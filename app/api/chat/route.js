import { PERSONAS } from "@/lib/personas";
import { runAgentStream } from "@/lib/agent";
import { getHistory, appendMessages } from "@/lib/store";

// GET /api/chat?uid=...&persona=... -> this user's in-memory history
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const uid = searchParams.get("uid");
  const personaId = searchParams.get("persona");
  if (!uid || !PERSONAS[personaId]) {
    return Response.json({ error: "uid and a valid persona are required" }, { status: 400 });
  }
  return Response.json({ messages: getHistory(uid, personaId) });
}

// POST /api/chat { uid, persona, message } -> NDJSON stream of step events + final result
export async function POST(request) {
  const { uid, persona: personaId, message } = await request.json();
  const persona = PERSONAS[personaId];
  if (!uid || !persona || !message?.trim()) {
    return Response.json({ error: "uid, persona and message are required" }, { status: 400 });
  }

  const text = message.trim();
  const history = getHistory(uid, personaId);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        let finalReply = "";
        let finalSearches = [];
        let finalVideos = [];

        for await (const event of runAgentStream(persona, history, text)) {
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
          if (event.type === "final") {
            finalReply = event.reply;
            finalSearches = event.searches;
            finalVideos = event.videos;
          }
        }

        if (finalReply) {
          appendMessages(
            uid,
            personaId,
            { role: "user", content: text },
            { role: "assistant", content: finalReply, searches: finalSearches, videos: finalVideos }
          );
        }
      } catch (err) {
        console.error("chat stream error:", err);
        const errEvent = { type: "error", error: "The AI is unreachable right now. Try again." };
        controller.enqueue(encoder.encode(JSON.stringify(errEvent) + "\n"));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
    },
  });
}
