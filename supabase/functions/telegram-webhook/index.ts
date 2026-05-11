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

async function handleTeacherAbsence(sb: any, parsed: any, senderName: string, source: "telegram" | "whatsapp", text: string) {
  const name = (parsed.teacher_name || senderName || "").toLowerCase();
  const first = name.split(/\s+/).filter(Boolean)[0] || name;
  const { data: teachers } = await sb.from("staff").select("id, full_name").eq("role", "teacher");
  const teacher = teachers?.find((t: any) => t.full_name.toLowerCase().includes(first));
  if (!teacher) {
    return { reply: `⚠️ Не нашёл учителя "${parsed.teacher_name || senderName}" в базе.` };
  }

  const backendUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const today = new Date().toISOString().slice(0, 10);

  // 1) Find substitutes
  const subRes = await fetch(`${backendUrl}/functions/v1/smart-substitute`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${anonKey}` },
    body: JSON.stringify({ teacher_id: teacher.id }),
  });
  const subData = await subRes.json();
  const substitutions = subData.substitutions || [];

  // 2) Create absence record
  const { data: absence } = await sb.from("teacher_absences").insert({
    teacher_id: teacher.id,
    teacher_name: teacher.full_name,
    reason: parsed.reason || "не указана",
    absence_date: today,
    source,
    substitutions,
  }).select().single();

  // 3) Generate substitution order with AI (template + PDF)
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
      // Link order to substitution slots
      const lessonIds = substitutions.map((s: any) => s.lesson_id).filter(Boolean);
      if (lessonIds.length) {
        await sb.from("schedule_slots").update({ substitution_order_id: orderId, absence_id: absence.id }).in("id", lessonIds);
      }
    }
  } catch (e) {
    console.error("auto-order failed:", e);
  }

  // 4) Notification
  await sb.from("notifications").insert({
    type: "teacher_absence",
    title: `Отсутствие: ${teacher.full_name}`,
    body: `${parsed.reason || "не указана"} · замен: ${substitutions.length}${pdfUrl ? " · приказ готов" : ""}`,
    payload: { teacher_id: teacher.id, absence_id: absence.id, order_id: orderId, source },
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
      channel: "telegram", chat_name: chatName, sender_name: senderName, content: text,
      raw: { ...body, _chat_id: chatId },
    }).select().single();

    if (text.startsWith("/start")) {
      await tgSend(chatId, `🎓 *AISSchool*\n\nЗдравствуйте, ${senderName}!\n\nЯ помогу с посещаемостью, инцидентами, задачами и приказами по школе в Актобе.\n\nID этого чата: \`${chatId}\``);
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
          { role: "system", content: `Парсер сообщений Telegram школы AISSchool в Актобе. Верни JSON одного типа:
- teacher_absence: {"intent":"teacher_absence","teacher_name":"Фамилия Имя","reason":"болезнь|опоздание|отгул"}
- attendance: {"intent":"attendance","class":"8B","present":N,"absent":N,"sick":N}
- incident: {"intent":"incident","title":"...","location":"...","priority":"low|normal|high"}
- task_request: {"intent":"task_request","title":"...","description":"..."}
- other: {"intent":"other"}
Если учитель пишет от себя ("я заболел","не приду","опоздаю") — teacher_name = "${senderName}".
Только JSON, без markdown.` },
          { role: "user", content: text },
        ],
      }),
    });
    const aiJson = await aiResponse.json();
    const raw = aiJson.choices?.[0]?.message?.content || "{}";
    let parsed: any = { intent: "other" };
    try { parsed = JSON.parse(raw.replace(/```json\n?|```/g, "").trim()); } catch {}

    await sb.from("chat_messages").update({ parsed_intent: parsed.intent, parsed_data: parsed }).eq("id", saved.id);

    let reply = "";
    if (parsed.intent === "teacher_absence") {
      const r = await handleTeacherAbsence(sb, parsed, senderName, "telegram", text);
      reply = r.reply;
    } else if (parsed.intent === "attendance" && parsed.class) {
      const { data: schoolClass } = await sb.from("classes").select("id,name").ilike("name", parsed.class).maybeSingle();
      if (schoolClass) {
        await sb.from("attendance").insert({
          class_id: schoolClass.id,
          present_count: parsed.present || 0,
          absent_count: parsed.absent || 0,
          sick_count: parsed.sick || 0,
          source: "telegram", notes: text,
        });
        reply = `✅ Принято: ${schoolClass.name} → присутствуют ${parsed.present || 0}, отсутствуют ${parsed.absent || 0}${parsed.sick ? `, болеют ${parsed.sick}` : ""}`;
      } else reply = `⚠️ Не нашёл класс "${parsed.class}".`;
    } else if (parsed.intent === "incident") {
      await sb.from("incidents").insert({
        title: parsed.title || text.slice(0, 80), description: text, location: parsed.location,
        priority: parsed.priority || "normal", source: "telegram", source_message: text, reported_by: senderName,
      });
      await sb.from("notifications").insert({ type: "incident", title: "🚨 Инцидент из Telegram", body: `${senderName}: ${parsed.title || text.slice(0, 80)}` });
      reply = `🚨 Инцидент зарегистрирован: *${parsed.title || text.slice(0, 40)}*\nЛокация: ${parsed.location || "—"}\nПриоритет: ${parsed.priority || "normal"}`;
    } else if (parsed.intent === "task_request") {
      await sb.from("tasks").insert({
        title: parsed.title || text.slice(0, 80), description: parsed.description || text,
        source: "telegram", source_message: text, priority: "normal",
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
