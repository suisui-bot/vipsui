#!/usr/bin/env python3
from __future__ import annotations

import concurrent.futures
import json
import re
import subprocess
import sys
import time
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from import_wecatalog_store import canonical_image_url, clean, slugify  # noqa: E402

WATCH_TOP_CATEGORY = "高端腕表"
STORE_ID = "A202006301754324710116144"
WECATALOG_DIR = ROOT / "data" / "wecatalog"
APP_DATA_DIR = ROOT / "app" / "data"
SHARDS_DIR = ROOT / "public" / "product-shards"
REPORT_PATH = WECATALOG_DIR / "watch_catalog_sync_report.json"
MEDIA_UNAVAILABLE_COVER = "/media-unavailable.svg"


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: Any, *, compact: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(
            payload,
            ensure_ascii=False,
            indent=None if compact else 2,
            separators=(",", ":") if compact else None,
        ),
        encoding="utf-8",
    )


def media_id(url: str, prefix: str) -> str:
    parsed = re.sub(r"[^a-zA-Z0-9]+", "-", url.split("?", 1)[0]).strip("-")
    return f"{prefix}:{parsed[-96:]}"


def normalize_video_url(url: str) -> str:
    return (url or "").split("?", 1)[0].strip()


def source_url(goods_id: str) -> str:
    return f"https://www.wecatalog.cn/weshop/goods/{STORE_ID}/{goods_id}"


def watch_tags(tree: list[dict[str, Any]]) -> list[dict[str, Any]]:
    group = next((item for item in tree if item.get("name") == WATCH_TOP_CATEGORY), None)
    if not group:
        raise RuntimeError(f"Could not find WeCatalog group: {WATCH_TOP_CATEGORY}")
    return group.get("children") or []


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


def build_media(product: dict[str, Any], scanned: dict[str, Any]) -> tuple[list[dict[str, Any]], dict[str, int]]:
    commodity = (scanned or {}).get("commodity") or {}
    source_images = [
        canonical_image_url(url)
        for url in (commodity.get("imgsSrc") or commodity.get("imgs") or product.get("galleryImages") or [])
        if clean(url)
    ]
    video_url = normalize_video_url(clean(scanned.get("videoUrl") or commodity.get("videoUrl") or commodity.get("videoURL") or commodity.get("replayUrl")))
    poster = canonical_image_url(clean(scanned.get("videoPoster") or commodity.get("videoThumbImg")))

    media: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()
    exact_duplicate_images_removed = 0
    duplicate_poster_images_removed = 0
    inserted_video = False

    def add_video() -> None:
        nonlocal inserted_video
        if not video_url:
            return
        key = ("video", video_url)
        if key in seen:
            return
        seen.add(key)
        media.append({"type": "video", "url": video_url, "poster": poster, "sourceMediaId": media_id(video_url, "video")})
        inserted_video = True

    def add_image(url: str) -> None:
        nonlocal exact_duplicate_images_removed, duplicate_poster_images_removed
        normalized = canonical_image_url(url)
        if not normalized:
            return
        if video_url and poster and normalized == poster:
            duplicate_poster_images_removed += 1
            add_video()
            return
        key = ("image", normalized)
        if key in seen:
            exact_duplicate_images_removed += 1
            return
        seen.add(key)
        media.append({"type": "image", "url": normalized, "sourceMediaId": media_id(normalized, "image")})

    for image_url in source_images:
        add_image(image_url)
    if video_url and not inserted_video:
        media.insert(0, {"type": "video", "url": video_url, "poster": poster or product.get("coverImage") or "", "sourceMediaId": media_id(video_url, "video")})

    return media, {
        "exactDuplicateImagesRemoved": exact_duplicate_images_removed,
        "duplicatePosterImagesRemoved": duplicate_poster_images_removed,
    }


