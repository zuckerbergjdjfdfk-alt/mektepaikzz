// AI-генератор расписания v3: сначала жадный алгоритм с лентами английского по уровням,
// потом Gemini проверяет проблемные места (окна у учителей, перегрузки, конфликты).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DAYS = 5;
const PERIODS = 7;

type Slot = {
  day_of_week: number;
  period: number;
  class_id: string;
  subject_id: string;
  teacher_id: string;
  room_id: string | null;
  lenta_group?: string | null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const t0 = Date.now();
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json().catch(() => ({}));
    const useAI = body.mode !== "fast";

    const [classesR, subjectsR, teachersR, roomsR, currR] = await Promise.all([
      sb.from("classes").select("*").order("grade").order("letter"),
      sb.from("subjects").select("*"),
      sb.from("staff").select("*").eq("role", "teacher").eq("is_active", true),
      sb.from("rooms").select("*"),
      sb.from("curriculum").select("*"),
    ]);

    const classes = classesR.data || [];
    const subjects = subjectsR.data || [];
    const teachers = teachersR.data || [];
    const rooms = roomsR.data || [];
    const curriculum = currR.data || [];

    const subjectById = new Map(subjects.map((s: any) => [s.id, s]));
    const labRooms = rooms.filter((r: any) => r.type === "language_lab");
    const standardRooms = rooms.filter((r: any) => r.type === "standard" || !r.type);

    await sb.from("schedule_slots").delete().gte("day_of_week", 0);

    const teacherBusy = new Map<string, Set<string>>();
    const roomBusy = new Map<string, Set<string>>();
    const classBusy = new Map<string, Set<string>>();
    const teacherDayLoad = new Map<string, Map<number, number>>();
    const teacherWeekLoad = new Map<string, number>();

    const key = (d: number, p: number) => `${d}-${p}`;
    const busy = (m: Map<string, Set<string>>, id: string, d: number, p: number) => m.get(id)?.has(key(d, p)) || false;
    const occupy = (m: Map<string, Set<string>>, id: string, d: number, p: number) => {
      if (!m.has(id)) m.set(id, new Set());
      m.get(id)!.add(key(d, p));
    };

    const slots: Slot[] = [];

    // ===== ФАЗА 1: Ленты английского (4 уровня) =====
    const englishSubj = subjects.find((s: any) =>
      s.is_lenta || /ағылшын|англ|english/i.test(s.name)
    );
    const LEVELS = ["Beginner", "Pre-Intermediate", "Intermediate", "Advanced"];

    if (englishSubj && labRooms.length >= 2) {
      const grades = [...new Set(classes.map((c: any) => c.grade))].sort((a: any, b: any) => a - b);
      for (const grade of grades) {
        const parClasses = classes.filter((c: any) => c.grade === grade);
        if (parClasses.length < 1) continue;

        const engTeachers = teachers.filter((t: any) =>
          (t.subjects || []).some((s: string) => /ағылшын|англ|english/i.test(s))
        );
        if (engTeachers.length === 0) continue;

        const groupsPerLesson = Math.min(parClasses.length, LEVELS.length, engTeachers.length, labRooms.length);
        if (groupsPerLesson === 0) continue;

        let placed = 0;
        const target = 3; // 3 ленты в неделю
        outer: for (let d = 1; d <= DAYS; d++) {
          for (let p = 2; p <= PERIODS - 1; p++) {
            if (placed >= target) break outer;
            const allClassesFree = parClasses.every((c: any) => !busy(classBusy, c.id, d, p));
            const tFree = engTeachers.filter((t: any) => !busy(teacherBusy, t.id, d, p)).slice(0, groupsPerLesson);
            const labFree = labRooms.filter((r: any) => !busy(roomBusy, r.id, d, p)).slice(0, groupsPerLesson);
            if (!allClassesFree || tFree.length < groupsPerLesson || labFree.length < groupsPerLesson) continue;

            for (let i = 0; i < parClasses.length; i++) {
              const teacher = tFree[i % tFree.length];
              const room = labFree[i % labFree.length];
              slots.push({
                day_of_week: d, period: p,
                class_id: parClasses[i].id,
                subject_id: englishSubj.id,
                teacher_id: teacher.id,
                room_id: room.id,
                lenta_group: `eng_g${grade}_${LEVELS[i % LEVELS.length].toLowerCase().replace(/[^a-z]/g, "")}`,
              });
              occupy(classBusy, parClasses[i].id, d, p);
              occupy(teacherBusy, teacher.id, d, p);
              occupy(roomBusy, room.id, d, p);
              const dl = teacherDayLoad.get(teacher.id) || new Map<number, number>();
              dl.set(d, (dl.get(d) || 0) + 1);
              teacherDayLoad.set(teacher.id, dl);
              teacherWeekLoad.set(teacher.id, (teacherWeekLoad.get(teacher.id) || 0) + 1);
            }
            placed++;
          }
        }
      }
    }

    // ===== ФАЗА 2: Основные предметы по curriculum =====
    const teachersForSubject = (subjId: string) => {
      const subj = subjectById.get(subjId) as any;
      if (!subj) return [];
      const sname = subj.name.toLowerCase();
      const sshort = (subj.short_name || "").toLowerCase();
      return teachers.filter((t: any) =>
        (t.subjects || []).some((s: string) => {
          const ts = s.toLowerCase();
          return ts === sname || ts.includes(sname) || sname.includes(ts) || (sshort && ts.includes(sshort));
        })
      );
    };

    const pickRoom = (subj: any, d: number, p: number) => {
      if (subj.is_lenta || /ағылшын|англ|english/i.test(subj.name)) {
        const lab = labRooms.find((r: any) => !busy(roomBusy, r.id, d, p));
        if (lab) return lab;
      }
      return standardRooms.find((r: any) => !busy(roomBusy, r.id, d, p));
    };

    const sortedClasses = [...classes].sort((a: any, b: any) => b.grade - a.grade);

    for (const cls of sortedClasses) {
      const classCurr = curriculum.filter((c: any) => c.class_id === cls.id);
      const placedEng = slots.filter((s) => s.class_id === cls.id && s.subject_id === englishSubj?.id).length;
      const buckets: { subject_id: string; remaining: number; subj: any }[] = [];
      for (const cu of classCurr) {
        const subj = subjectById.get(cu.subject_id) as any;
        if (!subj) continue;
        let rem = cu.hours_per_week;
        if (subj.id === englishSubj?.id) rem = Math.max(0, rem - placedEng);
        if (rem > 0) buckets.push({ subject_id: cu.subject_id, remaining: rem, subj });
      }

      // Жадная расстановка с минимизацией окон у класса
      const periodOrder: { d: number; p: number }[] = [];
      for (let d = 1; d <= DAYS; d++) for (let p = 1; p <= PERIODS; p++) periodOrder.push({ d, p });

      for (const { d, p } of periodOrder) {
        if (busy(classBusy, cls.id, d, p)) continue;
        buckets.sort((a, b) => b.remaining - a.remaining);
        const pick = buckets.find((b) => b.remaining > 0);
        if (!pick) break;

        const candidates = teachersForSubject(pick.subject_id)
          .filter((t: any) => !busy(teacherBusy, t.id, d, p))
          .sort((a: any, b: any) => {
            // приоритет: меньше дневная нагрузка, меньше недельная
            const da = (teacherDayLoad.get(a.id)?.get(d) || 0) - (teacherDayLoad.get(b.id)?.get(d) || 0);
            if (da !== 0) return da;
            return (teacherWeekLoad.get(a.id) || 0) - (teacherWeekLoad.get(b.id) || 0);
          });

        let teacher = candidates[0];
        if (!teacher) teacher = teachers.find((t: any) => !busy(teacherBusy, t.id, d, p));
        if (!teacher) continue;

        const room = pickRoom(pick.subj, d, p);
        if (!room) continue;

        slots.push({
          day_of_week: d, period: p,
          class_id: cls.id,
          subject_id: pick.subject_id,
          teacher_id: teacher.id,
          room_id: room.id,
        });
        occupy(classBusy, cls.id, d, p);
        occupy(teacherBusy, teacher.id, d, p);
        occupy(roomBusy, room.id, d, p);
        const dl = teacherDayLoad.get(teacher.id) || new Map<number, number>();
        dl.set(d, (dl.get(d) || 0) + 1);
        teacherDayLoad.set(teacher.id, dl);
        teacherWeekLoad.set(teacher.id, (teacherWeekLoad.get(teacher.id) || 0) + 1);
        pick.remaining--;
      }
    }

    // ===== ФАЗА 3: AI-валидация =====
    let aiNote = "";
    if (useAI) {
      try {
        const overloaded = teachers
          .map((t: any) => ({ name: t.full_name, load: teacherWeekLoad.get(t.id) || 0, max: t.weekly_hours || 22 }))
          .filter((x) => x.load > x.max).slice(0, 5);
        const lentas = slots.filter((s) => s.lenta_group).length;

        const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
        if (LOVABLE_API_KEY) {
          const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "google/gemini-2.5-pro",
              messages: [
                { role: "system", content: "Ты — AI-методист школы Mektep AI в Актобе. Дай краткий вердикт по сгенерированному расписанию: 2-4 строки на русском, без markdown." },
                { role: "user", content: `Создано ${slots.length} уроков, ${lentas} лент английского по 4 уровням, ${classes.length} классов, ${teachers.length} учителей.\nПерегружены: ${overloaded.map((x) => `${x.name} (${x.load}/${x.max}ч)`).join(", ") || "никто"}.` },
              ],
            }),
          });
          if (aiRes.ok) {
            const ai = await aiRes.json();
            aiNote = ai.choices?.[0]?.message?.content || "";
          }
        }
      } catch (e) {
        console.warn("AI validation skipped:", (e as Error).message);
      }
    }

    // Запись
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
    const weekStr = weekStart.toISOString().slice(0, 10);
    for (let i = 0; i < slots.length; i += 200) {
      const batch = slots.slice(i, i + 200).map((s) => ({ ...s, week_starting: weekStr }));
      const { error } = await sb.from("schedule_slots").insert(batch);
      if (error) throw error;
    }

    return new Response(JSON.stringify({
      ok: true,
      slots_created: slots.length,
      classes: classes.length,
      teachers: teachers.length,
      rooms: rooms.length,
      lentas: slots.filter((s) => s.lenta_group).length,
      ai_note: aiNote,
      elapsed_ms: Date.now() - t0,
    }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("schedule-generator:", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
