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

    const { text, pageCount } = result;

    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        { error: "Could not extract text from file." },
        { status: 400 }
      );
    }

    const filename = `${Date.now()}-${file.name.replace(/\s+/g, "_")}`;

    const dbResult = await sql`
      INSERT INTO documents (filename, original_name, content, file_size, page_count)
      VALUES (${filename}, ${file.name}, ${text}, ${file.size}, ${pageCount})
      RETURNING id, original_name, page_count, uploaded_at
    `;

    return NextResponse.json({ success: true, document: dbResult[0] });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
