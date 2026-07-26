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

from import_wecatalog_store import canonical_image_url, clean  # noqa: E402

WATCH_TOP_CATEGORY = "高端腕表"
SHARDS_DIR = ROOT / "public" / "product-shards"
APP_DATA_DIR = ROOT / "app" / "data"
WECATALOG_DIR = ROOT / "data" / "wecatalog"
CHECKPOINT_PATH = WECATALOG_DIR / "media_backfill_checkpoint.json"
REPORT_PATH = ROOT / "data" / "watch-media-restoration-audit.json"
MEDIA_UNAVAILABLE_COVER = "/media-unavailable.svg"


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, data: Any, compact: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    separators = (",", ":") if compact else None
    path.write_text(json.dumps(data, ensure_ascii=False, indent=None if compact else 2, separators=separators), encoding="utf-8")


def media_id(url: str, prefix: str) -> str:
    parsed = re.sub(r"[^a-zA-Z0-9]+", "-", url.split("?", 1)[0]).strip("-")
    return f"{prefix}:{parsed[-96:]}"


def normalize_video_url(url: str) -> str:
    return (url or "").split("?", 1)[0].strip()


def load_shards() -> tuple[list[dict[str, Any]], dict[str, str]]:
    products: list[dict[str, Any]] = []
    shard_by_id: dict[str, str] = {}
    for path in sorted(SHARDS_DIR.glob("*.json")):
        items = load_json(path)
        for product in items:
            goods_id = clean(product.get("albumId") or product.get("id"))
            if goods_id:
                shard_by_id[goods_id] = path.name
            products.append(product)
    return products, shard_by_id


def save_shards(products: list[dict[str, Any]], shard_by_id: dict[str, str]) -> None:
    shards: dict[str, list[dict[str, Any]]] = {}
    for product in products:
        goods_id = clean(product.get("albumId") or product.get("id"))
        shard = shard_by_id.get(goods_id)
        if not shard:
            match = re.search(r"\d+", clean(product.get("productNumber")))
            shard = f"{(match.group(0)[:3] if match else 'misc') or 'misc'}.json"
        shards.setdefault(shard, []).append(product)
    for shard, items in shards.items():
        write_json(SHARDS_DIR / shard, items, compact=True)


def update_product_index(products: list[dict[str, Any]]) -> None:
    index_path = APP_DATA_DIR / "productIndex.json"
    existing = load_json(index_path) if index_path.exists() else []
    index_by_id = {clean(item.get("albumId")): item for item in existing}
    for product in products:
        if (product.get("categoryPath") or [""])[0] != WATCH_TOP_CATEGORY:
            continue
        product_id = clean(product.get("albumId"))
        current = index_by_id.get(product_id, {}).copy()
        current.update(
            {
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
                "priceLocked": product.get("priceLocked"),
                "pricingCalculatedAt": product.get("pricingCalculatedAt"),
                "matchConfidence": product.get("matchConfidence"),
                "searchText": product.get("searchText"),
            }
        )
        index_by_id[product_id] = current
    merged = [index_by_id.get(clean(item.get("albumId")), item) for item in existing]
    known = {clean(item.get("albumId")) for item in existing}
    for product_id, item in index_by_id.items():
        if product_id not in known:
            merged.append(item)
    write_json(index_path, merged, compact=True)


def update_catalog_video_stats(products: list[dict[str, Any]]) -> None:
    catalog_path = APP_DATA_DIR / "catalog.json"
    catalog = load_json(catalog_path)
    stats = catalog.setdefault("stats", {})
    stats["productsContainingVideos"] = sum(1 for product in products if product.get("hasVideo"))
    stats["totalVideos"] = sum(int(product.get("videoCount") or 0) for product in products)
    write_json(catalog_path, catalog, compact=True)


