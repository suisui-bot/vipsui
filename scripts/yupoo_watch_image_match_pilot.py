from __future__ import annotations

import json
import math
import os
import re
import shutil
import struct
import subprocess
import tempfile
import urllib.request
import zlib
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
APP_PRODUCT_INDEX = ROOT / "app" / "data" / "productIndex.json"
YUPOO_PRODUCTS = ROOT / "data" / "products.json"
REPORT_PATH = ROOT / "data" / "pricing" / "yupoo-watch-image-match-pilot-report.json"
CACHE_DIR = ROOT / "data" / "pricing" / "yupoo-watch-image-match-cache"
WATCH_TOP_CATEGORY = "高端腕表"

BRAND_MAP = {
    "劳力士": "Rolex",
    "AP爱彼": "Audemars Piguet",
    "卡地亚": "Cartier",
    "百达翡丽": "Patek Philippe",
    "理查德·米勒": "Richard Mille",
    "欧米茄": "Omega",
    "宇舶": "Hublot",
    "万国": "IWC",
    "江诗丹顿": "Vacheron Constantin",
    "浪琴": "Longines",
    "积家": "Jaeger-LeCoultre",
    "百年灵": "Breitling",
    "宝格丽⌚️": "BVLGARI",
    "沛纳海": "Panerai",
    "帝陀": "Tudor",
}

