#!/usr/bin/env python3
import argparse
import gzip
import hashlib
import json
import os
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image

BULK_DATA_URL = "https://api.scryfall.com/bulk-data"
USER_AGENT = "TradingDocksCatalogGenerator/1.0 (tradingdocks.com)"
SCHEMA_VERSION = 2
DESCRIPTOR_VERSION = "luma_phash_8x8_v1"
NORMALIZATION_VERSION = "scryfall_full_card_luma8_8x8_mean_v1"
REGRESSION_NAMES = {
    "Incinerate",
    "Goblin War Strike",
    "Lightning Bolt",
    "Sol Ring",
    "Birds of Paradise",
    "Rhystic Study",
    "Runed Stalactite",
    "Krark-Clan Ironworks",
    "Ulalek, Fused Atrocity",
}


def parse_args():
    parser = argparse.ArgumentParser(description="Generate the Trading Docks Magic visual reference index.")
    parser.add_argument("--source", default="auto", help="Scryfall bulk JSON/JSONL path, URL, or 'auto'.")
    parser.add_argument("--out", default="services/generated/magic-visual-descriptor-index.ts")
    parser.add_argument("--cache-dir", default=".cache/scryfall-card-images")
    parser.add_argument("--workers", type=int, default=12)
    parser.add_argument("--max-records", type=int, default=0, help="Test/debug limit. Omit for production generation.")
    parser.add_argument("--min-records", type=int, default=10000)
    parser.add_argument("--allow-missing-regression", action="store_true", help="Debug only. Production generation must omit this.")
    parser.add_argument("--image-version", choices=["small", "normal"], default="small")
    return parser.parse_args()


def fetch_json(url):
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    with urllib.request.urlopen(request, timeout=60) as response:
        return json.loads(response.read().decode("utf-8"))


