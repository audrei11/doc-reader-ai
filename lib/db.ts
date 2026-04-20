import { neon } from "@neondatabase/serverless";

function getDb() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }
  return neon(process.env.DATABASE_URL);
}

export function sql(strings: TemplateStringsArray, ...values: unknown[]) {
  return getDb()(strings, ...values);
}
