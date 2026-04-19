import { Card } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export const StatCard = ({
  icon: Icon, label, value, trend, accent = "primary", subtitle,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  trend?: string;
  accent?: "primary" | "gold" | "success" | "destructive";
  subtitle?: string;
}) => {
  const accentMap = {
    primary: "bg-primary/10 text-primary",
    gold: "bg-secondary/15 text-secondary",
    success: "bg-success/10 text-success",
    destructive: "bg-destructive/10 text-destructive",
  };
  return (
    <Card className="p-5 bg-gradient-card hover:shadow-elegant transition-all duration-300 border-border/50">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground font-medium">{label}</p>
          <p className="mt-2 text-3xl font-display font-bold text-foreground">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          {trend && <p className="text-xs text-success mt-2 font-medium">{trend}</p>}
        </div>
        <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl shrink-0", accentMap[accent])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
};
