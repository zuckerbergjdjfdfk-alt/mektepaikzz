import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, CheckCircle2, X, Loader2, MapPin, User, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

const PRIORITY_STYLES: Record<string, { bg: string; border: string; badge: string; label: string }> = {
  low: { bg: "bg-success/5", border: "border-l-success", badge: "bg-success text-success-foreground", label: "Лёгкий" },
  normal: { bg: "bg-warning/5", border: "border-l-warning", badge: "bg-warning text-warning-foreground", label: "Средний" },
  high: { bg: "bg-destructive/5", border: "border-l-destructive", badge: "bg-destructive text-destructive-foreground", label: "Тяжёлый" },
};

const IncidentsPage = () => {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [filter, setFilter] = useState<"all" | "open" | "resolved">("all");

  const load = async () => {
    const { data } = await supabase.from("incidents").select("*").order("created_at", { ascending: false });
    setIncidents(data || []);
  };
  useEffect(() => {
    load();
    const ch = supabase.channel("inc-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "incidents" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const accept = async (id: string) => {
    await supabase.from("incidents").update({ status: "in_progress" }).eq("id", id);
    toast.success("Принято в работу");
  };
  const resolve = async (id: string) => {
    await supabase.from("incidents").update({ status: "resolved" }).eq("id", id);
    toast.success("Закрыт");
  };
  const reject = async (id: string) => {
    await supabase.from("incidents").update({ status: "rejected" }).eq("id", id);
    toast.info("Отклонён");
  };

  const filtered = incidents.filter((i) => filter === "all" ? true : filter === "open" ? i.status === "open" : i.status === "resolved");
  const stats = {
    high: incidents.filter((i) => i.priority === "high" && i.status !== "resolved").length,
    normal: incidents.filter((i) => i.priority === "normal" && i.status !== "resolved").length,
    low: incidents.filter((i) => i.priority === "low" && i.status !== "resolved").length,
  };

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-display text-3xl font-extrabold flex items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-destructive" /> Инциденты
          </h1>
          <p className="text-muted-foreground mt-1">Из чатов TG/WA · NFC · ручные · сортировка по тяжести</p>
        </motion.div>

        <div className="grid grid-cols-3 gap-4">
          <Card className="p-4 bg-destructive/10 border-destructive/30">
            <div className="text-xs text-destructive font-medium">🔴 Тяжёлые (срочно!)</div>
            <div className="text-3xl font-bold font-display mt-1 text-destructive">{stats.high}</div>
          </Card>
          <Card className="p-4 bg-warning/10 border-warning/30">
            <div className="text-xs text-warning font-medium">🟡 Средние</div>
            <div className="text-3xl font-bold font-display mt-1 text-warning">{stats.normal}</div>
          </Card>
          <Card className="p-4 bg-success/10 border-success/30">
            <div className="text-xs text-success font-medium">🟢 Лёгкие</div>
            <div className="text-3xl font-bold font-display mt-1 text-success">{stats.low}</div>
          </Card>
        </div>

        <div className="flex gap-2">
          {[{ k: "all", l: "Все" }, { k: "open", l: "Открытые" }, { k: "resolved", l: "Решённые" }].map((f) => (
            <Button key={f.k} size="sm" variant={filter === f.k ? "default" : "outline"} onClick={() => setFilter(f.k as any)}>{f.l}</Button>
          ))}
        </div>

        <div className="space-y-3">
          {filtered.length === 0 && (
            <Card className="p-8 text-center text-muted-foreground bg-gradient-card">Инцидентов нет 🎉</Card>
          )}
          {filtered.map((inc, i) => {
            const style = PRIORITY_STYLES[inc.priority] || PRIORITY_STYLES.normal;
            return (
              <motion.div key={inc.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
                <Card className={`p-4 border-l-4 ${style.border} ${style.bg}`}>
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={style.badge}>{style.label}</Badge>
                        <Badge variant="outline" className="text-[10px]">{inc.source}</Badge>
                        <Badge variant="outline" className="text-[10px]">{inc.status}</Badge>
                      </div>
                      <h3 className="font-display font-bold text-lg mt-2">{inc.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1">{inc.description}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                        {inc.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {inc.location}</span>}
                        {inc.reported_by && <span className="flex items-center gap-1"><User className="h-3 w-3" /> {inc.reported_by}</span>}
                        <span>{new Date(inc.created_at).toLocaleString("ru-RU")}</span>
                      </div>
                    </div>
                    {inc.status === "open" && (
                      <div className="flex gap-2 shrink-0">
                        <Button size="sm" onClick={() => accept(inc.id)} className="gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Принять
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => resolve(inc.id)} className="gap-1">
                          ✓ Решён
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => reject(inc.id)} className="gap-1 text-destructive">
                          <X className="h-3 w-3" /> Отклонить
                        </Button>
                      </div>
                    )}
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
};

export default IncidentsPage;
