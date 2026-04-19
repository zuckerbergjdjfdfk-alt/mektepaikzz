import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Простой жадный генератор расписания с поддержкой лент
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const [classesR, subjectsR, teachersR, roomsR, currR] = await Promise.all([
      supabase.from("classes").select("*").order("name"),
      supabase.from("subjects").select("*"),
      supabase.from("staff").select("*").eq("role", "teacher"),
      supabase.from("rooms").select("*"),
      supabase.from("curriculum").select("*"),
    ]);

    const classes = classesR.data || [];
    const subjects = subjectsR.data || [];
    const teachers = teachersR.data || [];
    const rooms = roomsR.data || [];
    const curriculum = currR.data || [];

    const subjectById = new Map(subjects.map((s: any) => [s.id, s]));
    const subjectByName = new Map(subjects.map((s: any) => [s.short_name, s]));
    const langLabs = rooms.filter((r: any) => r.type === "language_lab");
    const standardRooms = new Map<string, any>();
    classes.forEach((c: any) => {
      const room = rooms.find((r: any) => r.number === `${c.grade}${c.letter === "А" ? "1" : c.letter === "Б" ? "2" : "3"}`);
      if (room) standardRooms.set(c.id, room);
    });

    // Очищаем текущее расписание
    await supabase.from("schedule_slots").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    const DAYS = 5;
    const PERIODS = 6;
    const slots: any[] = [];

    // Учётчики занятости: teacher[day][period], room[day][period]
    const teacherBusy = new Map<string, Set<string>>();
    const roomBusy = new Map<string, Set<string>>();
    const classBusy = new Map<string, Set<string>>();
    const teacherDayLoad = new Map<string, Map<number, number>>();

    const key = (d: number, p: number) => `${d}-${p}`;
    const isFree = (map: Map<string, Set<string>>, id: string, d: number, p: number) =>
      !map.get(id)?.has(key(d, p));
    const occupy = (map: Map<string, Set<string>>, id: string, d: number, p: number) => {
      if (!map.has(id)) map.set(id, new Set());
      map.get(id)!.add(key(d, p));
    };

    const englishSubject = subjectByName.get("Англ");

    // Сначала ставим ленты по английскому: для каждой параллели — 3 ленты в неделю на одинаковом слоте
    if (englishSubject) {
      const parallels = [...new Set(classes.map((c: any) => c.grade))];
      for (const grade of parallels) {
        const parallelClasses = classes.filter((c: any) => c.grade === grade);
        const englishTeachers = teachers.filter((t: any) => t.subjects?.includes("Английский язык"));
        if (englishTeachers.length < 2 || langLabs.length < 2) continue;

        // 3 урока в неделю на параллель
        let placed = 0;
        for (let d = 1; d <= DAYS && placed < 3; d++) {
          for (let p = 2; p <= PERIODS - 1 && placed < 3; p++) {
            // Проверяем, что весь параллельный набор свободен
            const allClassesFree = parallelClasses.every((c: any) => isFree(classBusy, c.id, d, p));
            const teachersFree = englishTeachers.filter((t: any) => isFree(teacherBusy, t.id, d, p));
            const labsFree = langLabs.filter((r: any) => isFree(roomBusy, r.id, d, p));
            const needed = Math.min(parallelClasses.length, 4);
            if (allClassesFree && teachersFree.length >= needed && labsFree.length >= needed) {
              const levels = ["Beginner", "Pre-Int", "Intermediate", "Upper"];
              for (let i = 0; i < needed; i++) {
                const c = parallelClasses[i];
                const t = teachersFree[i];
                const r = labsFree[i];
                slots.push({
                  day_of_week: d,
                  period: p,
                  class_id: c.id,
                  subject_id: englishSubject.id,
                  teacher_id: t.id,
                  room_id: r.id,
                  lenta_group: `english_${levels[i].toLowerCase()}`,
                });
                occupy(classBusy, c.id, d, p);
                occupy(teacherBusy, t.id, d, p);
                occupy(roomBusy, r.id, d, p);
              }
              placed++;
            }
          }
        }
      }
    }

    // Теперь — основные предметы для каждого класса
    for (const c of classes) {
      const classCurr = curriculum.filter((cu: any) => cu.class_id === c.id);
      // вычитаем уже поставленные английские
      const placedEnglish = slots.filter((s) => s.class_id === c.id && s.subject_id === englishSubject?.id).length;

      const subjectsToPlace: { subject_id: string; remaining: number }[] = [];
      for (const cu of classCurr) {
        const subj = subjectById.get(cu.subject_id) as any;
        if (!subj) continue;
        let remaining = cu.hours_per_week;
        if (subj.short_name === "Англ") remaining = Math.max(0, remaining - placedEnglish);
        if (remaining > 0) subjectsToPlace.push({ subject_id: cu.subject_id, remaining });
      }

      const room = standardRooms.get(c.id);

      for (let d = 1; d <= DAYS; d++) {
        for (let p = 1; p <= PERIODS; p++) {
          if (!isFree(classBusy, c.id, d, p)) continue;
          // выбираем предмет: тот, у которого больше осталось
          subjectsToPlace.sort((a, b) => b.remaining - a.remaining);
          const candidate = subjectsToPlace.find((sp) => sp.remaining > 0);
          if (!candidate) continue;
          const subj = subjectById.get(candidate.subject_id) as any;

          // Ищем учителя
          const candidateTeachers = teachers.filter(
            (t: any) =>
              t.subjects?.some((sub: string) => sub.toLowerCase().includes(subj.short_name.toLowerCase()) || sub === subj.name) &&
              isFree(teacherBusy, t.id, d, p)
          );
          if (candidateTeachers.length === 0) {
            // fallback: любой учитель
            const anyT = teachers.find((t: any) => isFree(teacherBusy, t.id, d, p));
            if (!anyT) continue;
            slots.push({
              day_of_week: d, period: p, class_id: c.id, subject_id: subj.id,
              teacher_id: anyT.id, room_id: room?.id,
            });
            occupy(classBusy, c.id, d, p);
            occupy(teacherBusy, anyT.id, d, p);
            if (room) occupy(roomBusy, room.id, d, p);
          } else {
            // выбираем наименее загруженного
            candidateTeachers.sort((a: any, b: any) => {
              const la = teacherDayLoad.get(a.id)?.get(d) || 0;
              const lb = teacherDayLoad.get(b.id)?.get(d) || 0;
              return la - lb;
            });
            const t = candidateTeachers[0];
            slots.push({
              day_of_week: d, period: p, class_id: c.id, subject_id: subj.id,
              teacher_id: t.id, room_id: room?.id,
            });
            occupy(classBusy, c.id, d, p);
            occupy(teacherBusy, t.id, d, p);
            if (room) occupy(roomBusy, room.id, d, p);
            if (!teacherDayLoad.has(t.id)) teacherDayLoad.set(t.id, new Map());
            const ld = teacherDayLoad.get(t.id)!;
            ld.set(d, (ld.get(d) || 0) + 1);
          }
          candidate.remaining--;
        }
      }
    }

    // Записываем
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
    const weekStr = weekStart.toISOString().slice(0, 10);
    const { error } = await supabase.from("schedule_slots").insert(
      slots.map((s) => ({ ...s, week_starting: weekStr }))
    );
    if (error) throw error;

    return new Response(JSON.stringify({
      ok: true,
      slots_created: slots.length,
      classes: classes.length,
      lentas: slots.filter((s) => s.lenta_group).length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("schedule-generator error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