def read_bytes(location):
    if location.startswith("http://") or location.startswith("https://"):
        request = urllib.request.Request(location, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
        with urllib.request.urlopen(request, timeout=180) as response:
            return response.read()
    return Path(location).read_bytes()


def load_cards(source):
    source_updated_at = None
    bulk_type = "default_cards"
    resolved_source = source
    if source == "auto":
        bulk = fetch_json(BULK_DATA_URL)
        default_bulk = next((entry for entry in bulk.get("data", []) if entry.get("type") == "default_cards"), None)
        if not default_bulk:
            raise RuntimeError("Scryfall bulk-data did not include default_cards.")
        resolved_source = default_bulk.get("jsonl_download_uri") or default_bulk.get("download_uri")
        source_updated_at = default_bulk.get("updated_at")
    raw = read_bytes(resolved_source)
    if str(resolved_source).endswith(".gz"):
        raw = gzip.decompress(raw)
    text = raw.decode("utf-8")
    if str(resolved_source).endswith(".jsonl") or str(resolved_source).endswith(".jsonl.gz"):
        cards = [json.loads(line) for line in text.splitlines() if line.strip()]
    else:
        cards = json.loads(text)
    return cards, {
        "provider": "scryfall",
        "bulkDataType": bulk_type,
        "source": resolved_source,
        "sourceUpdatedAt": source_updated_at,
    }


def card_faces(card):
    faces = card.get("card_faces")
    if isinstance(faces, list) and faces:
        return faces
    return [card]


def image_uri_for(card, face, image_version):
    image_uris = face.get("image_uris") or card.get("image_uris") or {}
    return image_uris.get(image_version) or image_uris.get("normal") or image_uris.get("small")


def candidate_rows(cards, image_version):
    rows = []
    seen_artworks = set()
    printings = 0
    identities = set()
    for card in cards:
        if not card or card.get("digital"):
            continue
        if "paper" not in (card.get("games") or []):
            continue
        if not card.get("id") or not card.get("name") or not card.get("oracle_id"):
            continue
        for face_index, face in enumerate(card_faces(card)):
            image_uri = image_uri_for(card, face, image_version)
            if not image_uri:
                continue
            face_name = face.get("name") or card.get("name")
            oracle_id = card.get("oracle_id")
            identities.add(oracle_id)
            printings += 1
            artwork_key = face.get("illustration_id") or card.get("illustration_id") or f"{card.get('id')}:{face_index}:{image_uri}"
            descriptor_key = f"{oracle_id}:{face_name}:{artwork_key}"
            if descriptor_key in seen_artworks:
                continue
            seen_artworks.add(descriptor_key)
            rows.append({
                "oracleId": oracle_id,
                "scryfallId": card.get("id"),
                "name": face_name,
                "setCode": card.get("set"),
                "collectorNumber": card.get("collector_number"),
                "imageUri": image_uri,
                "artworkKey": artwork_key,
                "layout": card.get("layout"),
                "frame": card.get("frame"),
            })
    return rows, {"oracleIdentities": len(identities), "printings": printings, "uniqueArtworks": len(seen_artworks)}


def cache_path(cache_dir, image_uri):
    digest = hashlib.sha256(image_uri.encode("utf-8")).hexdigest()
    return Path(cache_dir) / f"{digest}.jpg"


def download_image(image_uri, destination):
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.exists() and destination.stat().st_size > 0:
        return destination
    if not image_uri.startswith("http://") and not image_uri.startswith("https://"):
        local_path = Path(image_uri[7:] if image_uri.startswith("file://") else image_uri)
        destination.write_bytes(local_path.read_bytes())
        return destination
    request = urllib.request.Request(image_uri, headers={"User-Agent": USER_AGENT, "Accept": "image/*"})
    with urllib.request.urlopen(request, timeout=45) as response:
        destination.write_bytes(response.read())
    return destination


def luma_hash(image_path):
    with Image.open(image_path) as image:
        normalized = image.convert("L").resize((8, 8), Image.Resampling.LANCZOS)
        values = list(normalized.getdata())
    mean = sum(values) / len(values)
    bits = "".join("1" if value >= mean else "0" for value in values)
    return f"{int(bits[:32], 2):08x}{int(bits[32:], 2):08x}"


def descriptor_for(row, cache_dir):
    image_path = cache_path(cache_dir, row["imageUri"])
    download_image(row["imageUri"], image_path)
    return {
        "o": row["oracleId"],
        "s": row["scryfallId"],
        "n": row["name"],
        "c": row["setCode"],
        "cn": row["collectorNumber"],
        "h": luma_hash(image_path),
    }


def generate_descriptors(rows, cache_dir, workers):
    records = []
    failures = []
    started = time.perf_counter()
    with ThreadPoolExecutor(max_workers=max(1, workers)) as pool:
        futures = {pool.submit(descriptor_for, row, cache_dir): row for row in rows}
        for index, future in enumerate(as_completed(futures), start=1):
            row = futures[future]
            try:
                records.append(future.result())
            except (OSError, urllib.error.URLError, urllib.error.HTTPError, TimeoutError) as error:
                failures.append({"name": row["name"], "scryfallId": row["scryfallId"], "error": str(error)})
            if index % 1000 == 0:
                elapsed = max(1, time.perf_counter() - started)
                print(f"Processed {index}/{len(rows)} reference images ({index / elapsed:.1f}/sec)")
    return sorted(records, key=lambda record: (record["n"], record["c"] or "", record["cn"] or "", record["s"])), failures


def json_literal(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def write_index(out_path, records, source, counts, failures, started_at, cache_dir):
    generated_at = datetime.now(timezone.utc).isoformat()
    payload_json = json_literal(records)
    metadata = {
        "provider": "scryfall",
        "source": source["source"],
        "bulkDataType": source["bulkDataType"],
        "sourceUpdatedAt": source["sourceUpdatedAt"],
        "generatedAt": generated_at,
        "schemaVersion": SCHEMA_VERSION,
        "descriptorVersion": DESCRIPTOR_VERSION,
        "normalizationVersion": NORMALIZATION_VERSION,
        "imageVersion": "small",
        "recordCount": len(records),
        "oracleIdentityCount": counts["oracleIdentities"],
        "uniqueArtworkCount": counts["uniqueArtworks"],
        "printingCount": counts["printings"],
        "generationMs": round((time.perf_counter() - started_at) * 1000),
        "failedImageCount": len(failures),
        "refreshCommand": "npm run catalog:magic-visual-index",
        "notes": "Generated from Scryfall paper default_cards reference images. Runtime bundle contains compact descriptors only; source artwork remains in ignored local cache.",
    }
    stats = {
        "recordCount": len(records),
        "storageBytes": len(payload_json.encode("utf-8")),
        "oracleIdentityCount": counts["oracleIdentities"],
        "uniqueArtworkCount": counts["uniqueArtworks"],
        "printingCount": counts["printings"],
        "failedImageCount": len(failures),
    }
    content = (
        "// Generated by mobile/scripts/generate-magic-visual-index.py. Do not edit by hand.\n"
        "export type GeneratedMagicVisualDescriptorRecord = {o:string;s:string;n:string;c:string|null;cn:string|null;h:string};\n"
        f"export const MAGIC_VISUAL_DESCRIPTOR_INDEX_SOURCE = {json.dumps(metadata, ensure_ascii=False, indent=2)} as const;\n"
        f"export const MAGIC_VISUAL_DESCRIPTOR_RECORDS: readonly GeneratedMagicVisualDescriptorRecord[] = {payload_json};\n"
        f"export const MAGIC_VISUAL_DESCRIPTOR_INDEX_STATS = {json.dumps(stats, ensure_ascii=False, indent=2)} as const;\n"
    )
    out = Path(out_path)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(content, encoding="utf-8")
    if failures:
        failure_path = Path(cache_dir) / "last-failures.json"
        failure_path.parent.mkdir(parents=True, exist_ok=True)
        failure_path.write_text(json.dumps(failures[:500], indent=2), encoding="utf-8")
    return metadata, stats


def main():
    args = parse_args()
    started_at = time.perf_counter()
    cards, source = load_cards(args.source)
    rows, counts = candidate_rows(cards, args.image_version)
    if args.max_records:
        rows = rows[:args.max_records]
    records, failures = generate_descriptors(rows, args.cache_dir, args.workers)
    if len(records) < args.min_records:
        raise RuntimeError(f"Generated {len(records)} descriptors, below required floor {args.min_records}.")
    missing = sorted(name for name in REGRESSION_NAMES if not any(record["n"] == name for record in records))
    if missing and not args.allow_missing_regression:
        raise RuntimeError(f"Generated index is missing regression cards: {', '.join(missing)}")
    metadata, stats = write_index(args.out, records, source, counts, failures, started_at, args.cache_dir)
    print(json.dumps({
        "out": args.out,
        "recordCount": stats["recordCount"],
        "oracleIdentityCount": stats["oracleIdentityCount"],
        "uniqueArtworkCount": stats["uniqueArtworkCount"],
        "printingCount": stats["printingCount"],
        "storageBytes": stats["storageBytes"],
        "failedImageCount": stats["failedImageCount"],
        "descriptorVersion": metadata["descriptorVersion"],
        "normalizationVersion": metadata["normalizationVersion"],
    }, indent=2))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(exc, file=sys.stderr)
        sys.exit(1)
