import { useEffect, useRef, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bot, Mic, MicOff, Send, Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

type Msg = { role: "user" | "assistant"; content: string };

const AIChatPage = () => {
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "Здравствуйте, Айгуль Серикбаевна! 👋\n\nЯ ваш AI-завуч. Могу:\n- Распарсить голосовую команду в задачи (нажмите 🎤)\n- Объяснить любой приказ простым языком\n- Подсказать замену учителю\n- Сгенерировать утренний свод\n\nПопробуйте сказать: *«Айгерим, подготовь актовый зал. Назкен, закажи воду»*" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const recRef = useRef<any>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), [messages]);

  const send = async (text: string) => {
    if (!text.trim()) return;
    const newMsgs: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(newMsgs);
    setInput("");
    setLoading(true);
    try {
      // Если голосовая команда похожа на постановку задач — парсим в tasks
      const isTaskLike = /закажи|подготовь|сделай|купи|организуй|свяжись|назначь/i.test(text);
      if (isTaskLike) {
        const { data: staff } = await supabase.from("staff").select("id, full_name, role");
        const { data, error } = await supabase.functions.invoke("ai-orchestrator", {
          body: { action: "voice_to_tasks", transcript: text, staff: staff || [] },
        });
        if (error) throw error;
        const tasks = data.tasks || [];
        for (const t of tasks) {
          const assignee = (staff || []).find((s: any) => s.full_name.toLowerCase().includes((t.assignee_full_name || "").toLowerCase().split(" ")[0]));
          await supabase.from("tasks").insert({
            title: t.title,
            description: t.description || "",
            assignee_id: assignee?.id,
            priority: t.priority,
            source: "voice",
            source_message: text,
          });
        }
        const reply = `✅ Создано задач: **${tasks.length}**\n\n${tasks.map((t: any, i: number) => `${i + 1}. **${t.title}** — ${t.assignee_full_name} (${t.priority})${t.due_hint ? ` · _${t.due_hint}_` : ""}`).join("\n")}\n\nЗадачи отправлены исполнителям.`;
        setMessages([...newMsgs, { role: "assistant", content: reply }]);
      } else {
        const { data, error } = await supabase.functions.invoke("ai-orchestrator", {
          body: { action: "chat", messages: newMsgs },
        });
        if (error) throw error;
        setMessages([...newMsgs, { role: "assistant", content: data.content }]);
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

          <div className="border-t border-border p-4 flex gap-2">
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