def rebuild_watch_product(product: dict[str, Any], categories: list[dict[str, Any]], scanned: dict[str, Any]) -> tuple[dict[str, Any], dict[str, int]]:
    primary = categories[0] if categories else {"path": [WATCH_TOP_CATEGORY, "Uncategorized"], "id": "", "sourceId": "", "sourceName": "Uncategorized"}
    category_path = primary.get("path") or [WATCH_TOP_CATEGORY, "Uncategorized"]
    collection = category_path[1] if len(category_path) > 1 else "Uncategorized"
    product_number = clean(product.get("productNumber") or product.get("itemCode") or product.get("id"))
    goods_id = clean(product.get("id") or product.get("albumId"))
    media, counts = build_media(product, scanned)
    image_media = [item for item in media if item.get("type") == "image"]
    video_media = [item for item in media if item.get("type") == "video"]
    cover = ""
    if media:
        first = media[0]
        cover = first.get("poster") if first.get("type") == "video" else first.get("url")
    cover = cover or product.get("coverImage") or MEDIA_UNAVAILABLE_COVER
    search_text = " ".join(
        [
            product_number,
            clean(product.get("title")),
            WATCH_TOP_CATEGORY,
            collection,
            collection,
            " ".join(category.get("sourceName", "") for category in categories),
        ]
    ).lower()
    rebuilt = dict(product)
    rebuilt.update(
        {
            "id": goods_id,
            "albumId": goods_id,
            "source": "wecatalog",
            "sourceStoreId": STORE_ID,
            "sourceUrl": source_url(goods_id),
            "yupooUrl": source_url(goods_id),
            "slug": f"wecatalog-{slugify(product_number)}-{slugify(goods_id[-8:])}",
            "productNumber": product_number,
            "itemCode": product_number,
            "brand": WATCH_TOP_CATEGORY,
            "exactBrand": WATCH_TOP_CATEGORY,
            "collection": collection,
            "series": collection,
            "modelStyle": collection,
            "version": collection,
            "categoryPath": category_path,
            "exactCategoryName": " > ".join(category_path),
            "sourceCategories": [
                {
                    "categoryId": category.get("id"),
                    "sourceId": category.get("sourceId"),
                    "sourceName": category.get("sourceName"),
                    "path": category.get("path"),
                }
                for category in categories
            ],
            "websiteCategories": [category.get("path") for category in categories],
            "sourceTags": [category.get("sourceName") for category in categories],
            "classificationSource": "wecatalog-source-category",
            "classificationConfidence": "source",
            "needsReview": not categories,
            "coverImage": cover,
            "galleryImages": [item["url"] for item in image_media],
            "galleryMedia": media,
            "imageCount": len(image_media),
            "videoCount": len(video_media),
            "mediaCount": len(media),
            "hasVideo": bool(video_media),
            "internalPrice": None,
            "publicPriceLabel": "Price on Request",
            "pricingStatus": "needs_review",
            "pricingSource": "wecatalog_price_on_request",
            "pricingCalculatedAt": None,
            "matchConfidence": "not_applicable",
            "priceLocked": False,
            "searchText": search_text,
        }
    )
    rebuilt.pop("pricingBreakdownInternal", None)
    return rebuilt, counts


def app_detail_product(product: dict[str, Any]) -> dict[str, Any]:
    fields = [
        "albumId",
        "slug",
        "productNumber",
        "brand",
        "exactBrand",
        "collection",
        "series",
        "version",
        "categoryPath",
        "exactCategoryName",
        "coverImage",
        "galleryImages",
        "galleryMedia",
        "imageCount",
        "videoCount",
        "mediaCount",
        "hasVideo",
        "yupooUrl",
        "internalPrice",
        "publicPriceLabel",
        "pricingStatus",
        "pricingSource",
        "priceLocked",
        "pricingCalculatedAt",
        "matchConfidence",
        "description",
        "specs",
        "size",
        "movement",
        "searchText",
    ]
    return {field: product.get(field) for field in fields}


