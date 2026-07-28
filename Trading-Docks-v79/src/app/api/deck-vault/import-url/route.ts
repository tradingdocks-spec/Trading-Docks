import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();
    const id = extractMoxfieldId(String(url ?? ""));
    if (!id) return NextResponse.json({ error: "Enter a valid public Moxfield deck URL." }, { status: 400 });

    const endpoints = [
      `https://api2.moxfield.com/v3/decks/all/${id}`,
      `https://api2.moxfield.com/v2/decks/all/${id}`,
    ];

    let payload: any = null;
    for (const endpoint of endpoints) {
      const response = await fetch(endpoint, {
        headers: {
          Accept: "application/json",
          "User-Agent": "TradingDocks-DeckVault/1.0 (+deck import)",
          Referer: `https://www.moxfield.com/decks/${id}`,
        },
        cache: "no-store",
      });
      if (response.ok) { payload = await response.json(); break; }
    }

    if (!payload) {
      return NextResponse.json({ error: "Moxfield did not return this deck. Confirm that the deck is public and try again." }, { status: 502 });
    }

    const lines: string[] = [];
    appendBoard(lines, "Commander", payload.commanders ?? payload.commander);
    appendBoard(lines, "Deck", payload.mainboard ?? payload.mainBoard);
    appendBoard(lines, "Sideboard", payload.sideboard ?? payload.sideBoard);
    appendBoard(lines, "Maybeboard", payload.maybeboard ?? payload.maybeBoard);

    const deckList = lines.join("\n").trim();
    const cardCount = countBoard(payload.commanders ?? payload.commander) + countBoard(payload.mainboard ?? payload.mainBoard) + countBoard(payload.sideboard ?? payload.sideBoard) + countBoard(payload.maybeboard ?? payload.maybeBoard);

    return NextResponse.json({
      source: "Moxfield",
      name: payload.name ?? payload.deckName ?? "Imported Moxfield Deck",
      format: payload.format ?? payload.formatName ?? "Commander",
      deckList,
      cardCount,
    });
  } catch (error) {
    console.error("Moxfield import failed", error);
    return NextResponse.json({ error: "The Moxfield deck could not be loaded right now." }, { status: 500 });
  }
}

function extractMoxfieldId(input: string) {
  const direct = input.trim().match(/^[A-Za-z0-9_-]{8,}$/)?.[0];
  if (direct) return direct;
  try {
    const parsed = new URL(input.trim());
    if (!/(^|\.)moxfield\.com$/i.test(parsed.hostname)) return null;
    return parsed.pathname.match(/\/decks\/([A-Za-z0-9_-]+)/)?.[1] ?? null;
  } catch { return null; }
}

function appendBoard(lines: string[], heading: string, board: any) {
  const entries = normalizeBoard(board);
  if (!entries.length) return;
  if (lines.length) lines.push("");
  lines.push(heading);
  for (const entry of entries) {
    const card = entry.card ?? entry;
    const quantity = Number(entry.quantity ?? entry.count ?? card.quantity ?? 1);
    const name = card.name ?? entry.name;
    if (!name) continue;
    const set = card.set ?? card.setCode ?? card.set_code;
    const collector = card.cn ?? card.collectorNumber ?? card.collector_number;
    lines.push(`${quantity} ${name}${set ? ` (${String(set).toUpperCase()})` : ""}${collector ? ` ${collector}` : ""}`);
  }
}

function normalizeBoard(board: any): any[] {
  if (!board) return [];
  if (Array.isArray(board)) return board;
  if (Array.isArray(board.cards)) return board.cards;
  if (typeof board === "object") return Object.values(board);
  return [];
}

function countBoard(board: any) {
  return normalizeBoard(board).reduce((sum, entry) => sum + Number(entry.quantity ?? entry.count ?? entry.card?.quantity ?? 1), 0);
}
