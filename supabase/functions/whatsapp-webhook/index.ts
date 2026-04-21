import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json();

    if (body.typeWebhook !== "incomingMessageReceived") {
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const text = body.messageData?.textMessageData?.textMessage || body.messageData?.extendedTextMessageData?.text || "";
    const senderName = body.senderData?.senderName || "Unknown";
    const chatName = body.senderData?.chatName || senderName;
    const chatId = body.senderData?.chatId || "";

    const { data: message } = await sb.from("chat_messages").insert({
      channel: "whatsapp",
      chat_name: chatName,
      sender_name: senderName,
      content: text,
      raw: body,
    }).select().single();

    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${lovableApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        max_tokens: 700,
        messages: [
          { role: "system", content: `Ты парсер входящих сообщений учителей школы Mektep AI в Актобе. Извлеки ровно одну сущность:

1) attendance → {"intent":"attendance","class":"8B","present":18,"absent":2,"sick":1}
2) incident → {"intent":"incident","title":"...","location":"...","priority":"low|normal|high"}
3) task_request → {"intent":"task_request","title":"...","description":"..."}
4) other → {"intent":"other"}

Верни только JSON без markdown.` },
          { role: "user", content: text || "(пусто)" },
        ],
      }),
    });
    const aiData = await aiResponse.json();
    const raw = aiData.choices?.[0]?.message?.content || "{}";
    const cleaned = raw.replace(/```json
?|```/g, "").trim();
    let parsed: any = { intent: "other" };
    try {
      parsed = JSON.parse(cleaned);
    } catch {}

    await sb.from("chat_messages").update({
      parsed_intent: parsed.intent,
      parsed_data: parsed,
    }).eq("id", message.id);

    if (parsed.intent === "attendance" && parsed.class) {
      const { data: schoolClass } = await sb.from("classes").select("id").ilike("name", parsed.class).maybeSingle();
      if (schoolClass) {
        await sb.from("attendance").insert({
          class_id: schoolClass.id,
          present_count: parsed.present || 0,
          absent_count: parsed.absent || 0,
          sick_count: parsed.sick || 0,
          source: "whatsapp",
          notes: text,
        });
      }
    } else if (parsed.intent === "incident") {
      await sb.from("incidents").insert({
        title: parsed.title || text.slice(0, 80),
        description: text,
        location: parsed.location,
        priority: parsed.priority || "normal",
        source: "whatsapp",
        source_message: text,
        reported_by: senderName,
      });
      await sb.from("notifications").insert({
        type: "incident",
        title: "🚨 Новый инцидент",
        body: `${senderName}: ${parsed.title || text.slice(0, 80)}`,
        payload: { chat_id: chatId, sender: senderName },
      });
    } else if (parsed.intent === "task_request") {
      await sb.from("tasks").insert({
        title: parsed.title || text.slice(0, 80),
        description: parsed.description || text,
        source: "whatsapp",
        source_message: text,
        priority: "normal",
      });
    }

    return new Response(JSON.stringify({ ok: true, parsed }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("wa-webhook error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
