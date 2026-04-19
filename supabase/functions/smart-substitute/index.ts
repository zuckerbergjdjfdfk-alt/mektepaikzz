import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Smart substitution: ищет замену для всех уроков заболевшего учителя на сегодня
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { teacher_id, day_of_week } = await req.json();
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const today = new Date();
    const dow = day_of_week ?? (today.getDay() === 0 ? 6 : today.getDay());

    const { data: absent } = await supabase.from("staff").select("*").eq("id", teacher_id).single();
    if (!absent) throw new Error("Учитель не найден");

    const { data: lessons } = await supabase
      .from("schedule_slots")
      .select("*, subjects(*), classes(*), rooms(*)")
      .eq("teacher_id", teacher_id)
      .eq("day_of_week", dow);

    const { data: allTeachers } = await supabase.from("staff").select("*").eq("role", "teacher").eq("is_active", true);
    const { data: daySlots } = await supabase.from("schedule_slots").select("*").eq("day_of_week", dow);

    const substitutions: any[] = [];

    for (const lesson of lessons || []) {
      const subjName = (lesson as any).subjects?.short_name;
      const subjFull = (lesson as any).subjects?.name;
      const candidates = (allTeachers || []).filter((t) => {
        if (t.id === teacher_id) return false;
        const hasSkill = t.subjects?.some((s: string) =>
          s === subjFull || s.toLowerCase().includes(subjName?.toLowerCase() || "_no_")
        );
        if (!hasSkill) return false;
        const busy = (daySlots || []).some(
          (s) => s.teacher_id === t.id && s.period === lesson.period
        );
        return !busy;
      });

      const sub = candidates[0];
      if (sub) {
        await supabase
          .from("schedule_slots")
          .update({ teacher_id: sub.id, is_substitution: true, original_teacher_id: teacher_id })
          .eq("id", lesson.id);
        substitutions.push({
          lesson_id: lesson.id,
          period: lesson.period,
          class_name: (lesson as any).classes?.name,
          subject: subjFull,
          original_teacher: absent.full_name,
          substitute: sub.full_name,
        });

        await supabase.from("notifications").insert({
          type: "schedule_conflict",
          title: "Замена назначена",
          body: `${sub.full_name} → ${(lesson as any).classes?.name}, ${lesson.period} урок (${subjFull})`,
          payload: { lesson_id: lesson.id },
        });
      } else {
        substitutions.push({
          lesson_id: lesson.id,
          period: lesson.period,
          class_name: (lesson as any).classes?.name,
          subject: subjFull,
          original_teacher: absent.full_name,
          substitute: null,
          note: "Свободный учитель не найден — нужно ручное вмешательство",
        });
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      absent_teacher: absent.full_name,
      lessons_processed: lessons?.length || 0,
      substitutions,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("smart-substitute error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
