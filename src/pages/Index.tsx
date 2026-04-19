import { AppLayout } from "@/components/AppLayout";
import { StatCard } from "@/components/StatCard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, GraduationCap, AlertTriangle, ClipboardList, TrendingUp, Sparkles, Calendar, MessageSquare, Bot, ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

const Index = () => {
  const [stats, setStats] = useState({ staff: 0, students: 0, classes: 0, present: 0, absent: 0, openIncidents: 0, pendingTasks: 0 });
  const [notifications, setNotifications] = useState<any[]>([]);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [chats, setChats] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      const [staffR, classR, attR, incR, taskR, notR, chR] = await Promise.all([
        supabase.from("staff").select("*", { count: "exact", head: true }),
        supabase.from("classes").select("student_count"),
        supabase.from("attendance").select("present_count, absent_count").eq("date", new Date().toISOString().slice(0,10)),
        supabase.from("incidents").select("*").eq("status", "open"),
        supabase.from("tasks").select("*", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(5),
        supabase.from("chat_messages").select("*").order("created_at", { ascending: false }).limit(6),
      ]);
      const students = (classR.data || []).reduce((s, c: any) => s + c.student_count, 0);
      const present = (attR.data || []).reduce((s, c: any) => s + c.present_count, 0);
      const absent = (attR.data || []).reduce((s, c: any) => s + c.absent_count, 0);
      setStats({
        staff: staffR.count || 0,
        students,
        classes: (classR.data || []).length,
        present, absent,
        openIncidents: (incR.data || []).length,
        pendingTasks: taskR.count || 0,
      });
      setNotifications(notR.data || []);
      setIncidents(incR.data || []);
      setChats(chR.data || []);
    };
    load();
  }, []);

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Hero */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden rounded-3xl bg-gradient-hero p-8 text-primary-foreground">
          <div className="absolute inset-0 ornament-kz opacity-30" />
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 text-sm opacity-90 mb-2">
                <Sparkles className="h-4 w-4 text-secondary" />
                <span>Утренний свод · {new Date().toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" })}</span>
              </div>
              <h1 className="font-display text-4xl lg:text-5xl font-extrabold text-balance">
                Доброе утро, <span className="text-secondary">Айгуль Серикбаевна</span>
              </h1>
              <p className="mt-3 text-lg opacity-90 max-w-2xl">
                Сегодня в школе <b>{stats.present}</b> учеников · отсутствуют <b>{stats.absent}</b> · 
                заявка в столовую: <b className="text-secondary">{stats.present} порций</b> уже отправлена.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <Link to="/ai-chat">
                <Button size="lg" className="bg-secondary text-secondary-foreground hover:bg-secondary/90 shadow-gold gap-2">
                  <Bot className="h-5 w-5" /> Открыть AI-завуча
                </Button>
              </Link>
              <Link to="/schedule">
                <Button size="lg" variant="outline" className="border-primary-foreground/30 bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20 gap-2">
                  <Calendar className="h-5 w-5" /> Расписание дня
                </Button>
              </Link>
            </div>
          </div>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Users} label="Сотрудников" value={stats.staff} accent="primary" subtitle="20 активных" />
          <StatCard icon={GraduationCap} label="Учеников" value={stats.students} trend={`${stats.present} в школе`} accent="gold" />
          <StatCard icon={AlertTriangle} label="Открытых инцидентов" value={stats.openIncidents} accent="destructive" />
          <StatCard icon={ClipboardList} label="Активных задач" value={stats.pendingTasks} accent="success" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Notifications */}
          <Card className="p-5 bg-gradient-card border-border/50 lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-xl font-bold">AI-уведомления</h2>
              <Badge className="bg-primary/10 text-primary border-0">{notifications.length}</Badge>
            </div>
            <div className="space-y-3">
              {notifications.map((n) => (
                <div key={n.id} className="flex gap-3 p-3 rounded-xl bg-muted/40 hover:bg-muted/70 transition-colors">
                  <div className={`h-10 w-10 shrink-0 rounded-xl flex items-center justify-center ${
                    n.type === "incident" ? "bg-destructive/10 text-destructive" :
                    n.type === "schedule_conflict" ? "bg-warning/15 text-warning" :
                    "bg-primary/10 text-primary"
                  }`}>
                    {n.type === "incident" ? <AlertTriangle className="h-5 w-5" /> :
                     n.type === "schedule_conflict" ? <Calendar className="h-5 w-5" /> :
                     <TrendingUp className="h-5 w-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{n.title}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">{n.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Live chats */}
          <Card className="p-5 bg-gradient-card border-border/50">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-xl font-bold">Живые чаты</h2>
              <Link to="/chats" className="text-xs text-primary font-medium flex items-center gap-1 hover:underline">
                Все <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="space-y-3">
              {chats.map((c) => (
                <div key={c.id} className="flex gap-2 text-sm">
                  <Badge variant="outline" className={c.channel === "telegram" ? "border-primary/40 text-primary" : "border-success/40 text-success"}>
                    {c.channel === "telegram" ? "TG" : "WA"}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{c.sender_name}</p>
                    <p className="text-muted-foreground truncate text-xs">{c.content}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Incidents */}
          <Card className="p-5 bg-gradient-card border-border/50 lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-xl font-bold">Открытые инциденты</h2>
              <Link to="/incidents"><Button variant="ghost" size="sm">Все</Button></Link>
            </div>
            <div className="space-y-2">
              {incidents.map((i) => (
                <div key={i.id} className="flex items-center justify-between p-3 rounded-xl border border-border bg-card hover:shadow-md transition-all">
                  <div className="min-w-0">
                    <div className="font-medium">{i.title}</div>
                    <div className="text-xs text-muted-foreground">📍 {i.location} · {i.reported_by}</div>
                  </div>
                  <Badge className={
                    i.priority === "high" ? "bg-destructive text-destructive-foreground" :
                    i.priority === "low" ? "bg-muted text-muted-foreground" :
                    "bg-warning text-warning-foreground"
                  }>{i.priority}</Badge>
                </div>
              ))}
            </div>
          </Card>

          {/* Quick actions */}
          <Card className="p-5 bg-gradient-card border-border/50">
            <h2 className="font-display text-xl font-bold mb-4">Быстрые действия</h2>
            <div className="space-y-2">
              <Link to="/schedule"><Button variant="outline" className="w-full justify-start gap-2"><Calendar className="h-4 w-4" /> Сгенерировать расписание</Button></Link>
              <Link to="/orders"><Button variant="outline" className="w-full justify-start gap-2"><Sparkles className="h-4 w-4" /> Создать приказ</Button></Link>
              <Link to="/ai-chat"><Button variant="outline" className="w-full justify-start gap-2"><Bot className="h-4 w-4" /> Голосовая команда</Button></Link>
              <Link to="/chats"><Button variant="outline" className="w-full justify-start gap-2"><MessageSquare className="h-4 w-4" /> Чаты учителей</Button></Link>
            </div>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
};

export default Index;
