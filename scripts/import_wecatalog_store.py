from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import json
import mimetypes
import posixpath
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data" / "wecatalog"
APP_DATA_DIR = ROOT / "app" / "data"
PUBLIC_DIR = ROOT / "public" / "wecatalog-gallery"
PUBLIC_PRICE_LABEL = "Price on Request"

DEFAULT_STORE_URL = "https://www.wecatalog.cn/weshop/store/A202006301754324710116144?groupIds=&tagWayType=0"
USER_AGENT = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 MicroMessenger/8.0"

WATCH_BRANDS = {
    "rolex": ["rolex", "劳力士"],
    "omega": ["omega", "欧米茄"],
    "cartier": ["cartier", "卡地亚"],
    "ap": ["ap", "audemars", "爱彼"],
    "patek philippe": ["patek", "philippe", "百达翡丽"],
}

WATCH_COLLECTIONS = {
    "Rolex": ["submariner", "daytona", "gmt-master", "gmt", "datejust", "day-date", "yacht-master", "sea-dweller", "explorer"],
    "Omega": ["seamaster", "speedmaster", "constellation", "deville", "de ville"],
    "Cartier": ["santos", "tank", "ballon bleu", "panthere", "pasha"],
    "AP": ["royal oak", "offshore", "code 11.59"],
    "Patek Philippe": ["nautilus", "aquanaut", "calatrava", "complications"],
}

TAG_BRAND_ALIASES = {
    "路易威登": "Louis Vuitton",
    "lv": "Louis Vuitton",
    "迪奥": "Dior",
    "dior": "Dior",
    "香奈儿": "Chanel",
    "chanel": "Chanel",
    "巴黎世家": "Balenciaga",
    "圣罗兰": "Saint Laurent",
    "ysl": "Saint Laurent",
    "赛琳": "Celine",
    "塞琳": "Celine",
    "celine": "Celine",
    "罗意威": "Loewe",
    "loewe": "Loewe",
    "普拉达": "Prada",
    "prada": "Prada",
    "爱马仕": "Hermes",
    "hermes": "Hermes",
    "芬迪": "Fendi",
    "fendi": "Fendi",
    "古驰": "Gucci",
    "gucci": "Gucci",
    "宝格丽": "Bvlgari",
    "bvlgari": "Bvlgari",
    "卡地亚": "Cartier",
    "cartier": "Cartier",
}


