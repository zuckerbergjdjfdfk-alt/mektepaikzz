import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings, Bot, MessageSquare, Bell, CheckCircle2, XCircle, Loader2, Copy, Mic, Sparkles, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { supportsSpeechRecognition, requestMicrophoneAccess, speakText } from "@/lib/voice";

const SettingsPage = () => {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [instanceId, setInstanceId] = useState("");
  const [token, setToken] = useState("");
  const [testPhone, setTestPhone] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiResult, setAiResult] = useState<string>("");
  const [micResult, setMicResult] = useState<string>("");

  const refresh = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("whatsapp-config", { body: { action: "status" } });
    if (!error) setStatus(data);
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  const save = async () => {
    if (!instanceId || !token) { toast.error("Введите Instance ID и API Token"); return; }
    setSaving(true);
    const { error } = await supabase.functions.invoke("whatsapp-config", { body: { action: "save", instance_id: instanceId, token } });
    setSaving(false);
    if (error) { toast.error("Ошибка сохранения"); return; }
    toast.success("Сохранено. Проверяем подключение...");
    setInstanceId(""); setToken("");
    await refresh();
  };

  const setupWebhook = async () => {
    const { data, error } = await supabase.functions.invoke("whatsapp-config?action=set_webhook", { body: {} });
    if (error || !data?.ok) { toast.error("Ошибка настройки webhook"); return; }
    toast.success("Webhook привязан в Green API");
    await refresh();
  };

  const testSend = async () => {
    if (!testPhone) { toast.error("Введите номер (например 77001234567)"); return; }
    const { data, error } = await supabase.functions.invoke("whatsapp-config?action=test_send", {
      body: { phone: testPhone, message: "✅ AISSchool: тест связи. Если вы это видите — интеграция работает." },
    });
    if (error || !data?.ok) { toast.error("Ошибка отправки: " + (data?.response?.error || error?.message || "?")); return; }
    toast.success("Сообщение отправлено!");
  };

  const testAI = async () => {
    setAiBusy(true); setAiResult("");
    try {
      const { data, error } = await supabase.functions.invoke("ai-orchestrator", {
        body: { messages: [{ role: "user", content: "Привет! Скажи коротко: AISSchool работает?" }] },
      });
      if (error) throw error;
      setAiResult(data?.content || JSON.stringify(data));
      toast.success("AI ответил");
    } catch (e: any) { toast.error("AI ошибка: " + e.message); setAiResult("❌ " + e.message); }
    finally { setAiBusy(false); }
  };

  const testMic = async () => {
    if (!supportsSpeechRecognition()) { toast.error("Микрофон/распознавание недоступны в этом браузере"); return; }
    try {
      await requestMicrophoneAccess();
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const rec = new SR(); rec.lang = "ru-RU"; rec.interimResults = false;
      setMicResult("🎤 Говорите...");
      rec.onresult = async (e: any) => {
        const t = e.results[0][0].transcript;
        setMicResult("✅ Распознано: " + t);
        await speakText("Я вас услышала: " + t);
      };
      rec.onerror = (e: any) => setMicResult("❌ " + e.error);
      rec.start();
    } catch (e: any) { toast.error(e.message); }
  };

  const copyWebhook = () => {
    if (status?.webhook_url) { navigator.clipboard.writeText(status.webhook_url); toast.success("Webhook URL скопирован"); }
  };

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6 max-w-5xl">
        <div className="animate-fade-up">
          <h1 className="font-display text-3xl font-extrabold flex items-center gap-3">
            <Settings className="h-8 w-8 text-primary" /> Настройки
          </h1>
          <p className="text-muted-foreground mt-1">Интеграции, тесты и системные модули AISSchool</p>
        </div>

        {/* WhatsApp Integration */}
        <Card className="p-6 glass-sheen animate-fade-up">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-gradient-primary flex items-center justify-center">
                <MessageSquare className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h2 className="font-display text-xl font-bold">WhatsApp · Green API</h2>
                <p className="text-sm text-muted-foreground">Реальный мониторинг чатов и автоответы AI</p>
              </div>
            </div>
            {loading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> :
              status?.connected ? <Badge className="bg-success text-success-foreground gap-1"><CheckCircle2 className="h-3 w-3" /> Подключено</Badge> :
              status?.configured ? <Badge variant="secondary" className="gap-1">Настроено · {status?.stateInstance || "проверка"}</Badge> :
              <Badge variant="outline" className="gap-1"><XCircle className="h-3 w-3" /> Не настроено</Badge>}
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <Label>Instance ID</Label>
                <Input value={instanceId} onChange={(e) => setInstanceId(e.target.value)} placeholder={status?.instance_id || "1101000000"} />
              </div>
              <div>
                <Label>API Token</Label>
                <Input value={token} onChange={(e) => setToken(e.target.value)} type="password" placeholder={status?.has_token ? "•••• сохранён ••••" : "abcdef1234567890..."} />
              </div>
              <Button onClick={save} disabled={saving} className="bg-gradient-primary text-primary-foreground w-full">
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Сохранить креды
              </Button>
              <p className="text-xs text-muted-foreground">
                Получите на <a href="https://green-api.com" target="_blank" className="underline">green-api.com</a> →
                Личный кабинет → ваш инстанс → idInstance + apiTokenInstance.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <Label>Webhook URL (вставьте в Green API → Settings → Webhook)</Label>
                <div className="flex gap-2">
                  <Input value={status?.webhook_url || ""} readOnly className="font-mono text-xs" />
                  <Button size="icon" variant="outline" onClick={copyWebhook}><Copy className="h-4 w-4" /></Button>
                </div>
              </div>
              <Button onClick={setupWebhook} disabled={!status?.configured} variant="outline" className="w-full">
                Привязать webhook автоматически
              </Button>
              <div className="pt-2 border-t">
                <Label>Тест: отправить себе</Label>
                <div className="flex gap-2 mt-1">
                  <Input value={testPhone} onChange={(e) => setTestPhone(e.target.value)} placeholder="77001234567" />
                  <Button onClick={testSend} disabled={!status?.configured} className="gap-1">
                    <Phone className="h-4 w-4" /> Отправить
                  </Button>
                </div>
              </div>
              {status?.phone && <p className="text-xs text-muted-foreground">📱 Номер инстанса: {status.phone}</p>}
            </div>
          </div>
        </Card>

        {/* Quick tests */}
        <div className="grid md:grid-cols-2 gap-4">
          <Card className="p-5 glass-sheen">
            <div className="flex items-center gap-3 mb-3">
              <Sparkles className="h-5 w-5 text-primary" />
              <h3 className="font-display font-bold">Тест AI</h3>
            </div>
            <Button onClick={testAI} disabled={aiBusy} className="bg-gradient-primary text-primary-foreground w-full">
              {aiBusy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Запросить ответ
            </Button>
            {aiResult && <div className="mt-3 p-3 rounded-xl bg-muted/40 text-sm">{aiResult}</div>}
          </Card>

          <Card className="p-5 glass-sheen">
            <div className="flex items-center gap-3 mb-3">
              <Mic className="h-5 w-5 text-primary" />
              <h3 className="font-display font-bold">Тест микрофона</h3>
            </div>
            <Button onClick={testMic} variant="outline" className="w-full">Сказать фразу</Button>
            {micResult && <div className="mt-3 p-3 rounded-xl bg-muted/40 text-sm">{micResult}</div>}
            {!supportsSpeechRecognition() && <p className="text-xs text-warning mt-2">Доступно в Chrome / Edge / Safari.</p>}
          </Card>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <Card className="p-5 glass-sheen">
            <div className="flex items-center gap-2 font-display font-bold"><Bot className="h-5 w-5 text-primary" /> AI Orchestrator</div>
            <div className="mt-3"><Badge className="bg-success text-success-foreground">Lovable AI</Badge></div>
            <p className="mt-3 text-sm text-muted-foreground">Чат, расписание, приказы, отчёты, голос.</p>
          </Card>
          <Card className="p-5 glass-sheen">
            <div className="flex items-center gap-2 font-display font-bold"><MessageSquare className="h-5 w-5 text-primary" /> Telegram</div>
            <div className="mt-3"><Badge className="bg-success text-success-foreground">Подключен</Badge></div>
            <p className="mt-3 text-sm text-muted-foreground">Бот мониторит чаты и автоматически реагирует.</p>
          </Card>
          <Card className="p-5 glass-sheen">
            <div className="flex items-center gap-2 font-display font-bold"><Bell className="h-5 w-5 text-primary" /> Realtime</div>
            <div className="mt-3"><Badge className="bg-success text-success-foreground">Активно</Badge></div>
            <p className="mt-3 text-sm text-muted-foreground">Лента уведомлений + дашборд обновляются мгновенно.</p>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
};

export default SettingsPage;
