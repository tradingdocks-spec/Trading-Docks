import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const outputDirectory = path.join(
  process.cwd(),
  "public",
  "market-cards",
);

const cards = [
  {
    filename: "mana-crypt.jpg",
    name: "Mana Crypt",
    set: "mps",
    collectorNumber: "16",
  },
  {
    filename: "force-of-will.jpg",
    name: "Force of Will",
    set: "all",
    collectorNumber: "28",
  },
  {
    filename: "the-one-ring.jpg",
    name: "The One Ring",
    set: "ltr",
    collectorNumber: "246",
  },
  {
    filename: "underground-sea.jpg",
    name: "Underground Sea",
    set: "3ed",
    collectorNumber: "290",
  },
];

await fs.mkdir(outputDirectory, { recursive: true });

let failures = 0;

for (const card of cards) {
  const outputPath = path.join(outputDirectory, card.filename);

  try {
    const image = await downloadCardImage(card);
    await fs.writeFile(outputPath, image);

    console.log(
      `✓ ${card.name} saved to public/market-cards/${card.filename}`,
    );
  } catch (error) {
    failures += 1;
    console.error(
      `✗ ${card.name}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  await wait(125);
}

if (failures) {
  console.error(
    `\n${failures} card image${
      failures === 1 ? "" : "s"
    } could not be downloaded.`,
  );
  console.error(
    "Confirm that api.scryfall.com is reachable, then rerun this script.",
  );
  process.exitCode = 1;
} else {
  console.log("\nAll homepage card images are now stored locally.");
}

async function downloadCardImage(card) {
  const collectorUrl =
    `https://api.scryfall.com/cards/` +
    `${encodeURIComponent(card.set)}/` +
    `${encodeURIComponent(card.collectorNumber)}` +
    "?format=image&version=normal";

  const collectorResponse = await requestImage(collectorUrl);

  if (collectorResponse) {
    return collectorResponse;
  }

  const params = new URLSearchParams({
    exact: card.name,
    set: card.set,
    format: "image",
    version: "normal",
  });

  const namedUrl =
    `https://api.scryfall.com/cards/named?${params.toString()}`;

  const namedResponse = await requestImage(namedUrl);

  if (namedResponse) {
    return namedResponse;
  }

  throw new Error(
    "Scryfall did not return a valid image from either endpoint.",
  );
}

async function requestImage(url) {
  const response = await fetch(url, {
    headers: {
      Accept:
        "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      "User-Agent":
        "TradingDocks/1.0 (homepage market-card image cache)",
    },
    redirect: "follow",
  });

  if (!response.ok) {
    console.warn(`  ${response.status} from ${url}`);
    return null;
  }

  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.startsWith("image/")) {
    console.warn(
      `  Expected image content but received ${contentType || "unknown"}.`,
    );
    return null;
  }

  const buffer = Buffer.from(await response.arrayBuffer());

  if (buffer.byteLength < 10_000) {
    console.warn("  Image response was unexpectedly small.");
    return null;
  }

  return buffer;
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
