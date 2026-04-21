import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const telegramToken = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const telegramApi = `https://api.telegram.org/bot${telegramToken}`;

async function tgSend(chatId: number | string, text: string) {
  const response = await fetch(`${telegramApi}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
  });
  return response.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json();

    if (body.action === "send") {
      const result = await tgSend(body.chat_id, body.text);
      return new Response(JSON.stringify(result), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    const message = body.message || body.edited_message;
    if (!message) return new Response(JSON.stringify({ ok: true }), { headers: cors });

    const text = message.text || "";
    const senderName = `${message.from?.first_name || ""} ${message.from?.last_name || ""}`.trim() || message.from?.username || "Unknown";
    const chatName = message.chat?.title || senderName;
    const chatId = message.chat?.id;

    const { data: saved } = await sb.from("chat_messages").insert({
      channel: "telegram",
      chat_name: chatName,
      sender_name: senderName,
      content: text,
      raw: { ...body, _chat_id: chatId },
    }).select().single();

    if (text.startsWith("/start")) {
      await tgSend(chatId, `🎓 *Mektep AI*

Здравствуйте, ${senderName}!

Я помогу с посещаемостью, инцидентами, задачами и приказами по школе в Актобе.

ID этого чата: \`${chatId}\``);
      return new Response(JSON.stringify({ ok: true }), { headers: cors });
    }

    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${lovableApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        max_tokens: 700,
        messages: [
          { role: "system", content: `Парсер сообщений Telegram для школы Mektep AI в Актобе. Верни JSON одного типа:
- attendance: {"intent":"attendance","class":"8B","present":N,"absent":N,"sick":N}
- incident: {"intent":"incident","title":"...","location":"кабинет/место","priority":"low|normal|high"}
- task_request: {"intent":"task_request","title":"...","description":"..."}
- other: {"intent":"other"}
Только JSON, без markdown.` },
          { role: "user", content: text },
        ],
      }),
    });
    const aiJson = await aiResponse.json();
    const raw = aiJson.choices?.[0]?.message?.content || "{}";
    let parsed: any = { intent: "other" };
    try {
      parsed = JSON.parse(raw.replace(/```json\n?|```/g, "").trim());
    } catch {}

    await sb.from("chat_messages").update({ parsed_intent: parsed.intent, parsed_data: parsed }).eq("id", saved.id);

    let reply = "";
    if (parsed.intent === "attendance" && parsed.class) {
      const { data: schoolClass } = await sb.from("classes").select("id,name").ilike("name", parsed.class).maybeSingle();
      if (schoolClass) {
        await sb.from("attendance").insert({
          class_id: schoolClass.id,
          present_count: parsed.present || 0,
          absent_count: parsed.absent || 0,
          sick_count: parsed.sick || 0,
          source: "telegram",
          notes: text,
        });
        reply = `✅ Принято: ${schoolClass.name} → присутствуют ${parsed.present || 0}, отсутствуют ${parsed.absent || 0}${parsed.sick ? `, болеют ${parsed.sick}` : ""}`;
      } else {
        reply = `⚠️ Не нашёл класс "${parsed.class}". Используйте формат 8B, 10A или 11В.`;
      }
    } else if (parsed.intent === "incident") {
      await sb.from("incidents").insert({
        title: parsed.title || text.slice(0, 80),
        description: text,
        location: parsed.location,
        priority: parsed.priority || "normal",
        source: "telegram",
        source_message: text,
        reported_by: senderName,
      });
      await sb.from("notifications").insert({
        type: "incident",
        title: "🚨 Инцидент из Telegram",
        body: `${senderName}: ${parsed.title || text.slice(0, 80)}`,
      });
      reply = `🚨 Инцидент зарегистрирован: *${parsed.title || text.slice(0, 40)}*
Локация: ${parsed.location || "—"}
Приоритет: ${parsed.priority || "normal"}`;
    } else if (parsed.intent === "task_request") {
      await sb.from("tasks").insert({
        title: parsed.title || text.slice(0, 80),
        description: parsed.description || text,
        source: "telegram",
        source_message: text,
        priority: "normal",
      });
      reply = `📋 Задача создана: *${parsed.title || text.slice(0, 40)}*`;
    }

    if (reply) await tgSend(chatId, reply);

    return new Response(JSON.stringify({ ok: true, parsed }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (error: any) {
    console.error("tg-webhook error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
