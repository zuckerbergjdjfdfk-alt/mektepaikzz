import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Mic, MicOff, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

type Listener = (text: string) => boolean | Promise<boolean>;
const listeners = new Set<Listener>();

export const registerVoiceListener = (fn: Listener) => {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
};

const speak = (text: string) => {
  if (!("speechSynthesis" in window)) return;
  const utter = new SpeechSynthesisUtterance(text.replace(/[*_#`>\-]/g, ""));
  utter.lang = "ru-RU";
  utter.rate = 1.05;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utter);
};

const handleGlobal = async (transcript: string, navigate: (p: string) => void): Promise<string> => {
  const t = transcript.toLowerCase();
  // Навигация
  const routes: [RegExp, string, string][] = [
    [/(расписан|урок)/, "/schedule", "Открываю расписание"],
    [/(приказ)/, "/orders", "Открываю приказы"],
    [/(чат|сообщ|ватсап|whatsapp|телеграм|telegram)/, "/chats", "Открываю чаты"],
    [/(инцидент|проблем)/, "/incidents", "Открываю инциденты"],
    [/(замен)/, "/substitutions", "Открываю замены"],
    [/(nfc|карт|опозд)/, "/nfc", "Открываю NFC журнал"],
    [/(отчёт|отчет|свод|посещаем)/, "/reports", "Открываю отчёты"],
    [/(сотрудник|учител|педагог)/, "/staff", "Открываю сотрудников"],
    [/(класс)/, "/classes", "Открываю классы"],
    [/(задач)/, "/tasks", "Открываю задачи"],
    [/(настройк)/, "/settings", "Открываю настройки"],
    [/(главн|дашборд|home)/, "/", "Открываю главную"],
  ];

  // Быстрые действия
  if (/(сгенер|построй|создай|сделай).*расписан/.test(t)) {
    toast.loading("Генерирую расписание через AI...", { id: "gen-sch" });
    const { data, error } = await supabase.functions.invoke("schedule-generator", { body: { mode: "ai" } });
    toast.dismiss("gen-sch");
    if (error) throw error;
    navigate("/schedule");
    return `Готово. Создал ${data?.slots_created || 0} уроков, лент английского: ${data?.lentas || 0}.`;
  }

  if (/(утрен|свод|отчёт|отчет).*готов|сгенер.*(свод|отчёт|отчет)|сделай.*отчёт/.test(t)) {
    toast.loading("Готовлю утренний свод...", { id: "gen-rep" });
    const { data, error } = await supabase.functions.invoke("morning-digest", { body: {} });
    toast.dismiss("gen-rep");
    if (error) throw error;
    navigate("/reports");
    return data?.report?.split("\n").slice(0, 3).join(" ") || "Свод готов";
  }

  for (const [re, path, msg] of routes) {
    if (re.test(t)) {
      navigate(path);
      return msg;
    }
  }

  // Передаём в AI-чат как обычное сообщение
  toast.loading("AI думает...", { id: "ai-think" });
  const { data, error } = await supabase.functions.invoke("ai-orchestrator", {
    body: { messages: [{ role: "user", content: transcript }], voice_mode: true },
  });
  toast.dismiss("ai-think");
  if (error) throw error;
  return data?.content || "Не понял команду";
};

export const VoiceAssistant = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lastTranscript, setLastTranscript] = useState("");
  const recRef = useRef<any>(null);

  // Скрываем на AI-чате — там свой микрофон
  if (location.pathname === "/ai-chat") return null;

  const start = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      toast.error("Голосовой ввод доступен только в Chrome / Edge");
      return;
    }
    if (recording) {
      recRef.current?.stop();
      return;
    }
    const rec = new SR();
    rec.lang = "ru-RU";
    rec.continuous = false;
    rec.interimResults = true;
    let finalText = "";

    rec.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += t;
        else interim += t;
      }
      setLastTranscript(finalText || interim);
    };
    rec.onerror = (e: any) => {
      setRecording(false);
      if (e.error !== "no-speech" && e.error !== "aborted") {
        toast.error(`Микрофон: ${e.error}`);
      }
    };
    rec.onend = async () => {
      setRecording(false);
      const transcript = finalText.trim();
      if (!transcript) return;
      setBusy(true);
      try {
        // Сначала даём шанс локальному слушателю страницы
        for (const l of listeners) {
          const consumed = await l(transcript);
          if (consumed) { setBusy(false); return; }
        }
        const reply = await handleGlobal(transcript, navigate);
        toast.success(reply, { duration: 5000 });
        speak(reply);
      } catch (err: any) {
        toast.error(err.message || "Ошибка голосовой команды");
      } finally {
        setBusy(false);
        setLastTranscript("");
      }
    };
    rec.start();
    recRef.current = rec;
    setRecording(true);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
      <AnimatePresence>
        {(recording || busy || lastTranscript) && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="max-w-xs rounded-2xl bg-card border border-border shadow-2xl px-4 py-3 text-sm"
          >
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Sparkles className="h-3 w-3 text-primary" />
              {busy ? "AI обрабатывает..." : recording ? "Говорите..." : "Распознано"}
            </div>
            {lastTranscript || (busy ? "..." : "")}
          </motion.div>
        )}
      </AnimatePresence>
      <Button
        onClick={start}
        size="icon"
        className={`h-14 w-14 rounded-full shadow-2xl transition-all ${
          recording
            ? "bg-destructive text-destructive-foreground animate-pulse"
            : "bg-gradient-primary text-primary-foreground hover:scale-105"
        }`}
        disabled={busy}
        aria-label="Голосовая команда"
      >
        {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : recording ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
      </Button>
    </div>
  );
};
