import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { FileText, Sparkles, Loader2, Download, Printer, Wand2, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { motion } from "framer-motion";

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
      supabase.from("generated_orders").select("*").order("created_at", { ascending: false }).limit(15),
    ]);
    setTemplates(t.data || []);
    setOrders(o.data || []);
  };
  useEffect(() => { load(); }, []);

  const generate = async () => {
    if (!selected || !context.trim()) { toast.error("Введите детали приказа"); return; }
    setLoading(true);
    try {
      const prompt = `Сгенерируй приказ по шаблону "${selected.title}" (код ${selected.code}). Контекст от директора: "${context}". Заполни все плейсхолдеры в шаблоне реальными данными. Шаблон:\n\n${selected.template_md}\n\nВерни ТОЛЬКО готовый markdown без объяснений.`;
      const { data, error } = await supabase.functions.invoke("ai-orchestrator", {
        body: { messages: [{ role: "user", content: prompt }] },
      });
      if (error) throw error;
      setGenerated(data.content || "");
      toast.success("Приказ готов — справа предпросмотр");
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };

  const editOrder = async () => {
    if (!editInstr.trim()) return;
    setLoading(true);
    try {
      const prompt = `Вот текущий приказ:\n\n${generated}\n\nИзмени его согласно инструкции: "${editInstr}". Верни ТОЛЬКО обновлённый markdown.`;
      const { data, error } = await supabase.functions.invoke("ai-orchestrator", {
        body: { messages: [{ role: "user", content: prompt }] },
      });
      if (error) throw error;
      setGenerated(data.content || generated);
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
    toast.success("Сохранено");
    await load();
  };

  const printPreview = () => {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<html><head><title>${selected?.title || "Приказ"}</title>
      <style>body{font-family:Georgia,serif;padding:40px;max-width:800px;margin:auto;line-height:1.6;color:#222}h1{font-size:18pt;text-align:center}h2{font-size:14pt}p{margin:12px 0}</style>
      </head><body>${generated.replace(/\n/g, "<br/>")}</body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 300);
  };

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-display text-3xl font-extrabold flex items-center gap-3">
            <FileText className="h-8 w-8 text-primary" /> Приказы
          </h1>
          <p className="text-muted-foreground mt-1">{templates.length} официальных шаблонов · AI-генерация · предпросмотр справа</p>
        </motion.div>

        <div className="grid lg:grid-cols-12 gap-6">
          {/* Templates */}
          <Card className="p-4 bg-gradient-card lg:col-span-3">
            <h2 className="font-display font-bold mb-3">Шаблоны</h2>
            <div className="space-y-2 max-h-[700px] overflow-y-auto">
              {templates.map((t) => (
                <button key={t.id} onClick={() => { setSelected(t); setGenerated(""); setContext(""); }}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${selected?.id === t.id ? "bg-primary/10 border-primary shadow-sm" : "border-border hover:bg-muted"}`}>
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
                  <label className="text-sm font-medium mb-1 block">Контекст для AI:</label>
                  <Textarea value={context} onChange={(e) => setContext(e.target.value)} rows={6}
                    placeholder="Например: ответственный — завхоз Турсунов С.Б., срок до 1 декабря 2025, контроль на завуче Сейтеновой М.Б." />
                </div>
                <Button onClick={generate} disabled={loading || !context.trim()} className="w-full bg-gradient-primary text-primary-foreground gap-2">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Сгенерировать
                </Button>

                {generated && (
                  <>
                    <div className="pt-3 border-t border-border">
                      <label className="text-sm font-medium mb-1 block">Доработать:</label>
                      <div className="flex gap-2">
                        <Textarea value={editInstr} onChange={(e) => setEditInstr(e.target.value)} rows={2}
                          placeholder="Замени дату на 15 декабря..." className="flex-1" />
                        <Button onClick={editOrder} disabled={loading || !editInstr.trim()} variant="outline" size="icon" className="self-stretch">
                          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Button size="sm" onClick={save} className="gap-1"><FileText className="h-3 w-3" /> Сохранить</Button>
                      <Button size="sm" variant="outline" onClick={printPreview} className="gap-1"><Printer className="h-3 w-3" /> Печать</Button>
                      <Button size="sm" variant="outline" onClick={() => {
                        const blob = new Blob([generated], { type: "text/markdown" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url; a.download = `${selected.code}-${new Date().toISOString().slice(0,10)}.md`; a.click();
                      }} className="gap-1"><Download className="h-3 w-3" /> Скачать</Button>
                    </div>
                  </>
                )}
              </>
            )}
          </Card>

          {/* Preview */}
          <Card className="lg:col-span-5 bg-card overflow-hidden flex flex-col max-h-[800px]">
            <div className="p-3 border-b border-border bg-gradient-card flex items-center gap-2">
              <Eye className="h-4 w-4 text-primary" />
              <span className="font-display font-bold text-sm">Предпросмотр приказа</span>
              {generated && <Badge className="ml-auto bg-success text-success-foreground text-[10px]">Готов</Badge>}
            </div>
            <div className="overflow-y-auto p-8 flex-1 bg-card text-foreground">
              {generated ? (
                <div className="prose prose-sm max-w-none dark:prose-invert" style={{ fontFamily: "Georgia, serif" }}>
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

        {/* History */}
        {orders.length > 0 && (
          <Card className="p-4 bg-gradient-card">
            <h2 className="font-display font-bold mb-3">История приказов ({orders.length})</h2>
            <div className="grid md:grid-cols-2 gap-2">
              {orders.map((o) => (
                <button key={o.id} onClick={() => setGenerated(o.content_md)}
                  className="flex items-center justify-between p-3 rounded-lg border border-border bg-card hover:shadow-md transition-all text-left">
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{o.title}</div>
                    <div className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString("ru-RU")}</div>
                  </div>
                  <Badge variant="outline">{o.status}</Badge>
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
