import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BookOpen, Loader2, Sparkles, Download, Printer, TrendingUp, TrendingDown, Users } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { motion } from "framer-motion";

const ReportsPage = () => {
  const [attendance, setAttendance] = useState<any[]>([]);
  const [aiReport, setAiReport] = useState("");
  const [loading, setLoading] = useState(false);
  const [classes, setClasses] = useState<any[]>([]);

  const load = async () => {
    const today = new Date().toISOString().slice(0, 10);
    const [att, cls] = await Promise.all([
      supabase.from("attendance").select("*, classes(name)").eq("date", today),
      supabase.from("classes").select("*").order("name"),
    ]);
    setAttendance(att.data || []);
    setClasses(cls.data || []);
  };
  useEffect(() => { load(); }, []);

  const generate = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("morning-digest", { body: {} });
      if (error) throw error;
      setAiReport(data.report || data.content || "Отчёт сгенерирован.");
      toast.success("AI-отчёт готов");
    } catch (e: any) {
      toast.error(e.message);
    } finally { setLoading(false); }
  };

  const totals = attendance.reduce((acc, a) => ({
    present: acc.present + (a.present_count || 0),
    absent: acc.absent + (a.absent_count || 0),
    sick: acc.sick + (a.sick_count || 0),
  }), { present: 0, absent: 0, sick: 0 });
  const total = totals.present + totals.absent + totals.sick;
  const pct = total ? Math.round((totals.present / total) * 100) : 0;

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6 print:p-0">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between flex-wrap gap-4 print:hidden">
          <div>
            <h1 className="font-display text-3xl font-extrabold flex items-center gap-3">
              <BookOpen className="h-8 w-8 text-primary" /> AI-отчёты
            </h1>
            <p className="text-muted-foreground mt-1">Реальные данные из чатов TG/WA · {new Date().toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" })}</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={generate} disabled={loading} className="bg-gradient-primary text-primary-foreground gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Сгенерировать утренний свод
            </Button>
            {aiReport && (
              <>
                <Button variant="outline" onClick={() => window.print()} className="gap-2"><Printer className="h-4 w-4" /> Печать</Button>
                <Button variant="outline" onClick={() => {
                  const blob = new Blob([aiReport], { type: "text/markdown" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url; a.download = `report-${new Date().toISOString().slice(0,10)}.md`; a.click();
                }} className="gap-2"><Download className="h-4 w-4" /> Скачать</Button>
              </>
            )}
          </div>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 print:hidden">
          <Card className="p-5 bg-gradient-card">
            <div className="text-xs text-muted-foreground">Всего учеников</div>
            <div className="text-3xl font-bold font-display mt-1">{total}</div>
          </Card>
          <Card className="p-5 bg-success/10 border-success/30">
            <div className="text-xs text-success font-medium">В школе</div>
            <div className="text-3xl font-bold font-display mt-1 text-success">{totals.present}</div>
            <div className="text-xs text-success mt-1">{pct}% явка</div>
          </Card>
          <Card className="p-5 bg-warning/10 border-warning/30">
            <div className="text-xs text-warning font-medium">Болеют</div>
            <div className="text-3xl font-bold font-display mt-1 text-warning">{totals.sick}</div>
          </Card>
          <Card className="p-5 bg-destructive/10 border-destructive/30">
            <div className="text-xs text-destructive font-medium">Отсутствуют</div>
            <div className="text-3xl font-bold font-display mt-1 text-destructive">{totals.absent}</div>
          </Card>
        </div>

        {/* Per-class table */}
        <Card className="p-0 bg-gradient-card overflow-hidden print:hidden">
          <div className="p-4 border-b border-border font-display font-bold">Посещаемость по классам</div>
          <table className="w-full">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr className="text-left">
                <th className="p-3">Класс</th>
                <th className="p-3 text-right">Пришли</th>
                <th className="p-3 text-right">Болеют</th>
                <th className="p-3 text-right">Отсутствуют</th>
                <th className="p-3 text-right">Явка</th>
              </tr>
            </thead>
            <tbody>
              {classes.map((c) => {
                const a = attendance.find((x) => x.class_id === c.id) || { present_count: 0, absent_count: 0, sick_count: 0 };
                const t = a.present_count + a.absent_count + a.sick_count;
                const p = t ? Math.round((a.present_count / t) * 100) : 0;
                return (
                  <tr key={c.id} className="border-t border-border">
                    <td className="p-3 font-bold">{c.name}</td>
                    <td className="p-3 text-right text-success font-medium">{a.present_count}</td>
                    <td className="p-3 text-right text-warning">{a.sick_count}</td>
                    <td className="p-3 text-right text-destructive">{a.absent_count}</td>
                    <td className="p-3 text-right">
                      <Badge className={p >= 90 ? "bg-success text-success-foreground" : p >= 75 ? "bg-warning text-warning-foreground" : "bg-destructive text-destructive-foreground"}>
                        {p}%
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>

        {/* AI report */}
        {aiReport && (
          <Card className="p-8 bg-card print:shadow-none print:border-0">
            <div className="flex items-center gap-2 mb-4 print:hidden">
              <Sparkles className="h-5 w-5 text-primary" />
              <h2 className="font-display text-xl font-bold">AI-сводка для директора</h2>
            </div>
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <ReactMarkdown>{aiReport}</ReactMarkdown>
            </div>
          </Card>
        )}
      </div>
    </AppLayout>
  );
};

export default ReportsPage;
