#!/usr/bin/env python3
from __future__ import annotations

import argparse
import concurrent.futures
import json
import re
import sys
import time
import urllib.request
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from import_wecatalog_store import DEFAULT_STORE_URL, WeCatalogClient, canonical_image_url, clean  # noqa: E402

APP_DATA_DIR = ROOT / "app" / "data"
SHARDS_DIR = ROOT / "public" / "product-shards"
WECATALOG_DIR = ROOT / "data" / "wecatalog"
REPORT_PATH = WECATALOG_DIR / "media_backfill_report.json"
CHECKPOINT_PATH = WECATALOG_DIR / "media_backfill_checkpoint.json"
FAILURES_PATH = WECATALOG_DIR / "media_backfill_failures.json"
SAMPLE_VIDEO_PATH = WECATALOG_DIR / "media_backfill_video_samples.json"


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def compact_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def media_id(url: str, prefix: str) -> str:
    parsed = re.sub(r"[^a-zA-Z0-9]+", "-", url.split("?", 1)[0]).strip("-")
    return f"{prefix}:{parsed[-96:]}"


def normalize_video_url(url: str) -> str:
    return (url or "").split("?", 1)[0].strip()


def build_media_from_detail(product: dict[str, Any], commodity: dict[str, Any]) -> tuple[list[dict[str, Any]], dict[str, int]]:
    image_urls = [
        canonical_image_url(url)
        for url in (commodity.get("imgsSrc") or commodity.get("imgs") or product.get("galleryImages") or [])
        if clean(url)
    ]
    video_url = normalize_video_url(clean(commodity.get("videoUrl") or commodity.get("videoURL") or commodity.get("replayUrl")))
    poster = canonical_image_url(clean(commodity.get("videoThumbImg")))

    media: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()
    duplicate_poster_images_removed = 0

    def add_image(url: str) -> None:
        nonlocal duplicate_poster_images_removed
        url = canonical_image_url(url)
        if not url:
            return
        if video_url and poster and canonical_image_url(url) == poster:
            duplicate_poster_images_removed += 1
            return
        key = ("image", url)
        if key in seen:
            return
        seen.add(key)
        media.append({"type": "image", "url": url, "sourceMediaId": media_id(url, "image")})

    def add_video(insert_at: int | None = None) -> None:
        if not video_url:
            return
        key = ("video", video_url)
        if key in seen:
            return
        seen.add(key)
        record = {
            "type": "video",
            "url": video_url,
            "poster": poster or (product.get("coverImage") or ""),
            "sourceMediaId": media_id(video_url, "video"),
        }
        if insert_at is None:
            media.append(record)
        else:
            media.insert(insert_at, record)

    video_inserted = False
    for image_url in image_urls:
        if video_url and poster and canonical_image_url(image_url) == poster and not video_inserted:
            add_video(len(media))
            video_inserted = True
            duplicate_poster_images_removed += 1
            continue
        add_image(image_url)

    if video_url and not video_inserted:
        add_video(0)

    if not media:
        for image_url in product.get("galleryImages") or [product.get("coverImage")]:
            add_image(image_url)

    image_count = sum(1 for item in media if item.get("type") == "image")
    video_count = sum(1 for item in media if item.get("type") == "video")
    return media, {
        "imageCount": image_count,
        "videoCount": video_count,
        "duplicatePosterImagesRemoved": duplicate_poster_images_removed,
    }


def playable(url: str, timeout: int = 8) -> bool:
    if not url:
        return False
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0", "Range": "bytes=0-1"})
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return response.status in {200, 206}
    except Exception:
        return False


def scan_one(goods_id: str, store_url: str, token: str, verify_video: bool) -> dict[str, Any]:
    client = WeCatalogClient(store_url)
    client.token = token
    detail = client.detail(goods_id)
    commodity = (detail.get("result") or {}).get("commodity") or {}
    video_url = normalize_video_url(clean(commodity.get("videoUrl") or commodity.get("videoURL") or commodity.get("replayUrl")))
    poster = canonical_image_url(clean(commodity.get("videoThumbImg")))
    video_ok = playable(video_url) if verify_video and video_url else None
    return {
        "goodsId": goods_id,
        "commodity": commodity,
        "videoUrl": video_url,
        "videoPoster": poster,
        "videoPlayable": video_ok,
    }


def load_shard_products() -> tuple[list[dict[str, Any]], dict[str, str]]:
    products: list[dict[str, Any]] = []
    shard_by_id: dict[str, str] = {}
    for path in sorted(SHARDS_DIR.glob("*.json")):
        shard_products = load_json(path)
        for product in shard_products:
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
        compact_json(SHARDS_DIR / shard, items)


def update_app_index(products: list[dict[str, Any]]) -> None:
    index = []
    for product in products:
        index.append(
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
                "searchText": product.get("searchText"),
            }
        )
    compact_json(APP_DATA_DIR / "productIndex.json", index)


def update_catalog_stats(video_products: int, total_videos: int) -> None:
    path = APP_DATA_DIR / "catalog.json"
    catalog = load_json(path)
    stats = catalog.setdefault("stats", {})
    stats["productsContainingVideos"] = video_products
    stats["totalVideos"] = total_videos
    compact_json(path, catalog)


