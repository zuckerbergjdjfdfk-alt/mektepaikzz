import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Users, Loader2, UserX, CheckCircle2, AlertTriangle, Sparkles, Send } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

const SubstitutionsPage = () => {
  const [staff, setStaff] = useState<any[]>([]);
  const [substitutions, setSubstitutions] = useState<any[]>([]);
  const [absentTeacher, setAbsentTeacher] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [autoLog, setAutoLog] = useState<any[]>([]);

  const load = async () => {
    const [s, sub] = await Promise.all([
      supabase.from("staff").select("*").eq("role", "teacher").order("full_name"),
      supabase.from("schedule_slots").select("*, classes(name), subjects(name, short_name), staff!schedule_slots_teacher_id_fkey(full_name), original:staff!schedule_slots_original_teacher_id_fkey(full_name)").eq("is_substitution", true).order("created_at", { ascending: false }).limit(20),
    ]);
    setStaff(s.data || []);
    setSubstitutions(sub.data || []);
  };
  useEffect(() => { load(); }, []);

  const triggerAuto = async () => {
    if (!absentTeacher) { toast.error("Выберите учителя"); return; }
    setLoading(true);
    setAutoLog([]);
    try {
      const dow = new Date().getDay() === 0 ? 6 : Math.min(new Date().getDay(), 5);
      const { data, error } = await supabase.functions.invoke("smart-substitute", {
        body: { teacher_id: absentTeacher, day_of_week: dow },
      });
      if (error) throw error;
      setAutoLog(data.substitutions || []);
      const teacher = staff.find((s) => s.id === absentTeacher);
      await supabase.from("notifications").insert({
        type: "schedule_conflict",
        title: "🔄 AI выполнил замену",
        body: `${teacher?.full_name}: ${data.substitutions.filter((s: any) => s.substitute).length} из ${data.lessons_processed} уроков покрыты`,
        payload: { reason },
      });
      toast.success(`AI назначил ${data.substitutions.filter((s: any) => s.substitute).length} замен`);
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally { setLoading(false); }
  };

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-display text-3xl font-extrabold flex items-center gap-3">
            <Users className="h-8 w-8 text-primary" /> Замены учителей
            <Badge className="bg-gradient-gold text-primary-foreground">AI Auto</Badge>
          </h1>
          <p className="text-muted-foreground mt-1">
            Учитель написал что не придёт → AI находит свободное окно у коллег с подходящей квалификацией
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Trigger card */}
          <Card className="p-6 bg-gradient-card border-primary/20">
            <div className="flex items-center gap-2 mb-4">
              <UserX className="h-5 w-5 text-destructive" />
              <h2 className="font-display text-xl font-bold">Учитель не придёт</h2>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Кто заболел / отсутствует</label>
                <Select value={absentTeacher} onValueChange={setAbsentTeacher}>
                  <SelectTrigger><SelectValue placeholder="Выберите учителя" /></SelectTrigger>
                  <SelectContent>
                    {staff.map((t) => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Причина (для приказа)</label>
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Болеет, ОРВИ, больничный лист..." />
              </div>

              <Button onClick={triggerAuto} disabled={loading || !absentTeacher} className="w-full bg-gradient-primary text-primary-foreground gap-2">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                AI: подобрать замены автоматически
              </Button>
            </div>

            {autoLog.length > 0 && (
              <div className="mt-4 space-y-2">
                <div className="text-sm font-semibold">Результат AI-подбора:</div>
                {autoLog.map((s, i) => (
                  <div key={i} className={`p-3 rounded-lg border ${s.substitute ? "bg-success/10 border-success/30" : "bg-destructive/10 border-destructive/30"}`}>
                    <div className="flex items-center justify-between text-sm">
                      <div className="font-medium">
                        {s.period} урок · {s.class_name} · {s.subject}
                      </div>
                      {s.substitute ? (
                        <Badge className="bg-success text-success-foreground gap-1"><CheckCircle2 className="h-3 w-3" /> {s.substitute}</Badge>
                      ) : (
                        <Badge className="bg-destructive text-destructive-foreground gap-1"><AlertTriangle className="h-3 w-3" /> нет</Badge>
                      )}
                    </div>
                    {!s.substitute && <div className="text-xs text-muted-foreground mt-1">{s.note}</div>}
                  </div>
                ))}
                <Button size="sm" variant="outline" className="w-full gap-2 mt-2">
                  <Send className="h-3 w-3" /> Отправить уведомления учителям-заместителям
                </Button>
              </div>
            )}
          </Card>

          {/* Recent substitutions */}
          <Card className="p-6 bg-gradient-card">
            <h2 className="font-display text-xl font-bold mb-4">Последние замены</h2>
            {substitutions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-10 w-10 mx-auto mb-2 opacity-50" />
                Замен ещё не было
              </div>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {substitutions.map((s: any) => (
                  <div key={s.id} className="p-3 rounded-lg border-l-4 border-warning bg-warning/5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold">
                          {s.classes?.name} · {s.period} урок · {s.subjects?.short_name}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          <span className="line-through">{s.original?.full_name}</span>
                          {" → "}
                          <span className="text-foreground font-medium">{s.staff?.full_name}</span>
                        </div>
                      </div>
                      <Badge className="bg-warning text-warning-foreground text-[10px]">Замена</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </AppLayout>
  );
};

export default SubstitutionsPage;
