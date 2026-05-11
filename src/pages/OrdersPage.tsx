import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { FileText, Sparkles, Loader2, Download, Eye, Wand2, History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { motion } from "framer-motion";

const OrdersPage = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [versions, setVersions] = useState<any[]>([]);
  const [editInstr, setEditInstr] = useState("");
  const [loading, setLoading] = useState(false);
  const [quickText, setQuickText] = useState("");

  const load = async () => {
    const { data } = await supabase
      .from("generated_orders")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(80);
    setOrders(data || []);
  };

  const loadVersions = async (orderId: string) => {
    const { data } = await supabase
      .from("order_versions")
      .select("*")
      .eq("order_id", orderId)
      .order("version", { ascending: false });
    setVersions(data || []);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (selected?.id) loadVersions(selected.id); else setVersions([]);
  }, [selected?.id]);

  const grouped = orders.reduce<Record<string, any[]>>((acc, o) => {
    const d = new Date(o.created_at).toLocaleDateString("ru-RU");
    (acc[d] = acc[d] || []).push(o);
    return acc;
  }, {});

  const generateFromText = async () => {
    if (!quickText.trim()) return toast.error("Опишите приказ");
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("order-from-text", { body: { text: quickText } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Приказ создан и PDF готов");
      setQuickText("");
      await load();
      const { data: fresh } = await supabase.from("generated_orders").select("*").eq("id", data.order_id).single();
      setSelected(fresh);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const newRevision = async () => {
    if (!selected || !editInstr.trim()) return;
    setLoading(true);
    try {
      // Ask AI to revise
      const prompt = `Отредактируй приказ ниже по инструкции директора. Сохрани казахстанский деловой стиль и структуру. Верни ТОЛЬКО обновлённый markdown без комментариев.

Инструкция: "${editInstr}"

Текущий приказ:
${selected.content_md}`;
      const { data: ai, error } = await supabase.functions.invoke("ai-orchestrator", {
        body: { messages: [{ role: "user", content: prompt }] },
      });
      if (error) throw error;
      const newMd = (ai?.content || "").trim();
      if (!newMd) throw new Error("AI вернул пустой ответ");

      const newVersion = (selected.version || 1) + 1;
      // Save updated content on order, then render PDF
      await supabase.from("generated_orders").update({ content_md: newMd, version: newVersion }).eq("id", selected.id);
      const { data: pdfRes, error: pdfErr } = await supabase.functions.invoke("order-pdf", {
        body: { order_id: selected.id, markdown: newMd, version: newVersion, note: editInstr },
      });
      if (pdfErr) throw pdfErr;
      toast.success(`Версия ${newVersion} сохранена`);
      setEditInstr("");
      const { data: fresh } = await supabase.from("generated_orders").select("*").eq("id", selected.id).single();
      setSelected(fresh);
      await loadVersions(selected.id);
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const ensurePdf = async () => {
    if (!selected) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("order-pdf", {
        body: { order_id: selected.id, is_original: true, version: selected.version || 1, note: "Оригинал" },
      });
      if (error) throw error;
      toast.success("PDF сгенерирован");
      const { data: fresh } = await supabase.from("generated_orders").select("*").eq("id", selected.id).single();
      setSelected(fresh);
      await loadVersions(selected.id);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-display text-3xl font-extrabold flex items-center gap-3">
            <FileText className="h-8 w-8 text-primary" /> Журнал приказов
          </h1>
          <p className="text-muted-foreground mt-1">Версионирование, оригинал и текущий PDF, генерация из текста</p>
        </motion.div>

        {/* Quick generate from text */}
        <Card className="p-4 glass">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-4 w-4 text-secondary" />
            <span className="font-display font-bold">Сгенерировать приказ из текста</span>
          </div>
          <Textarea
            value={quickText}
            onChange={(e) => setQuickText(e.target.value)}
            rows={3}
            placeholder="Например: создай приказ о замещении уроков учителя Смирновой А.В. с 12 по 14 мая в связи с командировкой..."
          />
          <div className="flex justify-end mt-2">
            <Button onClick={generateFromText} disabled={loading || !quickText.trim()} className="gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Сгенерировать + PDF
            </Button>
          </div>
        </Card>

        <div className="grid lg:grid-cols-12 gap-6">
          {/* List grouped by date */}
          <Card className="lg:col-span-4 glass p-4 max-h-[80vh] overflow-y-auto">
            <h2 className="font-display font-bold mb-3">Все приказы ({orders.length})</h2>
            {Object.entries(grouped).map(([date, items]) => (
              <div key={date} className="mb-4">
                <div className="text-xs font-semibold text-muted-foreground mb-2">{date}</div>
                <div className="space-y-2">
                  {items.map((o) => (
                    <button
                      key={o.id}
                      onClick={() => setSelected(o)}
                      className={`w-full text-left p-3 rounded-lg border transition-all ${selected?.id === o.id ? "bg-primary/10 border-primary" : "border-border hover:bg-muted/50"}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-medium text-sm truncate">{o.title}</div>
                        <Badge variant="outline" className="text-[10px]">v{o.version || 1}</Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {o.order_no && <Badge variant="outline" className="text-[10px]">№{o.order_no}</Badge>}
                        {o.absence_id && <Badge className="text-[10px] bg-warning/15 text-warning-foreground">отсутствие</Badge>}
                        {o.incident_id && <Badge className="text-[10px] bg-destructive/15 text-destructive">инцидент</Badge>}
                        <span className="text-[10px] text-muted-foreground">{new Date(o.created_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </Card>

          {/* Detail */}
          <Card className="lg:col-span-8 glass p-4 space-y-4">
            {!selected ? (
              <div className="h-[400px] flex items-center justify-center text-muted-foreground text-center">
                <div>
                  <FileText className="h-12 w-12 mx-auto mb-2 opacity-30" />
                  Выберите приказ
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <h2 className="font-display text-xl font-bold">{selected.title}</h2>
                    <div className="flex gap-2 items-center mt-1 flex-wrap">
                      {selected.order_no && <Badge variant="outline">№{selected.order_no}</Badge>}
                      <Badge variant="outline">v{selected.version || 1}</Badge>
                      <span className="text-xs text-muted-foreground">{new Date(selected.created_at).toLocaleString("ru-RU")}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {selected.pdf_url_original ? (
                      <a href={selected.pdf_url_original} target="_blank" rel="noreferrer">
                        <Button variant="outline" className="gap-1"><Download className="h-4 w-4" /> Оригинал</Button>
                      </a>
                    ) : null}
                    {selected.pdf_url_current ? (
                      <a href={selected.pdf_url_current} target="_blank" rel="noreferrer">
                        <Button className="gap-1"><Download className="h-4 w-4" /> Текущая версия PDF</Button>
                      </a>
                    ) : (
                      <Button onClick={ensurePdf} disabled={loading} className="gap-1">
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                        Создать PDF
                      </Button>
                    )}
                  </div>
                </div>

                <div className="border rounded-lg p-4 bg-card max-h-[400px] overflow-y-auto">
                  <div className="prose prose-sm max-w-none dark:prose-invert" style={{ fontFamily: "'Times New Roman', Georgia, serif" }}>
                    <ReactMarkdown>{selected.content_md}</ReactMarkdown>
                  </div>
                </div>

                {/* New revision */}
                <div className="border-t border-border pt-3">
                  <label className="text-sm font-medium mb-1 block flex items-center gap-1"><Wand2 className="h-4 w-4" /> Новая редакция</label>
                  <div className="flex gap-2">
                    <Textarea value={editInstr} onChange={(e) => setEditInstr(e.target.value)} rows={2} placeholder="Например: измени дату на 20 мая, добавь пункт 4..." className="flex-1" />
                    <Button onClick={newRevision} disabled={loading || !editInstr.trim()} className="self-stretch gap-1">
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                      Создать v{(selected.version || 1) + 1}
                    </Button>
                  </div>
                </div>

                {/* Versions */}
                <div className="border-t border-border pt-3">
                  <h3 className="font-display font-bold mb-2 flex items-center gap-2"><History className="h-4 w-4" /> История версий ({versions.length})</h3>
                  <div className="space-y-2">
                    {versions.map((v) => (
                      <div key={v.id} className="flex items-center justify-between p-2 rounded-lg border border-border bg-card">
                        <div>
                          <div className="text-sm font-medium">v{v.version} — {v.note || "без комментария"}</div>
                          <div className="text-xs text-muted-foreground">{new Date(v.created_at).toLocaleString("ru-RU")}</div>
                        </div>
                        {v.pdf_url && (
                          <a href={v.pdf_url} target="_blank" rel="noreferrer">
                            <Button size="sm" variant="outline" className="gap-1"><Download className="h-3 w-3" /> PDF</Button>
                          </a>
                        )}
                      </div>
                    ))}
                    {versions.length === 0 && <div className="text-xs text-muted-foreground">PDF ещё не создавался — нажмите «Создать PDF».</div>}
                  </div>
                </div>
              </>
            )}
          </Card>
        </div>
      </div>
    </AppLayout>
  );
};

export default OrdersPage;
