// Client-only phone-number dedup logic. Nothing here touches the network —
// phone lists are sensitive and are processed entirely in the browser.

export type BrandFile = {
  brandId: string;
  brandName: string;
  rawLines: string[];
};

export type OverlapEntry = {
  raw: string;
  normalized: string;
  removedFromBrand: string;
  keptInBrand: string;
};

export type BrandResult = {
  brandId: string;
  brandName: string;
  totalLines: number;
  kept: string[];
  duplicateInFile: number;
  invalid: number;
  removedOverlap: OverlapEntry[];
};

export type DedupSummary = {
  results: BrandResult[];
  overlaps: OverlapEntry[];
};

// Normalizes to a comparable key: digits only, US 11-digit numbers with a
// leading "1" collapse to the 10-digit form so "+1 (555) 123-4567",
// "15551234567" and "5551234567" are treated as the same number.
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 7) return null;
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  return digits;
}

// Drops a leading header row (a first entry that doesn't look like a phone
// number) from a column of candidate phone-number values.
function dropHeaderRow(values: string[]): string[] {
  if (values.length > 0 && !normalizePhone(values[0])) {
    return values.slice(1);
  }
  return values;
}

// Splits raw CSV text into candidate phone-number lines. Only the first
// column is used; a header row is dropped automatically.
export function parseCsvPhones(text: string): string[] {
  const lines = text
    .split(/\r\n|\n|\r/)
    .map((l) => l.split(",")[0]?.trim().replace(/^"|"$/g, "") ?? "")
    .filter((l) => l.length > 0);

  return dropHeaderRow(lines);
}

// Parses an .xlsx/.xls workbook and returns the first column of its first
// sheet as candidate phone-number values. Loads the SheetJS library on
// demand so it doesn't bloat the main bundle for users who only use CSV.
export async function parseXlsxPhones(data: ArrayBuffer): Promise<string[]> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(data, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return [];
  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: false,
    blankrows: false,
  });

  const values = rows
    .map((row) => (Array.isArray(row) && row[0] != null ? String(row[0]).trim() : ""))
    .filter((v) => v.length > 0);

  return dropHeaderRow(values);
}

export function isXlsxFile(file: File): boolean {
  return /\.(xlsx|xls)$/i.test(file.name);
}

// Runs the cross-brand dedup. `files` order is priority order — the first
// brand a number appears in keeps it; every later occurrence is removed.
export function runDedup(files: BrandFile[]): DedupSummary {
  const owner = new Map<string, string>();
  const overlaps: OverlapEntry[] = [];

  const results: BrandResult[] = files.map((f) => {
    const seenInFile = new Set<string>();
    const kept: string[] = [];
    const removedOverlap: OverlapEntry[] = [];
    let duplicateInFile = 0;
    let invalid = 0;

    for (const raw of f.rawLines) {
      const norm = normalizePhone(raw);
      if (!norm) {
        invalid++;
        continue;
      }
      if (seenInFile.has(norm)) {
        duplicateInFile++;
        continue;
      }
      seenInFile.add(norm);

      const existingOwner = owner.get(norm);
      if (existingOwner) {
        const entry: OverlapEntry = {
          raw: raw.trim(),
          normalized: norm,
          removedFromBrand: f.brandName,
          keptInBrand: existingOwner,
        };
        removedOverlap.push(entry);
        overlaps.push(entry);
      } else {
        owner.set(norm, f.brandName);
        kept.push(raw.trim());
      }
    }

    return {
      brandId: f.brandId,
      brandName: f.brandName,
      totalLines: f.rawLines.length,
      kept,
      duplicateInFile,
      invalid,
      removedOverlap,
    };
  });

  return { results, overlaps };
}

export function downloadCsv(filename: string, rows: string[], header = "phone") {
  const content = [header, ...rows].join("\n");
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
