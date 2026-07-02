from __future__ import annotations

import argparse
import csv
import hashlib
import json
import mimetypes
import posixpath
import re
import shutil
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
APP_DATA_DIR = ROOT / "app" / "data"
ROOT_DATA_DIR = ROOT / "data"
PUBLIC_IMPORT_DIR = ROOT / "public" / "wechat-album"

MINI_PROGRAM_PREFIX = "#小程序://"
PUBLIC_PRICE_LABEL = "Price on Request"

FIELD_ALIASES = {
    "product_number": [
        "product_number",
        "productnumber",
        "product no",
        "product no.",
        "product id",
        "sku",
        "货号",
        "款号",
        "商品编号",
        "编号",
        "搜索码",
        "mark_code",
        "goodsnum",
        "goods_num",
    ],
    "brand": ["brand", "品牌"],
    "collection": ["collection", "系列", "分类", "一级分类"],
    "series": ["series", "款式", "二级分类", "型号"],
    "version": ["version", "版本", "等级"],
    "name": ["name", "title", "商品名称", "标题", "名称"],
    "description": ["description", "desc", "描述", "详情", "商品描述"],
    "size": ["size", "尺寸"],
    "movement": ["movement", "机芯"],
    "image_paths": ["images", "image", "image_paths", "图片", "图片路径", "图片链接", "主图", "相册"],
    "source_url": ["source_url", "url", "链接", "商品链接", "微商相册链接"],
}

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"}


def slugify(value: str) -> str:
    value = value.lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-") or "item"


