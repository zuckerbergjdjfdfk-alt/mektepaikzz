import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MessageSquare, Send, Loader2, Bot, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

const ChatsPage = () => {
  const [messages, setMessages] = useState<any[]>([]);
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    const { data } = await supabase.from("chat_messages").select("*").order("created_at", { ascending: true }).limit(200);
    setMessages(data || []);
    if (!activeChat && data?.length) setActiveChat(data[data.length - 1].chat_name);
  };

  const pollNow = async () => {
    await Promise.allSettled([
      supabase.functions.invoke("telegram-poll", { body: {} }),
      supabase.functions.invoke("whatsapp-poll", { body: {} }),
    ]);
    await load();
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel("chats-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), [messages, activeChat]);

  const chatGroups = Array.from(new Set(messages.map((message) => message.chat_name).filter(Boolean))).map((name) => {
    const list = messages.filter((message) => message.chat_name === name);
    const last = list[list.length - 1];
    return {
      name,
      channel: last?.channel,
      lastMsg: last,
      unread: list.filter((message) => !message.parsed_intent || message.parsed_intent === "incident" || message.parsed_intent === "task_request").length,
    };
  });

  const activeMessages = messages.filter((message) => message.chat_name === activeChat);

  const sendReply = async () => {
    if (!reply.trim() || !activeChat) return;
    setSending(true);
    try {
      const last = messages.filter((message) => message.chat_name === activeChat).slice(-1)[0];
      const channel = last?.channel || "telegram";
      const functionName = channel === "telegram" ? "telegram-webhook" : "whatsapp-send";
      const body = channel === "telegram"
        ? { action: "send", chat_id: last?.raw?._chat_id || last?.raw?.message?.chat?.id || "", text: reply }
        : { chat_id: last?.raw?.senderData?.chatId || last?.raw?.chatId || "", message: reply };

      const { error } = await supabase.functions.invoke(functionName, { body });
      if (error) throw error;

      await supabase.from("chat_messages").insert({
        channel,
        chat_name: activeChat,
        sender_name: "Mektep AI",
        content: reply,
        parsed_intent: "ai_reply",
      });

      toast.success("Отправлено");
      setReply("");
      await load();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSending(false);
    }
  };

  const aiAutoReply = async () => {
    if (!activeChat) return;
    setSending(true);
    try {
      const recent = activeMessages.slice(-5).map((message) => ({ role: message.sender_name === "Mektep AI" ? "assistant" : "user", content: `${message.sender_name}: ${message.content}` }));
      const { data, error } = await supabase.functions.invoke("ai-orchestrator", {
        body: { messages: [...recent, { role: "user", content: "Сформулируй короткий профессиональный ответ от имени директора: 1-2 предложения, по-русски, без лишней воды." }] },
      });
      if (error) throw error;
      setReply(data.content || "");
      toast.success("AI предложил ответ — нажмите «Отправить»");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 h-[calc(100vh-4rem)] flex flex-col">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-extrabold flex items-center gap-3">
              <MessageSquare className="h-8 w-8 text-primary" /> Чаты Telegram & WhatsApp
              <Badge className="bg-success text-success-foreground gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-success-foreground animate-pulse" /> LIVE
              </Badge>
            </h1>
            <p className="text-muted-foreground mt-1">{messages.length} сообщений, AI парсит посещаемость, инциденты и задачи</p>
          </div>
          <Button variant="outline" size="sm" className="gap-2" onClick={pollNow} disabled={sending}>
            <RefreshCw className="h-4 w-4" /> Обновить каналы
          </Button>
        </div>

        <div className="flex-1 grid lg:grid-cols-3 gap-4 min-h-0">
          <Card className="bg-gradient-card overflow-hidden flex flex-col">
            <div className="p-3 border-b border-border font-display font-bold">Чаты ({chatGroups.length})</div>
            <div className="overflow-y-auto flex-1">
              {chatGroups.map((group) => (
                <button
                  key={group.name}
                  onClick={() => setActiveChat(group.name!)}
                  className={`w-full text-left p-3 border-b border-border hover:bg-muted/50 transition-colors ${activeChat === group.name ? "bg-primary/10 border-l-4 border-l-primary" : ""}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline" className={`text-[9px] ${group.channel === "telegram" ? "border-primary/40 text-primary" : "border-success/40 text-success"}`}>
                      {group.channel === "telegram" ? "TG" : "WA"}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {group.lastMsg && new Date(group.lastMsg.created_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <div className="font-medium text-sm mt-1 truncate">{group.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{group.lastMsg?.content}</div>
                </button>
              ))}
            </div>
          </Card>

          <Card className="bg-gradient-card overflow-hidden flex flex-col lg:col-span-2">
            <div className="p-3 border-b border-border flex items-center justify-between">
              <div>
                <div className="font-display font-bold">{activeChat || "Выберите чат"}</div>
                <div className="text-xs text-muted-foreground">{activeMessages.length} сообщений</div>
              </div>
              <Button size="sm" variant="outline" onClick={aiAutoReply} disabled={sending} className="gap-1">
                <Bot className="h-3 w-3" /> AI ответ
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {activeMessages.map((message, index) => {
                const isAI = message.sender_name === "Mektep AI";
                return (
                  <motion.div key={message.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.02 }} className={`flex gap-2 ${isAI ? "justify-end" : ""}`}>
                    {!isAI && (
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                        {message.sender_name?.split(" ").map((part: string) => part[0]).slice(0, 2).join("")}
                      </div>
                    )}
                    <div className={`max-w-[75%] ${isAI ? "items-end" : ""}`}>
                      <div className="text-[10px] text-muted-foreground mb-0.5">
                        {message.sender_name} · {new Date(message.created_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                      </div>
                      <div className={`rounded-2xl px-3 py-2 text-sm ${isAI ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                        {message.content}
                      </div>
                      {message.parsed_intent && message.parsed_intent !== "other" && message.parsed_intent !== "ai_reply" && (
                        <div className="mt-1 flex items-center gap-1">
                          <Badge className={`text-[9px] ${
                            message.parsed_intent === "attendance" ? "bg-success/15 text-success" :
                            message.parsed_intent === "incident" ? "bg-destructive/15 text-destructive" :
                            "bg-secondary/20 text-secondary-foreground"
                          }`}>
                            🤖 AI: {message.parsed_intent}
                          </Badge>
                        </div>
                      )}
                    </div>
                    {isAI && (
                      <div className="h-8 w-8 rounded-full bg-gradient-gold flex items-center justify-center shrink-0">
                        <Bot className="h-4 w-4 text-primary-foreground" />
                      </div>
                    )}
                  </motion.div>
                );
              })}
              <div ref={endRef} />
            </div>

            <div className="p-3 border-t border-border flex gap-2">
              <Input
                value={reply}
                onChange={(event) => setReply(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && !sending && sendReply()}
                placeholder="Ответить от имени директора..."
                className="flex-1"
              />
              <Button onClick={sendReply} disabled={sending || !reply.trim()} className="gap-1">
                {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                Отправить
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
};

export default ChatsPage;
