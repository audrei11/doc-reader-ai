import OpenAI from "openai";
import { sql } from "./db";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const tools: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "list_documents",
      description: "List all uploaded documents/files available in the database.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "read_document",
      description: "Read the full text content of a specific document by its ID.",
      parameters: {
        type: "object",
        properties: {
          document_id: { type: "number", description: "The ID of the document to read" },
        },
        required: ["document_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_in_document",
      description: "Search for a specific keyword or phrase inside a document.",
      parameters: {
        type: "object",
        properties: {
          document_id: { type: "number", description: "The ID of the document to search in" },
          keyword: { type: "string", description: "The keyword or phrase to search for" },
        },
        required: ["document_id", "keyword"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_columns",
      description: "Get the column names of a spreadsheet/CSV document. Use this before calculating.",
      parameters: {
        type: "object",
        properties: {
          document_id: { type: "number", description: "The ID of the document" },
        },
        required: ["document_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "calculate",
      description: "Calculate SUM, COUNT, AVERAGE, MIN, or MAX on a column of a spreadsheet. Optionally filter by another column value.",
      parameters: {
        type: "object",
        properties: {
          document_id: { type: "number" },
          operation: { type: "string", enum: ["sum", "count", "average", "min", "max"] },
          column: { type: "string", description: "Column name to aggregate" },
          filter_column: { type: "string", description: "Optional column to filter by" },
          filter_value: { type: "string", description: "Value to filter by (partial match)" },
        },
        required: ["document_id", "operation", "column"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_rows",
      description: "Get rows from a spreadsheet filtered by a column value. Use for listing or analyzing specific data.",
      parameters: {
        type: "object",
        properties: {
          document_id: { type: "number" },
          filter_column: { type: "string", description: "Column to filter by" },
          filter_value: { type: "string", description: "Value to match (partial)" },
          limit: { type: "number", description: "Max rows to return (default 50)" },
        },
        required: ["document_id"],
      },
    },
  },
];

async function executeTool(toolName: string, toolInput: Record<string, unknown>): Promise<string> {
  if (toolName === "list_documents") {
    const docs = await sql`
      SELECT id, original_name, page_count, file_size, uploaded_at, columns
      FROM documents ORDER BY uploaded_at DESC
    `;
    if (docs.length === 0) return "No documents uploaded yet.";
    return JSON.stringify(docs, null, 2);
  }

  if (toolName === "read_document") {
    const id = toolInput.document_id as number;
    const docs = await sql`SELECT id, original_name, content, page_count FROM documents WHERE id = ${id}`;
    if (docs.length === 0) return `Document with ID ${id} not found.`;
    const doc = docs[0];
    const content = doc.content as string;
    const MAX_CHARS = 25000;
    const truncated = content.length > MAX_CHARS
      ? content.slice(0, MAX_CHARS) + `\n\n[... truncated. Use search_in_document for specific sections.]`
      : content;
    return `Document: ${doc.original_name}\nPages: ${doc.page_count}\n\n--- CONTENT ---\n${truncated}`;
  }

  if (toolName === "search_in_document") {
    const id = toolInput.document_id as number;
    const keyword = toolInput.keyword as string;
    const docs = await sql`SELECT original_name, content FROM documents WHERE id = ${id}`;
    if (docs.length === 0) return `Document with ID ${id} not found.`;
    const content = docs[0].content as string;
    const lower = content.toLowerCase();
    const kw = keyword.toLowerCase();
    const matches: string[] = [];
    let pos = 0;
    while ((pos = lower.indexOf(kw, pos)) !== -1 && matches.length < 5) {
      const start = Math.max(0, pos - 200);
      const end = Math.min(content.length, pos + 200);
      matches.push(`...${content.slice(start, end)}...`);
      pos += kw.length;
    }
    if (matches.length === 0) return `Keyword "${keyword}" not found in document.`;
    return `Found ${matches.length} match(es) for "${keyword}":\n\n${matches.join("\n\n---\n\n")}`;
  }

  if (toolName === "get_columns") {
    const id = toolInput.document_id as number;
    const docs = await sql`SELECT columns, original_name FROM documents WHERE id = ${id}`;
    if (docs.length === 0) return `Document not found.`;
    const columns = docs[0].columns;
    if (!columns) return `This document (${docs[0].original_name}) has no structured columns — it's a PDF or text file.`;
    return `Columns in ${docs[0].original_name}:\n${(columns as string[]).join("\n")}`;
  }

  if (toolName === "calculate") {
    const id = toolInput.document_id as number;
    const operation = toolInput.operation as string;
    const column = toolInput.column as string;
    const filterColumn = toolInput.filter_column as string | undefined;
    const filterValue = toolInput.filter_value as string | undefined;

    const doc = await sql`SELECT columns FROM documents WHERE id = ${id}`;
    if (doc.length === 0) return "Document not found.";
    const validColumns = doc[0].columns as string[] | null;
    if (!validColumns) return "This document has no structured data. Only spreadsheets/CSV support calculations.";
    if (!validColumns.includes(column)) return `Column "${column}" not found. Available columns: ${validColumns.join(", ")}`;
    if (filterColumn && !validColumns.includes(filterColumn)) return `Filter column "${filterColumn}" not found.`;

    let rows;
    if (filterColumn && filterValue) {
      rows = await sql`SELECT data FROM document_data WHERE document_id = ${id} AND data->>${filterColumn} ILIKE ${"%" + filterValue + "%"}`;
    } else {
      rows = await sql`SELECT data FROM document_data WHERE document_id = ${id}`;
    }

    if (rows.length === 0) return "No rows found matching the filter.";

    const values = rows
      .map((r) => {
        const val = (r.data as Record<string, string>)[column];
        return parseFloat(val?.replace(/,/g, "") || "0");
      })
      .filter((v) => !isNaN(v));

    if (values.length === 0) return `No numeric values found in column "${column}".`;

    let result: number;
    if (operation === "sum") result = values.reduce((a, b) => a + b, 0);
    else if (operation === "average") result = values.reduce((a, b) => a + b, 0) / values.length;
    else if (operation === "count") result = rows.length;
    else if (operation === "min") result = Math.min(...values);
    else if (operation === "max") result = Math.max(...values);
    else return "Unknown operation.";

    const filterDesc = filterColumn && filterValue ? ` (filtered: ${filterColumn} = "${filterValue}")` : "";
    return `${operation.toUpperCase()} of "${column}"${filterDesc}: ${result.toLocaleString()} (from ${rows.length} rows)`;
  }

  if (toolName === "get_rows") {
    const id = toolInput.document_id as number;
    const filterColumn = toolInput.filter_column as string | undefined;
    const filterValue = toolInput.filter_value as string | undefined;
    const limit = (toolInput.limit as number) || 50;

    let rows;
    if (filterColumn && filterValue) {
      rows = await sql`SELECT data FROM document_data WHERE document_id = ${id} AND data->>${filterColumn} ILIKE ${"%" + filterValue + "%"} LIMIT ${limit}`;
    } else {
      rows = await sql`SELECT data FROM document_data WHERE document_id = ${id} LIMIT ${limit}`;
    }

    if (rows.length === 0) return "No rows found.";
    const data = rows.map((r) => r.data);
    return `Found ${rows.length} rows:\n${JSON.stringify(data, null, 2)}`;
  }

  return "Unknown tool.";
}

export async function chat(messages: OpenAI.Chat.ChatCompletionMessageParam[]): Promise<string> {
  const systemMessage: OpenAI.Chat.ChatCompletionMessageParam = {
    role: "system",
    content: `You are a document AI assistant that can read, search, and calculate data from uploaded files.

STRICT RULES:
1. ALWAYS call list_documents first to see available documents.
2. For spreadsheets/CSV: use get_columns first, then calculate or get_rows.
3. For calculations (total, sum, average, count): ALWAYS use the calculate tool — never estimate.
4. For PDFs/text: use search_in_document with relevant keywords.
5. ONLY use information from documents. Do not guess or add your own knowledge.
6. If the document does not contain the answer, say so explicitly.`,
  };

  const currentMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [systemMessage, ...messages];

  while (true) {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: currentMessages,
      tools,
      tool_choice: "auto",
    });

    const choice = response.choices[0];

    if (choice.finish_reason === "stop") {
      return choice.message.content ?? "";
    }

    if (choice.finish_reason === "tool_calls" && choice.message.tool_calls) {
      currentMessages.push(choice.message);

      for (const toolCall of choice.message.tool_calls) {
        if (toolCall.type !== "function") continue;
        const toolInput = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
        const result = await executeTool(toolCall.function.name, toolInput);
        currentMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: result,
        });
      }

      continue;
    }

    break;
  }

  return "Sorry, something went wrong.";
}
