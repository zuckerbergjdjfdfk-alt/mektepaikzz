import { useEffect, useState } from "react";
import { Bell, AlertTriangle, Calendar, FileText, CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const iconFor = (type: string) => {
  if (type === "incident") return <AlertTriangle className="h-4 w-4 text-destructive" />;
  if (type === "schedule_conflict") return <Calendar className="h-4 w-4 text-warning" />;
  if (type === "order") return <FileText className="h-4 w-4 text-primary" />;
  return <CheckCircle2 className="h-4 w-4 text-success" />;
};

export const NotificationsBell = () => {
  const [items, setItems] = useState<any[]>([]);
  const [open, setOpen] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10);
    setItems(data || []);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("notifications-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, (p) => {
        toast(`🔔 ${(p.new as any).title}`, { description: (p.new as any).body });
        load();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const unread = items.filter((i) => !i.is_read).length;

  const accept = async (id: string) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    toast.success("Принято");
    load();
  };
  const reject = async (id: string) => {
    await supabase.from("notifications").delete().eq("id", id);
    toast.info("Отклонено");
    load();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-5 min-w-5 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
              {unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0 max-h-[500px] overflow-hidden flex flex-col">
        <div className="p-3 border-b border-border bg-gradient-card flex items-center justify-between">
          <div>
            <div className="font-display font-bold">Уведомления</div>
            <div className="text-xs text-muted-foreground">{unread} новых · обновляется в реальном времени</div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-border">
          {items.length === 0 && (
            <div className="p-6 text-center text-sm text-muted-foreground">Пока тихо 🌙</div>
          )}
          {items.map((n) => (
            <div key={n.id} className={`p-3 hover:bg-muted/50 ${!n.is_read ? "bg-primary/5" : ""}`}>
              <div className="flex gap-3 items-start">
                <div className="mt-0.5">{iconFor(n.type)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold text-sm truncate">{n.title}</div>
                    {!n.is_read && <Badge className="bg-primary text-primary-foreground text-[9px]">new</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{n.body}</div>
                  <div className="text-[10px] text-muted-foreground mt-1">
                    {new Date(n.created_at).toLocaleString("ru-RU")}
                  </div>
                  {!n.is_read && (n.type === "incident" || n.type === "schedule_conflict") && (
                    <div className="flex gap-2 mt-2">
                      <Button size="sm" variant="default" onClick={() => accept(n.id)} className="h-7 text-xs gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Принять
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => reject(n.id)} className="h-7 text-xs gap-1">
                        <X className="h-3 w-3" /> Отклонить
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};
