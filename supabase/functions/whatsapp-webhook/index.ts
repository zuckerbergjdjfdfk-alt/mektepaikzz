// Green API webhook receiver — принимает входящие WhatsApp сообщения,
// парсит их через AI (посещаемость / инциденты / задачи) и сохраняет в chat_messages.
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
    console.log("WA webhook:", JSON.stringify(body).slice(0, 500));

    // Green API формат: typeWebhook=incomingMessageReceived
    if (body.typeWebhook !== "incomingMessageReceived") {
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const text = body.messageData?.textMessageData?.textMessage 
      || body.messageData?.extendedTextMessageData?.text 
      || "";
    const senderName = body.senderData?.senderName || "Unknown";
    const chatName = body.senderData?.chatName || senderName;
    const chatId = body.senderData?.chatId || "";

    // Сохраняем raw
    const { data: msg } = await sb.from("chat_messages").insert({
      channel: "whatsapp",
      chat_name: chatName,
      sender_name: senderName,
      content: text,
      raw: body,
    }).select().single();

    // AI парсинг через Lovable AI
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: `Ты парсер сообщений учителей в WhatsApp школы Aqbobek. Извлеки ОДНУ из сущностей:

1) attendance — учитель отчитывается о посещаемости класса. Пример: "1А - 25 детей, 2 болеют" или "8B 18 присутствует 2 отсутствует"
   → {"intent":"attendance","class":"8B","present":18,"absent":2,"sick":2}

2) incident — поломка/проблема в школе. Пример: "В кабинете 12 сломалась парта" или "потёк кран в туалете"
   → {"intent":"incident","title":"...","location":"...","priority":"low|normal|high"}

3) task_request — учитель просит что-то сделать или предлагает помощь
   → {"intent":"task_request","title":"...","description":"..."}

4) other — обычное общение
   → {"intent":"other"}

Отвечай ТОЛЬКО валидным JSON, без markdown, без объяснений.` },
          { role: "user", content: text || "(пусто)" },
        ],
      }),
    });
    const aiData = await aiRes.json();
    const raw = aiData.choices?.[0]?.message?.content || "{}";
    const cleaned = raw.replace(/```json\n?|```/g, "").trim();
    let parsed: any = { intent: "other" };
    try { parsed = JSON.parse(cleaned); } catch {}

    // Обновляем сообщение
    await sb.from("chat_messages").update({
      parsed_intent: parsed.intent,
      parsed_data: parsed,
    }).eq("id", msg.id);

    // Действия
    if (parsed.intent === "attendance" && parsed.class) {
      const { data: cls } = await sb.from("classes").select("id").ilike("name", parsed.class).maybeSingle();
      if (cls) {
        await sb.from("attendance").insert({
          class_id: cls.id,
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
    }

    return new Response(JSON.stringify({ ok: true, parsed }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("wa-webhook error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
