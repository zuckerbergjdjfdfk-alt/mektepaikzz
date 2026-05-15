// Общая обработка отсутствия учителя: ищет учителя, создаёт замены,
// генерирует приказ, шлёт уведомления (в т.ч. Telegram директору).
// Используется и whatsapp-webhook, и ai-orchestrator (голос).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function notifyDirectorTelegram(sb: any, text: string) {
  try {
    const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!token) return;
    const { data: prof } = await sb.from("app_profile").select("metadata").eq("key", "default").maybeSingle();
    const chatId = prof?.metadata?.director_telegram_chat_id || prof?.metadata?.telegram_chat_id;
    if (!chatId) return;
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    });
  } catch (e) { console.error("tg notify failed", e); }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { teacher_name, reason, source = "manual", absence_date } = await req.json();
    if (!teacher_name) {
      return new Response(JSON.stringify({ error: "teacher_name required" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const first = teacher_name.toLowerCase().split(/\s+/).filter(Boolean)[0] || teacher_name.toLowerCase();
    const { data: teachers } = await sb.from("staff").select("id, full_name").eq("role", "teacher");
    const teacher = teachers?.find((t: any) => t.full_name.toLowerCase().includes(first));
    if (!teacher) {
      return new Response(JSON.stringify({ ok: false, error: `Учитель "${teacher_name}" не найден` }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    const backendUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const today = absence_date || new Date().toISOString().slice(0, 10);

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
      reason: reason || "не указана",
      absence_date: today,
      source,
      substitutions,
    }).select().single();

    let orderId: string | null = null;
    let pdfUrl: string | null = null;
    try {
      const subsLines = substitutions.map((s: any, i: number) =>
        `${i + 1}. ${s.period} урок, класс ${s.class_name} (${s.subject}) — ${s.substitute ? `замещает ${s.substitute}` : "замена не назначена"}.`
      ).join("\n");
      const orderText = `Создай приказ о замещении уроков. Учитель: ${teacher.full_name}. Причина: ${reason || "по болезни"}. Дата: ${today}. Замены:\n${subsLines}`;
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
      body: `${reason || "не указана"} · замен: ${substitutions.length}${pdfUrl ? " · приказ готов" : ""}`,
      payload: { teacher_id: teacher.id, absence_id: absence.id, order_id: orderId, source },
    });

    const lines = substitutions.map((s: any) =>
      s.substitute ? `• ${s.period} ур. ${s.class_name} (${s.subject}) → ${s.substitute}` : `• ${s.period} ур. ${s.class_name} — ⚠️ нет замены`
    ).join("\n");
    const tgText = `<b>🏫 Замена: ${teacher.full_name}</b>\nПричина: ${reason || "не указана"}\nДата: ${today}\nЗамен: ${substitutions.length}\n\n${lines || "Нет уроков"}${pdfUrl ? `\n\n📄 Приказ готов` : ""}`;
    await notifyDirectorTelegram(sb, tgText);

    return new Response(JSON.stringify({
      ok: true,
      teacher: teacher.full_name,
      absence_id: absence.id,
      substitutions,
      order_id: orderId,
      pdf_url: pdfUrl,
    }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (error: any) {
    console.error("handle-absence:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
