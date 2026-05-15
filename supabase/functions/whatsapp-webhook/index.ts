import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function handleTeacherAbsence(_sb: any, parsed: any, senderName: string, _text: string) {
  const backendUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const res = await fetch(`${backendUrl}/functions/v1/handle-absence`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${anonKey}` },
    body: JSON.stringify({ teacher_name: parsed.teacher_name || senderName, reason: parsed.reason, source: "whatsapp" }),
  });
  const data = await res.json();
  if (!data.ok) return { reply: `⚠️ ${data.error || "Не удалось зарегистрировать отсутствие"}` };
  const lines = (data.substitutions || []).map((s: any) =>
    s.substitute ? `• ${s.period} ур. ${s.class_name} (${s.subject}) → ${s.substitute}` : `• ${s.period} ур. ${s.class_name} — ⚠️ нет замены`
  ).join("\n");
  return { reply: `🤖 Принято, ${data.teacher}. Причина: ${parsed.reason || "не указана"}.\n\nЗамены:\n${lines || "Нет уроков"}${data.pdf_url ? `\n\n📄 Приказ готов` : ""}` };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json();

    if (body.typeWebhook !== "incomingMessageReceived") {
      return new Response(JSON.stringify({ ok: true, skipped: true }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    const text = body.messageData?.textMessageData?.textMessage || body.messageData?.extendedTextMessageData?.text || "";
    const senderName = body.senderData?.senderName || "Unknown";
    const chatName = body.senderData?.chatName || senderName;
    const chatId = body.senderData?.chatId || "";

    const { data: message } = await sb.from("chat_messages").insert({
      channel: "whatsapp", chat_name: chatName, sender_name: senderName, content: text, raw: body,
    }).select().single();

    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${lovableApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        max_tokens: 700,
        messages: [
          { role: "system", content: `Парсер входящих WhatsApp школы AISSchool в Актобе. Верни одну сущность JSON:
1) teacher_absence (учитель не придёт/болеет/опоздает) → {"intent":"teacher_absence","teacher_name":"имя","reason":"болезнь|опоздание|отгул"}
2) attendance → {"intent":"attendance","class":"8B","present":18,"absent":2,"sick":1}
3) incident → {"intent":"incident","title":"...","location":"...","priority":"low|normal|high"}
4) task_request → {"intent":"task_request","title":"...","description":"..."}
5) other → {"intent":"other"}
Если "я заболел","не приду" — teacher_name = "${senderName}". Только JSON.` },
          { role: "user", content: text || "(пусто)" },
        ],
      }),
    });
    const aiData = await aiResponse.json();
    const raw = aiData.choices?.[0]?.message?.content || "{}";
    const cleaned = raw.replace(/```json\n?|```/g, "").trim();
    let parsed: any = { intent: "other" };
    try { parsed = JSON.parse(cleaned); } catch {}

    await sb.from("chat_messages").update({ parsed_intent: parsed.intent, parsed_data: parsed }).eq("id", message.id);

    let replyText = "";
    const backendUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    if (parsed.intent === "teacher_absence") {
      const r = await handleTeacherAbsence(sb, parsed, senderName, text);
      replyText = r.reply;
    } else if (parsed.intent === "attendance" && parsed.class) {
      const { data: schoolClass } = await sb.from("classes").select("id,name").ilike("name", parsed.class).maybeSingle();
      if (schoolClass) {
        await sb.from("attendance").insert({
          class_id: schoolClass.id,
          present_count: parsed.present || 0,
          absent_count: parsed.absent || 0,
          sick_count: parsed.sick || 0,
          source: "whatsapp", notes: text,
        });
        replyText = `✅ Принято: ${schoolClass.name} → присутствуют ${parsed.present || 0}, отсутствуют ${parsed.absent || 0}${parsed.sick ? `, болеют ${parsed.sick}` : ""}`;
      } else replyText = `⚠️ Не нашёл класс "${parsed.class}".`;
    } else if (parsed.intent === "incident") {
      await sb.from("incidents").insert({
        title: parsed.title || text.slice(0, 80), description: text, location: parsed.location,
        priority: parsed.priority || "normal", source: "whatsapp", source_message: text, reported_by: senderName,
      });
      await sb.from("notifications").insert({ type: "incident", title: "🚨 Новый инцидент", body: `${senderName}: ${parsed.title || text.slice(0, 80)}`, payload: { chat_id: chatId, sender: senderName } });
      replyText = `🚨 Инцидент зарегистрирован: ${parsed.title || text.slice(0, 40)}\nЛокация: ${parsed.location || "—"}\nПриоритет: ${parsed.priority || "normal"}`;
    } else if (parsed.intent === "task_request") {
      await sb.from("tasks").insert({
        title: parsed.title || text.slice(0, 80), description: parsed.description || text,
        source: "whatsapp", source_message: text, priority: "normal",
      });
      replyText = `📋 Задача создана: ${parsed.title || text.slice(0, 40)}`;
    }

    if (replyText && chatId) {
      try {
        await fetch(`${backendUrl}/functions/v1/whatsapp-send`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${anonKey}` },
          body: JSON.stringify({ chat_id: chatId, message: replyText }),
        });
      } catch (e) { console.error("wa-send reply failed:", e); }
    }

    return new Response(JSON.stringify({ ok: true, parsed }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (error: any) {
    console.error("wa-webhook error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
