import Anthropic from "@anthropic-ai/sdk";
import { sql } from "./db";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const tools: Anthropic.Tool[] = [
  {
    name: "list_documents",
    description: "List all uploaded documents/PDFs available in the database.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "read_document",
    description:
      "Read the full text content of a specific document by its ID or filename. Use this to answer questions about a document.",
    input_schema: {
      type: "object" as const,
      properties: {
        document_id: {
          type: "number",
          description: "The ID of the document to read",
        },
      },
      required: ["document_id"],
    },
  },
  {
    name: "search_in_document",
    description:
      "Search for a specific keyword or phrase inside a document. Returns surrounding context of matches.",
    input_schema: {
      type: "object" as const,
      properties: {
        document_id: {
          type: "number",
          description: "The ID of the document to search in",
        },
        keyword: {
          type: "string",
          description: "The keyword or phrase to search for",
        },
      },
      required: ["document_id", "keyword"],
    },
  },
];

async function executeTool(
  toolName: string,
  toolInput: Record<string, unknown>
): Promise<string> {
  if (toolName === "list_documents") {
    const docs = await sql`
      SELECT id, original_name, page_count, file_size, uploaded_at
      FROM documents
      ORDER BY uploaded_at DESC
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
    return `Document: ${doc.original_name}\nPages: ${doc.page_count}\n\n--- CONTENT ---\n${doc.content}`;
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

    if (matches.length === 0)
      return `Keyword "${keyword}" not found in document.`;
    return `Found ${matches.length} match(es) for "${keyword}":\n\n${matches.join("\n\n---\n\n")}`;
  }

  return "Unknown tool.";
}

export async function chat(
  messages: Anthropic.MessageParam[]
): Promise<string> {
  let currentMessages = [...messages];

  while (true) {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8096,
      system: `You are a helpful AI assistant that can read and analyze documents uploaded by the user.
When the user asks about a document or book, use your tools to find and read the relevant content.
Always look for documents first using list_documents, then read or search the specific document.
Answer accurately based on what you actually read from the document — do not guess or make up information.`,
      tools,
      messages: currentMessages,
    });

    if (response.stop_reason === "end_turn") {
      const textBlock = response.content.find((b) => b.type === "text");
      return textBlock ? (textBlock as Anthropic.TextBlock).text : "";
    }

    if (response.stop_reason === "tool_use") {
      const assistantMessage: Anthropic.MessageParam = {
        role: "assistant",
        content: response.content,
      };
      currentMessages.push(assistantMessage);

      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const block of response.content) {
        if (block.type === "tool_use") {
          const result = await executeTool(
            block.name,
            block.input as Record<string, unknown>
          );
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: result,
          });
        }
      }

      currentMessages.push({
        role: "user",
        content: toolResults,
      });

      continue;
    }

    break;
  }

  return "Sorry, something went wrong.";
}
