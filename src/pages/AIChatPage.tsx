import { useEffect, useRef, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bot, Mic, MicOff, Send, Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

type Msg = { role: "user" | "assistant"; content: string };

const AIChatPage = () => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "Здравствуйте, Айгуль Серикбаевна! 👋\n\nЯ ваш AI-завуч Mektep AI. Могу:\n- Сгенерировать расписание и сразу открыть его\n- Запустить утренний свод и открыть отчёт\n- Подобрать замену учителю\n- Подготовить официальный приказ\n\nПопробуйте сказать: *«Сгенерируй расписание на вторник с лентой»*" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const recRef = useRef<any>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), [messages]);

  const send = async (text: string) => {
    if (!text.trim()) return;
    const normalized = text.toLowerCase();
    const newMsgs: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(newMsgs);
    setInput("");
    setLoading(true);
    try {
      if (normalized.includes("расписан") && (normalized.includes("сгенер") || normalized.includes("сделай") || normalized.includes("построй"))) {
        const { data, error } = await supabase.functions.invoke("schedule-generator", { body: {} });
        if (error) throw error;
        const reply = `Готово: сгенерировал расписание. Создано ${data?.slots_created || 0} уроков, лент: ${data?.lentas || 0}. Открываю раздел расписания.`;
        setMessages([...newMsgs, { role: "assistant", content: reply }]);
        toast.success("Расписание сгенерировано");
        setTimeout(() => navigate("/schedule"), 500);
        return;
      }

      if ((normalized.includes("утрен") && normalized.includes("свод")) || normalized.includes("отчёт")) {
        const { data, error } = await supabase.functions.invoke("morning-digest", { body: {} });
        if (error) throw error;
        const reply = data?.report || "Утренний свод готов. Открываю отчёты.";
        setMessages([...newMsgs, { role: "assistant", content: reply }]);
        toast.success("Отчёт готов");
        setTimeout(() => navigate("/reports"), 500);
        return;
      }

      const { data, error } = await supabase.functions.invoke("ai-orchestrator", {
        body: { messages: newMsgs, voice_mode: voiceMode },
      });
      if (error) throw error;
      const reply = data?.content || data?.error || "Не удалось получить ответ";
      setMessages([...newMsgs, { role: "assistant", content: reply }]);

      if (voiceMode && "speechSynthesis" in window) {
        const utter = new SpeechSynthesisUtterance(reply.replace(/[*_#`>\-]/g, ""));
        utter.lang = "ru-RU";
        utter.rate = 1.05;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utter);
      }
    } catch (e: any) {
      toast.error(e.message || "Ошибка AI");
    } finally {
      setLoading(false);
    }
  };

  const toggleRec = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      toast.error("Ваш браузер не поддерживает голосовой ввод. Используйте Chrome.");
      return;
    }
    if (recording) {
      recRef.current?.stop();
      setRecording(false);
      return;
    }
    const rec = new SR();
    rec.lang = "ru-RU";
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      setRecording(false);
      send(transcript);
    };
    rec.onerror = () => { setRecording(false); toast.error("Ошибка распознавания"); };
    rec.onend = () => setRecording(false);
    rec.start();
    recRef.current = rec;
    setRecording(true);
    toast.info("Говорите...");
  };

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 max-w-4xl mx-auto h-[calc(100vh-4rem)] flex flex-col">
        <div className="mb-4">
          <h1 className="font-display text-3xl font-extrabold flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-gold flex items-center justify-center shadow-gold"><Bot className="h-5 w-5 text-primary-foreground" /></div>
            AI-завуч
          </h1>
          <p className="text-muted-foreground mt-1">Голосовые команды · парсинг задач · бюрократический RAG</p>
        </div>

        <Card className="flex-1 flex flex-col bg-gradient-card overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-3 ${m.role === "user" ? "justify-end" : ""}`}>
                {m.role === "assistant" && (
                  <div className="h-8 w-8 rounded-full bg-gradient-gold flex items-center justify-center shrink-0">
                    <Sparkles className="h-4 w-4 text-primary-foreground" />
                  </div>
                )}
                <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                  <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-1 prose-ul:my-1">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                </div>
              </div>
            ))}
            {loading && <div className="flex gap-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin" /> AI думает...</div>}
            <div ref={endRef} />
          </div>

          <div className="border-t border-border p-4 flex gap-2 items-center">
            <Button onClick={() => setVoiceMode(v => !v)} variant={voiceMode ? "default" : "outline"} size="sm" className="gap-1">
              🔊 {voiceMode ? "Голос ВКЛ" : "Голос"}
            </Button>
            <Button onClick={toggleRec} variant={recording ? "destructive" : "outline"} size="icon" className={recording ? "animate-glow" : ""}>
              {recording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !loading && send(input)}
              placeholder="Спросите AI или надиктуйте голосом..."
              className="flex-1"
            />
            <Button onClick={() => send(input)} disabled={loading || !input.trim()} className="bg-gradient-primary text-primary-foreground gap-2">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
};

export default AIChatPage;