def clean(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def slugify(value: str) -> str:
    value = value.lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-") or "item"


def store_id_from_url(url: str) -> str:
    match = re.search(r"/store/([^/?#]+)", url)
    if not match:
        raise ValueError(f"Could not find WeCatalog store id in URL: {url}")
    return match.group(1)


def canonical_image_url(url: str) -> str:
    url = (url or "").split("?", 1)[0]
    return url.replace("cmp_", "")


def image_extension(url: str, content_type: str = "") -> str:
    suffix = Path(urllib.parse.urlparse(url).path).suffix.lower()
    if suffix in {".jpg", ".jpeg", ".png", ".webp", ".gif"}:
        return suffix
    guessed = mimetypes.guess_extension(content_type.split(";", 1)[0].strip()) if content_type else None
    return guessed or ".jpg"


class WeCatalogClient:
    def __init__(self, store_url: str) -> None:
        self.store_url = store_url
        self.store_id = store_id_from_url(store_url)
        self.origin = "https://www.wecatalog.cn"
        self.token = ""

    def request(self, path: str, *, method: str = "GET", params: dict[str, Any] | None = None, data: Any = None, timeout: int = 15) -> Any:
        url = self.origin + path
        if params:
            url += ("&" if "?" in url else "?") + urllib.parse.urlencode(params)
        headers = {
            "User-Agent": USER_AGENT,
            "Referer": self.store_url,
            "Accept": "application/json,text/plain,*/*",
        }
        if self.token:
            headers["Cookie"] = f"token={self.token}"
        body = None
        if data is not None:
            body = json.dumps(data, ensure_ascii=False).encode("utf-8")
            headers["Content-Type"] = "application/json;charset=UTF-8"
        request = urllib.request.Request(url, data=body, headers=headers, method=method)
        with urllib.request.urlopen(request, timeout=timeout) as response:
            payload = response.read().decode("utf-8")
        return json.loads(payload)

    def open_public_store(self) -> None:
        request = urllib.request.Request(self.store_url, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(request, timeout=30) as response:
            headers = response.headers
            body = response.read(20000).decode("utf-8", errors="ignore")
        cookie = headers.get("Set-Cookie", "")
        match = re.search(r"token=([^;]+)", cookie)
        if match:
            self.token = match.group(1)
        if "id=\"container\"" not in body:
            raise RuntimeError("The public store page did not return the expected WeCatalog app shell.")

    def list_products(self, *, tag_id: str = "", slip_type: int | None = None, timestamp: Any = "", timeout: int = 15) -> Any:
        params: dict[str, Any] = {
            "albumId": self.store_id,
            "startDate": "",
            "endDate": "",
            "requestDataType": "",
        }
        if tag_id:
            params["tagList"] = tag_id
        if slip_type is not None:
            params["slipType"] = slip_type
            params["timestamp"] = timestamp
        return self.request("/album/personal/all?", method="POST", params=params, timeout=timeout)

    def detail(self, goods_id: str) -> Any:
        return self.request(
            "/commodity/view",
            params={"targetAlbumId": self.store_id, "itemId": goods_id, "t": int(time.time() * 1000)},
        )

    def template(self) -> Any:
        return self.request("/album/api/v3/decorate/getAlbumShopTemplateInfo", params={"targetAlbumId": self.store_id, "deviceType": "net"})

    def filter_config(self) -> Any:
        return self.request("/album/api/v3/decorate/getAlbumShopFilterConfig", method="POST", params={"shopId": self.store_id})

    def source_tags(self) -> Any:
        return self.request(
            "/commodity/tags",
            params={"hasVideo": 0, "hideUnCategorized": "true", "albumId": self.store_id},
        )

    def download_image(self, url: str, destination: Path) -> tuple[str, str] | None:
        headers = {"User-Agent": USER_AGENT, "Referer": self.store_url}
        candidates = [canonical_image_url(url), (url or "").split("?", 1)[0]]
        for candidate in dict.fromkeys(candidate for candidate in candidates if candidate):
            try:
                request = urllib.request.Request(candidate, headers=headers)
                with urllib.request.urlopen(request, timeout=12) as response:
                    data = response.read()
                    content_type = response.headers.get("Content-Type", "")
                digest = hashlib.sha256(data).hexdigest()
                destination.parent.mkdir(parents=True, exist_ok=True)
                destination.write_bytes(data)
                if destination.suffix.lower() == ".tmp":
                    final = destination.with_suffix(image_extension(candidate, content_type))
                    destination.replace(final)
                    destination = final
                return "/" + posixpath.join(*destination.relative_to(ROOT / "public").parts), digest
            except (urllib.error.URLError, TimeoutError, OSError):
                continue
        return None


def extract_public_tags(template_payload: dict[str, Any]) -> list[dict[str, Any]]:
    raw = (template_payload.get("result") or {}).get("componentContent") or "[]"
    try:
        components = json.loads(raw)
    except json.JSONDecodeError:
        components = []
    tags: list[dict[str, Any]] = []
    seen: set[str] = set()
    for component in components:
        resource = (((component.get("comProps") or {}).get("resource") or {}).get("details") or [])
        for item in resource:
            if item.get("resType") != "res_tag":
                continue
            tag_id = clean(item.get("resId"))
            if not tag_id or tag_id in seen:
                continue
            seen.add(tag_id)
            tags.append(
                {
                    "tagId": tag_id,
                    "name": clean(item.get("resName")),
                    "icon": clean(item.get("resIcon")),
                    "sourceType": item.get("resType"),
                }
            )
    return tags


def parse_source_category_tree(source_tags_payload: dict[str, Any]) -> tuple[list[dict[str, Any]], dict[str, dict[str, Any]]]:
    result = source_tags_payload.get("result") or {}
    all_tags = {str(tag.get("tagId")): tag for tag in result.get("allTags") or [] if tag.get("tagId") is not None}
    groups: list[dict[str, Any]] = []
    tag_lookup: dict[str, dict[str, Any]] = {}
    used_tags: set[str] = set()

    for group_order, group in enumerate(result.get("tagGroups") or []):
        group_id = str(group.get("groupId"))
        children: list[dict[str, Any]] = []
        for tag_order, tag_id_raw in enumerate(group.get("childrenTag") or []):
            tag_id = str(tag_id_raw)
            tag = all_tags.get(tag_id)
            if not tag:
                continue
            used_tags.add(tag_id)
            child = {
                "id": f"tag:{tag_id}",
                "sourceId": tag_id,
                "type": "tag",
                "name": clean(tag.get("tagName")),
                "sourceName": clean(tag.get("tagName")),
                "parentId": f"group:{group_id}",
                "parentName": clean(group.get("groupName")),
                "path": [clean(group.get("groupName")), clean(tag.get("tagName"))],
                "order": tag_order,
                "raw": tag,
            }
            children.append(child)
            tag_lookup[tag_id] = child
        groups.append(
            {
                "id": f"group:{group_id}",
                "sourceId": group_id,
                "type": "group",
                "name": clean(group.get("groupName")),
                "sourceName": clean(group.get("groupName")),
                "path": [clean(group.get("groupName"))],
                "order": group_order,
                "children": children,
                "raw": group,
            }
        )

    standalone = []
    for tag_order, (tag_id, tag) in enumerate(all_tags.items()):
        if tag_id in used_tags:
            continue
        child = {
            "id": f"tag:{tag_id}",
            "sourceId": tag_id,
            "type": "tag",
            "name": clean(tag.get("tagName")),
            "sourceName": clean(tag.get("tagName")),
            "parentId": "group:standalone",
            "parentName": "Standalone",
            "path": ["Standalone", clean(tag.get("tagName"))],
            "order": tag_order,
            "raw": tag,
        }
        standalone.append(child)
        tag_lookup[tag_id] = child
    if standalone:
        groups.append(
            {
                "id": "group:standalone",
                "sourceId": "standalone",
                "type": "group",
                "name": "Standalone",
                "sourceName": "Standalone",
                "path": ["Standalone"],
                "order": len(groups),
                "children": standalone,
                "raw": {},
            }
        )

    return groups, tag_lookup


def iter_tag_categories(tree: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [child for group in tree for child in group.get("children", [])]


def fetch_products_for_tag(client: WeCatalogClient, tag_id: str, *, max_pages: int | None = None) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    products: list[dict[str, Any]] = []
    seen: set[str] = set()
    pages = 0
    pagination_exists = False
    complete = True
    timestamp: Any = ""
    slip_type: int | None = None
    while True:
        pages += 1
        payload = client.list_products(tag_id=tag_id, slip_type=slip_type, timestamp=timestamp, timeout=15)
        result = payload.get("result") or {}
        for item in result.get("items") or []:
            goods_id = clean(item.get("goods_id"))
            if goods_id and goods_id not in seen:
                seen.add(goods_id)
                products.append(item)
        pagination = result.get("pagination") or {}
        if pagination.get("isLoadMore"):
            pagination_exists = True
        if not pagination.get("isLoadMore"):
            break
        if max_pages and pages >= max_pages:
            complete = False
            break
        slip_type = 1
        timestamp = pagination.get("pageTimestamp") or 1
    return products, {"pages": pages, "paginationExists": pagination_exists, "allPagesDiscovered": complete}


def discover_source_categories(client: WeCatalogClient, *, max_pages_per_category: int | None = None, workers: int = 6) -> dict[str, Any]:
    source_tags = client.source_tags()
    tree, tag_lookup = parse_source_category_tree(source_tags)
    product_index: dict[str, list[str]] = {}
    product_summaries: dict[str, dict[str, Any]] = {}
    inaccessible: list[dict[str, str]] = []
    category_counts: list[dict[str, Any]] = []
    tags = iter_tag_categories(tree)
    def discover_one(payload: tuple[int, dict[str, Any]]) -> tuple[int, dict[str, Any], list[str], dict[str, dict[str, Any]], dict[str, Any] | None]:
        index, tag = payload
        print(f"Discovering category {index}/{len(tags)}: {' > '.join(tag['path'])}", file=sys.stderr, flush=True)
        try:
            items, page_info = fetch_products_for_tag(client, tag["sourceId"], max_pages=max_pages_per_category)
            product_ids = []
            summaries: dict[str, dict[str, Any]] = {}
            for item in items:
                goods_id = clean(item.get("goods_id"))
                if not goods_id:
                    continue
                product_ids.append(goods_id)
                summaries[goods_id] = {
                    "goodsId": goods_id,
                    "productNumber": clean(item.get("mark_code") or item.get("goodsNum")),
                    "title": clean(item.get("title")),
                    "imageCountHint": len(item.get("imgsSrc") or item.get("imgs") or []),
                }
            count = (
                {
                    "categoryId": tag["id"],
                    "sourceId": tag["sourceId"],
                    "path": tag["path"],
                    "productCount": len(product_ids),
                    **page_info,
                }
            )
            return index, count, product_ids, summaries, None
        except Exception as error:
            inaccessible_item = {"categoryId": tag["id"], "path": " > ".join(tag["path"]), "error": str(error)}
            count = {
                "categoryId": tag["id"],
                "sourceId": tag["sourceId"],
                "path": tag["path"],
                "productCount": 0,
                "pages": 0,
                "paginationExists": False,
                "allPagesDiscovered": False,
            }
            return index, count, [], {}, inaccessible_item

    results: list[tuple[int, dict[str, Any], list[str], dict[str, dict[str, Any]], dict[str, Any] | None]] = []
    if workers <= 1:
        results = [discover_one((index, tag)) for index, tag in enumerate(tags, start=1)]
    else:
        with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as executor:
            futures = [executor.submit(discover_one, (index, tag)) for index, tag in enumerate(tags, start=1)]
            for future in concurrent.futures.as_completed(futures):
                results.append(future.result())

    for _, count, product_ids, summaries, inaccessible_item in sorted(results, key=lambda item: item[0]):
        product_index[count["categoryId"]] = product_ids
        product_summaries.update(summaries)
        category_counts.append(count)
        if inaccessible_item:
            inaccessible.append(inaccessible_item)

    report = {
        "source": "wecatalog",
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "storeUrl": client.store_url,
        "publicStoreId": client.store_id,
        "totalGroups": len(tree),
        "totalTags": len(tags),
        "totalCategoriesGroupsTags": len(tree) + len(tags),
        "uniqueProductsDiscovered": len(product_summaries),
        "categoryTree": tree,
        "categoryCounts": category_counts,
        "inaccessibleCategories": inaccessible,
        "pagination": {
            "categoriesWithPagination": sum(1 for item in category_counts if item["paginationExists"]),
            "allPaginatedCategoriesFullyDiscovered": all(item["allPagesDiscovered"] for item in category_counts),
            "maxPagesPerCategory": max_pages_per_category,
        },
    }
    return {
        "tree": tree,
        "tagLookup": tag_lookup,
        "productIndex": product_index,
        "productSummaries": product_summaries,
        "report": report,
    }


def write_discovery(discovery: dict[str, Any]) -> None:
    write_json("source_category_tree.json", discovery["tree"])
    write_json("source_category_product_index.json", discovery["productIndex"])
    write_json("source_product_summaries.json", discovery["productSummaries"])
    write_json("category_discovery_report.json", discovery["report"])


def categories_for_product(goods_id: str, product_index: dict[str, list[str]], tag_lookup: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    categories: list[dict[str, Any]] = []
    for category_id, product_ids in product_index.items():
        if goods_id not in product_ids:
            continue
        source_id = category_id.split(":", 1)[1] if ":" in category_id else category_id
        category = tag_lookup.get(source_id)
        if category:
            categories.append(category)
    return sorted(categories, key=lambda item: (item.get("parentName", ""), item.get("order", 0)))


def select_category_test_products(discovery: dict[str, Any], limit: int) -> list[dict[str, Any]]:
    tree = discovery["tree"]
    product_index = discovery["productIndex"]
    product_summaries = discovery["productSummaries"]
    selected_product_ids: set[str] = set()
    selections: list[dict[str, Any]] = []

    all_tags = iter_tag_categories(tree)
    preferred = [tag for tag in all_tags if tag.get("parentName") == "高端腕表"]
    candidates = preferred + [tag for tag in all_tags if tag not in preferred]
    for tag in candidates:
        product_ids = product_index.get(tag["id"], [])
        if not product_ids:
            continue
        goods_id = next((item_id for item_id in product_ids if item_id not in selected_product_ids), "")
        if not goods_id:
            continue
        selected_product_ids.add(goods_id)
        summary = product_summaries.get(goods_id, {"goodsId": goods_id})
        selections.append(
            {
                "selectionCategory": tag,
                "goodsId": goods_id,
                "summary": summary,
            }
        )
        if len(selections) >= limit:
            break
    return selections


def run_category_test_import(client: WeCatalogClient, discovery: dict[str, Any], *, limit: int, download_images: bool) -> dict[str, Any]:
    selections = select_category_test_products(discovery, limit)
    products: list[dict[str, Any]] = []
    images: list[dict[str, Any]] = []
    failures: list[dict[str, str]] = []
    for index, selection in enumerate(selections, start=1):
        goods_id = selection["goodsId"]
        print(
            f"Importing category test product {index}/{len(selections)}: {' > '.join(selection['selectionCategory']['path'])} -> {goods_id}",
            file=sys.stderr,
            flush=True,
        )
        try:
            detail = client.detail(goods_id)
            categories = categories_for_product(goods_id, discovery["productIndex"], discovery["tagLookup"])
            product, product_images = build_product(
                client,
                {"goods_id": goods_id, "mark_code": selection["summary"].get("productNumber"), "title": selection["summary"].get("title")},
                detail,
                categories,
                download_images=download_images,
            )
            product["testSelectionCategory"] = {
                "sourceCategory": selection["selectionCategory"]["path"],
                "websiteCategory": selection["selectionCategory"]["path"],
            }
            products.append(product)
            images.extend(product_images)
        except Exception as error:
            failures.append({"goodsId": goods_id, "category": " > ".join(selection["selectionCategory"]["path"]), "error": str(error)})

    catalog = build_indexes(products, images, {"targetAlbum": {"id": client.store_id, "name": ""}, "publicStoreId": client.store_id}, discovery["report"]["categoryTree"])
    report = {
        "storeUrl": client.store_url,
        "publicStoreId": client.store_id,
        "mode": "category-mapping-test",
        "requestedLimit": limit,
        "selected": len(selections),
        "imported": len(products),
        "failed": len(failures),
        "failures": failures,
        "classificationRule": "1:1 copy from WeCatalog source category/tag/group membership. No title/image inference.",
        "results": [
            {
                "sourceCategory": product.get("testSelectionCategory", {}).get("sourceCategory", product.get("categoryPath")),
                "websiteCategory": product.get("testSelectionCategory", {}).get("websiteCategory", product.get("categoryPath")),
                "allSourceCategories": [item["path"] for item in product.get("sourceCategories", [])],
                "productNumber": product.get("productNumber"),
                "title": product.get("title"),
                "goodsId": product.get("id"),
                "imageCount": product.get("imageCount"),
            }
            for product in products
        ],
    }
    write_json("category_test_products.json", products)
    write_json("category_test_product_images.json", images)
    write_json("category_test_catalog.json", catalog)
    write_json("category_test_report.json", report)
    return report


def load_discovery_from_disk() -> dict[str, Any] | None:
    required = {
        "tree": DATA_DIR / "source_category_tree.json",
        "productIndex": DATA_DIR / "source_category_product_index.json",
        "productSummaries": DATA_DIR / "source_product_summaries.json",
        "report": DATA_DIR / "category_discovery_report.json",
    }
    if not all(path.exists() for path in required.values()):
        return None
    tree = json.loads(required["tree"].read_text(encoding="utf-8"))
    _, tag_lookup = parse_source_category_tree({"result": {"allTags": [], "tagGroups": []}})
    tag_lookup = {child["sourceId"]: child for child in iter_tag_categories(tree)}
    return {
        "tree": tree,
        "tagLookup": tag_lookup,
        "productIndex": json.loads(required["productIndex"].read_text(encoding="utf-8")),
        "productSummaries": json.loads(required["productSummaries"].read_text(encoding="utf-8")),
        "report": json.loads(required["report"].read_text(encoding="utf-8")),
    }


def save_full_import_checkpoint(products: list[dict[str, Any]], images: list[dict[str, Any]], failed: list[dict[str, str]], processed: set[str]) -> None:
    write_json("products.json", products)
    write_json("product_images.json", images)
    write_json("full_import_failures.json", failed)
    write_json("full_import_state.json", {"processedGoodsIds": sorted(processed), "updatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())})


def load_full_import_checkpoint() -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, str]], set[str]]:
    products_path = DATA_DIR / "products.json"
    images_path = DATA_DIR / "product_images.json"
    failures_path = DATA_DIR / "full_import_failures.json"
    state_path = DATA_DIR / "full_import_state.json"
    products = json.loads(products_path.read_text(encoding="utf-8")) if products_path.exists() else []
    images = json.loads(images_path.read_text(encoding="utf-8")) if images_path.exists() else []
    failures = json.loads(failures_path.read_text(encoding="utf-8")) if failures_path.exists() else []
    state = json.loads(state_path.read_text(encoding="utf-8")) if state_path.exists() else {}
    return products, images, failures, set(state.get("processedGoodsIds") or [])


def run_full_category_import(client: WeCatalogClient, discovery: dict[str, Any], *, download_images: bool, resume: bool, workers: int) -> dict[str, Any]:
    product_ids = sorted(discovery["productSummaries"].keys())
    products, images, failures, processed = load_full_import_checkpoint() if resume else ([], [], [], set())
    existing_by_id = {product["id"]: product for product in products if product.get("id")}
    existing_images_by_product = {}
    for image in images:
        existing_images_by_product.setdefault(image.get("productId"), []).append(image)

    pending = [(index, goods_id) for index, goods_id in enumerate(product_ids, start=1) if goods_id not in processed]

    def import_one(payload: tuple[int, str]) -> tuple[int, str, dict[str, Any] | None, list[dict[str, Any]], dict[str, str] | None]:
        index, goods_id = payload
        summary = discovery["productSummaries"].get(goods_id) or {"goodsId": goods_id}
        categories = categories_for_product(goods_id, discovery["productIndex"], discovery["tagLookup"])
        try:
            if index <= 20 or index % 100 == 0:
                print(
                    f"Full import {index}/{len(product_ids)}: {goods_id} | categories: {len(categories)}",
                    file=sys.stderr,
                    flush=True,
                )
            detail = client.detail(goods_id)
            product, product_images = build_product(
                client,
                {"goods_id": goods_id, "mark_code": summary.get("productNumber"), "title": summary.get("title")},
                detail,
                categories,
                download_images=download_images,
            )
            return index, goods_id, product, product_images, None
        except Exception as error:
            failure = {"goodsId": goods_id, "error": str(error), "categories": [category["path"] for category in categories]}
            return index, goods_id, None, [], failure

    start_time = time.time()
    completed_since_checkpoint = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, workers)) as executor:
        pending_iter = iter(pending)
        future_to_payload: dict[concurrent.futures.Future, tuple[int, str]] = {}
        max_in_flight = max(1, workers) * 4

        def submit_next() -> None:
            try:
                payload = next(pending_iter)
            except StopIteration:
                return
            future_to_payload[executor.submit(import_one, payload)] = payload

        for _ in range(max_in_flight):
            submit_next()

        while future_to_payload:
            done, _ = concurrent.futures.wait(future_to_payload, return_when=concurrent.futures.FIRST_COMPLETED)
            for future in done:
                _, fallback_goods_id = future_to_payload.pop(future)
                try:
                    _, goods_id, product, product_images, failure = future.result()
                except Exception as error:
                    goods_id = fallback_goods_id
                    product = None
                    product_images = []
                    failure = {"goodsId": goods_id, "error": str(error), "categories": []}

                if product:
                    existing_by_id[goods_id] = product
                    existing_images_by_product[goods_id] = product_images
                if failure:
                    failures.append(failure)
                processed.add(goods_id)
                completed_since_checkpoint += 1

                if completed_since_checkpoint >= 100:
                    products = sorted(existing_by_id.values(), key=lambda item: (item.get("categoryPath", []), item.get("productNumber", "")))
                    images = [image for product_id in sorted(existing_images_by_product) for image in existing_images_by_product[product_id]]
                    save_full_import_checkpoint(products, images, failures, processed)
                    elapsed = max(time.time() - start_time, 1)
                    print(
                        f"Checkpoint: processed {len(processed)}/{len(product_ids)}; imported {len(existing_by_id)}; images {len(images)}; failed {len(failures)}; rate {len(processed)/elapsed:.2f}/s",
                        file=sys.stderr,
                        flush=True,
                    )
                    completed_since_checkpoint = 0
                submit_next()

    products = sorted(existing_by_id.values(), key=lambda item: (item.get("categoryPath", []), item.get("productNumber", "")))
    images = [image for product_id in sorted(existing_images_by_product) for image in existing_images_by_product[product_id]]
    catalog = build_indexes(products, images, {"targetAlbum": {"id": client.store_id, "name": ""}, "publicStoreId": client.store_id}, discovery["report"]["categoryTree"])
    report = {
        "storeUrl": client.store_url,
        "publicStoreId": client.store_id,
        "mode": "full-category-import",
        "classificationRule": "1:1 copy from WeCatalog source category/tag/group membership. No title/image inference.",
        "totalCategoriesGroupsTags": discovery["report"]["totalCategoriesGroupsTags"],
        "totalGroups": discovery["report"]["totalGroups"],
        "totalTags": discovery["report"]["totalTags"],
        "productsDiscovered": len(product_ids),
        "productsImported": len(products),
        "imagesImported": len([image for image in images if image.get("localPath") or image.get("sourceUrl")]),
        "localImagesDownloaded": len([image for image in images if image.get("localPath")]),
        "failed": len(failures),
        "failures": failures[:500],
        "truncatedFailures": max(0, len(failures) - 500),
        "inaccessibleCategories": discovery["report"].get("inaccessibleCategories", []),
        "pagination": discovery["report"].get("pagination", {}),
    }
    write_catalog_dataset(catalog, products, images, report)
    save_full_import_checkpoint(products, images, failures, processed)
    return report


def infer_from_text(title: str, source_tags: list[str]) -> dict[str, Any]:
    text = f"{title} {' '.join(source_tags)}".lower()
    for canonical, aliases in WATCH_BRANDS.items():
        if any(alias in text for alias in aliases):
            brand = {"rolex": "Rolex", "omega": "Omega", "cartier": "Cartier", "ap": "AP", "patek philippe": "Patek Philippe"}[canonical]
            collection = "Unclassified"
            for candidate in WATCH_COLLECTIONS[brand]:
                if candidate in text:
                    collection = candidate.title().replace("Gmt", "GMT")
                    break
            return {
                "brand": brand,
                "collection": collection,
                "series": collection,
                "modelStyle": collection,
                "confidence": "medium" if collection != "Unclassified" else "low",
                "needsReview": collection == "Unclassified",
            }

    normalized_text = re.sub(r"[\s.*]+", "", text)
    for alias, brand in TAG_BRAND_ALIASES.items():
        if alias.lower() in normalized_text:
            return {
                "brand": brand,
                "collection": "Unclassified",
                "series": "Unclassified",
                "modelStyle": "Unclassified",
                "confidence": "low",
                "needsReview": True,
            }

    return {
        "brand": "Unclassified",
        "collection": "Unclassified",
        "series": "Unclassified",
        "modelStyle": "Unclassified",
        "confidence": "none",
        "needsReview": True,
    }


def collect_items(client: WeCatalogClient, limit: int | None) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    products: list[dict[str, Any]] = []
    seen: set[str] = set()
    page = client.list_products()
    result = page.get("result") or {}
    first_meta = {
        "targetAlbum": result.get("targetAlbum") or {},
        "album": result.get("album") or {},
        "pagination": result.get("pagination") or {},
    }
    while True:
        for item in result.get("items") or []:
            goods_id = clean(item.get("goods_id"))
            if goods_id and goods_id not in seen:
                seen.add(goods_id)
                products.append(item)
                if limit and len(products) >= limit:
                    return products, first_meta
        pagination = result.get("pagination") or {}
        if not pagination.get("isLoadMore"):
            return products, first_meta
        page = client.list_products(slip_type=1, timestamp=pagination.get("pageTimestamp") or 1)
        result = page.get("result") or {}


def map_tags_for_items(client: WeCatalogClient, tags: list[dict[str, Any]], item_ids: set[str], max_tags: int) -> dict[str, list[str]]:
    mapping: dict[str, list[str]] = {item_id: [] for item_id in item_ids}
    remaining = set(item_ids)
    for index, tag in enumerate(tags[:max_tags], start=1):
        if not remaining:
            break
        print(f"Scanning public tag {index}/{min(max_tags, len(tags))}: {tag['name']}", file=sys.stderr, flush=True)
        try:
            payload = client.list_products(tag_id=tag["tagId"], timeout=10)
        except Exception:
            continue
        for item in (payload.get("result") or {}).get("items") or []:
            goods_id = clean(item.get("goods_id"))
            if goods_id in mapping and tag["name"] not in mapping[goods_id]:
                mapping[goods_id].append(tag["name"])
                remaining.discard(goods_id)
    return mapping


def price_payload(commodity: dict[str, Any]) -> dict[str, Any]:
    return {
        "optimaPrice": commodity.get("optimaPrice") or "",
        "itemPrice": commodity.get("itemPrice") or "",
        "priceArr": commodity.get("priceArr") or [],
        "skuPriceMap": commodity.get("skuPriceMap") or {},
    }


def source_url(store_id: str, goods_id: str) -> str:
    return f"https://www.wecatalog.cn/weshop/goods/{store_id}/{goods_id}"


def build_product(
    client: WeCatalogClient,
    item: dict[str, Any],
    detail_payload: dict[str, Any],
    source_categories: list[dict[str, Any]],
    *,
    download_images: bool,
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    commodity = (detail_payload.get("result") or {}).get("commodity") or item
    goods_id = clean(commodity.get("goods_id") or item.get("goods_id"))
    product_number = clean(commodity.get("mark_code") or commodity.get("goodsNum") or goods_id)
    title = clean(commodity.get("title") or item.get("title"))
    primary_category = source_categories[0] if source_categories else {
        "path": ["Uncategorized"],
        "parentName": "Uncategorized",
        "name": "Uncategorized",
        "sourceId": "",
        "id": "uncategorized",
    }
    image_urls = [canonical_image_url(url) for url in (commodity.get("imgsSrc") or commodity.get("imgs") or item.get("imgsSrc") or item.get("imgs") or []) if clean(url)]
    image_urls = list(dict.fromkeys(image_urls))

    product_dir = PUBLIC_DIR / slugify(client.store_id) / slugify(goods_id)
    image_records: list[dict[str, Any]] = []
    gallery: list[str] = []
    for index, image_url in enumerate(image_urls, start=1):
        public_path = image_url
        image_hash = ""
        if download_images:
            tmp = product_dir / f"{index:02d}.tmp"
            downloaded = client.download_image(image_url, tmp)
            if downloaded:
                public_path, image_hash = downloaded
        gallery.append(public_path)
        image_records.append(
            {
                "productId": goods_id,
                "position": index,
                "sourceUrl": image_url,
                "localPath": public_path if public_path.startswith("/") else "",
                "imageHash": image_hash,
            }
        )

    description_parts = [clean(commodity.get("subTitle"))]
    for note in commodity.get("noteArr") or []:
        if isinstance(note, dict):
            description_parts.append(clean(note.get("value")))
    description = "\n".join(part for part in description_parts if part)
    brand = primary_category["path"][0]
    collection = primary_category["path"][1] if len(primary_category["path"]) > 1 else primary_category["path"][0]
    series = collection
    model_style = collection
    version = collection
    slug = f"wecatalog-{slugify(product_number)}-{slugify(goods_id[-8:])}"

    product = {
        "id": goods_id,
        "albumId": goods_id,
        "source": "wecatalog",
        "sourceStoreId": client.store_id,
        "sourceUrl": source_url(client.store_id, goods_id),
        "yupooUrl": source_url(client.store_id, goods_id),
        "slug": slug,
        "productNumber": product_number,
        "itemCode": product_number,
        "title": title,
        "description": description,
        "brand": brand,
        "exactBrand": brand,
        "collection": collection,
        "series": series,
        "modelStyle": model_style,
        "version": version,
        "categoryPath": primary_category["path"],
        "exactCategoryName": " > ".join(primary_category["path"]),
        "sourceCategories": [
            {
                "categoryId": category["id"],
                "sourceId": category["sourceId"],
                "sourceName": category["sourceName"],
                "path": category["path"],
            }
            for category in source_categories
        ],
        "websiteCategories": [category["path"] for category in source_categories],
        "sourceTags": [category["sourceName"] for category in source_categories],
        "classificationSource": "wecatalog-source-category",
        "classificationConfidence": "source",
        "needsReview": not source_categories,
        "coverImage": gallery[0] if gallery else "",
        "galleryImages": gallery,
        "imageCount": len(gallery),
        "priceInternal": price_payload(commodity),
        "internalPrice": None,
        "publicPriceLabel": PUBLIC_PRICE_LABEL,
        "specs": [],
        "size": "",
        "movement": "",
        "updatedAtSource": commodity.get("update_time") or commodity.get("time_stamp") or item.get("time_stamp"),
        "raw": {
            "goods_id": goods_id,
            "shop_id": commodity.get("shop_id"),
            "parent_goods_id": commodity.get("parent_goods_id"),
        },
        "searchText": " ".join([product_number, title, brand, collection, series, " ".join(category["sourceName"] for category in source_categories)]).lower(),
    }
    return product, image_records


def build_indexes(products: list[dict[str, Any]], images: list[dict[str, Any]], meta: dict[str, Any], tags: list[dict[str, Any]]) -> dict[str, Any]:
    brands = []
    for brand in sorted({product["brand"] for product in products}):
        brand_products = [product for product in products if product["brand"] == brand]
        brands.append(
            {
                "name": brand,
                "slug": slugify(brand),
                "productCount": len(brand_products),
                "collections": sorted({product["collection"] for product in brand_products}),
            }
        )
    collections = []
    for brand, collection in sorted({(product["brand"], product["collection"]) for product in products}):
        collection_products = [product for product in products if product["brand"] == brand and product["collection"] == collection]
        collections.append(
            {
                "brand": brand,
                "name": collection,
                "slug": slugify(f"{brand}-{collection}"),
                "productCount": len(collection_products),
                "series": sorted({product["series"] for product in collection_products}),
                "versions": sorted({product["version"] for product in collection_products}),
                "models": sorted({product["modelStyle"] for product in collection_products}),
            }
        )
    category_counts = []
    for category in iter_tag_categories(tags):
        path = category.get("path") or []
        category_counts.append(
            {
                "id": category.get("id"),
                "path": path,
                "albumCount": sum(1 for product in products if path in product.get("websiteCategories", [])),
            }
        )
    return {
        "source": "wecatalog",
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "store": {
            "id": meta.get("targetAlbum", {}).get("id"),
            "publicStoreId": meta.get("publicStoreId"),
            "name": meta.get("targetAlbum", {}).get("name"),
            "newItemCount": meta.get("targetAlbum", {}).get("newItemCount"),
            "totalItemCount": meta.get("targetAlbum", {}).get("totalItemCount"),
        },
        "stats": {
            "totalBrands": len(brands),
            "totalCollections": len(collections),
            "totalProducts": len(products),
            "totalImages": len(images),
            "unclassified": sum(1 for product in products if product.get("needsReview")),
            "unassignedProducts": sum(1 for product in products if product.get("needsReview")),
            "publicCategories": len(tags) + len(iter_tag_categories(tags)),
            "sourceGroups": len(tags),
            "sourceTags": len(iter_tag_categories(tags)),
        },
        "categoryCounts": category_counts,
        "unassignedAlbumIds": [product["id"] for product in products if product.get("needsReview")],
        "publicCategories": tags,
        "brands": brands,
        "collections": collections,
        "products": products,
        "product_images": images,
    }


def write_json(name: str, payload: Any) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    (DATA_DIR / name).write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def write_app_json(name: str, payload: Any) -> None:
    APP_DATA_DIR.mkdir(parents=True, exist_ok=True)
    (APP_DATA_DIR / name).write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def write_catalog_dataset(catalog: dict[str, Any], products: list[dict[str, Any]], images: list[dict[str, Any]], report: dict[str, Any]) -> None:
    write_json("brands.json", catalog["brands"])
    write_json("collections.json", catalog["collections"])
    write_json("products.json", products)
    write_json("product_images.json", images)
    write_json("catalog.json", catalog)
    write_json("full_import_report.json", report)
    app_products = [
        {
            "albumId": product.get("albumId"),
            "slug": product.get("slug"),
            "productNumber": product.get("productNumber"),
            "brand": product.get("brand"),
            "exactBrand": product.get("exactBrand"),
            "collection": product.get("collection"),
            "series": product.get("series"),
            "version": product.get("version"),
            "categoryPath": product.get("categoryPath"),
            "exactCategoryName": product.get("exactCategoryName"),
            "coverImage": product.get("coverImage"),
            "galleryImages": product.get("galleryImages"),
            "imageCount": product.get("imageCount"),
            "yupooUrl": product.get("yupooUrl"),
            "internalPrice": product.get("internalPrice"),
            "publicPriceLabel": product.get("publicPriceLabel"),
            "description": product.get("description"),
            "specs": product.get("specs"),
            "size": product.get("size"),
            "movement": product.get("movement"),
            "searchText": product.get("searchText"),
        }
        for product in products
    ]
    app_catalog = {
        key: value
        for key, value in catalog.items()
        if key not in {"products", "product_images"}
    }
    app_catalog["products"] = []
    write_app_json("brands.json", catalog["brands"])
    write_app_json("collections.json", catalog["collections"])
    write_app_json("products.json", app_products)
    write_app_json("catalog.json", app_catalog)


def load_existing_products() -> list[dict[str, Any]]:
    path = DATA_DIR / "products.json"
    if not path.exists():
        return []
    return json.loads(path.read_text(encoding="utf-8"))


def merge_incremental(existing: list[dict[str, Any]], imported: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], dict[str, int]]:
    by_id = {product["id"]: product for product in existing if product.get("id")}
    seen_numbers = {clean(product.get("productNumber")) for product in existing if clean(product.get("productNumber"))}
    stats = {"imported": 0, "updated": 0, "duplicatesSkipped": 0}
    for product in imported:
        current = by_id.get(product["id"])
        if current:
            current.update(product)
            stats["updated"] += 1
            continue
        product_number = clean(product.get("productNumber"))
        if product_number and product_number in seen_numbers:
            stats["duplicatesSkipped"] += 1
            continue
        by_id[product["id"]] = product
        seen_numbers.add(product_number)
        stats["imported"] += 1
    return sorted(by_id.values(), key=lambda item: (item.get("brand", ""), item.get("collection", ""), item.get("productNumber", ""))), stats


def run_import(args: argparse.Namespace) -> dict[str, Any]:
    client = WeCatalogClient(args.store_url)
    client.open_public_store()
    template = client.template()
    filter_config = client.filter_config()
    tags = extract_public_tags(template)
    items, meta = collect_items(client, args.limit)
    meta["publicStoreId"] = client.store_id
    item_ids = {clean(item.get("goods_id")) for item in items if clean(item.get("goods_id"))}
    tag_map = map_tags_for_items(client, tags, item_ids, args.tag_probe_limit) if args.map_tags else {item_id: [] for item_id in item_ids}

    products: list[dict[str, Any]] = []
    images: list[dict[str, Any]] = []
    failures: list[dict[str, str]] = []
    seen_hashes: set[str] = set()
    for item in items:
        goods_id = clean(item.get("goods_id"))
        try:
            print(f"Importing product {len(products) + 1}/{len(items)}: {goods_id}", file=sys.stderr, flush=True)
            detail = client.detail(goods_id)
            source_categories = [
                {
                    "id": f"legacy-tag:{name}",
                    "sourceId": name,
                    "sourceName": name,
                    "parentName": "Legacy",
                    "name": name,
                    "path": ["Legacy", name],
                    "order": index,
                }
                for index, name in enumerate(tag_map.get(goods_id, []))
            ]
            product, product_images = build_product(client, item, detail, source_categories, download_images=not args.no_download_images)
            duplicate_hash = False
            for image in product_images:
                image_hash = image.get("imageHash")
                if image_hash and image_hash in seen_hashes:
                    duplicate_hash = True
                if image_hash:
                    seen_hashes.add(image_hash)
            product["hasDuplicateImageHash"] = duplicate_hash
            products.append(product)
            images.extend(product_images)
        except Exception as error:
            failures.append({"goodsId": goods_id, "error": str(error)})

    existing = [] if args.replace else load_existing_products()
    merged_products, merge_stats = merge_incremental(existing, products)
    merged_images = images
    catalog = build_indexes(merged_products, merged_images, meta, tags)
    unclassified = [product for product in merged_products if product.get("needsReview")]
    report = {
        "storeUrl": args.store_url,
        "publicStoreId": client.store_id,
        "storeName": meta.get("targetAlbum", {}).get("name"),
        "accessibleProductsApprox": meta.get("targetAlbum", {}).get("newItemCount"),
        "publicCategories": len(tags),
        "filterConfig": filter_config.get("result"),
        "requestedLimit": args.limit,
        "fetchedForThisRun": len(items),
        "processedThisRun": len(products),
        **merge_stats,
        "unclassified": len(unclassified),
        "failed": len(failures),
        "failures": failures,
    }

    write_json("brands.json", catalog["brands"])
    write_json("collections.json", catalog["collections"])
    write_json("products.json", merged_products)
    write_json("product_images.json", merged_images)
    write_json("catalog.json", catalog)
    write_json("public_categories.json", tags)
    write_json("unclassified.json", unclassified)
    write_json("import_report.json", report)
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description="Import public products from a WeCatalog store.")
    parser.add_argument("--store-url", default=DEFAULT_STORE_URL)
    parser.add_argument("--limit", type=int, default=20, help="Limit products for test import. Use 0 for all accessible products.")
    parser.add_argument("--replace", action="store_true", help="Replace data/wecatalog instead of incrementally merging.")
    parser.add_argument("--no-download-images", action="store_true", help="Keep source image URLs instead of downloading to public/wecatalog-gallery.")
    parser.add_argument("--map-tags", action="store_true", help="Map imported items to public tag categories by probing tag-filtered public lists.")
    parser.add_argument("--tag-probe-limit", type=int, default=40, help="Maximum public tags to probe during test classification.")
    parser.add_argument("--discover-categories", action="store_true", help="Discover the full public WeCatalog source category/tag/group tree and product counts.")
    parser.add_argument("--category-test", action="store_true", help="After discovery, import a small test set selected from different source categories.")
    parser.add_argument("--full-category-import", action="store_true", help="Import all discovered accessible products using exact source category membership.")
    parser.add_argument("--resume", action="store_true", help="Resume a previous full category import checkpoint.")
    parser.add_argument("--max-pages-per-category", type=int, default=0, help="Limit pages per category during discovery. 0 means discover all pages.")
    parser.add_argument("--workers", type=int, default=6, help="Concurrent public category requests during discovery.")
    args = parser.parse_args()
    if args.limit == 0:
        args.limit = None
    if args.full_category_import:
        client = WeCatalogClient(args.store_url)
        client.open_public_store()
        discovery = load_discovery_from_disk()
        if discovery is None or args.discover_categories:
            max_pages = args.max_pages_per_category or None
            discovery = discover_source_categories(client, max_pages_per_category=max_pages, workers=args.workers)
            write_discovery(discovery)
        report = run_full_category_import(client, discovery, download_images=not args.no_download_images, resume=args.resume, workers=args.workers)
        print(json.dumps(report, ensure_ascii=False, indent=2))
        return
    if args.discover_categories or args.category_test:
        client = WeCatalogClient(args.store_url)
        client.open_public_store()
        max_pages = args.max_pages_per_category or None
        discovery = discover_source_categories(client, max_pages_per_category=max_pages, workers=args.workers)
        write_discovery(discovery)
        if args.category_test:
            report = run_category_test_import(client, discovery, limit=args.limit or 20, download_images=not args.no_download_images)
        else:
            report = discovery["report"]
        print(json.dumps(report, ensure_ascii=False, indent=2))
        return
    report = run_import(args)
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