def build_watch_media(product: dict[str, Any], scanned: dict[str, Any]) -> tuple[list[dict[str, Any]], dict[str, int]]:
    commodity = (scanned or {}).get("commodity") or {}
    source_images = [
        canonical_image_url(url)
        for url in (commodity.get("imgsSrc") or commodity.get("imgs") or product.get("galleryImages") or [])
        if clean(url)
    ]
    if not source_images:
        source_images = [canonical_image_url(url) for url in (product.get("galleryImages") or []) if clean(url)]

    video_url = normalize_video_url(clean(scanned.get("videoUrl") or commodity.get("videoUrl")))
    poster = canonical_image_url(clean(scanned.get("videoPoster") or commodity.get("videoThumbImg")))

    media: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()
    exact_duplicate_images_removed = 0
    duplicate_poster_images_removed = 0

    def add_image(url: str) -> None:
        nonlocal exact_duplicate_images_removed, duplicate_poster_images_removed
        normalized = canonical_image_url(url)
        if not normalized:
            return
        if video_url and poster and normalized == poster:
            duplicate_poster_images_removed += 1
            return
        key = ("image", normalized)
        if key in seen:
            exact_duplicate_images_removed += 1
            return
        seen.add(key)
        media.append({"type": "image", "url": normalized, "sourceMediaId": media_id(normalized, "image")})

    inserted_video = False
    for image_url in source_images:
        normalized = canonical_image_url(image_url)
        if video_url and poster and normalized == poster and not inserted_video:
            key = ("video", video_url)
            if key not in seen:
                seen.add(key)
                media.append({"type": "video", "url": video_url, "poster": poster, "sourceMediaId": media_id(video_url, "video")})
                inserted_video = True
            duplicate_poster_images_removed += 1
            continue
        add_image(normalized)

    if video_url and not inserted_video:
        media.insert(0, {"type": "video", "url": video_url, "poster": poster or product.get("coverImage") or "", "sourceMediaId": media_id(video_url, "video")})

    return media, {
        "exactDuplicateImagesRemoved": exact_duplicate_images_removed,
        "duplicatePosterImagesRemoved": duplicate_poster_images_removed,
    }


def check_url(url: str, kind: str, timeout: int = 180) -> dict[str, Any]:
    if not url:
        return {"url": url, "ok": False, "reason": "missing_url", "status": None}
    if url.startswith("/"):
        local_path = ROOT / "public" / url.lstrip("/")
        return {
            "url": url,
            "ok": local_path.exists(),
            "reason": None if local_path.exists() else "missing_local_asset",
            "status": None,
            "contentType": "local",
        }
    command = [
        "curl",
        "-L",
        "--silent",
        "--show-error",
        "--connect-timeout",
        "15",
        "--max-time",
        str(timeout),
        "--retry",
        "2",
        "--retry-delay",
        "2",
        "-A",
        "Mozilla/5.0",
        "-H",
        "Range: bytes=0-1",
        "-e",
        "https://www.wecatalog.cn/",
        "-w",
        "%{http_code}\t%{content_type}\t%{size_download}",
        "-o",
        "/tmp/vipsui_media_probe.bin",
        url,
    ]
    result = subprocess.run(command, text=True, capture_output=True, check=False)
    parts = result.stdout.strip().split("\t")
    status = parts[0] if parts else ""
    content_type = parts[1] if len(parts) > 1 else ""
    ok_status = status in {"200", "206"}
    if kind == "image":
        ok_type = content_type.startswith("image/") or content_type == "application/octet-stream"
    else:
        ok_type = content_type.startswith("video/") or content_type == "application/octet-stream"
    ok = result.returncode == 0 and ok_status and ok_type
    return {
        "url": url,
        "ok": ok,
        "reason": None if ok else "curl_range_check_failed",
        "status": int(status) if status.isdigit() else None,
        "contentType": content_type,
        "exitCode": result.returncode,
        "error": result.stderr.strip()[:240],
    }


def verify_urls(urls: list[tuple[str, str, str]], workers: int = 16) -> dict[str, dict[str, Any]]:
    unique: dict[tuple[str, str], list[str]] = {}
    for product_id, kind, url in urls:
        unique.setdefault((kind, url), []).append(product_id)
    results: dict[str, dict[str, Any]] = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as executor:
        futures = {executor.submit(check_url, url, kind): (kind, url, refs) for (kind, url), refs in unique.items()}
        for future in concurrent.futures.as_completed(futures):
            kind, url, refs = futures[future]
            result = future.result()
            result["kind"] = kind
            result["productRefs"] = refs[:20]
            results[f"{kind}:{url}"] = result
    return results