def app_index_product(product: dict[str, Any]) -> dict[str, Any]:
    return {
        "albumId": product.get("albumId"),
        "slug": product.get("slug"),
        "productNumber": product.get("productNumber"),
        "brand": product.get("brand"),
        "collection": product.get("collection"),
        "series": product.get("series"),
        "version": product.get("version"),
        "categoryPath": product.get("categoryPath"),
        "coverImage": product.get("coverImage"),
        "imageCount": product.get("imageCount"),
        "videoCount": product.get("videoCount", 0),
        "mediaCount": product.get("mediaCount", product.get("imageCount", 0)),
        "hasVideo": bool(product.get("hasVideo")),
        "publicPriceLabel": product.get("publicPriceLabel"),
        "internalPrice": product.get("internalPrice"),
        "pricingStatus": product.get("pricingStatus"),
        "pricingSource": product.get("pricingSource"),
        "priceLocked": product.get("priceLocked", False),
        "pricingCalculatedAt": product.get("pricingCalculatedAt"),
        "matchConfidence": product.get("matchConfidence"),
        "searchText": product.get("searchText"),
    }


def load_all_shard_products() -> list[dict[str, Any]]:
    products: list[dict[str, Any]] = []
    for path in sorted(SHARDS_DIR.glob("*.json")):
        products.extend(load_json(path))
    return products


def write_shards(products: list[dict[str, Any]]) -> None:
    shards: dict[str, list[dict[str, Any]]] = {}
    for product in products:
        match = re.search(r"\d+", clean(product.get("productNumber")))
        shard = (match.group(0)[:3] if match else "misc") or "misc"
        shards.setdefault(shard, []).append(product)
    for path in SHARDS_DIR.glob("*.json"):
        path.unlink()
    for shard, items in shards.items():
        items.sort(key=lambda item: (clean(item.get("categoryPath", [""])[0] if item.get("categoryPath") else ""), clean(item.get("productNumber")), clean(item.get("albumId"))))
        write_json(SHARDS_DIR / f"{shard}.json", items, compact=True)


def update_app_catalog(all_index_products: list[dict[str, Any]], tree: list[dict[str, Any]]) -> None:
    catalog_path = APP_DATA_DIR / "catalog.json"
    catalog = load_json(catalog_path)
    category_counts = []
    for group in tree:
        for category in group.get("children") or []:
            path = category.get("path") or []
            category_counts.append(
                {
                    "id": category.get("id"),
                    "path": path,
                    "albumCount": sum(1 for product in all_index_products if path == product.get("categoryPath") or path in (product.get("websiteCategories") or [])),
                }
            )
    brands = []
    for brand in sorted({product.get("brand") for product in all_index_products if product.get("brand")}):
        brand_products = [product for product in all_index_products if product.get("brand") == brand]
        brands.append(
            {
                "name": brand,
                "slug": slugify(brand),
                "productCount": len(brand_products),
                "collections": sorted({product.get("collection") for product in brand_products if product.get("collection")}),
            }
        )
    collections = []
    for brand, collection in sorted({(product.get("brand"), product.get("collection")) for product in all_index_products if product.get("brand") and product.get("collection")}):
        collection_products = [product for product in all_index_products if product.get("brand") == brand and product.get("collection") == collection]
        collections.append(
            {
                "brand": brand,
                "name": collection,
                "slug": slugify(f"{brand}-{collection}"),
                "productCount": len(collection_products),
                "series": sorted({product.get("series") for product in collection_products if product.get("series")}),
                "versions": sorted({product.get("version") for product in collection_products if product.get("version")}),
            }
        )
    stats = catalog.setdefault("stats", {})
    stats["totalBrands"] = len(brands)
    stats["totalCollections"] = len(collections)
    stats["totalProducts"] = len(all_index_products)
    stats["totalImages"] = sum(int(product.get("imageCount") or 0) for product in all_index_products)
    stats["totalVideos"] = sum(int(product.get("videoCount") or 0) for product in all_index_products)
    stats["productsContainingVideos"] = sum(1 for product in all_index_products if product.get("hasVideo"))
    stats["sourceGroups"] = len(tree)
    stats["sourceTags"] = sum(len(group.get("children") or []) for group in tree)
    stats["publicCategories"] = stats["sourceGroups"] + stats["sourceTags"]
    catalog["categoryCounts"] = category_counts
    catalog["brands"] = brands
    catalog["collections"] = collections
    catalog["publicCategories"] = tree
    write_json(catalog_path, catalog, compact=True)
    write_json(APP_DATA_DIR / "brands.json", brands, compact=True)
    write_json(APP_DATA_DIR / "collections.json", collections, compact=True)


