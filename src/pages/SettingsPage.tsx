import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Settings, Bot, MessageSquare, Bell } from "lucide-react";

const SettingsPage = () => {
  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6">
        <div>
          <h1 className="font-display text-3xl font-extrabold flex items-center gap-3">
            <Settings className="h-8 w-8 text-primary" /> Настройки
          </h1>
          <p className="text-muted-foreground mt-1">Статус интеграций и системных модулей Mektep AI</p>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <Card className="p-5 bg-gradient-card">
            <div className="flex items-center gap-2 font-display font-bold"><Bot className="h-5 w-5 text-primary" /> AI</div>
            <div className="mt-3"><Badge className="bg-success text-success-foreground">Подключен</Badge></div>
            <p className="mt-3 text-sm text-muted-foreground">AI-чат, генерация расписания, приказы и отчёты работают через backend-функции.</p>
          </Card>
          <Card className="p-5 bg-gradient-card">
            <div className="flex items-center gap-2 font-display font-bold"><MessageSquare className="h-5 w-5 text-primary" /> Мессенджеры</div>
            <div className="mt-3 flex gap-2"><Badge className="bg-success text-success-foreground">WhatsApp</Badge><Badge className="bg-success text-success-foreground">Telegram</Badge></div>
            <p className="mt-3 text-sm text-muted-foreground">Входящие сообщения попадают в чаты, инциденты, задачи и AI-отчёты.</p>
          </Card>
          <Card className="p-5 bg-gradient-card">
            <div className="flex items-center gap-2 font-display font-bold"><Bell className="h-5 w-5 text-primary" /> Уведомления</div>
            <div className="mt-3"><Badge className="bg-success text-success-foreground">Realtime</Badge></div>
            <p className="mt-3 text-sm text-muted-foreground">Утренний свод, замены, инциденты и служебные события отображаются в общей ленте.</p>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
};

export default SettingsPage;
