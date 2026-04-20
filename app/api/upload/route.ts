import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { extractTextFromPDF } from "@/lib/pdf";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!file.name.endsWith(".pdf")) {
      return NextResponse.json(
        { error: "Only PDF files are supported" },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { text, pageCount } = await extractTextFromPDF(buffer);

    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        { error: "Could not extract text from PDF. The file may be scanned/image-based." },
        { status: 400 }
      );
    }

    const filename = `${Date.now()}-${file.name.replace(/\s+/g, "_")}`;

    const result = await sql`
      INSERT INTO documents (filename, original_name, content, file_size, page_count)
      VALUES (${filename}, ${file.name}, ${text}, ${file.size}, ${pageCount})
      RETURNING id, original_name, page_count, uploaded_at
    `;

    return NextResponse.json({ success: true, document: result[0] });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
