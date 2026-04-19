// Telegram webhook + отправка сообщений
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TG_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const TG_API = `https://api.telegram.org/bot${TG_TOKEN}`;

async function tgSend(chat_id: number | string, text: string) {
  const r = await fetch(`${TG_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id, text, parse_mode: "Markdown" }),
  });
  return r.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json();

    // Режим отправки
    if (body.action === "send") {
      const result = await tgSend(body.chat_id, body.text);
      return new Response(JSON.stringify(result), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Webhook от Telegram
    const msg = body.message || body.edited_message;
    if (!msg) return new Response(JSON.stringify({ ok: true }), { headers: cors });

    const text = msg.text || "";
    const senderName = `${msg.from?.first_name || ""} ${msg.from?.last_name || ""}`.trim() || msg.from?.username || "Unknown";
    const chatName = msg.chat?.title || senderName;
    const chatId = msg.chat?.id;

    // Сохраняем
    const { data: saved } = await sb.from("chat_messages").insert({
      channel: "telegram",
      chat_name: chatName,
      sender_name: senderName,
      content: text,
      raw: { ...body, _chat_id: chatId },
    }).select().single();

    // Команды
    if (text.startsWith("/start")) {
      await tgSend(chatId, `🎓 *AI-завуч Aqbobek Lyceum*\n\nПривет, ${senderName}!\n\nЯ помогу с:\n• 📊 Отчёт о посещаемости — пиши: \`8B 23 присутствует 2 отсутствует\`\n• 🚨 Инциденты — \`в 209 кабинете сломался проектор\`\n• 📋 Задачи — я их отправлю директору\n\nID этого чата: \`${chatId}\``);
      return new Response(JSON.stringify({ ok: true }), { headers: cors });
    }

    // AI парсинг
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: `Парсер сообщений Telegram школы Aqbobek. Верни JSON одного типа:
- attendance: {"intent":"attendance","class":"8B","present":N,"absent":N,"sick":N}
- incident: {"intent":"incident","title":"...","location":"кабинет/место","priority":"low|normal|high"}
- task_request: {"intent":"task_request","title":"...","description":"..."}
- other: {"intent":"other"}
Только JSON, без markdown.` },
          { role: "user", content: text },
        ],
      }),
    });
    const aiJson = await aiRes.json();
    const raw = aiJson.choices?.[0]?.message?.content || "{}";
    let parsed: any = { intent: "other" };
    try { parsed = JSON.parse(raw.replace(/```json\n?|```/g, "").trim()); } catch {}

    await sb.from("chat_messages").update({ parsed_intent: parsed.intent, parsed_data: parsed }).eq("id", saved.id);

    let reply = "";
    if (parsed.intent === "attendance" && parsed.class) {
      const { data: cls } = await sb.from("classes").select("id,name").ilike("name", parsed.class).maybeSingle();
      if (cls) {
        await sb.from("attendance").insert({
          class_id: cls.id,
          present_count: parsed.present || 0,
          absent_count: parsed.absent || 0,
          sick_count: parsed.sick || 0,
          source: "telegram",
          notes: text,
        });
        reply = `✅ Принято: ${cls.name} → присутствуют ${parsed.present}, отсутствуют ${parsed.absent}${parsed.sick ? `, болеют ${parsed.sick}` : ""}`;
      } else {
        reply = `⚠️ Не нашёл класс "${parsed.class}". Используй формат: 8B, 10A, 11В`;
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
      reply = `🚨 Инцидент зарегистрирован: *${parsed.title}*\nЛокация: ${parsed.location || "—"}\nПриоритет: ${parsed.priority || "normal"}\n\nДиректор уведомлён.`;
    } else if (parsed.intent === "task_request") {
      await sb.from("tasks").insert({
        title: parsed.title || text.slice(0, 80),
        description: parsed.description || text,
        source: "telegram",
        source_message: text,
        priority: "normal",
      });
      reply = `📋 Задача создана: *${parsed.title}*`;
    }

    if (reply) await tgSend(chatId, reply);

    return new Response(JSON.stringify({ ok: true, parsed }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("tg-webhook error:", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
