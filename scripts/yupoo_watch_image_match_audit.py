from __future__ import annotations

import hashlib
import html
import json
import math
import os
import re
import urllib.request
from urllib.parse import urlparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any

import imagehash
import numpy as np
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
APP_PRODUCT_INDEX = ROOT / "app" / "data" / "productIndex.json"
YUPOO_PRODUCTS = ROOT / "data" / "products.json"
REPORT_PATH = ROOT / "data" / "pricing" / "yupoo-watch-image-match-audit-report.json"
CACHE_DIR = ROOT / "data" / "pricing" / "yupoo-watch-image-match-cache"
LIVE_YUPOO_CACHE = CACHE_DIR / "yupoo_live_public_catalog.json"
FEATURE_CACHE = CACHE_DIR / "yupoo_features_v3_live.json"
WATCH_TOP_CATEGORY = "高端腕表"
WE_STORE_ID = "a202006301754324710116144"
YUPOO_BASE = "https://1688dafan.x.yupoo.com"


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")


def slugify(value: str) -> str:
    value = value.lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-") or "item"


def local_public_path(public_path: str) -> Path:
    return ROOT / "public" / public_path.lstrip("/")


def valid_supplier_code(value: str) -> bool:
    digits = re.sub(r"\D", "", value or "")
    return len(digits) in {7, 8}