def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill WeCatalog gallery media with explicit image/video types.")
    parser.add_argument("--store-url", default=DEFAULT_STORE_URL)
    parser.add_argument("--workers", type=int, default=24)
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--resume", action="store_true")
    parser.add_argument("--verify-video", action="store_true", help="HEAD/range-check playable video URLs. Slower.")
    args = parser.parse_args()
    bootstrap = WeCatalogClient(args.store_url)
    bootstrap.open_public_store()
    token = bootstrap.token
    if not token:
        raise RuntimeError("Could not obtain WeCatalog public token.")

    products, shard_by_id = load_shard_products()
    product_by_id = {clean(product.get("albumId") or product.get("id")): product for product in products}
    ordered_ids = [goods_id for goods_id in product_by_id if goods_id]
    if args.limit:
        ordered_ids = ordered_ids[: args.limit]

    scanned: dict[str, Any] = {}
    failures: list[dict[str, str]] = []
    if args.resume and CHECKPOINT_PATH.exists():
        scanned = load_json(CHECKPOINT_PATH).get("scanned", {})
    if args.resume and FAILURES_PATH.exists():
        failures = load_json(FAILURES_PATH)

    pending_ids = [goods_id for goods_id in ordered_ids if goods_id not in scanned]
    started = time.time()
    print(f"Media backfill scanning {len(pending_ids)} pending of {len(ordered_ids)} products", file=sys.stderr, flush=True)

    def worker(goods_id: str) -> tuple[str, dict[str, Any] | None, str | None]:
        try:
            return goods_id, scan_one(goods_id, args.store_url, token, args.verify_video), None
        except Exception as error:
            return goods_id, None, str(error)

    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as executor:
        futures = {executor.submit(worker, goods_id): goods_id for goods_id in pending_ids}
        for index, future in enumerate(concurrent.futures.as_completed(futures), start=1):
            goods_id, result, error = future.result()
            if result:
                scanned[goods_id] = {
                    "videoUrl": result["videoUrl"],
                    "videoPoster": result["videoPoster"],
                    "videoPlayable": result["videoPlayable"],
                    "commodity": {
                        "imgsSrc": result["commodity"].get("imgsSrc") or result["commodity"].get("imgs") or [],
                        "videoUrl": result["videoUrl"],
                        "videoThumbImg": result["videoPoster"],
                    },
                }
            else:
                failures.append({"goodsId": goods_id, "error": error or "unknown"})

            completed = len(scanned) + len(failures)
            if index == 1 or completed % 250 == 0:
                elapsed = max(time.time() - started, 1)
                print(f"Media scan progress {completed}/{len(ordered_ids)}; videos={sum(1 for item in scanned.values() if item.get('videoUrl'))}; rate={completed/elapsed:.2f}/s", file=sys.stderr, flush=True)
                write_json(CHECKPOINT_PATH, {"updatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "scanned": scanned})
                write_json(FAILURES_PATH, failures)

    write_json(CHECKPOINT_PATH, {"updatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "scanned": scanned})
    write_json(FAILURES_PATH, failures)

    total_videos = 0
    products_with_videos = 0
    duplicate_poster_removed = 0
    video_samples: list[dict[str, Any]] = []
    failed_videos = 0

    for goods_id, product in product_by_id.items():
        detail = scanned.get(goods_id)
        commodity = (detail or {}).get("commodity") or {}
        media, counts = build_media_from_detail(product, commodity)
        image_media = [item for item in media if item.get("type") == "image"]
        video_media = [item for item in media if item.get("type") == "video"]
        total_videos += len(video_media)
        duplicate_poster_removed += counts["duplicatePosterImagesRemoved"]
        if video_media:
            products_with_videos += 1
            if len(video_samples) < 50:
                video_samples.append(
                    {
                        "albumId": goods_id,
                        "slug": product.get("slug"),
                        "productNumber": product.get("productNumber"),
                        "video": video_media[0],
                    }
                )
            if detail and detail.get("videoPlayable") is False:
                failed_videos += len(video_media)

        product["galleryMedia"] = media
        product["galleryImages"] = [item["url"] for item in image_media]
        product["imageCount"] = len(image_media)
        product["videoCount"] = len(video_media)
        product["mediaCount"] = len(media)
        product["hasVideo"] = bool(video_media)
        if media:
            first = media[0]
            product["coverImage"] = first.get("poster") if first.get("type") == "video" else first.get("url")

    save_shards(products, shard_by_id)
    update_app_index(products)
    update_catalog_stats(products_with_videos, total_videos)

    report = {
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "totalProductsScanned": len(ordered_ids),
        "productsContainingVideos": products_with_videos,
        "totalVideosDiscovered": total_videos,
        "videosSuccessfullyImportedPreserved": total_videos - failed_videos,
        "failedOrInaccessibleVideos": failed_videos,
        "failedProductDetailScans": len(failures),
        "duplicatePosterImageRecordsRemoved": duplicate_poster_removed,
        "mediaModel": {"type": "image | video", "url": "string", "poster": "video poster only", "sourceMediaId": "string"},
        "notes": [
            "Products are not reclassified.",
            "Category mappings are unchanged.",
            "Video posters are not duplicated as normal images when they match a source image.",
        ],
    }
    write_json(REPORT_PATH, report)
    write_json(SAMPLE_VIDEO_PATH, video_samples)
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
