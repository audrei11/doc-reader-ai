import { extractTextFromPDF } from "./pdf";

export async function extractText(
  buffer: Buffer,
  filename: string
): Promise<{ text: string; pageCount: number } | null> {
  const lower = filename.toLowerCase();

  if (lower.endsWith(".pdf")) {
    return await extractTextFromPDF(buffer);
  }

  if (lower.endsWith(".docx")) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return { text: result.value, pageCount: 1 };
  }

  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
    const XLSX = await import("xlsx");
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const lines: string[] = [];
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const csv = XLSX.utils.sheet_to_csv(sheet);
      lines.push(`=== Sheet: ${sheetName} ===\n${csv}`);
    }
    return { text: lines.join("\n\n"), pageCount: workbook.SheetNames.length };
  }

  if (lower.endsWith(".csv")) {
    const text = buffer.toString("utf-8");
    return { text, pageCount: 1 };
  }

  if (lower.endsWith(".txt")) {
    const text = buffer.toString("utf-8");
    return { text, pageCount: 1 };
  }

  return null;
}
