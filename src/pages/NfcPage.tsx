import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Radio, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";

// Mock NFC данные (в продакшене — из таблицы nfc_scans)
const MOCK_SCANS = [
  { name: "Ерасыл Амиртай", card: "0481-A29F-72E3", class: "9А", scanAt: "09:15", expectedBy: "08:30" },
  { name: "Нурия Орынбасарова", card: "0382-B71D-44AE", class: "9Б", scanAt: "08:25", expectedBy: "08:30" },
  { name: "Айдос Қасымов", card: "05A1-C82E-91FF", class: "5А", scanAt: "08:12", expectedBy: "08:30" },
  { name: "Әсем Бекенова", card: "0673-D44A-08CC", class: "7Б", scanAt: "08:45", expectedBy: "08:30" },
  { name: "Данияр Жұмабеков", card: "0254-E65B-3B19", class: "10А", scanAt: "08:18", expectedBy: "08:30" },
];

const isLate = (scanAt: string, expected: string) => {
  const [h1, m1] = scanAt.split(":").map(Number);
  const [h2, m2] = expected.split(":").map(Number);
  return h1 * 60 + m1 > h2 * 60 + m2;
};

const NfcPage = () => {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const lateCount = MOCK_SCANS.filter((s) => isLate(s.scanAt, s.expectedBy)).length;
  const onTimeCount = MOCK_SCANS.length - lateCount;

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
            <p className="text-muted-foreground mt-1">Сканирование карт учеников на входе · обновление в реальном времени</p>
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

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4 bg-gradient-card">
            <div className="text-xs text-muted-foreground">Всего сканов</div>
            <div className="text-3xl font-bold font-display mt-1">{MOCK_SCANS.length}</div>
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
            <div className="text-3xl font-bold font-display mt-1">412</div>
          </Card>
        </div>

        {/* Live feed */}
        <Card className="p-0 bg-gradient-card overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h2 className="font-display font-bold">Поток сканирований</h2>
            <span className="text-xs text-muted-foreground">Звонок в 08:30 · красным — опоздание</span>
          </div>
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
              {MOCK_SCANS.map((s, i) => {
                const late = isLate(s.scanAt, s.expectedBy);
                return (
                  <motion.tr
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className={`border-t border-border ${late ? "bg-destructive/5" : ""}`}
                  >
                    <td className={`p-3 font-mono font-bold tabular-nums ${late ? "text-destructive" : "text-success"}`}>
                      {s.scanAt}
                    </td>
                    <td className="p-3 font-medium">{s.name}</td>
                    <td className="p-3"><Badge variant="outline">{s.class}</Badge></td>
                    <td className="p-3 font-mono text-xs text-muted-foreground">{s.card}</td>
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
        </Card>

        <Card className="p-4 bg-primary/5 border-primary/20">
          <div className="text-sm flex gap-2 items-start">
            <Radio className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div>
              <b>Демо-режим NFC:</b> в production карты сканируются терминалом на входе и записывают в таблицу <code>nfc_scans</code>. AI автоматически создаёт инциденты «опоздание» для систематически опаздывающих учеников.
            </div>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
};

export default NfcPage;