def check_url(url: str, kind: str, timeout: int = 120) -> dict[str, Any]:
    if not url:
        return {"url": url, "kind": kind, "ok": False, "reason": "missing_url"}
    if url.startswith("/"):
        local_path = ROOT / "public" / url.lstrip("/")
        return {"url": url, "kind": kind, "ok": local_path.exists(), "reason": None if local_path.exists() else "missing_local_asset"}
    command = [
        "curl",
        "--http1.1",
        "-L",
        "-I",
        "--silent",
        "--show-error",
        "--connect-timeout",
        "15",
        "--max-time",
        str(timeout),
        "--retry",
        "1",
        "-A",
        "Mozilla/5.0",
        "-e",
        "https://www.wecatalog.cn/",
        "-w",
        "%{http_code}\t%{content_type}",
        "-o",
        "/dev/null",
        url,
    ]
    result = subprocess.run(command, text=True, capture_output=True, check=False)
    parts = result.stdout.strip().split("\t")
    status = parts[0] if parts else ""
    content_type = parts[1] if len(parts) > 1 else ""
    ok_status = status in {"200", "206"}
    ok_type = content_type.startswith("image/") if kind == "image" else content_type.startswith("video/")
    ok = ok_status and (ok_type or content_type == "application/octet-stream")
    return {"url": url, "kind": kind, "ok": ok, "status": int(status) if status.isdigit() else None, "contentType": content_type, "error": result.stderr.strip()[:200]}


def verify_media(watches: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    probes: list[tuple[str, str, str]] = []
    seen: set[tuple[str, str]] = set()
    for product in watches:
        product_id = clean(product.get("albumId"))
        for image in product.get("galleryImages") or []:
            key = ("image", image)
            if key not in seen:
                seen.add(key)
                probes.append((product_id, "image", image))
        for media in product.get("galleryMedia") or []:
            if media.get("type") == "video":
                for kind, url in [("video", media.get("url") or ""), ("image", media.get("poster") or "")]:
                    key = (kind, url)
                    if key not in seen:
                        seen.add(key)
                        probes.append((product_id, kind, url))
    broken_images: list[dict[str, Any]] = []
    broken_videos: list[dict[str, Any]] = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=16) as executor:
        futures = {executor.submit(check_url, url, kind): (product_id, kind, url) for product_id, kind, url in probes}
        for future in concurrent.futures.as_completed(futures):
            product_id, kind, _ = futures[future]
            result = future.result()
            result["productId"] = product_id
            if not result.get("ok"):
                if kind == "video":
                    broken_videos.append(result)
                else:
                    broken_images.append(result)
    return broken_images, broken_videos


