export function parseSimpleCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];
    if (character === '"' && quoted && next === '"') { cell += '"'; index += 1; continue; }
    if (character === '"') { quoted = !quoted; continue; }
    if (character === "," && !quoted) { row.push(cell.trim()); cell = ""; continue; }
    if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && next === "\n") index += 1;
      row.push(cell.trim()); cell = "";
      if (row.some((value) => value.length)) rows.push(row);
      row = [];
      continue;
    }
    cell += character;
  }
  row.push(cell.trim());
  if (row.some((value) => value.length)) rows.push(row);
  if (rows.length < 2) throw new Error("The CSV needs a header row and at least one card row.");
  const headers = rows[0].map((header) => header.trim().toLowerCase());
  return rows.slice(1).map((values, index) => ({
    sourceRow: index + 2,
    values: Object.fromEntries(headers.map((header, headerIndex) => [header, values[headerIndex] ?? ""])),
  }));
}

export function csvValue(values: Record<string, string>, ...keys: string[]) {
  const key = keys.find((candidate) => values[candidate]?.trim());
  return key ? values[key].trim() : "";
}
