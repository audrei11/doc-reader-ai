import { extractTextFromPDF } from "./pdf";

export interface ExtractResult {
  text: string;
  pageCount: number;
  columns?: string[];
  rows?: Record<string, string>[];
}

export async function extractText(
  buffer: Buffer,
  filename: string
): Promise<ExtractResult | null> {
  const lower = filename.toLowerCase();

  if (lower.endsWith(".pdf")) {
    const result = await extractTextFromPDF(buffer);
    return { ...result };
  }

  if (lower.endsWith(".docx")) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return { text: result.value, pageCount: 1 };
  }

  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
    const XLSX = await import("xlsx");
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const allRows: Record<string, string>[] = [];
    const lines: string[] = [];
    let columns: string[] = [];

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      if (json.length > 0 && columns.length === 0) {
        columns = Object.keys(json[0]);
      }
      const rows = json.map((r) =>
        Object.fromEntries(Object.entries(r).map(([k, v]) => [k, String(v)]))
      );
      allRows.push(...rows);
      const csv = XLSX.utils.sheet_to_csv(sheet);
      lines.push(`=== Sheet: ${sheetName} ===\n${csv}`);
    }

    return {
      text: lines.join("\n\n"),
      pageCount: workbook.SheetNames.length,
      columns,
      rows: allRows,
    };
  }

  if (lower.endsWith(".csv")) {
    const text = buffer.toString("utf-8");
    const lines = text.split("\n").filter((l) => l.trim());
    if (lines.length === 0) return { text, pageCount: 1 };

    const columns = lines[0].split("\t").map((c) => c.trim());
    const rows: Record<string, string>[] = [];

    for (let i = 1; i < lines.length; i++) {
      const vals = lines[i].split("\t");
      const row: Record<string, string> = {};
      columns.forEach((col, idx) => {
        row[col] = (vals[idx] || "").trim();
      });
      rows.push(row);
    }

    return { text, pageCount: 1, columns, rows };
  }

  if (lower.endsWith(".txt")) {
    const text = buffer.toString("utf-8");
    return { text, pageCount: 1 };
  }

  return null;
}
