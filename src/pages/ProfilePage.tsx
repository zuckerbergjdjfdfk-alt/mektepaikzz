import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Crown, Mail, MapPin, MessageSquare, Shield, CalendarDays, FileText } from "lucide-react";

const ProfilePage = () => {
  const [stats, setStats] = useState({ chats: 0, orders: 0, schedule: 0, staff: 0 });

  useEffect(() => {
    const load = async () => {
      const [chatCount, orderCount, scheduleCount, staffCount] = await Promise.all([
        supabase.from("chat_messages").select("*", { count: "exact", head: true }),
        supabase.from("generated_orders").select("*", { count: "exact", head: true }),
        supabase.from("schedule_slots").select("*", { count: "exact", head: true }),
        supabase.from("staff").select("*", { count: "exact", head: true }),
      ]);
      setStats({
        chats: chatCount.count || 0,
        orders: orderCount.count || 0,
        schedule: scheduleCount.count || 0,
        staff: staffCount.count || 0,
      });
    };
    load();
  }, []);

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6">
        <div>
          <h1 className="font-display text-3xl font-extrabold">Профиль директора</h1>
          <p className="text-muted-foreground mt-1">Управляющий профиль Mektep AI для школы в Актобе</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <Card className="p-6 bg-gradient-card lg:col-span-1">
            <div className="flex flex-col items-center text-center gap-4">
              <Avatar className="h-24 w-24 ring-4 ring-secondary/30">
                <AvatarFallback className="bg-gradient-gold text-primary-foreground text-2xl font-bold">АС</AvatarFallback>
              </Avatar>
              <div>
                <div className="font-display text-2xl font-bold">Айгуль Серикбаевна</div>
                <div className="text-muted-foreground">Директор · Mektep AI</div>
              </div>
              <Badge className="bg-secondary text-secondary-foreground gap-1">
                <Crown className="h-3 w-3" /> Полный доступ
              </Badge>
            </div>
          </Card>

          <Card className="p-6 bg-gradient-card lg:col-span-2">
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div className="flex gap-3 items-start"><Shield className="h-4 w-4 text-primary mt-0.5" /><div><div className="font-medium">Роль</div><div className="text-muted-foreground">Главный администратор системы</div></div></div>
              <div className="flex gap-3 items-start"><MapPin className="h-4 w-4 text-primary mt-0.5" /><div><div className="font-medium">Локация</div><div className="text-muted-foreground">Актобе, Казахстан</div></div></div>
              <div className="flex gap-3 items-start"><Mail className="h-4 w-4 text-primary mt-0.5" /><div><div className="font-medium">Школа</div><div className="text-muted-foreground">Mektep AI</div></div></div>
              <div className="flex gap-3 items-start"><CalendarDays className="h-4 w-4 text-primary mt-0.5" /><div><div className="font-medium">Статус</div><div className="text-muted-foreground">Онлайн и готова к работе</div></div></div>
            </div>
          </Card>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-5 bg-gradient-card"><div className="text-xs text-muted-foreground">Сообщений в чатах</div><div className="text-3xl font-display font-bold mt-1">{stats.chats}</div><MessageSquare className="h-4 w-4 text-primary mt-2" /></Card>
          <Card className="p-5 bg-gradient-card"><div className="text-xs text-muted-foreground">Приказов в истории</div><div className="text-3xl font-display font-bold mt-1">{stats.orders}</div><FileText className="h-4 w-4 text-primary mt-2" /></Card>
          <Card className="p-5 bg-gradient-card"><div className="text-xs text-muted-foreground">Слотов расписания</div><div className="text-3xl font-display font-bold mt-1">{stats.schedule}</div><CalendarDays className="h-4 w-4 text-primary mt-2" /></Card>
          <Card className="p-5 bg-gradient-card"><div className="text-xs text-muted-foreground">Сотрудников</div><div className="text-3xl font-display font-bold mt-1">{stats.staff}</div><Shield className="h-4 w-4 text-primary mt-2" /></Card>
        </div>
      </div>
    </AppLayout>
  );
};

export default ProfilePage;
