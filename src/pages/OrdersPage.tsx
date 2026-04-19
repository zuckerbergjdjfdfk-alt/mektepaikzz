import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { FileText, Sparkles, Loader2, Download, Printer, Wand2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

const OrdersPage = () => {
  const [templates, setTemplates] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [context, setContext] = useState("");
  const [generated, setGenerated] = useState("");
  const [editInstr, setEditInstr] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const [t, o] = await Promise.all([
      supabase.from("order_templates").select("*").order("category"),
      supabase.from("generated_orders").select("*").order("created_at", { ascending: false }).limit(10),
    ]);
    setTemplates(t.data || []);
    setOrders(o.data || []);
  };
  useEffect(() => { load(); }, []);

  const generate = async () => {
    if (!selected || !context.trim()) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-orchestrator", {
        body: { action: "generate_order", template: selected, context },
      });
      if (error) throw error;
      setGenerated(data.content);
      toast.success("Приказ сгенерирован");
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };

  const editOrder = async () => {
    if (!editInstr.trim()) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-orchestrator", {
        body: { action: "edit_order", current: generated, instruction: editInstr },
      });
      if (error) throw error;
      setGenerated(data.content);
      setEditInstr("");
      toast.success("AI обновил приказ");
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };

  const save = async () => {
    if (!generated || !selected) return;
    await supabase.from("generated_orders").insert({
      template_id: selected.id,
      title: `${selected.title} от ${new Date().toLocaleDateString("ru-RU")}`,
      content_md: generated,
      status: "draft",
    });
    toast.success("Сохранено в базу");
    await load();
  };

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6">
        <div>
          <h1 className="font-display text-3xl font-extrabold flex items-center gap-3">
            <FileText className="h-8 w-8 text-primary" /> Приказы
          </h1>
          <p className="text-muted-foreground mt-1">{templates.length} шаблонов · AI-генерация в стиле Claude</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Templates */}
          <Card className="p-4 bg-gradient-card">
            <h2 className="font-display font-bold mb-3">Шаблоны</h2>
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {templates.map((t) => (
                <button key={t.id} onClick={() => { setSelected(t); setGenerated(""); }} className={`w-full text-left p-3 rounded-lg border transition-all ${selected?.id === t.id ? "bg-primary/10 border-primary" : "border-border hover:bg-muted"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline" className="text-[10px]">{t.code}</Badge>
                    <Badge className={`text-[10px] ${t.category === "health" ? "bg-success/15 text-success" : t.category === "hr" ? "bg-secondary/20 text-secondary-foreground" : "bg-primary/10 text-primary"}`}>{t.category}</Badge>
                  </div>
                  <div className="font-medium text-sm mt-1.5">{t.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{t.description}</div>
                </button>
              ))}
            </div>
          </Card>

          {/* Editor */}
          <Card className="p-4 bg-gradient-card lg:col-span-2 space-y-4">
            {!selected ? (
              <div className="h-full min-h-[400px] flex items-center justify-center text-center text-muted-foreground">
                <div>
                  <Sparkles className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  Выберите шаблон слева, чтобы начать
                </div>
              </div>
            ) : (
              <>
                <div>
                  <h2 className="font-display text-xl font-bold">{selected.title}</h2>
                  <p className="text-sm text-muted-foreground">{selected.description}</p>
                </div>

                {!generated ? (
                  <>
                    <div>
                      <label className="text-sm font-medium mb-1 block">Расскажите AI детали приказа:</label>
                      <Textarea value={context} onChange={(e) => setContext(e.target.value)} rows={5} placeholder="Например: Назначить ответственным за санитарный режим завхоза Турсунова С.Б. Срок исполнения — 1 декабря 2025. Контроль на завуче Сейтеновой М.Б." />
                    </div>
                    <Button onClick={generate} disabled={loading || !context.trim()} className="bg-gradient-primary text-primary-foreground gap-2">
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      Сгенерировать приказ
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="rounded-xl border border-border bg-card p-6 max-h-[400px] overflow-y-auto">
                      <div className="prose prose-sm max-w-none dark:prose-invert">
                        <ReactMarkdown>{generated}</ReactMarkdown>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Textarea value={editInstr} onChange={(e) => setEditInstr(e.target.value)} placeholder="Скажите AI что поменять: «замени дату на 15 декабря», «добавь пункт про обучение»..." rows={2} className="flex-1" />
                      <Button onClick={editOrder} disabled={loading || !editInstr.trim()} variant="outline" className="gap-2 self-stretch">
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                        Изменить
                      </Button>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={save} className="gap-2"><FileText className="h-4 w-4" /> Сохранить</Button>
                      <Button variant="outline" onClick={() => window.print()} className="gap-2"><Printer className="h-4 w-4" /> Печать</Button>
                      <Button variant="outline" onClick={() => {
                        const blob = new Blob([generated], { type: "text/markdown" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url; a.download = `${selected.code}.md`; a.click();
                      }} className="gap-2"><Download className="h-4 w-4" /> Скачать</Button>
                      <Button variant="ghost" onClick={() => setGenerated("")}>Заново</Button>
                    </div>
                  </>
                )}
              </>
            )}
          </Card>
        </div>

        {/* History */}
        {orders.length > 0 && (
          <Card className="p-4 bg-gradient-card">
            <h2 className="font-display font-bold mb-3">История приказов</h2>
            <div className="space-y-2">
              {orders.map((o) => (
                <div key={o.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
                  <div>
                    <div className="font-medium text-sm">{o.title}</div>
                    <div className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString("ru-RU")}</div>
                  </div>
                  <Badge>{o.status}</Badge>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </AppLayout>
  );
};

export default OrdersPage;
