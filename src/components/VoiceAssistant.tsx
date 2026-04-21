import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mic, MicOff, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { getSpeechRecognition, primeSpeech, requestMicrophoneAccess, speakText, supportsSpeechRecognition } from "@/lib/voice";

type Listener = (text: string) => boolean | Promise<boolean>;
const listeners = new Set<Listener>();

export const registerVoiceListener = (fn: Listener) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

const handleGlobal = async (transcript: string, navigate: (p: string) => void): Promise<string> => {
  const t = transcript.toLowerCase();
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
    [/(профил)/, "/profile", "Открываю профиль"],
    [/(настройк)/, "/settings", "Открываю настройки"],
    [/(главн|дашборд|home)/, "/", "Открываю главную"],
  ];

  if (/(сгенер|построй|создай|сделай).*расписан/.test(t)) {
    toast.loading("Генерирую расписание через AI...", { id: "gen-sch" });
    const { data, error } = await supabase.functions.invoke("schedule-generator", { body: { mode: "ai" } });
    toast.dismiss("gen-sch");
    if (error) throw error;
    navigate("/schedule");
    return `Готово. Создал ${data?.slots_created || 0} уроков, лент ${data?.lentas || 0}.`;
  }

  if (/(утрен|свод|отчёт|отчет).*готов|сгенер.*(свод|отчёт|отчет)|сделай.*отчёт/.test(t)) {
    toast.loading("Готовлю утренний свод...", { id: "gen-rep" });
    const { data, error } = await supabase.functions.invoke("morning-digest", { body: {} });
    toast.dismiss("gen-rep");
    if (error) throw error;
    navigate("/reports");
    return data?.report?.split("\n").slice(0, 2).join(" ") || "Свод готов";
  }

  for (const [re, path, msg] of routes) {
    if (re.test(t)) {
      navigate(path);
      return msg;
    }
  }

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
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lastTranscript, setLastTranscript] = useState("");
  const recRef = useRef<any>(null);

  useEffect(() => {
    primeSpeech();
    return () => window.speechSynthesis?.cancel();
  }, []);

  const start = async () => {
    if (!supportsSpeechRecognition()) {
      toast.error("Голосовой ввод доступен в Chrome или Edge");
      return;
    }

    if (recording) {
      recRef.current?.stop();
      return;
    }

    try {
      await requestMicrophoneAccess();
      const SR = getSpeechRecognition();
      if (!SR) throw new Error("SpeechRecognition не найден");

      const rec = new SR();
      rec.lang = "ru-RU";
      rec.continuous = false;
      rec.interimResults = true;
      let finalText = "";
      let interimText = "";

      rec.onresult = (event: SpeechRecognitionEvent) => {
        interimText = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const chunk = event.results[i][0]?.transcript || "";
          if (event.results[i].isFinal) finalText += `${chunk} `;
          else interimText += chunk;
        }
        setLastTranscript((finalText || interimText).trim());
      };

      rec.onerror = (event: SpeechRecognitionErrorEvent) => {
        setRecording(false);
        if (event.error !== "no-speech" && event.error !== "aborted") {
          toast.error(`Микрофон: ${event.error}`);
        }
      };

      rec.onend = async () => {
        setRecording(false);
        const transcript = (finalText || interimText).trim();
        if (!transcript) {
          setLastTranscript("");
          return;
        }

        setBusy(true);
        try {
          for (const listener of listeners) {
            const consumed = await listener(transcript);
            if (consumed) {
              await speakText("Готово");
              return;
            }
          }

          const reply = await handleGlobal(transcript, navigate);
          toast.success(reply, { duration: 5000 });
          await speakText(reply);
        } catch (error: any) {
          toast.error(error.message || "Ошибка голосовой команды");
        } finally {
          setBusy(false);
          setLastTranscript("");
        }
      };

      rec.start();
      recRef.current = rec;
      setLastTranscript("");
      setRecording(true);
    } catch (error: any) {
      toast.error(error?.message || "Не удалось включить микрофон");
    }
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
        title={supportsSpeechRecognition() ? "Голосовая команда" : "Голос недоступен в этом браузере"}
      >
        {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : recording ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
      </Button>
    </div>
  );
};
