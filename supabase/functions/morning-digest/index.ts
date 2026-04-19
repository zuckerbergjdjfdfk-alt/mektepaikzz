// Утренний свод: к 9:00 собирает посещаемость по всем классам, считает обеды
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const today = new Date().toISOString().slice(0, 10);

    const { data: att } = await sb.from("attendance")
      .select("class_id, present_count, absent_count, sick_count, classes(name, student_count)")
      .eq("date", today);

    const totalPresent = att?.reduce((s, a: any) => s + (a.present_count || 0), 0) || 0;
    const totalAbsent = att?.reduce((s, a: any) => s + (a.absent_count || 0), 0) || 0;
    const totalSick = att?.reduce((s, a: any) => s + (a.sick_count || 0), 0) || 0;
    const reportedClasses = new Set(att?.map((a: any) => a.classes?.name).filter(Boolean));

    const { data: allClasses } = await sb.from("classes").select("name");
    const missing = (allClasses || []).filter((c: any) => !reportedClasses.has(c.name)).map((c: any) => c.name);

    const summary = `🌅 *Утренний свод — ${today}*

👥 Присутствуют: *${totalPresent}*
❌ Отсутствуют: *${totalAbsent}*
🤒 Болеют: *${totalSick}*

🍽 *Заявка в столовую: ${totalPresent} порций*

📋 Отчитались: ${reportedClasses.size}/${allClasses?.length || 0} классов
${missing.length > 0 ? `⚠️ Не отчитались: ${missing.join(", ")}` : "✅ Все классы отчитались"}`;

    await sb.from("notifications").insert({
      type: "morning_digest",
      title: "🌅 Утренний свод готов",
      body: summary,
      payload: { totalPresent, totalAbsent, totalSick, missing, reported: [...reportedClasses] },
    });

    return new Response(JSON.stringify({ ok: true, summary, totalPresent, totalAbsent, totalSick, missing }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