def main() -> None:
    checkpoint = load_json(CHECKPOINT_PATH).get("scanned", {})
    products, shard_by_id = load_shards()
    watches = [product for product in products if (product.get("categoryPath") or [""])[0] == WATCH_TOP_CATEGORY]

    before_image_refs = sum(len(product.get("galleryImages") or []) for product in watches)
    before_videos = sum(int(product.get("videoCount") or 0) for product in watches)

    duplicate_images_removed = 0
    duplicate_posters_removed = 0
    recovered_images = 0
    recovered_videos = 0

    for product in watches:
        goods_id = clean(product.get("albumId") or product.get("id"))
        old_images = product.get("galleryImages") or []
        old_videos = int(product.get("videoCount") or 0)
        media, counts = build_watch_media(product, checkpoint.get(goods_id) or {})
        image_media = [item for item in media if item.get("type") == "image"]
        video_media = [item for item in media if item.get("type") == "video"]
        duplicate_images_removed += counts["exactDuplicateImagesRemoved"]
        duplicate_posters_removed += counts["duplicatePosterImagesRemoved"]
        recovered_images += max(0, len(image_media) - len(old_images))
        recovered_videos += max(0, len(video_media) - old_videos)

        product["galleryMedia"] = media
        product["galleryImages"] = [item["url"] for item in image_media]
        product["imageCount"] = len(image_media)
        product["videoCount"] = len(video_media)
        product["mediaCount"] = len(media)
        product["hasVideo"] = bool(video_media)
        if not product.get("coverImage") and media:
            first = media[0]
            product["coverImage"] = first.get("poster") if first.get("type") == "video" else first.get("url")
        if not product.get("coverImage"):
            product["coverImage"] = MEDIA_UNAVAILABLE_COVER

    save_shards(products, shard_by_id)
    update_product_index(products)
    update_catalog_video_stats(products)

    watches = [product for product in products if (product.get("categoryPath") or [""])[0] == WATCH_TOP_CATEGORY]
    image_urls: list[tuple[str, str, str]] = []
    video_urls: list[tuple[str, str, str]] = []
    poster_urls: list[tuple[str, str, str]] = []
    missing_media = []
    poster_dupes = []
    for product in watches:
        product_id = clean(product.get("albumId"))
        for image in product.get("galleryImages") or []:
            image_urls.append((product_id, "image", image))
        for item in product.get("galleryMedia") or []:
            if item.get("type") == "video":
                video_urls.append((product_id, "video", item.get("url") or ""))
                if item.get("poster"):
                    poster_urls.append((product_id, "image", item.get("poster") or ""))
                    if item.get("poster") in set(product.get("galleryImages") or []):
                        poster_dupes.append({"productId": product_id, "poster": item.get("poster")})
        if not product.get("coverImage") or not (product.get("galleryMedia") or product.get("galleryImages")):
            missing_media.append({"productId": product_id, "productNumber": product.get("productNumber"), "slug": product.get("slug"), "categoryPath": product.get("categoryPath"), "reason": "no_cover_or_gallery"})

    verify_started = time.time()
    checks = verify_urls(image_urls + video_urls + poster_urls)
    broken_images = [value for key, value in checks.items() if value.get("kind") == "image" and not value.get("ok")]
    broken_videos = [value for key, value in checks.items() if value.get("kind") == "video" and not value.get("ok")]

    report = {
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "totalWatches": len(watches),
        "before": {"imageReferences": before_image_refs, "videos": before_videos},
        "totalWatchImageReferences": sum(len(product.get("galleryImages") or []) for product in watches),
        "totalUniqueWatchImages": len({image for product in watches for image in (product.get("galleryImages") or [])}),
        "totalWatchVideos": sum(int(product.get("videoCount") or 0) for product in watches),
        "watchesWithVideo": sum(1 for product in watches if product.get("hasVideo")),
        "brokenImages": len(broken_images),
        "brokenVideos": len(broken_videos),
        "playableVideos": len({url for _, _, url in video_urls}) - len(broken_videos),
        "missingPosterImages": sum(1 for product in watches for item in (product.get("galleryMedia") or []) if item.get("type") == "video" and not item.get("poster")),
        "productsWithMissingMedia": missing_media,
        "duplicateImagesRemoved": duplicate_images_removed,
        "duplicatePosterGalleryProblems": len(poster_dupes),
        "duplicatePosterImagesRemoved": duplicate_posters_removed,
        "recoveredImages": recovered_images,
        "recoveredVideos": recovered_videos,
        "verificationSeconds": round(time.time() - verify_started, 2),
        "brokenImageSamples": broken_images[:50],
        "brokenVideoSamples": broken_videos[:50],
        "videoProductSamples": [
            {
                "productId": product.get("albumId"),
                "productNumber": product.get("productNumber"),
                "slug": product.get("slug"),
                "coverImage": product.get("coverImage"),
                "video": next((item for item in product.get("galleryMedia") or [] if item.get("type") == "video"), None),
            }
            for product in watches
            if product.get("hasVideo")
        ][:40],
    }
    write_json(REPORT_PATH, report)
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
