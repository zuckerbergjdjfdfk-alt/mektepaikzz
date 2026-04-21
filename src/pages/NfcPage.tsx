import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Radio, Clock, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";

type ScanRow = {
  id: string;
  student_name: string;
  card_id: string;
  scanned_at: string | null;
  class_id: string | null;
  classes?: { name?: string | null } | null;
};

const FALLBACK_SCANS: ScanRow[] = [
  {
    id: "mock-erasyl",
    student_name: "Ерасыл Амиртай",
    card_id: "0481-A29F-72E3",
    class_id: null,
    scanned_at: new Date().toISOString(),
    classes: { name: "9А" },
  },
];

const getTime = (value: string | null) => {
  if (!value) return "--:--";
  return new Date(value).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
};

const isLate = (value: string | null, expected: string) => {
  if (!value) return false;
  const [scanHour, scanMinute] = getTime(value).split(":").map(Number);
  const [expectedHour, expectedMinute] = expected.split(":").map(Number);
  return scanHour * 60 + scanMinute > expectedHour * 60 + expectedMinute;
};

const NfcPage = () => {
  const [now, setNow] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [scans, setScans] = useState<ScanRow[]>([]);

  const loadScans = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("nfc_scans")
      .select("id, student_name, card_id, scanned_at, class_id, classes(name)")
      .order("scanned_at", { ascending: false })
      .limit(20);
    setScans((data as ScanRow[])?.length ? (data as ScanRow[]) : FALLBACK_SCANS);
    setLoading(false);
  };

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    loadScans();
    const channel = supabase
      .channel("nfc-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "nfc_scans" }, () => loadScans())
      .subscribe();

    return () => {
      clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, []);

  const lateCount = useMemo(() => scans.filter((scan) => isLate(scan.scanned_at, "08:30")).length, [scans]);
  const onTimeCount = scans.length - lateCount;
  const activeCards = useMemo(() => new Set(scans.map((scan) => scan.card_id)).size, [scans]);

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="font-display text-3xl font-extrabold flex items-center gap-3">
              <Radio className="h-8 w-8 text-primary animate-pulse" />
              NFC журнал
              <Badge className="bg-success text-success-foreground gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-success-foreground animate-pulse" /> LIVE
              </Badge>
            </h1>
            <p className="text-muted-foreground mt-1">Реальные сканы из базы, fallback только если терминал ещё не присылал события</p>
          </div>
          <Card className="p-4 bg-gradient-primary text-primary-foreground flex items-center gap-3 shadow-glow">
            <Clock className="h-6 w-6" />
            <div>
              <div className="text-3xl font-bold font-display tabular-nums">
                {now.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </div>
              <div className="text-xs opacity-80">{now.toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" })}</div>
            </div>
          </Card>
        </motion.div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4 bg-gradient-card">
            <div className="text-xs text-muted-foreground">Всего сканов</div>
            <div className="text-3xl font-bold font-display mt-1">{scans.length}</div>
          </Card>
          <Card className="p-4 bg-gradient-card border-success/30">
            <div className="text-xs text-success">Вовремя</div>
            <div className="text-3xl font-bold font-display mt-1 text-success">{onTimeCount}</div>
          </Card>
          <Card className="p-4 bg-gradient-card border-destructive/30">
            <div className="text-xs text-destructive">Опоздали</div>
            <div className="text-3xl font-bold font-display mt-1 text-destructive">{lateCount}</div>
          </Card>
          <Card className="p-4 bg-gradient-card">
            <div className="text-xs text-muted-foreground">Активные карты</div>
            <div className="text-3xl font-bold font-display mt-1">{activeCards}</div>
          </Card>
        </div>

        <Card className="p-0 bg-gradient-card overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h2 className="font-display font-bold">Поток сканирований</h2>
            <span className="text-xs text-muted-foreground">Звонок в 08:30 · красным отмечается опоздание</span>
          </div>
          {loading ? (
            <div className="p-8 flex items-center justify-center text-muted-foreground gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Загрузка NFC...
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="p-3 font-medium">Время</th>
                  <th className="p-3 font-medium">Ученик</th>
                  <th className="p-3 font-medium">Класс</th>
                  <th className="p-3 font-medium">Номер карты</th>
                  <th className="p-3 font-medium">Статус</th>
                </tr>
              </thead>
              <tbody>
                {scans.map((scan, index) => {
                  const late = isLate(scan.scanned_at, "08:30");
                  return (
                    <motion.tr
                      key={scan.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.04 }}
                      className={`border-t border-border ${late ? "bg-destructive/5" : ""}`}
                    >
                      <td className={`p-3 font-mono font-bold tabular-nums ${late ? "text-destructive" : "text-success"}`}>
                        {getTime(scan.scanned_at)}
                      </td>
                      <td className="p-3 font-medium">{scan.student_name}</td>
                      <td className="p-3"><Badge variant="outline">{scan.classes?.name || "—"}</Badge></td>
                      <td className="p-3 font-mono text-xs text-muted-foreground">{scan.card_id}</td>
                      <td className="p-3">
                        {late ? (
                          <Badge className="bg-destructive text-destructive-foreground gap-1">
                            <AlertTriangle className="h-3 w-3" /> Опоздал
                          </Badge>
                        ) : (
                          <Badge className="bg-success text-success-foreground gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Вовремя
                          </Badge>
                        )}
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>

        <Card className="p-4 bg-primary/5 border-primary/20">
          <div className="text-sm flex gap-2 items-start">
            <Radio className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div>
              <b>Режим NFC:</b> страница теперь читает реальные записи из таблицы <code>nfc_scans</code>. Если записей пока нет, показывается резервный пример с Ерасылом Амиртаем.
            </div>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
};

export default NfcPage;
