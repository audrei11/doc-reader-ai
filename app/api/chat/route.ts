import { NextRequest, NextResponse } from "next/server";
import { chat } from "@/lib/claude";
import OpenAI from "openai";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json() as {
      messages: OpenAI.Chat.ChatCompletionMessageParam[];
    };

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: "No messages provided" }, { status: 400 });
    }

    const reply = await chat(messages);
    return NextResponse.json({ reply });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Chat error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
