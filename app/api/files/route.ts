import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    const docs = await sql`
      SELECT id, original_name, page_count, file_size, uploaded_at
      FROM documents
      ORDER BY uploaded_at DESC
    `;
    return NextResponse.json({ documents: docs });
  } catch (err) {
    console.error("Files fetch error:", err);
    return NextResponse.json({ error: "Failed to fetch files" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { id } = await req.json();
    await sql`DELETE FROM documents WHERE id = ${id}`;
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Delete error:", err);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
