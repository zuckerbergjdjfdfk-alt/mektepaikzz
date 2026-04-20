// Генератор расписания v2: реальная нагрузка из curriculum, ленты по английскому,
// учёт нагрузки учителей, кабинетов, окон. Цель — собрать за <10 секунд.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DAYS = 5;
const PERIODS = 7;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const t0 = Date.now();
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const [classesR, subjectsR, teachersR, roomsR, currR] = await Promise.all([
      sb.from("classes").select("*").order("grade").order("letter"),
      sb.from("subjects").select("*"),
      sb.from("staff").select("*").eq("role", "teacher"),
      sb.from("rooms").select("*"),
      sb.from("curriculum").select("*"),
    ]);

    const classes = classesR.data || [];
    const subjects = subjectsR.data || [];
    const teachers = teachersR.data || [];
    const rooms = roomsR.data || [];
    const curriculum = currR.data || [];

    const subjectById = new Map(subjects.map((s: any) => [s.id, s]));
    const classById = new Map(classes.map((c: any) => [c.id, c]));
    const labRooms = rooms.filter((r: any) => r.type === "language_lab");
    const standardRooms = rooms.filter((r: any) => r.type === "standard" || !r.type);

    // Очистка
    await sb.from("schedule_slots").delete().gte("day_of_week", 0);

    // Учёт занятости
    const busy = (m: Map<string, Set<string>>, id: string, d: number, p: number) => m.get(id)?.has(`${d}-${p}`);
    const occupy = (m: Map<string, Set<string>>, id: string, d: number, p: number) => {
      if (!m.has(id)) m.set(id, new Set());
      m.get(id)!.add(`${d}-${p}`);
    };
    const teacherBusy = new Map<string, Set<string>>();
    const roomBusy = new Map<string, Set<string>>();
    const classBusy = new Map<string, Set<string>>();
    const teacherDayLoad = new Map<string, Map<number, number>>();

    const slots: any[] = [];

    // Найти учителей, ведущих предмет в данном классе
    const teachersForSubjectClass = (subjId: string, cls: any) => {
      const subj = subjectById.get(subjId) as any;
      if (!subj) return [];
      const sname = subj.name.toLowerCase();
      return teachers.filter((t: any) =>
        (t.subjects || []).some((s: string) => {
          const ts = s.toLowerCase();
          return ts === sname || ts.includes(sname) || sname.includes(ts);
        })
      );
    };

    // Подходящий кабинет
    const pickRoom = (subj: any, cls: any, d: number, p: number) => {
      // 1. lab для английского
      if (subj.is_lenta || subj.name.toLowerCase().includes("ағылшын")) {
        const lab = labRooms.find((r: any) => !busy(roomBusy, r.id, d, p));
        if (lab) return lab;
      }
      // 2. кабинет, привязанный к классу/учителю
      const matched = standardRooms.find((r: any) => 
        r.name && subj.name.toLowerCase().includes(r.name.toLowerCase()) && !busy(roomBusy, r.id, d, p)
      );
      if (matched) return matched;
      // 3. любой свободный
      return standardRooms.find((r: any) => !busy(roomBusy, r.id, d, p));
    };

    // ===== ФАЗА 1: Ленты по английскому для параллелей =====
    const englishSubj = subjects.find((s: any) => s.is_lenta || s.name.toLowerCase().includes("ағылшын"));
    if (englishSubj && labRooms.length >= 2) {
      const grades = [...new Set(classes.map((c: any) => c.grade))];
      for (const grade of grades) {
        const parClasses = classes.filter((c: any) => c.grade === grade);
        if (parClasses.length < 2) continue;

        const engTeachers = teachers.filter((t: any) =>
          (t.subjects || []).some((s: string) => s.toLowerCase().includes("ағылшын"))
        );
        if (engTeachers.length < parClasses.length) continue;

        let placed = 0;
        const targetLessons = 3;
        for (let d = 1; d <= DAYS && placed < targetLessons; d++) {
          for (let p = 2; p <= PERIODS - 1 && placed < targetLessons; p++) {
            const allClassesFree = parClasses.every((c: any) => !busy(classBusy, c.id, d, p));
            const teachersFree = engTeachers.filter((t: any) => !busy(teacherBusy, t.id, d, p)).slice(0, parClasses.length);
            const labsFree = labRooms.filter((r: any) => !busy(roomBusy, r.id, d, p)).slice(0, parClasses.length);
            
            if (allClassesFree && teachersFree.length >= parClasses.length && labsFree.length >= parClasses.length) {
              const levels = ["Beginner", "Pre-Int", "Intermediate", "Advanced"];
              for (let i = 0; i < parClasses.length; i++) {
                slots.push({
                  day_of_week: d, period: p,
                  class_id: parClasses[i].id,
                  subject_id: englishSubj.id,
                  teacher_id: teachersFree[i].id,
                  room_id: labsFree[i].id,
                  lenta_group: `eng_${grade}_${levels[i].toLowerCase()}`,
                });
                occupy(classBusy, parClasses[i].id, d, p);
                occupy(teacherBusy, teachersFree[i].id, d, p);
                occupy(roomBusy, labsFree[i].id, d, p);
              }
              placed++;
            }
          }
        }
      }
    }

    // ===== ФАЗА 2: Основные предметы по curriculum =====
    // Сортируем классы и собираем "корзину" уроков для каждого
    for (const cls of classes) {
      const classCurr = curriculum.filter((c: any) => c.class_id === cls.id);
      const placedEngCount = slots.filter(s => s.class_id === cls.id && s.subject_id === englishSubj?.id).length;

      const buckets: { subject_id: string; remaining: number; subj: any }[] = [];
      for (const cu of classCurr) {
        const subj = subjectById.get(cu.subject_id) as any;
        if (!subj) continue;
        let rem = cu.hours_per_week;
        if (subj.id === englishSubj?.id) rem = Math.max(0, rem - placedEngCount);
        if (rem > 0) buckets.push({ subject_id: cu.subject_id, remaining: rem, subj });
      }

      // Жадно расставляем
      for (let d = 1; d <= DAYS; d++) {
        for (let p = 1; p <= PERIODS; p++) {
          if (busy(classBusy, cls.id, d, p)) continue;
          buckets.sort((a, b) => b.remaining - a.remaining);
          const pick = buckets.find(b => b.remaining > 0);
          if (!pick) break;

          const candidates = teachersForSubjectClass(pick.subject_id, cls).filter((t: any) => !busy(teacherBusy, t.id, d, p));
          // приоритет — наименее загруженный сегодня
          candidates.sort((a: any, b: any) => 
            (teacherDayLoad.get(a.id)?.get(d) || 0) - (teacherDayLoad.get(b.id)?.get(d) || 0)
          );
          let teacher = candidates[0];
          if (!teacher) {
            // fallback — любой свободный учитель
            teacher = teachers.find((t: any) => !busy(teacherBusy, t.id, d, p));
          }
          if (!teacher) continue;

          const room = pickRoom(pick.subj, cls, d, p);
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
          if (!teacherDayLoad.has(teacher.id)) teacherDayLoad.set(teacher.id, new Map());
          const ld = teacherDayLoad.get(teacher.id)!;
          ld.set(d, (ld.get(d) || 0) + 1);
          pick.remaining--;
        }
      }
    }

    // Запись
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
    const weekStr = weekStart.toISOString().slice(0, 10);
    const batches: any[] = [];
    for (let i = 0; i < slots.length; i += 200) batches.push(slots.slice(i, i + 200));
    for (const b of batches) {
      const { error } = await sb.from("schedule_slots").insert(b.map((s: any) => ({ ...s, week_starting: weekStr })));
      if (error) throw error;
    }

    const elapsed = Date.now() - t0;
    return new Response(JSON.stringify({
      ok: true,
      slots_created: slots.length,
      classes: classes.length,
      teachers: teachers.length,
      rooms: rooms.length,
      lentas: slots.filter(s => s.lenta_group).length,
      elapsed_ms: elapsed,
    }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("schedule-generator:", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
