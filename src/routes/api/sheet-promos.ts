import { createFileRoute } from "@tanstack/react-router";
import { verifyMemberCreds, unauthorized } from "@/server/member-auth.server";

// Promotions sheet: each tab = one website. Row 1 = promotion names,
// row 2 = promotion URLs, row 3 = promotion details (one promotion per column).
const SHEET_ID = "1EJ6rPJf4-xKw2bPLURzTEuTNSMEsGdq4cO7tPjJsr_Q";
const TABS = ["BitBetWin", "BitPlay", "BitofGold", "BitSpinWin", "Win777", "VegasGems"];

type SheetPromo = { name: string; url: string; details: string };
type SheetSite = { name: string; promotions: SheetPromo[] };

let cache: { at: number; data: SheetSite[] } | null = null;
const TTL = 5 * 60 * 1000;

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else q = false;
      } else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (c !== "\r") cell += c;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function clean(s: string) {
  return s.replace(/\u00a0/g, " ").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

async function loadTab(tab: string): Promise<SheetSite> {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Sheet tab ${tab} failed (${res.status})`);
  const rows = parseCsv(await res.text());
  const names = rows[0] ?? [];
  const urls = rows[1] ?? [];
  const details = rows[2] ?? [];
  const promotions: SheetPromo[] = [];
  names.forEach((n, i) => {
    const name = n.trim();
    if (!name) return;
    promotions.push({ name, url: (urls[i] ?? "").trim(), details: clean(details[i] ?? "") });
  });
  return { name: tab, promotions };
}

export const Route = createFileRoute("/api/sheet-promos")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.json().catch(() => ({}));
        if (!(await verifyMemberCreds(body))) return unauthorized();
        const refresh = (body as { refresh?: boolean })?.refresh === true;
        if (!refresh && cache && Date.now() - cache.at < TTL) {
          return Response.json({ sites: cache.data });
        }
        try {
          const data = await Promise.all(TABS.map(loadTab));
          cache = { at: Date.now(), data };
          return Response.json({ sites: data });
        } catch (err) {
          console.error("[sheet-promos]", err);
          if (cache) return Response.json({ sites: cache.data });
          return Response.json({ error: "Could not load the promotions sheet" }, { status: 502 });
        }
      },
    },
  },
});
