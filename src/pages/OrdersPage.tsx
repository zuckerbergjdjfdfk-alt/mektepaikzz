import { useEffect, useRef, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { FileText, Sparkles, Loader2, Download, Printer, Wand2, Eye, Mic, MicOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { registerVoiceListener } from "@/components/VoiceAssistant";
import { getSpeechRecognition, requestMicrophoneAccess, supportsSpeechRecognition } from "@/lib/voice";

const OrdersPage = () => {
  const [templates, setTemplates] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [context, setContext] = useState("");
  const [generated, setGenerated] = useState("");
  const [editInstr, setEditInstr] = useState("");
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const recRef = useRef<any>(null);

  const load = async () => {
    const [templatesResult, ordersResult] = await Promise.all([
      supabase.from("order_templates").select("*").order("category"),
      supabase.from("generated_orders").select("*").order("created_at", { ascending: false }).limit(15),
    ]);
    setTemplates(templatesResult.data || []);
    setOrders(ordersResult.data || []);
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    return registerVoiceListener(async (text) => {
      if (!/приказ|распоряжен|документ/i.test(text)) return false;
      setContext((previous) => (previous ? `${previous}
${text}` : text));
      toast.success("Контекст добавлен голосом");
      return true;
    });
  }, []);

  const dictate = async () => {
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
      rec.continuous = true;
      rec.interimResults = true;
      let finalText = context;
      rec.onresult = (event: SpeechRecognitionEvent) => {
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const piece = event.results[i][0]?.transcript || "";
          if (event.results[i].isFinal) finalText += ` ${piece}`;
          else interim += piece;
        }
        setContext(`${finalText} ${interim}`.trim());
      };
      rec.onerror = () => setRecording(false);
      rec.onend = () => {
        setRecording(false);
        setContext(finalText.trim());
      };
      rec.start();
      recRef.current = rec;
      setRecording(true);
      toast.info("Диктуйте контекст приказа...");
    } catch (error: any) {
      toast.error(error?.message || "Не удалось включить микрофон");
    }
  };

  const generate = async () => {
    if (!selected || !context.trim()) {
      toast.error("Введите детали приказа");
      return;
    }
    setLoading(true);
    try {
      const today = new Date().toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
      const orderNo = Math.floor(100 + Math.random() * 900);
      const prompt = `Ты составляешь официальный приказ для школы Mektep AI, г. Актобе, Республика Казахстан, от имени директора Айгуль Серикбаевны.

Шаблон: "${selected.title}" (код ${selected.code}).
Дата: ${today}. Номер: №${orderNo}-АЛ.
Контекст: ${context}

Шаблон-основа:
${selected.template_md}

Требования:
- Используй официальный деловой стиль Казахстана.
- Заполни все переменные точными данными из контекста.
- Структура обязательна: шапка, номер и дата, основание, слово ПРИКАЗЫВАЮ, нумерованные пункты, ответственные, контроль, подпись директора.
- Если данных не хватает, сформулируй нейтрально и официально, без заглушек вида [ФИО].
- Верни только готовый markdown-документ без пояснений.`;

      const { data, error } = await supabase.functions.invoke("ai-orchestrator", {
        body: { messages: [{ role: "user", content: prompt }] },
      });
      if (error) throw error;
      setGenerated(data.content || "");
      toast.success("Приказ готов — справа предпросмотр");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const editOrder = async () => {
    if (!editInstr.trim()) return;
    setLoading(true);
    try {
      const prompt = `Вот текущий приказ:

${generated}

Измени его согласно инструкции директора: "${editInstr}". Сохрани официальный деловой стиль Казахстана. Верни только обновлённый markdown без комментариев.`;
      const { data, error } = await supabase.functions.invoke("ai-orchestrator", {
        body: { messages: [{ role: "user", content: prompt }] },
      });
      if (error) throw error;
      setGenerated(data.content || generated);
      setEditInstr("");
      toast.success("AI обновил приказ");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    if (!generated || !selected) return;
    await supabase.from("generated_orders").insert({
      template_id: selected.id,
      title: `${selected.title} от ${new Date().toLocaleDateString("ru-RU")}`,
      content_md: generated,
      status: "draft",
    });
    toast.success("Сохранено в историю");
    await load();
  };

  const printPreview = () => {
    const popup = window.open("", "_blank");
    if (!popup) return;
    const html = generated
      .replace(/^# (.*)$/gm, "<h1>$1</h1>")
      .replace(/^## (.*)$/gm, "<h2>$1</h2>")
      .replace(/^### (.*)$/gm, "<h3>$1</h3>")
      .replace(/\*\*(.*?)\*\*/g, "<b>$1</b>")
      .replace(/\n\n/g, "</p><p>")
      .replace(/\n/g, "<br/>");
    popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${selected?.title || "Приказ"}</title>
      <style>
        @page { size: A4; margin: 2.5cm 2cm; }
        body { font-family: 'Times New Roman', Georgia, serif; font-size: 12pt; line-height: 1.6; color: #000; }
        h1 { font-size: 16pt; text-align: center; margin: 0 0 8pt; }
        h2 { font-size: 13pt; margin-top: 14pt; }
        h3 { font-size: 12pt; }
        p { margin: 8pt 0; text-align: justify; }
      </style></head><body><p>${html}</p></body></html>`);
    popup.document.close();
    window.setTimeout(() => popup.print(), 300);
  };

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-display text-3xl font-extrabold flex items-center gap-3">
            <FileText className="h-8 w-8 text-primary" /> Приказы
          </h1>
          <p className="text-muted-foreground mt-1">Официальные шаблоны, AI-генерация, диктовка голосом и печать A4</p>
        </motion.div>

        <div className="grid lg:grid-cols-12 gap-6">
          <Card className="p-4 bg-gradient-card lg:col-span-3">
            <h2 className="font-display font-bold mb-3">Шаблоны</h2>
            <div className="space-y-2 max-h-[700px] overflow-y-auto">
              {templates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => {
                    setSelected(template);
                    setGenerated("");
                    setContext("");
                  }}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${selected?.id === template.id ? "bg-primary/10 border-primary shadow-sm" : "border-border hover:bg-muted"}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline" className="text-[10px]">{template.code}</Badge>
                    <Badge className={`text-[10px] ${template.category === "health" ? "bg-success/15 text-success" : template.category === "hr" ? "bg-secondary/20 text-secondary-foreground" : "bg-primary/10 text-primary"}`}>{template.category}</Badge>
                  </div>
                  <div className="font-medium text-sm mt-1.5">{template.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{template.description}</div>
                </button>
              ))}
            </div>
          </Card>

          <Card className="p-4 bg-gradient-card lg:col-span-4 space-y-3">
            {!selected ? (
              <div className="h-full min-h-[400px] flex items-center justify-center text-center text-muted-foreground">
                <div>
                  <Sparkles className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  Выберите шаблон слева
                </div>
              </div>
            ) : (
              <>
                <div>
                  <h2 className="font-display text-lg font-bold">{selected.title}</h2>
                  <p className="text-xs text-muted-foreground">{selected.description}</p>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-medium">Контекст для AI:</label>
                    <Button size="sm" variant={recording ? "destructive" : "outline"} onClick={dictate} className="gap-1 h-7" disabled={!supportsSpeechRecognition()}>
                      {recording ? <MicOff className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
                      {recording ? "Стоп" : "Диктовать"}
                    </Button>
                  </div>
                  <Textarea
                    value={context}
                    onChange={(event) => setContext(event.target.value)}
                    rows={6}
                    placeholder="Например: ответственная — завуч Сейтенова М.Б., срок до 1 декабря 2026, основание — служебная записка, город Актобе."
                  />
                </div>
                <Button onClick={generate} disabled={loading || !context.trim()} className="w-full bg-gradient-primary text-primary-foreground gap-2">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Сгенерировать приказ
                </Button>

                {generated && (
                  <>
                    <div className="pt-3 border-t border-border">
                      <label className="text-sm font-medium mb-1 block">Доработать AI-командой:</label>
                      <div className="flex gap-2">
                        <Textarea
                          value={editInstr}
                          onChange={(event) => setEditInstr(event.target.value)}
                          rows={2}
                          placeholder="Замени дату на 15 декабря, добавь пункт о контроле исполнения..."
                          className="flex-1"
                        />
                        <Button onClick={editOrder} disabled={loading || !editInstr.trim()} variant="outline" size="icon" className="self-stretch">
                          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Button size="sm" onClick={save} className="gap-1"><FileText className="h-3 w-3" /> Сохранить</Button>
                      <Button size="sm" variant="outline" onClick={printPreview} className="gap-1"><Printer className="h-3 w-3" /> Печать A4</Button>
                      <Button size="sm" variant="outline" onClick={() => {
                        const blob = new Blob([generated], { type: "text/markdown" });
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement("a");
                        link.href = url;
                        link.download = `${selected.code}-${new Date().toISOString().slice(0, 10)}.md`;
                        link.click();
                      }} className="gap-1"><Download className="h-3 w-3" /> Скачать</Button>
                    </div>
                  </>
                )}
              </>
            )}
          </Card>

          <Card className="lg:col-span-5 bg-card overflow-hidden flex flex-col max-h-[800px]">
            <div className="p-3 border-b border-border bg-gradient-card flex items-center gap-2">
              <Eye className="h-4 w-4 text-primary" />
              <span className="font-display font-bold text-sm">Предпросмотр приказа</span>
              {generated && <Badge className="ml-auto bg-success text-success-foreground text-[10px]">Готов</Badge>}
            </div>
            <div className="overflow-y-auto p-8 flex-1 bg-card text-foreground">
              {generated ? (
                <div className="prose prose-sm max-w-none dark:prose-invert" style={{ fontFamily: "'Times New Roman', Georgia, serif" }}>
                  <ReactMarkdown>{generated}</ReactMarkdown>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-center">
                  <div>
                    <FileText className="h-12 w-12 mx-auto mb-2 opacity-30" />
                    <div className="text-sm">Здесь появится готовый приказ.<br />Сгенерируйте его слева.</div>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>

        {orders.length > 0 && (
          <Card className="p-4 bg-gradient-card">
            <h2 className="font-display font-bold mb-3">История приказов ({orders.length})</h2>
            <div className="grid md:grid-cols-2 gap-2">
              {orders.map((order) => (
                <button
                  key={order.id}
                  onClick={() => setGenerated(order.content_md)}
                  className="flex items-center justify-between p-3 rounded-lg border border-border bg-card hover:shadow-md transition-all text-left"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{order.title}</div>
                    <div className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleString("ru-RU")}</div>
                  </div>
                  <Badge variant="outline">{order.status}</Badge>
                </button>
              ))}
            </div>
          </Card>
        )}
      </div>
    </AppLayout>
  );
};

export default OrdersPage;