def clean(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def normalize_key(value: str) -> str:
    return re.sub(r"[\s_\-.:：/]+", "", value.strip().lower())


def first_value(row: dict[str, str], field: str) -> str:
    aliases = {normalize_key(alias) for alias in FIELD_ALIASES[field]}
    for key, value in row.items():
        if normalize_key(key) in aliases and clean(value):
            return clean(value)
    return ""


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def column_name(index: int) -> str:
    name = ""
    index += 1
    while index:
        index, rem = divmod(index - 1, 26)
        name = chr(65 + rem) + name
    return name


def read_xlsx(path: Path) -> list[dict[str, str]]:
    ns = {"a": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    with zipfile.ZipFile(path) as archive:
        shared: list[str] = []
        if "xl/sharedStrings.xml" in archive.namelist():
            root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
            for item in root.findall(".//a:si", ns):
                shared.append("".join(text.text or "" for text in item.findall(".//a:t", ns)))

        sheet_name = next((name for name in archive.namelist() if name.startswith("xl/worksheets/sheet") and name.endswith(".xml")), "")
        if not sheet_name:
            return []
        sheet = ET.fromstring(archive.read(sheet_name))

    rows: list[list[str]] = []
    for row in sheet.findall(".//a:row", ns):
        values: dict[int, str] = {}
        for cell in row.findall("a:c", ns):
            ref = cell.attrib.get("r", "")
            col_match = re.match(r"([A-Z]+)", ref)
            if not col_match:
                continue
            col_letters = col_match.group(1)
            col_index = 0
            for char in col_letters:
                col_index = col_index * 26 + ord(char) - 64
            value_node = cell.find("a:v", ns)
            inline_node = cell.find("a:is/a:t", ns)
            raw = value_node.text if value_node is not None else inline_node.text if inline_node is not None else ""
            if cell.attrib.get("t") == "s" and raw:
                raw = shared[int(raw)]
            values[col_index - 1] = clean(raw)
        if values:
            max_index = max(values)
            rows.append([values.get(index, "") for index in range(max_index + 1)])

    if not rows:
        return []
    headers = [clean(value) or column_name(index) for index, value in enumerate(rows[0])]
    return [dict(zip(headers, row + [""] * (len(headers) - len(row)))) for row in rows[1:] if any(clean(value) for value in row)]


def read_export(path: Path) -> list[dict[str, str]]:
    suffix = path.suffix.lower()
    if suffix == ".csv":
        return read_csv(path)
    if suffix == ".xlsx":
        return read_xlsx(path)
    raise ValueError(f"Unsupported export type: {path.suffix}. Use .csv or .xlsx.")


def split_images(value: str) -> list[str]:
    if not value:
        return []
    parts = re.split(r"[\n;,，|]+", value)
    return [clean(part) for part in parts if clean(part)]


def image_candidates(image_root: Path | None, product_number: str, explicit: list[str]) -> list[Path | str]:
    results: list[Path | str] = []
    for item in explicit:
        if re.match(r"^https?://", item) or item.startswith("/"):
            results.append(item)
            continue
        path = Path(item)
        if not path.is_absolute() and image_root:
            path = image_root / path
        if path.exists():
            results.append(path)

    if not image_root or not image_root.exists():
        return results

    product_dir = image_root / product_number
    if product_dir.exists():
        for path in sorted(product_dir.rglob("*")):
            if path.suffix.lower() in IMAGE_EXTENSIONS:
                results.append(path)

    for path in sorted(image_root.rglob("*")):
        if path.suffix.lower() in IMAGE_EXTENSIONS and product_number in path.stem:
            results.append(path)

    deduped: list[Path | str] = []
    seen: set[str] = set()
    for item in results:
        key = str(item)
        if key not in seen:
            deduped.append(item)
            seen.add(key)
    return deduped


def public_image_path(item: Path | str, product_number: str, index: int, dry_run: bool) -> str:
    if isinstance(item, str):
        return item
    digest = hashlib.sha1(str(item).encode("utf-8")).hexdigest()[:10]
    suffix = item.suffix.lower() or mimetypes.guess_extension(mimetypes.guess_type(str(item))[0] or "") or ".jpg"
    filename = f"{index:02d}-{digest}{suffix}"
    dest_dir = PUBLIC_IMPORT_DIR / slugify(product_number)
    dest = dest_dir / filename
    if not dry_run:
        dest_dir.mkdir(parents=True, exist_ok=True)
        shutil.copy2(item, dest)
    return "/" + posixpath.join("wechat-album", slugify(product_number), filename)


def parse_internal_price(product_number: str) -> int | None:
    digits = re.sub(r"\D", "", product_number)
    if len(digits) == 7:
        return int(digits[2:5])
    if len(digits) == 8:
        return int(digits[2:6])
    return None


def product_from_row(row: dict[str, str], image_root: Path | None, dry_run: bool) -> dict[str, Any] | None:
    product_number = first_value(row, "product_number")
    if not product_number:
        return None

    brand = first_value(row, "brand") or "Unassigned"
    collection = first_value(row, "collection") or "Unassigned"
    series = first_value(row, "series") or collection
    version = first_value(row, "version") or "Standard Version"
    name = first_value(row, "name") or product_number
    description = first_value(row, "description")
    size = first_value(row, "size")
    movement = first_value(row, "movement")
    source_url = first_value(row, "source_url")
    explicit_images = split_images(first_value(row, "image_paths"))
    candidates = image_candidates(image_root, product_number, explicit_images)
    images = [public_image_path(item, product_number, index + 1, dry_run) for index, item in enumerate(candidates)]

    specs = [value for value in [size, movement, version] if value]
    slug = f"{slugify(product_number)}-{slugify(brand)}"
    return {
        "albumId": f"wechat-{slugify(product_number)}",
        "slug": slug,
        "productNumber": product_number,
        "brand": brand,
        "exactBrand": brand,
        "collection": collection,
        "series": series,
        "version": version,
        "categoryPath": [brand, collection, version],
        "exactCategoryName": version,
        "coverImage": images[0] if images else "",
        "galleryImages": images,
        "imageCount": len(images),
        "yupooUrl": source_url,
        "source": "wechat-album-export",
        "internalPrice": parse_internal_price(product_number),
        "publicPriceLabel": PUBLIC_PRICE_LABEL,
        "description": description,
        "specs": specs,
        "size": size,
        "movement": movement,
        "searchText": " ".join([product_number, brand, collection, series, version, name, description]).lower(),
    }


def merge_products(existing: list[dict[str, Any]], imported: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], dict[str, int]]:
    by_number: dict[str, dict[str, Any]] = {clean(product.get("productNumber")): product for product in existing if clean(product.get("productNumber"))}
    added = 0
    updated = 0
    for product in imported:
        key = clean(product["productNumber"])
        current = by_number.get(key)
        if not current:
            by_number[key] = product
            added += 1
            continue
        merged_images = []
        for image in [*product.get("galleryImages", []), *current.get("galleryImages", [])]:
            if image and image not in merged_images:
                merged_images.append(image)
        current.update(
            {
                "brand": product["brand"] or current.get("brand", ""),
                "exactBrand": product["exactBrand"] or current.get("exactBrand", ""),
                "collection": product["collection"] or current.get("collection", ""),
                "series": product["series"] or current.get("series", ""),
                "version": product["version"] or current.get("version", ""),
                "categoryPath": product["categoryPath"] or current.get("categoryPath", []),
                "exactCategoryName": product["exactCategoryName"] or current.get("exactCategoryName", ""),
                "galleryImages": merged_images,
                "coverImage": merged_images[0] if merged_images else current.get("coverImage", ""),
                "imageCount": len(merged_images),
                "publicPriceLabel": PUBLIC_PRICE_LABEL,
                "source": "wechat-album-export+yupoo" if current.get("yupooUrl") else "wechat-album-export",
            }
        )
        if product.get("description"):
            current["description"] = product["description"]
        if product.get("size"):
            current["size"] = product["size"]
        if product.get("movement"):
            current["movement"] = product["movement"]
        current["searchText"] = " ".join(
            [
                current.get("productNumber", ""),
                current.get("brand", ""),
                current.get("collection", ""),
                current.get("series", ""),
                current.get("version", ""),
                current.get("description", ""),
            ]
        ).lower()
        updated += 1

    products = sorted(by_number.values(), key=lambda item: (item.get("brand", ""), item.get("collection", ""), item.get("version", ""), item.get("productNumber", "")))
    return products, {"added": added, "updated": updated, "deduped": len(imported) - added}


def build_indexes(products: list[dict[str, Any]], source: str) -> dict[str, Any]:
    brands: list[dict[str, Any]] = []
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

    collections: list[dict[str, Any]] = []
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
            }
        )

    category_counts: list[dict[str, Any]] = []
    for path in sorted({tuple(product.get("categoryPath", [])) for product in products}):
        category_counts.append(
            {
                "id": slugify("-".join(path)),
                "path": list(path),
                "albumCount": sum(1 for product in products if tuple(product.get("categoryPath", [])) == path),
            }
        )

    return {
        "source": source,
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "stats": {
            "totalBrands": len(brands),
            "totalCollections": len(collections),
            "totalProducts": len(products),
            "totalImages": sum(product.get("imageCount", 0) for product in products),
            "unassignedProducts": sum(1 for product in products if product.get("brand") == "Unassigned"),
        },
        "categoryCounts": category_counts,
        "unassignedAlbumIds": [product["albumId"] for product in products if product.get("brand") == "Unassigned"],
        "brands": brands,
        "collections": collections,
        "products": products,
    }