def local_wecatalog_images(product: dict[str, Any]) -> list[Path]:
    directory = ROOT / "public" / "wecatalog-gallery" / WE_STORE_ID / slugify(str(product.get("albumId") or ""))
    if not directory.exists():
        return []
    return sorted(path for path in directory.iterdir() if path.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"})


def http_get(url: str, timeout: int = 20) -> bytes | None:
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return response.read()
    except Exception:
        return None


def http_text(url: str, timeout: int = 20) -> str | None:
    data = http_get(url, timeout=timeout)
    if not data:
        return None
    return data.decode("utf-8", errors="ignore")


def download_image(url: str, namespace: str, product_id: str, index: int) -> Path | None:
    suffix = Path(urlparse(url).path).suffix.lower()
    if suffix not in {".jpg", ".jpeg", ".png", ".webp"}:
        suffix = ".jpg"
    destination = CACHE_DIR / namespace / slugify(product_id) / f"{index:02d}{suffix}"
    if destination.exists() and destination.stat().st_size > 1024:
        return destination
    data = http_get(url, timeout=20)
    if not data:
        return None
    if len(data) < 1024:
        return None
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(data)
    return destination


def image_paths_for_vipsui(product: dict[str, Any], limit: int = 8) -> list[tuple[str, Path]]:
    local_images = local_wecatalog_images(product)
    if local_images:
        return [(str(path), path) for path in local_images[:limit]]

    seen: set[str] = set()
    records: list[tuple[str, Path]] = []
    image_urls = [product.get("coverImage"), *(product.get("galleryImages") or [])]
    for image in image_urls:
        image = str(image or "")
        if not image or image in seen:
            continue
        seen.add(image)
        if image.startswith("/"):
            path = local_public_path(image)
        elif image.startswith("http"):
            path = download_image(image, "vipsui-downloads", str(product.get("albumId") or product.get("productNumber")), len(records) + 1)
        else:
            path = None
        if path and path.exists():
            records.append((image, path))
        if len(records) >= limit:
            break
    return records


def parse_category_page(document: str) -> tuple[list[dict[str, Any]], int]:
    total_match = re.search(r"共\s*([0-9,]+)\s*个相册", document)
    total = int(total_match.group(1).replace(",", "")) if total_match else 0
    albums: list[dict[str, Any]] = []
    pattern = re.compile(
        r'<a\s+class="album__main"(?P<body>.*?)</a>\s*<div class="text_overflow album__title">(?P<title>.*?)</div>',
        re.S,
    )
    for match in pattern.finditer(document):
        body = match.group("body")
        href_match = re.search(r'href="(?P<href>/albums/(?P<id>\d+)[^"]*)"', body)
        image_match = re.search(r'data-src="(?P<image>https://photo\.yupoo\.com/[^"]+)"', body)
        if not href_match:
            continue
        title = html.unescape(re.sub(r"<[^>]+>", "", match.group("title")).strip())
        albums.append(
            {
                "albumId": href_match.group("id"),
                "productNumber": title,
                "yupooUrl": YUPOO_BASE + html.unescape(href_match.group("href")),
                "coverImageRemote": html.unescape(image_match.group("image")) if image_match else "",
                "galleryImagesRemote": [],
                "source": "yupoo-live-public",
            }
        )
    return albums, total


def discover_live_yupoo_albums() -> dict[str, Any]:
    if LIVE_YUPOO_CACHE.exists():
        return load_json(LIVE_YUPOO_CACHE)
    first = http_text(f"{YUPOO_BASE}/categories?page=1", timeout=30)
    if not first:
        raise RuntimeError("Could not fetch Yupoo categories page.")
    first_albums, total = parse_category_page(first)
    page_match = re.search(r'<span class="categories__box-right-pagination-span">\s*1\s*/\s*(\d+)\s*</span>', first)
    page_count = int(page_match.group(1)) if page_match else max(1, math.ceil(total / max(len(first_albums), 1)))
    albums_by_id = {album["albumId"]: album for album in first_albums}
    for page in range(2, page_count + 1):
        document = http_text(f"{YUPOO_BASE}/categories?page={page}", timeout=30)
        if not document:
            continue
        for album in parse_category_page(document)[0]:
            albums_by_id[album["albumId"]] = album
    result = {
        "source": f"{YUPOO_BASE}/categories",
        "displayedTotal": total,
        "pageCount": page_count,
        "albumsDiscovered": len(albums_by_id),
        "albums": sorted(albums_by_id.values(), key=lambda item: int(item["albumId"])),
    }
    write_json(LIVE_YUPOO_CACHE, result)
    return result


def parse_album_detail(album: dict[str, Any]) -> dict[str, Any]:
    document = http_text(album["yupooUrl"], timeout=30)
    if not document:
        return {**album, "detailFetchFailed": True}
    title_match = re.search(r'class="showalbumheader__gallerytitle">(?P<title>.*?)</span>', document)
    description_match = re.search(r'<div class="showalbumheader__gallerysubtitle htmlwrap__main">(?P<description>.*?)</div>', document, re.S)
    image_matches = re.findall(r'data-src="(?P<big>https://photo\.yupoo\.com/[^"]+/big\.jpg)"\s+data-origin-src="(?P<origin>https://photo\.yupoo\.com/[^"]+)"', document)
    gallery = [html.unescape(origin or big) for big, origin in image_matches]
    return {
        **album,
        "productNumber": html.unescape(re.sub(r"<[^>]+>", "", title_match.group("title")).strip()) if title_match else album.get("productNumber"),
        "description": html.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", description_match.group("description"))).strip()) if description_match else "",
        "galleryImagesRemote": gallery or ([album["coverImageRemote"]] if album.get("coverImageRemote") else []),
        "detailFetchFailed": False,
    }


def live_yupoo_products(local_yupoo_products: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    live = discover_live_yupoo_albums()
    local_by_id = {str(product.get("albumId")): product for product in local_yupoo_products}
    live_albums = live["albums"]
    missing = [album for album in live_albums if str(album.get("albumId")) not in local_by_id]
    detailed_missing: list[dict[str, Any]] = []
    if missing:
        with ThreadPoolExecutor(max_workers=12) as pool:
            futures = [pool.submit(parse_album_detail, album) for album in missing]
            for future in as_completed(futures):
                detailed_missing.append(future.result())
    live_missing_by_id = {str(album["albumId"]): album for album in detailed_missing}
    products: list[dict[str, Any]] = []
    for album in live_albums:
        album_id = str(album["albumId"])
        if album_id in local_by_id:
            product = {**local_by_id[album_id], "source": "yupoo-local+live-index"}
            products.append(product)
        else:
            detail = live_missing_by_id.get(album_id, album)
            products.append(
                {
                    "albumId": album_id,
                    "productNumber": detail.get("productNumber") or album.get("productNumber"),
                    "yupooUrl": detail.get("yupooUrl") or album.get("yupooUrl"),
                    "coverImage": detail.get("coverImageRemote") or album.get("coverImageRemote"),
                    "galleryImages": detail.get("galleryImagesRemote") or ([album.get("coverImageRemote")] if album.get("coverImageRemote") else []),
                    "brand": "",
                    "collection": "",
                    "description": detail.get("description", ""),
                    "source": "yupoo-live-public",
                    "detailFetchFailed": detail.get("detailFetchFailed", False),
                }
            )
    return products, {
        "displayedTotal": live.get("displayedTotal"),
        "pageCount": live.get("pageCount"),
        "albumsDiscovered": live.get("albumsDiscovered"),
        "localYupooProducts": len(local_yupoo_products),
        "liveOnlyAlbums": len(missing),
        "liveOnlyDetailFetched": sum(1 for album in detailed_missing if not album.get("detailFetchFailed")),
    }


def bytes_sha1(path: Path) -> str:
    return hashlib.sha1(path.read_bytes()).hexdigest()


def int_hash(value: imagehash.ImageHash) -> int:
    return int(str(value), 16)


def hamming(a: int, b: int) -> int:
    return bin(a ^ b).count("1")


def feature_for_path(path: Path) -> dict[str, Any] | None:
    try:
        image = Image.open(path).convert("RGB")
        contained = ImageOps.contain(image, (256, 256))
        fitted = ImageOps.fit(image, (96, 96))
        arr = np.asarray(fitted).astype(np.float32) / 255.0
        hist_parts = []
        for channel in range(3):
            hist, _ = np.histogram(arr[:, :, channel], bins=24, range=(0, 1), density=False)
            hist_parts.extend(hist.astype(np.float32).tolist())
        hist_array = np.array(hist_parts, dtype=np.float32)
        hist_array = hist_array / (np.linalg.norm(hist_array) + 1e-9)
        return {
            "sha1": bytes_sha1(path),
            "phash": int_hash(imagehash.phash(contained, hash_size=16)),
            "dhash": int_hash(imagehash.dhash(contained, hash_size=16)),
            "whash": int_hash(imagehash.whash(contained, hash_size=16)),
            "average": [float(value) for value in np.mean(arr, axis=(0, 1)).tolist()],
            "hist": [round(float(value), 6) for value in hist_array.tolist()],
        }
    except Exception:
        return None


def load_or_build_yupoo_features(yupoo_products: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if FEATURE_CACHE.exists():
        return load_json(FEATURE_CACHE)
    features: list[dict[str, Any]] = []
    for product in yupoo_products:
        for position, image in enumerate(product.get("galleryImages") or [], start=1):
            if str(image).startswith("/"):
                path = local_public_path(image)
                if not path.exists():
                    continue
                image_ref = image
            elif str(image).startswith("http"):
                path = download_image(str(image), "yupoo-live-downloads", str(product.get("albumId") or product.get("productNumber")), position)
                if not path:
                    continue
                image_ref = str(image)
            else:
                continue
            feature = feature_for_path(path)
            if not feature:
                continue
            features.append(
                {
                    "albumId": product.get("albumId"),
                    "productNumber": product.get("productNumber"),
                    "yupooUrl": product.get("yupooUrl"),
                    "image": image_ref,
                    "position": position,
                    "brand": product.get("brand"),
                    "collection": product.get("collection"),
                    **feature,
                }
            )
    write_json(FEATURE_CACHE, features)
    return features


def compare_features(a: dict[str, Any], b: dict[str, Any]) -> dict[str, float]:
    if a["sha1"] == b["sha1"]:
        return {"distance": 0.0, "score": 1.0, "hashDistance": 0.0, "colorSimilarity": 1.0}
    ph = hamming(a["phash"], b["phash"]) / 256
    dh = hamming(a["dhash"], b["dhash"]) / 256
    wh = hamming(a["whash"], b["whash"]) / 256
    hist_a = np.array(a["hist"], dtype=np.float32)
    hist_b = np.array(b["hist"], dtype=np.float32)
    color_similarity = float(np.dot(hist_a, hist_b) / ((np.linalg.norm(hist_a) * np.linalg.norm(hist_b)) + 1e-9))
    color_distance = 1 - color_similarity
    avg_a = np.array(a["average"], dtype=np.float32)
    avg_b = np.array(b["average"], dtype=np.float32)
    avg_distance = min(float(np.linalg.norm(avg_a - avg_b) / math.sqrt(3)), 1.0)
    distance = 0.34 * ph + 0.28 * dh + 0.28 * wh + 0.07 * color_distance + 0.03 * avg_distance
    return {
        "distance": float(distance),
        "score": float(1 - distance),
        "hashDistance": float((ph + dh + wh) / 3 * 256),
        "colorSimilarity": color_similarity,
    }


def select_audit_products(products: list[dict[str, Any]], limit: int = 50) -> list[dict[str, Any]]:
    watches = [product for product in products if (product.get("categoryPath") or [""])[0] == WATCH_TOP_CATEGORY]
    selected: list[dict[str, Any]] = []
    counts: dict[str, int] = {}
    for product in watches:
        collection = str(product.get("collection") or "")
        if counts.get(collection, 0) < 3:
            selected.append(product)
            counts[collection] = counts.get(collection, 0) + 1
        if len(selected) >= limit:
            return selected
    for product in watches:
        if product not in selected:
            selected.append(product)
        if len(selected) >= limit:
            break
    return selected


def top_match_for_product(product: dict[str, Any], yupoo_features: list[dict[str, Any]]) -> dict[str, Any]:
    source_records = []
    for source, path in image_paths_for_vipsui(product):
        feature = feature_for_path(path)
        if feature:
            source_records.append({"source": source, **feature})
    candidate_scores: dict[str, dict[str, Any]] = {}
    for source_feature in source_records:
        for yupoo_feature in yupoo_features:
            metrics = compare_features(source_feature, yupoo_feature)
            album_id = str(yupoo_feature["albumId"])
            current = candidate_scores.get(album_id)
            if current is None or metrics["distance"] < current["distance"]:
                candidate_scores[album_id] = {
                    **metrics,
                    "vipsuiImage": source_feature["source"],
                    "yupooImage": yupoo_feature["image"],
                    "yupooProductId": yupoo_feature["albumId"],
                    "yupooProductNumber": yupoo_feature["productNumber"],
                    "yupooUrl": yupoo_feature["yupooUrl"],
                    "yupooBrand": yupoo_feature["brand"],
                    "yupooCollection": yupoo_feature["collection"],
                }
    ranked = sorted(candidate_scores.values(), key=lambda item: item["distance"])
    best = ranked[0] if ranked else None
    second = ranked[1] if len(ranked) > 1 else None
    if not best:
        return {
            "matchConfidence": "needs_review",
            "acceptedForPricing": False,
            "reviewReason": "No comparable image features available.",
            "possibleYupooMatch": None,
        }

    margin = (second["distance"] - best["distance"]) if second else 1.0
    exact = best["score"] == 1.0
    strong = best["distance"] <= 0.08 and margin >= 0.025
    moderate = best["distance"] <= 0.11 and margin >= 0.04 and best["hashDistance"] <= 18
    accepted = (exact or strong or moderate) and valid_supplier_code(str(best["yupooProductNumber"]))
    return {
        "possibleYupooMatch": best,
        "secondBestDistance": round(second["distance"], 6) if second else None,
        "matchMargin": round(margin, 6),
        "matchConfidence": "verified_high" if accepted else "needs_review",
        "matchMethod": "multi_image_phash_dhash_whash_color",
        "acceptedForPricing": accepted,
        "reviewReason": None if accepted else "Similarity or supplier-code validation did not pass the high-confidence threshold.",
    }


def main() -> None:
    products = load_json(APP_PRODUCT_INDEX)
    local_yupoo_products = load_json(YUPOO_PRODUCTS)
    yupoo_products, yupoo_audit = live_yupoo_products(local_yupoo_products)
    yupoo_features = load_or_build_yupoo_features(yupoo_products)
    audit_products = select_audit_products(products, 50)
    rows: list[dict[str, Any]] = []
    verified_rows: list[dict[str, Any]] = []
    for product in audit_products:
        match = top_match_for_product(product, yupoo_features)
        best = match.get("possibleYupooMatch") or {}
        row = {
            "vipsuiId": product.get("albumId"),
            "vipsuiProductNumber": product.get("productNumber"),
            "vipsuiImage": best.get("vipsuiImage") or product.get("coverImage"),
            "possibleYupooMatch": best.get("yupooProductId"),
            "yupooUrl": best.get("yupooUrl"),
            "yupooImage": best.get("yupooImage"),
            "similarityScore": round(best.get("score", 0), 6) if best else None,
            "combinedDistance": round(best.get("distance", 1), 6) if best else None,
            "hashDistance": round(best.get("hashDistance", 0), 3) if best else None,
            "colorSimilarity": round(best.get("colorSimilarity", 0), 6) if best else None,
            "secondBestDistance": match.get("secondBestDistance"),
            "matchMargin": match.get("matchMargin"),
            "confidence": match.get("matchConfidence"),
            "matchMethod": match.get("matchMethod"),
            "numericSupplierCode": best.get("yupooProductNumber") if match.get("acceptedForPricing") else None,
            "acceptedForPricing": match.get("acceptedForPricing"),
            "reviewReason": match.get("reviewReason"),
        }
        rows.append(row)
        if row["acceptedForPricing"]:
            verified_rows.append(row)
    report = {
        "generatedAt": __import__("datetime").datetime.utcnow().isoformat() + "Z",
        "sourceYupooCatalog": "https://1688dafan.x.yupoo.com/",
        "yupooSourceAudit": yupoo_audit,
        "yupooProducts": len(yupoo_products),
        "yupooImageFeatures": len(yupoo_features),
        "auditedWatches": len(rows),
        "verifiedHighConfidenceMatches": len(verified_rows),
        "needsReview": len(rows) - len(verified_rows),
        "acceptanceRule": "exact image OR combined visual distance <= 0.08 with margin >= 0.025 OR distance <= 0.11 with margin >= 0.04 and hash distance <= 18; plus valid 7/8 digit supplier code",
        "products": rows,
        "verifiedMatches": verified_rows[:20],
    }
    write_json(REPORT_PATH, report)
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
