import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { AI_SYSTEM_PROMPT } from "@/lib/constants";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// POST /api/ai — AI chat (streaming)
export async function POST(request: NextRequest) {
  try {
    const { message, history } = await request.json();

    if (!message?.trim()) {
      return NextResponse.json({ message: "Xabar bo'sh" }, { status: 400 });
    }

    // Chat tarixini formatlash
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: AI_SYSTEM_PROMPT },
      ...(history || []).map((msg: any) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })),
      { role: "user", content: message },
    ];

    // Streaming response
    const stream = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      max_tokens: 1000,
      temperature: 0.7,
      stream: true,
    });

    // ReadableStream yaratish
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const text = chunk.choices[0]?.delta?.content || "";
            if (text) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ text })}\n\n`)
              );
            }
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error: any) {
    console.error("AI API error:", error);

    if (error?.code === "insufficient_quota") {
      return NextResponse.json(
        { message: "AI xizmati vaqtinchalik ishlamayapti" },
        { status: 503 }
      );
    }

    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}
