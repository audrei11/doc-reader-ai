import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { extractText } from "@/lib/extract";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = await extractText(buffer, file.name);

    if (!result) {
      return NextResponse.json(
        { error: "Unsupported file type. Supported: PDF, DOCX, XLSX, CSV, TXT" },
        { status: 400 }
      );
    }

    const { text, pageCount, columns, rows } = result;

    if (!text || text.trim().length === 0) {
      return NextResponse.json({ error: "Could not extract text from file." }, { status: 400 });
    }

    const filename = `${Date.now()}-${file.name.replace(/\s+/g, "_")}`;

    const dbResult = await sql`
      INSERT INTO documents (filename, original_name, content, file_size, page_count, columns)
      VALUES (${filename}, ${file.name}, ${text}, ${file.size}, ${pageCount}, ${columns ?? null})
      RETURNING id, original_name, page_count, uploaded_at
    `;

    const docId = dbResult[0].id as number;

    if (rows && rows.length > 0) {
      const BATCH = 50;
      for (let i = 0; i < rows.length; i += BATCH) {
        const batch = rows.slice(i, i + BATCH);
        await Promise.all(
          batch.map((row, j) =>
            sql`INSERT INTO document_data (document_id, row_index, data) VALUES (${docId}, ${i + j}, ${JSON.stringify(row)})`
          )
        );
      }
    }

    return NextResponse.json({ success: true, document: dbResult[0] });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