def write_catalog(catalog: dict[str, Any], dry_run: bool) -> None:
    if dry_run:
        return
    for data_dir in [APP_DATA_DIR, ROOT_DATA_DIR]:
        data_dir.mkdir(parents=True, exist_ok=True)
        for filename, payload in {
            "catalog.json": catalog,
            "products.json": catalog["products"],
            "brands.json": catalog["brands"],
            "collections.json": catalog["collections"],
        }.items():
            (data_dir / filename).write_text(json.dumps(payload, ensure_ascii=False, indent=2))


def probe_source(source: str) -> None:
    if source.startswith(MINI_PROGRAM_PREFIX):
        raise SystemExit(
            "The provided source is a WeChat mini-program deep link, not a public web catalog URL. "
            "Open/export it in WeChat Album and provide a public wgstores.com store URL or a CSV/XLSX export."
        )

    parsed = urllib.parse.urlparse(source)
    if not parsed.scheme or not parsed.netloc:
        raise SystemExit("Source URL is not a valid public web URL.")

    request = urllib.request.Request(source, headers={"User-Agent": "Mozilla/5.0"})
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            body = response.read(5000).decode("utf-8", errors="ignore")
    except urllib.error.HTTPError as error:
        raise SystemExit(f"Source URL returned HTTP {error.code}. Provide a public URL or export file.") from error

    if "链接失效" in body or "未找到指定的栏目" in body:
        raise SystemExit("Source URL is public but invalid/expired. Provide a fresh public store/share URL or export file.")
    if "You need to enable JavaScript" in body:
        raise SystemExit(
            "Source URL is a public app shell, but product-list API requires a logged-in session. "
            "Provide a CSV/XLSX export or an owner-authorized export file."
        )
    raise SystemExit("No supported public product list was found at this URL. Provide CSV/XLSX export data.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Import public WeChat Album export data and merge it with the existing catalog.")
    parser.add_argument("--source-url", help="Public WeChat Album/wgstores URL to probe. Mini-program deep links are reported as unsupported.")
    parser.add_argument("--export", type=Path, help="CSV or XLSX export containing product rows.")
    parser.add_argument("--images", type=Path, help="Local image root. Supports product-number folders and filenames containing product numbers.")
    parser.add_argument("--dry-run", action="store_true", help="Parse and report without writing catalog files or copying images.")
    args = parser.parse_args()

    if args.source_url and not args.export:
        probe_source(args.source_url)
    if not args.export:
        parser.error("--export is required unless you are only probing --source-url")

    rows = read_export(args.export)
    imported = [product for row in rows if (product := product_from_row(row, args.images, args.dry_run))]
    if not imported:
        raise SystemExit("No importable products found. Ensure the export includes a product number column.")

    existing = json.loads((APP_DATA_DIR / "products.json").read_text())
    products, merge_stats = merge_products(existing, imported)
    catalog = build_indexes(products, source=f"Yupoo + WeChat Album export: {args.export.name}")
    write_catalog(catalog, args.dry_run)

    summary = {
        "exportRows": len(rows),
        "importableProducts": len(imported),
        **merge_stats,
        "totalProducts": catalog["stats"]["totalProducts"],
        "totalImages": catalog["stats"]["totalImages"],
        "dryRun": args.dry_run,
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
