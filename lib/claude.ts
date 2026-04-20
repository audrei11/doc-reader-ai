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
      description: "List all uploaded documents/PDFs available in the database.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "read_document",
      description:
        "Read the full text content of a specific document by its ID. Use this to answer questions about a document.",
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
      description:
        "Search for a specific keyword or phrase inside a document. Returns surrounding context of matches.",
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
];

async function executeTool(toolName: string, toolInput: Record<string, unknown>): Promise<string> {
  if (toolName === "list_documents") {
    const docs = await sql`
      SELECT id, original_name, page_count, file_size, uploaded_at
      FROM documents ORDER BY uploaded_at DESC
    `;
    if (docs.length === 0) return "No documents uploaded yet.";
    return JSON.stringify(docs, null, 2);
  }

  if (toolName === "read_document") {
    const id = toolInput.document_id as number;
    const docs = await sql`
      SELECT id, original_name, content, page_count FROM documents WHERE id = ${id}
    `;
    if (docs.length === 0) return `Document with ID ${id} not found.`;
    const doc = docs[0];
    const content = doc.content as string;
    const MAX_CHARS = 25000;
    const truncated = content.length > MAX_CHARS
      ? content.slice(0, MAX_CHARS) + `\n\n[... document continues, ${content.length - MAX_CHARS} more characters. Use search_in_document to find specific sections.]`
      : content;
    return `Document: ${doc.original_name}\nPages: ${doc.page_count}\n\n--- CONTENT ---\n${truncated}`;
  }

  if (toolName === "search_in_document") {
    const id = toolInput.document_id as number;
    const keyword = toolInput.keyword as string;
    const docs = await sql`
      SELECT original_name, content FROM documents WHERE id = ${id}
    `;
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

  return "Unknown tool.";
}

export async function chat(messages: OpenAI.Chat.ChatCompletionMessageParam[]): Promise<string> {
  const systemMessage: OpenAI.Chat.ChatCompletionMessageParam = {
    role: "system",
    content: `You are a document AI assistant. You ONLY answer based on the uploaded documents.

STRICT RULES:
1. ALWAYS call list_documents first to see available documents.
2. ALWAYS use search_in_document with multiple relevant keywords before answering.
3. ONLY use information found in the document. NEVER add your own knowledge or general advice.
4. If the document does not contain the answer, say exactly: "The document does not contain information about this topic."
5. Do NOT make up steps, procedures, or explanations that are not explicitly written in the document.
6. Quote or closely paraphrase the actual text from the document in your answer.`,
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
