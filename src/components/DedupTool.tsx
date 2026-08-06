import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  Download,
  ListChecks,
  Plus,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useCatalog } from "@/lib/catalog";
import {
  parseCsvPhones,
  parseXlsxPhones,
  isXlsxFile,
  runDedup,
  downloadCsv,
  type BrandResult,
  type OverlapEntry,
} from "@/lib/dedup";

type Row = {
  id: string;
  brandId: string;
  brandName: string;
  fileName: string | null;
  rawLines: string[];
};

let nextId = 0;

export function DedupTool() {
  const { data: catalog } = useCatalog();
  const sites = catalog?.sites ?? [];

  const [rows, setRows] = useState<Row[]>([]);
  const [summary, setSummary] = useState<{
    results: BrandResult[];
    overlaps: OverlapEntry[];
  } | null>(null);

  const addRow = () => {
    const used = new Set(rows.map((r) => r.brandId));
    const next = sites.find((s) => !used.has(s.id)) ?? sites[0];
    if (!next) {
      toast.error("No brands available yet — try again in a moment.");
      return;
    }
    setRows((prev) => [
      ...prev,
      {
        id: `row-${nextId++}`,
        brandId: next.id,
        brandName: next.name,
        fileName: null,
        rawLines: [],
      },
    ]);
  };

  const removeRow = (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
    setSummary(null);
  };

  const moveRow = (id: string, dir: -1 | 1) => {
    setRows((prev) => {
      const idx = prev.findIndex((r) => r.id === id);
      const target = idx + dir;
      if (idx < 0 || target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
    setSummary(null);
  };

  const setBrand = (id: string, brandId: string) => {
    const site = sites.find((s) => s.id === brandId);
    if (!site) return;
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, brandId: site.id, brandName: site.name } : r)),
    );
    setSummary(null);
  };

  const handleFile = async (id: string, file: File) => {
    try {
      const lines = isXlsxFile(file)
        ? await parseXlsxPhones(await file.arrayBuffer())
        : parseCsvPhones(await file.text());
      setRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, fileName: file.name, rawLines: lines } : r)),
      );
      setSummary(null);
    } catch {
      toast.error(`Could not read ${file.name}`);
    }
  };

  const canRun = rows.length >= 2 && rows.every((r) => r.rawLines.length > 0);

  const run = () => {
    if (!canRun) return;
    const result = runDedup(
      rows.map((r) => ({ brandId: r.brandId, brandName: r.brandName, rawLines: r.rawLines })),
    );
    setSummary(result);
    const removedTotal = result.overlaps.length;
    toast.success(
      removedTotal > 0
        ? `Found ${removedTotal} overlapping number${removedTotal === 1 ? "" : "s"} — download the cleaned lists below.`
        : "No overlaps found. Every number is unique to its brand.",
    );
  };

  const totalRemoved = summary?.overlaps.length ?? 0;

  const overlapsByPair = useMemo(() => {
    if (!summary) return [];
    const map = new Map<string, number>();
    for (const o of summary.overlaps) {
      const key = `${o.removedFromBrand} → ${o.keptInBrand}`;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [summary]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Cross-brand number dedup
          </CardTitle>
          <CardDescription>
            Upload one phone-number file per brand (CSV or Excel — .csv, .xlsx, .xls). Any number
            that appears in more than one brand is kept in whichever brand you listed first and
            removed from the rest, so each user is only called or texted once. Everything runs in
            your browser — files are never uploaded anywhere.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {rows.length === 0 && (
            <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              Add at least two brands to get started.
            </p>
          )}

          {rows.map((row, idx) => (
            <div
              key={row.id}
              className="flex flex-wrap items-center gap-3 rounded-md border bg-muted/30 p-3"
            >
              <Badge variant="secondary" className="shrink-0">
                Priority {idx + 1}
              </Badge>

              <div className="flex flex-col gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-6"
                  disabled={idx === 0}
                  onClick={() => moveRow(row.id, -1)}
                  title="Move up (higher priority)"
                >
                  <ArrowUp className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-6"
                  disabled={idx === rows.length - 1}
                  onClick={() => moveRow(row.id, 1)}
                  title="Move down (lower priority)"
                >
                  <ArrowDown className="h-3 w-3" />
                </Button>
              </div>

              <div className="w-48 shrink-0">
                <Select value={row.brandId} onValueChange={(v) => setBrand(row.id, v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {sites.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <label className="flex flex-1 min-w-[200px] cursor-pointer items-center gap-2 rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground hover:border-foreground/40">
                <Upload className="h-4 w-4 shrink-0" />
                <span className="truncate">
                  {row.fileName
                    ? `${row.fileName} (${row.rawLines.length} number${row.rawLines.length === 1 ? "" : "s"})`
                    : "Choose CSV or Excel file…"}
                </span>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleFile(row.id, file);
                    e.target.value = "";
                  }}
                />
              </label>

              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => removeRow(row.id)}
                title="Remove brand"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              onClick={addRow}
              disabled={rows.length >= sites.length && sites.length > 0}
            >
              <Plus className="h-4 w-4" />
              Add brand
            </Button>
            <Button onClick={run} disabled={!canRun} className="ml-auto">
              <ListChecks className="h-4 w-4" />
              Find overlaps &amp; dedup
            </Button>
          </div>
          {rows.length >= 2 && !canRun && (
            <p className="text-xs text-muted-foreground">
              Upload a CSV for every brand above before running the dedup.
            </p>
          )}
        </CardContent>
      </Card>

      {summary && (
        <Card>
          <CardHeader>
            <CardTitle>Results</CardTitle>
            <CardDescription>
              {totalRemoved > 0
                ? `${totalRemoved} number${totalRemoved === 1 ? "" : "s"} removed across ${overlapsByPair.length} brand pair${overlapsByPair.length === 1 ? "" : "s"}.`
                : "No cross-brand overlaps found."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Brand</TableHead>
                  <TableHead className="text-right">Uploaded</TableHead>
                  <TableHead className="text-right">In-file dupes</TableHead>
                  <TableHead className="text-right">Removed (overlap)</TableHead>
                  <TableHead className="text-right">Final list</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.results.map((r) => (
                  <TableRow key={r.brandId}>
                    <TableCell className="font-medium">{r.brandName}</TableCell>
                    <TableCell className="text-right">{r.totalLines}</TableCell>
                    <TableCell className="text-right">{r.duplicateInFile}</TableCell>
                    <TableCell className="text-right">
                      {r.removedOverlap.length > 0 ? (
                        <span className="text-destructive">{r.removedOverlap.length}</span>
                      ) : (
                        0
                      )}
                    </TableCell>
                    <TableCell className="text-right font-semibold">{r.kept.length}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1"
                        onClick={() => downloadCsv(`${r.brandName}_deduped.csv`, r.kept)}
                      >
                        <Download className="h-3.5 w-3.5" />
                        CSV
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {totalRemoved > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  className="gap-1"
                  onClick={() =>
                    downloadCsv(
                      "overlap_report.csv",
                      summary.overlaps.map(
                        (o) => `${o.raw},${o.removedFromBrand},${o.keptInBrand}`,
                      ),
                      "phone,removed_from_brand,kept_in_brand",
                    )
                  }
                >
                  <Download className="h-3.5 w-3.5" />
                  Download overlap report
                </Button>
                <span className="text-xs text-muted-foreground">
                  Lists every removed number, which brand it was removed from, and which brand kept
                  it.
                </span>
              </div>
            )}

            {totalRemoved > 0 && (
              <Collapsible>
                <CollapsibleTrigger className="text-xs font-medium text-muted-foreground underline underline-offset-2">
                  Show overlap breakdown by brand pair
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-3">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Removed from → Kept in</TableHead>
                        <TableHead className="text-right">Count</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {overlapsByPair.map(([pair, count]) => (
                        <TableRow key={pair}>
                          <TableCell>{pair}</TableCell>
                          <TableCell className="text-right">{count}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CollapsibleContent>
              </Collapsible>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