def main() -> None:
    tree = load_json(WECATALOG_DIR / "source_category_tree.json")
    product_index = load_json(WECATALOG_DIR / "source_category_product_index.json")
    products = load_json(WECATALOG_DIR / "products.json")
    checkpoint = load_json(WECATALOG_DIR / "media_backfill_checkpoint.json").get("scanned", {})
    tags = watch_tags(tree)
    tag_lookup = {tag["sourceId"]: tag for tag in tags}
    source_watch_ids = []
    seen_source_ids = set()
    for tag in tags:
        for goods_id in product_index.get(tag["id"], []):
            if goods_id not in seen_source_ids:
                seen_source_ids.add(goods_id)
                source_watch_ids.append(goods_id)

    by_id = {clean(product.get("id") or product.get("albumId")): product for product in products}
    rebuilt_watches: list[dict[str, Any]] = []
    missing_products: list[str] = []
    exact_duplicates_removed = 0
    duplicate_posters_removed = 0
    for goods_id in source_watch_ids:
        product = by_id.get(goods_id)
        if not product:
            missing_products.append(goods_id)
            continue
        categories = categories_for_product(goods_id, product_index, tag_lookup)
        rebuilt, counts = rebuild_watch_product(product, categories, checkpoint.get(goods_id) or {})
        rebuilt_watches.append(rebuilt)
        by_id[goods_id] = rebuilt
        exact_duplicates_removed += counts["exactDuplicateImagesRemoved"]
        duplicate_posters_removed += counts["duplicatePosterImagesRemoved"]

    write_json(WECATALOG_DIR / "products.json", sorted(by_id.values(), key=lambda item: (item.get("categoryPath") or [], clean(item.get("productNumber")), clean(item.get("id")))))

    watch_id_set = {clean(product.get("albumId")) for product in rebuilt_watches}
    existing_site_products = load_all_shard_products()
    non_watch_site_products = [
        product
        for product in existing_site_products
        if clean(product.get("albumId")) not in watch_id_set and (product.get("categoryPath") or [""])[0] != WATCH_TOP_CATEGORY
    ]
    all_site_products = non_watch_site_products + [app_detail_product(product) for product in rebuilt_watches]
    write_shards(all_site_products)

    existing_index = load_json(APP_DATA_DIR / "productIndex.json")
    non_watch_index = [
        product
        for product in existing_index
        if clean(product.get("albumId")) not in watch_id_set and (product.get("categoryPath") or [""])[0] != WATCH_TOP_CATEGORY
    ]
    all_index = non_watch_index + [app_index_product(product) for product in rebuilt_watches]
    all_index.sort(key=lambda item: (item.get("categoryPath") or [], clean(item.get("productNumber")), clean(item.get("albumId"))))
    write_json(APP_DATA_DIR / "productIndex.json", all_index, compact=True)
    update_app_catalog(all_index, tree)

    missing_media = [
        {
            "productId": product.get("albumId"),
            "productNumber": product.get("productNumber"),
            "slug": product.get("slug"),
            "categoryPath": product.get("categoryPath"),
            "reason": "no_source_media",
        }
        for product in rebuilt_watches
        if not product.get("galleryMedia")
    ]
    broken_images, broken_videos = verify_media(rebuilt_watches)

    report = {
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "source": "wecatalog",
        "storeUrl": f"https://www.wecatalog.cn/weshop/store/{STORE_ID}",
        "sourceOfTruth": "WeCatalog Watches category tree only",
        "totalWatchProducts": len(rebuilt_watches),
        "totalBrands": len(tags),
        "brands": [
            {
                "sourceId": tag.get("sourceId"),
                "name": tag.get("name"),
                "sourceItemCount": tag.get("raw", {}).get("itemCount"),
                "importedProducts": sum(1 for product in rebuilt_watches if product.get("categoryPath") == tag.get("path")),
            }
            for tag in tags
        ],
        "totalImages": sum(int(product.get("imageCount") or 0) for product in rebuilt_watches),
        "totalUniqueImages": len({image for product in rebuilt_watches for image in (product.get("galleryImages") or [])}),
        "totalVideos": sum(int(product.get("videoCount") or 0) for product in rebuilt_watches),
        "watchesWithVideo": sum(1 for product in rebuilt_watches if product.get("hasVideo")),
        "missingProducts": missing_products,
        "missingMedia": missing_media,
        "brokenImages": len(broken_images),
        "brokenVideos": len(broken_videos),
        "brokenImageSamples": broken_images[:50],
        "brokenVideoSamples": broken_videos[:50],
        "duplicateImagesRemoved": exact_duplicates_removed,
        "duplicatePosterImagesRemoved": duplicate_posters_removed,
        "prices": {
            "rule": "All Watches remain Price on Request",
            "pricedWatches": sum(1 for product in rebuilt_watches if product.get("internalPrice") is not None),
            "priceOnRequest": sum(1 for product in rebuilt_watches if product.get("publicPriceLabel") == "Price on Request"),
        },
        "siteDataset": {
            "productIndexTotal": len(all_index),
            "productIndexWatches": sum(1 for product in all_index if (product.get("categoryPath") or [""])[0] == WATCH_TOP_CATEGORY),
            "shardProductsTotal": len(all_site_products),
            "shardWatches": sum(1 for product in all_site_products if (product.get("categoryPath") or [""])[0] == WATCH_TOP_CATEGORY),
        },
    }
    write_json(REPORT_PATH, report)
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