SETTINGS = {
    "shippingCostRMB": 100,
    "packagingCostRMB": 10,
    "paymentFeePercent": 4.5,
    "exchangeRateBufferPercent": 2,
    "riskReservePercent": 5,
    "exchangeRateRMBPerUSD": 7.2,
    "profitMultiplier": 1.45,
}


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def clean(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def decode_supplier_cost_rmb(numeric_code: str) -> int | None:
    digits = re.sub(r"\D", "", numeric_code)
    if len(digits) == 7:
        return int(digits[2:5])
    if len(digits) == 8:
        return int(digits[2:6])
    return None


def round_customer_price(raw: float) -> int:
    return math.ceil((math.ceil(raw) + 1) / 10) * 10 - 1


def calculate_price(supplier_cost_rmb: int) -> dict[str, Any]:
    base = supplier_cost_rmb + SETTINGS["shippingCostRMB"] + SETTINGS["packagingCostRMB"]
    reserve = (SETTINGS["paymentFeePercent"] + SETTINGS["exchangeRateBufferPercent"] + SETTINGS["riskReservePercent"]) / 100
    adjusted = base * (1 + reserve)
    raw = adjusted * SETTINGS["profitMultiplier"] / SETTINGS["exchangeRateRMBPerUSD"]
    return {
        "supplierCostRMB": supplier_cost_rmb,
        "shippingCostRMB": SETTINGS["shippingCostRMB"],
        "packagingCostRMB": SETTINGS["packagingCostRMB"],
        "adjustedCostRMB": round(adjusted, 2),
        "rawSellingPriceUSD": round(raw, 2),
        "finalSellingPriceUSD": round_customer_price(raw),
    }


def local_path(public_path: str) -> Path:
    return ROOT / "public" / public_path.lstrip("/")


def download_image(url: str, dest: Path) -> Path | None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    try:
        with urllib.request.urlopen(request, timeout=25) as response:
            data = response.read()
    except Exception:
        return None
    if len(data) < 1024:
        return None
    dest.write_bytes(data)
    return dest


def png_pixels(path: Path) -> tuple[int, int, list[tuple[int, int, int]]]:
    data = path.read_bytes()
    if not data.startswith(b"\x89PNG\r\n\x1a\n"):
        raise ValueError("not png")
    offset = 8
    width = height = color_type = bit_depth = None
    chunks: list[bytes] = []
    while offset < len(data):
        size = struct.unpack(">I", data[offset : offset + 4])[0]
        kind = data[offset + 4 : offset + 8]
        payload = data[offset + 8 : offset + 8 + size]
        offset += 12 + size
        if kind == b"IHDR":
            width, height, bit_depth, color_type = struct.unpack(">IIBB", payload[:10])[:4]
        elif kind == b"IDAT":
            chunks.append(payload)
        elif kind == b"IEND":
            break
    if bit_depth != 8 or color_type not in {0, 2, 6} or width is None or height is None:
        raise ValueError("unsupported png")
    channels = {0: 1, 2: 3, 6: 4}[color_type]
    raw = zlib.decompress(b"".join(chunks))
    stride = width * channels
    rows: list[bytearray] = []
    pos = 0
    for _ in range(height):
        filter_type = raw[pos]
        pos += 1
        row = bytearray(raw[pos : pos + stride])
        pos += stride
        prev = rows[-1] if rows else bytearray(stride)
        for i in range(stride):
            left = row[i - channels] if i >= channels else 0
            up = prev[i]
            up_left = prev[i - channels] if i >= channels else 0
            if filter_type == 1:
                row[i] = (row[i] + left) & 0xFF
            elif filter_type == 2:
                row[i] = (row[i] + up) & 0xFF
            elif filter_type == 3:
                row[i] = (row[i] + ((left + up) // 2)) & 0xFF
            elif filter_type == 4:
                p = left + up - up_left
                pa, pb, pc = abs(p - left), abs(p - up), abs(p - up_left)
                predictor = left if pa <= pb and pa <= pc else up if pb <= pc else up_left
                row[i] = (row[i] + predictor) & 0xFF
            elif filter_type != 0:
                raise ValueError("unsupported filter")
        rows.append(row)
    pixels: list[tuple[int, int, int]] = []
    for row in rows:
        for x in range(width):
            start = x * channels
            if color_type == 0:
                v = row[start]
                pixels.append((v, v, v))
            else:
                pixels.append((row[start], row[start + 1], row[start + 2]))
    return width, height, pixels


def resized_png(source: Path, width: int, height: int) -> Path:
    tmp = Path(tempfile.mkstemp(suffix=".png")[1])
    subprocess.run(
        ["sips", "-s", "format", "png", "-z", str(height), str(width), str(source), "--out", str(tmp)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        check=True,
    )
    return tmp


def dhash(source: Path) -> int | None:
    tmp: Path | None = None
    try:
        tmp = resized_png(source, 9, 8)
        width, height, pixels = png_pixels(tmp)
        if width != 9 or height != 8:
            return None
        gray = [(r * 299 + g * 587 + b * 114) // 1000 for r, g, b in pixels]
        value = 0
        for y in range(8):
            for x in range(8):
                value = (value << 1) | (1 if gray[y * 9 + x] > gray[y * 9 + x + 1] else 0)
        return value
    except Exception:
        return None
    finally:
        if tmp and tmp.exists():
            tmp.unlink()


def hamming(a: int, b: int) -> int:
    return bin(a ^ b).count("1")


def select_pilot_products(products: list[dict[str, Any]], limit: int = 20) -> list[dict[str, Any]]:
    watches = [p for p in products if (p.get("categoryPath") or [""])[0] == WATCH_TOP_CATEGORY]
    selected: list[dict[str, Any]] = []
    seen_collections: set[str] = set()
    for product in watches:
        collection = clean(product.get("collection"))
        if collection and collection not in seen_collections:
            selected.append(product)
            seen_collections.add(collection)
        if len(selected) >= limit:
            return selected
    for product in watches:
        if product not in selected:
            selected.append(product)
        if len(selected) >= limit:
            break
    return selected


def candidate_yupoo_products(vipsui: dict[str, Any], yupoo_products: list[dict[str, Any]]) -> list[dict[str, Any]]:
    brand = BRAND_MAP.get(clean(vipsui.get("collection")))
    if brand:
        branded = [p for p in yupoo_products if p.get("brand") == brand]
        if branded:
            return branded
    return yupoo_products


def main() -> None:
    products = load_json(APP_PRODUCT_INDEX)
    yupoo_products = load_json(YUPOO_PRODUCTS)
    pilot = select_pilot_products(products)

    yupoo_hashes: dict[str, list[dict[str, Any]]] = {}
    for product in yupoo_products:
        records: list[dict[str, Any]] = []
        for image in (product.get("galleryImages") or [])[:3]:
            path = local_path(image)
            if not path.exists():
                continue
            value = dhash(path)
            if value is not None:
                records.append({"image": image, "hash": value})
        yupoo_hashes[product["albumId"]] = records

    rows: list[dict[str, Any]] = []
    verified = 0
    for product in pilot:
        source_images = [product.get("coverImage"), *(product.get("galleryImages") or [])[:2]]
        source_images = [image for image in source_images if image]
        vipsui_records: list[dict[str, Any]] = []
        for index, image in enumerate(source_images, start=1):
            if str(image).startswith("http"):
                image_path = download_image(image, CACHE_DIR / product["albumId"] / f"{index:02d}.jpg")
            else:
                image_path = local_path(image)
            if image_path and image_path.exists():
                value = dhash(image_path)
                if value is not None:
                    vipsui_records.append({"image": image, "hash": value})

        candidates = candidate_yupoo_products(product, yupoo_products)
        best: dict[str, Any] | None = None
        for candidate in candidates:
            distances: list[tuple[int, str, str]] = []
            for a in vipsui_records:
                for b in yupoo_hashes.get(candidate["albumId"], []):
                    distances.append((hamming(a["hash"], b["hash"]), a["image"], b["image"]))
            if not distances:
                continue
            distance, vipsui_image, yupoo_image = min(distances, key=lambda item: item[0])
            score = round(1 - distance / 64, 4)
            if best is None or score > best["imageSimilarityScore"]:
                best = {
                    "candidate": candidate,
                    "vipsuiImage": vipsui_image,
                    "matchedYupooImage": yupoo_image,
                    "hashDistance": distance,
                    "imageSimilarityScore": score,
                }

        accepted = bool(best and best["hashDistance"] <= 6)
        price = None
        if accepted:
            code = clean(best["candidate"].get("productNumber"))
            supplier = decode_supplier_cost_rmb(code)
            if supplier and supplier > 0:
                price = calculate_price(supplier)
                verified += 1
            else:
                accepted = False

        candidate = best["candidate"] if best else {}
        rows.append(
            {
                "vipsuiProductId": product.get("albumId"),
                "vipsuiProductNumber": product.get("productNumber"),
                "vipsuiBrandOrCategory": product.get("collection"),
                "vipsuiImage": best["vipsuiImage"] if best else (source_images[0] if source_images else ""),
                "matchedYupooProductUrl": candidate.get("yupooUrl") if accepted else None,
                "matchedYupooProductId": candidate.get("albumId") if accepted else None,
                "matchedYupooImage": best["matchedYupooImage"] if accepted and best else None,
                "matchConfidence": "verified_high" if accepted else "needs_review",
                "matchMethod": "brand_scoped_multi_image_dhash" if best else "no_candidate_hash",
                "hashDistance": best["hashDistance"] if best else None,
                "imageSimilarityScore": best["imageSimilarityScore"] if best else None,
                "numericSupplierCode": candidate.get("productNumber") if accepted else None,
                **(price or {
                    "supplierCostRMB": None,
                    "shippingCostRMB": SETTINGS["shippingCostRMB"],
                    "packagingCostRMB": SETTINGS["packagingCostRMB"],
                    "adjustedCostRMB": None,
                    "rawSellingPriceUSD": None,
                    "finalSellingPriceUSD": None,
                }),
                "acceptedForPricing": accepted,
                "reviewReason": None if accepted else "No high-confidence Yupoo image match and valid supplier code.",
            }
        )

    report = {
        "generatedAt": __import__("datetime").datetime.utcnow().isoformat() + "Z",
        "sourceYupooCatalog": "https://1688dafan.x.yupoo.com/",
        "pilotSize": len(rows),
        "verifiedMatches": verified,
        "needsReview": len(rows) - verified,
        "acceptanceRule": "dHash distance <= 6 within mapped brand and valid 7/8 digit Yupoo supplier code",
        "products": rows,
    }
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
