import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users, Phone, MessageCircle, Send, PhoneCall } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { toast } from "sonner";

const cleanPhone = (raw?: string) => (raw || "").replace(/[^\d+]/g, "").replace(/^\+?/, "");

const StaffPage = () => {
  const [staff, setStaff] = useState<any[]>([]);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Record<string, string>>({});

  const load = () => supabase.from("staff").select("*").order("full_name").then(({ data }) => setStaff(data || []));

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return staff;
    return staff.filter((s) =>
      [s.full_name, s.role, ...(s.subjects || [])].join(" ").toLowerCase().includes(q)
    );
  }, [staff, query]);

  const saveWhatsApp = async (id: string) => {
    const value = (editing[id] ?? "").trim();
    const { error } = await supabase.from("staff").update({ whatsapp: value || null }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("WhatsApp сохранён");
    setEditing((s) => { const n = { ...s }; delete n[id]; return n; });
    load();
  };

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-display text-3xl font-extrabold flex items-center gap-3">
            <Users className="h-8 w-8 text-primary" /> Сотрудники
          </h1>
          <p className="text-muted-foreground mt-1">Привяжите WhatsApp учителей и звоните в один клик</p>
        </motion.div>

        <Card className="p-4 glass">
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск по ФИО, роли, предмету..." />
        </Card>

        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((person, i) => {
            const wa = cleanPhone(person.whatsapp);
            const isEditing = editing[person.id] !== undefined;
            return (
              <motion.div key={person.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}>
                <Card className="p-5 glass h-full">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={person.avatar_url || undefined} alt={person.full_name} />
                      <AvatarFallback>{person.full_name.split(" ").map((x: string) => x[0]).slice(0, 2).join("")}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="font-display font-bold leading-tight">{person.full_name}</div>
                      <div className="text-sm text-muted-foreground mt-1">{person.role}</div>
                    </div>
                    <Badge className={person.is_active ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"}>
                      {person.is_active ? "Активен" : "—"}
                    </Badge>
                  </div>

                  <div className="mt-4 space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground"><Phone className="h-4 w-4" /> {person.phone || "—"}</div>
                    <div className="flex items-center gap-2">
                      <MessageCircle className="h-4 w-4 text-success" />
                      {isEditing ? (
                        <>
                          <Input
                            value={editing[person.id]}
                            onChange={(e) => setEditing((s) => ({ ...s, [person.id]: e.target.value }))}
                            placeholder="+7 700 000 0000"
                            className="h-8 text-xs"
                          />
                          <Button size="sm" onClick={() => saveWhatsApp(person.id)}>OK</Button>
                        </>
                      ) : (
                        <>
                          <span className="flex-1 truncate">{person.whatsapp || "не привязан"}</span>
                          {wa ? (
                            <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer">
                              <Button size="sm" variant="outline" className="h-7 gap-1"><PhoneCall className="h-3 w-3" /> WA</Button>
                            </a>
                          ) : null}
                          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditing((s) => ({ ...s, [person.id]: person.whatsapp || "" }))}>
                            {person.whatsapp ? "Изм." : "Привязать"}
                          </Button>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground"><Send className="h-4 w-4" /> {person.telegram_id || "нет Telegram"}</div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {(person.subjects || []).slice(0, 6).map((subject: string) => (
                      <Badge key={subject} variant="outline">{subject}</Badge>
                    ))}
                  </div>

                  <div className="mt-4 text-xs text-muted-foreground">
                    Нагрузка: <span className="font-medium text-foreground">{person.weekly_hours || 0} ч/нед</span>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
};

export default StaffPage;
