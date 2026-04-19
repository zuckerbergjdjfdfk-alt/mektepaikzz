// Утренний свод: собирает посещаемость + чаты + инциденты, генерирует AI-сводку для директора
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

    const [att, allClasses, incidents, chatMsgs] = await Promise.all([
      sb.from("attendance").select("class_id, present_count, absent_count, sick_count, classes(name, student_count)").eq("date", today),
      sb.from("classes").select("name, student_count"),
      sb.from("incidents").select("title, priority, location, reported_by").eq("status", "open").order("priority", { ascending: false }),
      sb.from("chat_messages").select("sender_name, content, parsed_intent, channel").gte("created_at", today).order("created_at", { ascending: false }).limit(20),
    ]);

    const totalPresent = att.data?.reduce((s, a: any) => s + (a.present_count || 0), 0) || 0;
    const totalAbsent = att.data?.reduce((s, a: any) => s + (a.absent_count || 0), 0) || 0;
    const totalSick = att.data?.reduce((s, a: any) => s + (a.sick_count || 0), 0) || 0;
    const totalStudents = (allClasses.data || []).reduce((s, c: any) => s + (c.student_count || 0), 0);
    const reportedClasses = new Set(att.data?.map((a: any) => a.classes?.name).filter(Boolean));
    const missing = (allClasses.data || []).filter((c: any) => !reportedClasses.has(c.name)).map((c: any) => c.name);

    const incidentsList = (incidents.data || []).map((i: any) => `- ${i.priority === "high" ? "🔴" : i.priority === "low" ? "🟢" : "🟡"} ${i.title} (${i.location || "—"}, ${i.reported_by || "?"})`).join("\n") || "Инцидентов нет ✅";
    const chatStats = (chatMsgs.data || []).reduce((acc: any, m: any) => {
      acc[m.parsed_intent || "other"] = (acc[m.parsed_intent || "other"] || 0) + 1;
      return acc;
    }, {});

    // AI-сводка
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    let aiSummary = "";
    if (LOVABLE_API_KEY) {
      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: "Ты AI-завуч Mektep AI. Сделай краткий профессиональный утренний свод для директора Айгуль Серикбаевны на русском языке. Используй markdown. Будь конкретен, выдели риски красным эмодзи, успехи зелёным. 6-10 строк." },
            { role: "user", content: `Данные на ${today}:
- Учеников всего: ${totalStudents}, в школе: ${totalPresent}, болеют: ${totalSick}, отсутствуют: ${totalAbsent}
- Явка: ${totalStudents ? Math.round((totalPresent / totalStudents) * 100) : 0}%
- Не отчитались классы: ${missing.join(", ") || "все отчитались"}
- Открытые инциденты: ${incidents.data?.length || 0}
${incidentsList}
- Сообщений в чатах сегодня: ${chatMsgs.data?.length || 0} (посещаемость: ${chatStats.attendance || 0}, инциденты: ${chatStats.incident || 0}, задачи: ${chatStats.task_request || 0})

Составь утренний свод.` },
          ],
        }),
      });
      const aiData = await aiRes.json();
      aiSummary = aiData.choices?.[0]?.message?.content || "";
    }

    const report = aiSummary || `# 🌅 Утренний свод — ${today}

## Посещаемость
- 👥 Присутствуют: **${totalPresent}** из ${totalStudents}
- 🤒 Болеют: **${totalSick}**
- ❌ Отсутствуют: **${totalAbsent}**
- 🍽 Заявка в столовую: **${totalPresent} порций**

## Отчётность
- Отчитались: ${reportedClasses.size}/${allClasses.data?.length || 0} классов
${missing.length ? `- ⚠️ Не отчитались: ${missing.join(", ")}` : "- ✅ Все классы на связи"}

## Открытые инциденты (${incidents.data?.length || 0})
${incidentsList}`;

    await sb.from("notifications").insert({
      type: "morning_digest",
      title: "🌅 Утренний свод готов",
      body: `Явка ${totalStudents ? Math.round((totalPresent / totalStudents) * 100) : 0}% · ${incidents.data?.length || 0} инцидентов`,
      payload: { totalPresent, totalAbsent, totalSick, missing },
    });

    return new Response(JSON.stringify({ ok: true, report, totalPresent, totalAbsent, totalSick, missing, incidents: incidents.data?.length || 0 }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
