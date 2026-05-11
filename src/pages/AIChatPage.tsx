import { useEffect, useRef, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bot, Mic, MicOff, Send, Loader2, Sparkles, Volume2, FileText, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { useNavigate, Link } from "react-router-dom";
import { getSpeechRecognition, primeSpeech, requestMicrophoneAccess, speakText, supportsSpeechRecognition } from "@/lib/voice";

type Msg = { role: "user" | "assistant"; content: string; orderCard?: { order_id: string; title: string; pdf_url?: string } };

const AIChatPage = () => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "Здравствуйте, Айгуль Серикбаевна! 👋\n\nЯ AI-завуч AISSchool. Могу собрать утренний свод, сгенерировать расписание, составить и оформить приказ в PDF, найти замены." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [voiceMode, setVoiceMode] = useState(true);
  const recRef = useRef<any>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  useEffect(() => { primeSpeech(); }, []);

  const maybeSpeak = async (text: string) => { if (voiceMode) await speakText(text); };

  const send = async (text: string) => {
    if (!text.trim()) return;
    const normalized = text.toLowerCase();
    const newMsgs: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(newMsgs);
    setInput("");
    setLoading(true);
    try {
      if (normalized.includes("расписан") && (normalized.includes("сгенер") || normalized.includes("сделай") || normalized.includes("построй"))) {
        const { data, error } = await supabase.functions.invoke("schedule-generator", { body: { mode: "ai" } });
        if (error) throw error;
        const reply = `Готово: создано ${data?.slots_created || 0} уроков.`;
        setMessages([...newMsgs, { role: "assistant", content: reply }]);
        await maybeSpeak(reply);
        setTimeout(() => navigate("/schedule"), 500);
        return;
      }

      const { data, error } = await supabase.functions.invoke("ai-orchestrator", {
        body: { messages: newMsgs.map(({ role, content }) => ({ role, content })), voice_mode: voiceMode },
      });
      if (error) throw error;
      const reply = data?.content || data?.error || "Не удалось получить ответ";
      setMessages([...newMsgs, { role: "assistant", content: reply }]);
      await maybeSpeak(reply);
    } catch (error: any) {
      toast.error(error.message || "Ошибка AI");
    } finally {
      setLoading(false);
    }
  };

  const generateOrder = async () => {
    if (!input.trim()) return toast.error("Опишите, какой приказ нужен");
    const text = input.trim();
    setMessages((m) => [...m, { role: "user", content: `📄 Приказ: ${text}` }]);
    setInput("");
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("order-from-text", { body: { text } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const reply = `Приказ «${data.title}» готов. PDF сформирован — можно скачать или открыть в журнале.`;
      setMessages((m) => [...m, { role: "assistant", content: reply, orderCard: { order_id: data.order_id, title: data.title, pdf_url: data.pdf_url } }]);
      await maybeSpeak("Приказ готов");
      toast.success("Приказ создан");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleRec = async () => {
    if (!supportsSpeechRecognition()) return toast.error("Браузер не поддерживает голосовой ввод");
    if (recording) { recRef.current?.stop(); setRecording(false); return; }
    try {
      await requestMicrophoneAccess();
      const SR = getSpeechRecognition(); if (!SR) throw new Error("SR not found");
      const rec = new SR(); rec.lang = "ru-RU"; rec.continuous = false; rec.interimResults = false;
      rec.onresult = (e: SpeechRecognitionEvent) => { setRecording(false); send(e.results[0][0]?.transcript || ""); };
      rec.onerror = () => { setRecording(false); toast.error("Ошибка распознавания"); };
      rec.onend = () => setRecording(false);
      rec.start(); recRef.current = rec; setRecording(true); toast.info("Говорите...");
    } catch (e: any) { toast.error(e?.message || "Микрофон недоступен"); }
  };

  const repeatLast = async () => {
    const last = [...messages].reverse().find((m) => m.role === "assistant");
    if (last) await speakText(last.content);
  };

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 max-w-4xl mx-auto h-[calc(100vh-4rem)] flex flex-col">
        <div className="mb-4">
          <h1 className="font-display text-3xl font-extrabold flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-gold flex items-center justify-center shadow-gold"><Bot className="h-5 w-5 text-primary-foreground" /></div>
            AI-завуч AISSchool
          </h1>
          <p className="text-muted-foreground mt-1">Голос, расписание, приказы в PDF, отчёты</p>
        </div>

        <Card className="flex-1 flex flex-col glass overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.map((message, index) => (
              <div key={index} className={`flex gap-3 ${message.role === "user" ? "justify-end" : ""}`}>
                {message.role === "assistant" && (
                  <div className="h-8 w-8 rounded-full bg-gradient-gold flex items-center justify-center shrink-0">
                    <Sparkles className="h-4 w-4 text-primary-foreground" />
                  </div>
                )}
                <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                  <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-1 prose-ul:my-1">
                    <ReactMarkdown>{message.content}</ReactMarkdown>
                  </div>
                  {message.orderCard && (
                    <div className="mt-3 p-3 rounded-lg glass-soft flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs text-muted-foreground">Приказ</div>
                        <div className="font-semibold text-sm truncate">{message.orderCard.title}</div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        {message.orderCard.pdf_url && (
                          <a href={message.orderCard.pdf_url} target="_blank" rel="noreferrer">
                            <Button size="sm" variant="outline" className="gap-1 h-8"><Download className="h-3 w-3" /> PDF</Button>
                          </a>
                        )}
                        <Link to="/orders">
                          <Button size="sm" className="gap-1 h-8"><FileText className="h-3 w-3" /> Журнал</Button>
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && <div className="flex gap-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin" /> AI работает...</div>}
            <div ref={endRef} />
          </div>

          <div className="border-t border-border/50 p-4 flex gap-2 items-center flex-wrap">
            <Button onClick={() => setVoiceMode((v) => !v)} variant={voiceMode ? "default" : "outline"} size="sm" className="gap-1">
              🔊 {voiceMode ? "Озвучка ВКЛ" : "Озвучка"}
            </Button>
            <Button onClick={repeatLast} variant="outline" size="icon" title="Повторить"><Volume2 className="h-4 w-4" /></Button>
            <Button onClick={toggleRec} variant={recording ? "destructive" : "outline"} size="icon" disabled={!supportsSpeechRecognition()}>
              {recording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !loading && send(input)}
              placeholder="Спросите AI или продиктуйте..."
              className="flex-1 min-w-[200px]"
            />
            <Button onClick={generateOrder} disabled={loading || !input.trim()} variant="outline" className="gap-1" title="Сгенерировать приказ из текста">
              <FileText className="h-4 w-4" /> Приказ
            </Button>
            <Button onClick={() => send(input)} disabled={loading || !input.trim()} className="gap-2">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
};

export default AIChatPage;
