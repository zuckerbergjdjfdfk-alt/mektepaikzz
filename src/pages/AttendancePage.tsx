import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookOpen, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const AttendancePage = () => {
  const [attendance, setAttendance] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);

  const load = async () => {
    const today = new Date().toISOString().slice(0, 10);
    const [att, cls] = await Promise.all([
      supabase.from("attendance").select("*").eq("date", today),
      supabase.from("classes").select("*").order("grade").order("letter"),
    ]);
    setAttendance(att.data || []);
    setClasses(cls.data || []);
  };

  useEffect(() => { load(); }, []);

  const totals = useMemo(() => attendance.reduce((acc, row) => ({
    present: acc.present + (row.present_count || 0),
    absent: acc.absent + (row.absent_count || 0),
    sick: acc.sick + (row.sick_count || 0),
  }), { present: 0, absent: 0, sick: 0 }), [attendance]);

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="font-display text-3xl font-extrabold flex items-center gap-3">
              <BookOpen className="h-8 w-8 text-primary" /> Посещаемость
            </h1>
            <p className="text-muted-foreground mt-1">Фактические данные на сегодня из чатов и сводов</p>
          </div>
          <Button variant="outline" onClick={load} className="gap-2"><RefreshCw className="h-4 w-4" /> Обновить</Button>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Card className="p-4 bg-success/10 border-success/30"><div className="text-xs text-success">В школе</div><div className="text-3xl font-bold mt-1 text-success">{totals.present}</div></Card>
          <Card className="p-4 bg-warning/10 border-warning/30"><div className="text-xs text-warning">Болеют</div><div className="text-3xl font-bold mt-1 text-warning">{totals.sick}</div></Card>
          <Card className="p-4 bg-destructive/10 border-destructive/30"><div className="text-xs text-destructive">Отсутствуют</div><div className="text-3xl font-bold mt-1 text-destructive">{totals.absent}</div></Card>
        </div>

        <Card className="p-0 bg-gradient-card overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr className="text-left">
                <th className="p-3">Класс</th>
                <th className="p-3 text-right">Пришли</th>
                <th className="p-3 text-right">Болеют</th>
                <th className="p-3 text-right">Отсутствуют</th>
                <th className="p-3 text-right">Статус</th>
              </tr>
            </thead>
            <tbody>
              {classes.map((cls) => {
                const row = attendance.find((x) => x.class_id === cls.id) || { present_count: 0, absent_count: 0, sick_count: 0 };
                const total = row.present_count + row.absent_count + row.sick_count;
                const pct = total ? Math.round((row.present_count / total) * 100) : 0;
                return (
                  <tr key={cls.id} className="border-t border-border">
                    <td className="p-3 font-semibold">{cls.name}</td>
                    <td className="p-3 text-right text-success">{row.present_count}</td>
                    <td className="p-3 text-right text-warning">{row.sick_count}</td>
                    <td className="p-3 text-right text-destructive">{row.absent_count}</td>
                    <td className="p-3 text-right">
                      <Badge className={pct >= 90 ? "bg-success text-success-foreground" : pct >= 75 ? "bg-warning text-warning-foreground" : "bg-destructive text-destructive-foreground"}>{pct}%</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      </div>
    </AppLayout>
  );
};

export default AttendancePage;
