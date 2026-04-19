import { AppLayout } from "@/components/AppLayout";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Loader2, Calendar, AlertTriangle, Flame, Download, RefreshCw, UserX } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

const DAYS = ["Пн", "Вт", "Ср", "Чт", "Пт"];
const PERIODS = [1, 2, 3, 4, 5, 6];

type Slot = {
  id: string;
  day_of_week: number;
  period: number;
  class_id: string;
  subject_id: string | null;
  teacher_id: string | null;
  room_id: string | null;
  lenta_group: string | null;
  is_substitution: boolean;
};

const SchedulePage = () => {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [view, setView] = useState<"class" | "teacher" | "heatmap">("class");
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>("");
  const [generating, setGenerating] = useState(false);
  const [substituting, setSubstituting] = useState(false);
  const [draggedSlot, setDraggedSlot] = useState<Slot | null>(null);

  const load = async () => {
    const [s, c, t, sj, r] = await Promise.all([
      supabase.from("schedule_slots").select("*"),
      supabase.from("classes").select("*").order("name"),
      supabase.from("staff").select("*").order("full_name"),
      supabase.from("subjects").select("*"),
      supabase.from("rooms").select("*"),
    ]);
    setSlots((s.data || []) as Slot[]);
    setClasses(c.data || []);
    setStaff(t.data || []);
    setSubjects(sj.data || []);
    setRooms(r.data || []);
    if (!selectedClassId && c.data?.length) setSelectedClassId(c.data[0].id);
    if (!selectedTeacherId && t.data?.length) {
      const firstTeacher = t.data.find((x: any) => x.role === "teacher");
      if (firstTeacher) setSelectedTeacherId(firstTeacher.id);
    }
  };

  useEffect(() => { load(); }, []);

  const subjectMap = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);
  const staffMap = useMemo(() => new Map(staff.map((s) => [s.id, s])), [staff]);
  const classMap = useMemo(() => new Map(classes.map((c) => [c.id, c])), [classes]);
  const roomMap = useMemo(() => new Map(rooms.map((r) => [r.id, r])), [rooms]);

  const generateSchedule = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("schedule-generator", { body: {} });
      if (error) throw error;
      toast.success(`Расписание сгенерировано: ${data.slots_created} уроков, ${data.lentas} лент английского`);
      await load();
    } catch (e: any) {
      toast.error(e.message || "Ошибка генерации");
    } finally {
      setGenerating(false);
    }
  };

  const triggerSubstitution = async (teacherId: string) => {
    setSubstituting(true);
    try {
      const dow = new Date().getDay() === 0 ? 6 : new Date().getDay();
      const { data, error } = await supabase.functions.invoke("smart-substitute", {
        body: { teacher_id: teacherId, day_of_week: Math.min(dow, 5) },
      });
      if (error) throw error;
      toast.success(`AI назначил ${data.substitutions.filter((s: any) => s.substitute).length} замен из ${data.lessons_processed}`);
      await load();
    } catch (e: any) {
      toast.error(e.message || "Ошибка");
    } finally {
      setSubstituting(false);
    }
  };

  const onDrop = async (day: number, period: number) => {
    if (!draggedSlot) return;
    // проверяем конфликт
    const conflict = slots.find(
      (s) =>
        s.id !== draggedSlot.id &&
        s.day_of_week === day &&
        s.period === period &&
        (s.teacher_id === draggedSlot.teacher_id ||
          s.room_id === draggedSlot.room_id ||
          (view === "class" && s.class_id === draggedSlot.class_id))
    );
    if (conflict) {
      toast.error("Конфликт: учитель, кабинет или класс уже заняты в этом слоте");
      setDraggedSlot(null);
      return;
    }
    await supabase.from("schedule_slots").update({ day_of_week: day, period }).eq("id", draggedSlot.id);
    toast.success("Урок перенесён");
    setDraggedSlot(null);
    await load();
  };

  const slotForCell = (day: number, period: number) => {
    if (view === "class") return slots.filter((s) => s.class_id === selectedClassId && s.day_of_week === day && s.period === period);
    if (view === "teacher") return slots.filter((s) => s.teacher_id === selectedTeacherId && s.day_of_week === day && s.period === period);
    return [];
  };

  // Heatmap data
  const heatmapData = useMemo(() => {
    const teacherLoad = new Map<string, number>();
    slots.forEach((s) => {
      if (s.teacher_id) teacherLoad.set(s.teacher_id, (teacherLoad.get(s.teacher_id) || 0) + 1);
    });
    return staff
      .filter((t) => t.role === "teacher")
      .map((t) => ({
        teacher: t,
        load: teacherLoad.get(t.id) || 0,
        max: t.weekly_hours || 22,
      }))
      .sort((a, b) => b.load - a.load);
  }, [slots, staff]);

  const heatColor = (ratio: number) => {
    if (ratio > 1.1) return "bg-heat-4 text-destructive-foreground";
    if (ratio > 0.9) return "bg-heat-3 text-foreground";
    if (ratio > 0.6) return "bg-heat-2 text-foreground";
    if (ratio > 0.3) return "bg-heat-1 text-foreground";
    return "bg-heat-0 text-foreground";
  };

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-extrabold flex items-center gap-3">
              <Calendar className="h-8 w-8 text-primary" />
              Умное расписание
            </h1>
            <p className="text-muted-foreground mt-1">
              {slots.length} уроков · {slots.filter((s) => s.lenta_group).length} лент английского · {slots.filter((s) => s.is_substitution).length} замен
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={generateSchedule} disabled={generating} className="bg-gradient-primary text-primary-foreground gap-2 shadow-glow">
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              AI генерация
            </Button>
            <Button variant="outline" onClick={load} className="gap-2"><RefreshCw className="h-4 w-4" /></Button>
            <Button variant="outline" className="gap-2"><Download className="h-4 w-4" /> Экспорт</Button>
          </div>
        </motion.div>

        {/* View tabs */}
        <Card className="p-4 bg-gradient-card">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="flex bg-muted rounded-lg p-1 gap-1">
              {[
                { v: "class", l: "По классу" },
                { v: "teacher", l: "По учителю" },
                { v: "heatmap", l: "Heatmap нагрузки" },
              ].map((t) => (
                <button key={t.v} onClick={() => setView(t.v as any)} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${view === t.v ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                  {t.l}
                </button>
              ))}
            </div>

            {view === "class" && (
              <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {classes.map((c) => <SelectItem key={c.id} value={c.id}>Класс {c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            {view === "teacher" && (
              <>
                <Select value={selectedTeacherId} onValueChange={setSelectedTeacherId}>
                  <SelectTrigger className="w-[280px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {staff.map((t) => <SelectItem key={t.id} value={t.id}>{t.full_name} ({t.role})</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={() => triggerSubstitution(selectedTeacherId)} disabled={substituting} className="gap-2">
                  {substituting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserX className="h-4 w-4" />}
                  Учитель заболел → AI замена
                </Button>
              </>
            )}
          </div>
        </Card>

        {/* Grid */}
        {view === "heatmap" ? (
          <Card className="p-6 bg-gradient-card">
            <div className="flex items-center gap-2 mb-4">
              <Flame className="h-5 w-5 text-destructive" />
              <h2 className="font-display text-xl font-bold">Тепловая карта нагрузки учителей</h2>
            </div>
            <div className="space-y-2">
              {heatmapData.map(({ teacher, load, max }) => {
                const ratio = load / max;
                return (
                  <div key={teacher.id} className="flex items-center gap-3">
                    <div className="w-56 text-sm font-medium truncate">{teacher.full_name}</div>
                    <div className="flex-1 h-8 rounded-md overflow-hidden bg-muted relative">
                      <div className={`h-full ${heatColor(ratio)} transition-all`} style={{ width: `${Math.min(ratio * 100, 130)}%` }} />
                      <div className="absolute inset-0 flex items-center px-3 text-xs font-bold">
                        {load} / {max} ч
                        {ratio > 1 && <Badge className="ml-2 bg-destructive text-destructive-foreground text-[10px]">Перегрузка!</Badge>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        ) : (
          <Card className="p-4 bg-gradient-card overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr>
                  <th className="text-left p-2 font-medium text-muted-foreground text-sm w-16">Урок</th>
                  {DAYS.map((d, i) => (
                    <th key={d} className="text-left p-2 font-display font-bold text-foreground">{d}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERIODS.map((p) => (
                  <tr key={p} className="border-t border-border">
                    <td className="p-2 font-bold text-primary text-lg w-16">{p}</td>
                    {DAYS.map((_, dIdx) => {
                      const day = dIdx + 1;
                      const cellSlots = slotForCell(day, p);
                      return (
                        <td
                          key={day}
                          className="p-1 align-top"
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => onDrop(day, p)}
                        >
                          {cellSlots.length === 0 ? (
                            <div className="h-20 rounded-lg border-2 border-dashed border-border/40 flex items-center justify-center text-xs text-muted-foreground">
                              окно
                            </div>
                          ) : (
                            <div className="space-y-1">
                              {cellSlots.map((s) => {
                                const subj = subjectMap.get(s.subject_id || "");
                                const teacher = staffMap.get(s.teacher_id || "");
                                const cls = classMap.get(s.class_id);
                                const room = roomMap.get(s.room_id || "");
                                return (
                                  <div
                                    key={s.id}
                                    draggable
                                    onDragStart={() => setDraggedSlot(s)}
                                    className={`p-2 rounded-lg cursor-move shadow-sm hover:shadow-md transition-all border-l-4 ${s.is_substitution ? "bg-warning/15 border-warning" : s.lenta_group ? "bg-secondary/15 border-secondary" : "bg-card border-primary"}`}
                                    style={subj ? { borderLeftColor: subj.color } : undefined}
                                  >
                                    <div className="flex items-start justify-between gap-1">
                                      <div className="min-w-0">
                                        <div className="font-bold text-sm truncate">{subj?.short_name || "?"}</div>
                                        <div className="text-[11px] text-muted-foreground truncate">
                                          {view === "class" ? teacher?.full_name?.split(" ")[0] : cls?.name}
                                          {room ? ` · к.${room.number}` : ""}
                                        </div>
                                      </div>
                                      {s.lenta_group && <Badge className="bg-secondary text-secondary-foreground text-[9px] px-1">Лента</Badge>}
                                      {s.is_substitution && <Badge className="bg-warning text-warning-foreground text-[9px] px-1">Замена</Badge>}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}

        {/* Hint */}
        <Card className="p-4 bg-primary/5 border-primary/20">
          <div className="flex gap-3">
            <AlertTriangle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium">Как работать с расписанием:</p>
              <ul className="text-muted-foreground mt-1 space-y-0.5 list-disc list-inside">
                <li>Перетащите карточку урока в свободную ячейку — система проверит конфликты автоматически</li>
                <li>Кнопка <b>"Учитель заболел"</b> запустит AI-поиск замен с проверкой квалификации и нагрузки</li>
                <li>Ленты английского привязаны ко всей параллели одновременно (4 группы по уровням)</li>
              </ul>
            </div>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
};

export default SchedulePage;
