import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

export const sql = neon(process.env.DATABASE_URL);

export async function setupDatabase() {
  await sql`
    CREATE TABLE IF NOT EXISTS documents (
      id SERIAL PRIMARY KEY,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      content TEXT NOT NULL,
      file_size INTEGER,
      page_count INTEGER,
      uploaded_at TIMESTAMP DEFAULT NOW()
    )
  `;
}
