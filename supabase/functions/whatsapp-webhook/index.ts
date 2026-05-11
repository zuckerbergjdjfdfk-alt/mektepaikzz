import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function handleTeacherAbsence(sb: any, parsed: any, senderName: string, text: string) {
  const name = (parsed.teacher_name || senderName || "").toLowerCase();
  const first = name.split(/\s+/).filter(Boolean)[0] || name;
  const { data: teachers } = await sb.from("staff").select("id, full_name").eq("role", "teacher");
  const teacher = teachers?.find((t: any) => t.full_name.toLowerCase().includes(first));
  if (!teacher) return { reply: `⚠️ Не нашёл учителя "${parsed.teacher_name || senderName}" в базе.` };

  const backendUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const today = new Date().toISOString().slice(0, 10);

  const subRes = await fetch(`${backendUrl}/functions/v1/smart-substitute`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${anonKey}` },
    body: JSON.stringify({ teacher_id: teacher.id }),
  });
  const subData = await subRes.json();
  const substitutions = subData.substitutions || [];

  const { data: absence } = await sb.from("teacher_absences").insert({
    teacher_id: teacher.id,
    teacher_name: teacher.full_name,
    reason: parsed.reason || "не указана",
    absence_date: today,
    source: "whatsapp",
    substitutions,
  }).select().single();

  let orderId: string | null = null;
  let pdfUrl: string | null = null;
  try {
    const subsLines = substitutions.map((s: any, i: number) =>
      `${i + 1}. ${s.period} урок, класс ${s.class_name} (${s.subject}) — ${s.substitute ? `замещает ${s.substitute}` : "замена не назначена"}.`
    ).join("\n");
    const orderText = `Создай приказ о замещении уроков. Учитель: ${teacher.full_name}. Причина: ${parsed.reason || "по болезни"}. Дата: ${today}. Замены:\n${subsLines}`;
    const orderRes = await fetch(`${backendUrl}/functions/v1/order-from-text`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${anonKey}` },
      body: JSON.stringify({ text: orderText }),
    });
    const orderData = await orderRes.json();
    orderId = orderData.order_id || null;
    pdfUrl = orderData.pdf_url || null;

    if (orderId) {
      await sb.from("generated_orders").update({ absence_id: absence.id }).eq("id", orderId);
      await sb.from("teacher_absences").update({ order_id: orderId }).eq("id", absence.id);
      const lessonIds = substitutions.map((s: any) => s.lesson_id).filter(Boolean);
      if (lessonIds.length) {
        await sb.from("schedule_slots").update({ substitution_order_id: orderId, absence_id: absence.id }).in("id", lessonIds);
      }
    }
  } catch (e) { console.error("auto-order failed:", e); }

  await sb.from("notifications").insert({
    type: "teacher_absence",
    title: `Отсутствие: ${teacher.full_name}`,
    body: `${parsed.reason || "не указана"} · замен: ${substitutions.length}${pdfUrl ? " · приказ готов" : ""}`,
    payload: { teacher_id: teacher.id, absence_id: absence.id, order_id: orderId, source: "whatsapp" },
  });

  const lines = substitutions.map((s: any) =>
    s.substitute ? `• ${s.period} урок ${s.class_name} (${s.subject}) → ${s.substitute}` : `• ${s.period} урок ${s.class_name} — ⚠️ не найдена`
  ).join("\n");
  const reply = `🤖 Принято, ${teacher.full_name}. Причина: ${parsed.reason || "не указана"}.\n\nЗамены на сегодня:\n${lines || "Нет уроков сегодня."}${pdfUrl ? `\n\n📄 Приказ: ${pdfUrl}` : ""}`;
  return { reply };
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
