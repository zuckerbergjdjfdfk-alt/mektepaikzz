import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GraduationCap, Users, BookOpen } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";

const ClassesPage = () => {
  const [classes, setClasses] = useState<any[]>([]);
  const [curriculum, setCurriculum] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([
      supabase.from("classes").select("*").order("grade").order("letter"),
      supabase.from("curriculum").select("*"),
      supabase.from("subjects").select("*"),
    ]).then(([c, cu, s]) => {
      setClasses(c.data || []);
      setCurriculum(cu.data || []);
      setSubjects(s.data || []);
    });
  }, []);

  const subjectMap = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-display text-3xl font-extrabold flex items-center gap-3">
            <GraduationCap className="h-8 w-8 text-primary" /> Классы
          </h1>
          <p className="text-muted-foreground mt-1">Параллели, контингент и учебная нагрузка</p>
        </motion.div>

        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {classes.map((cls, i) => {
            const rows = curriculum.filter((row) => row.class_id === cls.id);
            const totalHours = rows.reduce((sum, row) => sum + (row.hours_per_week || 0), 0);
            return (
              <motion.div key={cls.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}>
                <Card className="p-5 bg-gradient-card h-full">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-display text-2xl font-bold">{cls.name}</div>
                      <div className="text-sm text-muted-foreground">{cls.grade} класс</div>
                    </div>
                    <Badge className="bg-primary/10 text-primary">{rows.length} предметов</Badge>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-lg bg-muted/50 p-3">
                      <div className="flex items-center gap-2 text-muted-foreground"><Users className="h-4 w-4" /> Ученики</div>
                      <div className="mt-1 text-xl font-bold">{cls.student_count || 0}</div>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-3">
                      <div className="flex items-center gap-2 text-muted-foreground"><BookOpen className="h-4 w-4" /> Часов</div>
                      <div className="mt-1 text-xl font-bold">{totalHours}</div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {rows.slice(0, 8).map((row) => (
                      <Badge key={row.id} variant="outline">
                        {subjectMap.get(row.subject_id)?.short_name || subjectMap.get(row.subject_id)?.name || "?"} · {row.hours_per_week}ч
                      </Badge>
                    ))}
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

export default ClassesPage;
