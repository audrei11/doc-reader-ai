const fs = require("fs");
const path = require("path");

// Manually load .env.local
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}
const { neon } = require("@neondatabase/serverless");

async function main() {
  const sql = neon(process.env.DATABASE_URL);

  await sql`
    CREATE TABLE IF NOT EXISTS documents (
      id SERIAL PRIMARY KEY,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      content TEXT NOT NULL,
      file_size INTEGER,
      page_count INTEGER,
      columns TEXT[],
      uploaded_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS document_data (
      id SERIAL PRIMARY KEY,
      document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
      row_index INTEGER,
      data JSONB
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_document_data_doc_id ON document_data(document_id)`;

  console.log("✅ Database setup complete!");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Setup failed:", err);
  process.exit(1);
});
