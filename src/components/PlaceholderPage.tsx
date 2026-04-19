import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Sparkles } from "lucide-react";
import { ReactNode } from "react";

export const PlaceholderPage = ({ title, description, icon }: { title: string; description: string; icon?: ReactNode }) => (
  <AppLayout>
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-extrabold flex items-center gap-3">
          {icon}
          {title}
        </h1>
        <p className="text-muted-foreground mt-1">{description}</p>
      </div>
      <Card className="p-12 bg-gradient-card text-center border-dashed border-2">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-gold flex items-center justify-center shadow-gold mb-4">
          <Sparkles className="h-8 w-8 text-primary-foreground" />
        </div>
        <h2 className="font-display text-2xl font-bold mb-2">Раздел в разработке</h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          Этот модуль будет реализован на следующей итерации. Сейчас работают: Дашборд, Расписание (AI-генерация, drag&drop, heatmap, замены), AI-чат и Приказы.
        </p>
      </Card>
    </div>
  </AppLayout>
);
