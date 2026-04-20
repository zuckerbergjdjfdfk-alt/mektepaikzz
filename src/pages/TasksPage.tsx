import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClipboardList } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const TasksPage = () => {
  const [tasks, setTasks] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([
      supabase.from("tasks").select("*").order("created_at", { ascending: false }),
      supabase.from("staff").select("id, full_name"),
    ]).then(([t, s]) => {
      setTasks(t.data || []);
      setStaff(s.data || []);
    });
  }, []);

  const staffMap = useMemo(() => new Map(staff.map((s) => [s.id, s.full_name])), [staff]);

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6">
        <div>
          <h1 className="font-display text-3xl font-extrabold flex items-center gap-3">
            <ClipboardList className="h-8 w-8 text-primary" /> Задачи
          </h1>
          <p className="text-muted-foreground mt-1">Поручения из AI-чата, Telegram и WhatsApp</p>
        </div>

        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {tasks.map((task) => (
            <Card key={task.id} className="p-5 bg-gradient-card">
              <div className="flex items-start justify-between gap-3">
                <div className="font-display font-bold leading-tight">{task.title}</div>
                <Badge className={task.priority === "high" ? "bg-destructive text-destructive-foreground" : task.priority === "low" ? "bg-muted text-muted-foreground" : "bg-warning text-warning-foreground"}>
                  {task.priority || "normal"}
                </Badge>
              </div>
              {task.description && <p className="mt-2 text-sm text-muted-foreground">{task.description}</p>}
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge variant="outline">{task.status || "pending"}</Badge>
                <Badge variant="outline">{task.source || "manual"}</Badge>
              </div>
              <div className="mt-4 text-xs text-muted-foreground">
                Исполнитель: <span className="text-foreground font-medium">{staffMap.get(task.assignee_id) || "не назначен"}</span>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
};

export default TasksPage;
