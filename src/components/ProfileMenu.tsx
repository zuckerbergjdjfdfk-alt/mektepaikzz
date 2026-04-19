import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Crown, LogOut, Settings, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

export const ProfileMenu = () => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="gap-2 h-10 px-2">
          <Avatar className="h-8 w-8 ring-2 ring-secondary/40">
            <AvatarFallback className="bg-gradient-gold text-primary-foreground font-bold text-xs">АС</AvatarFallback>
          </Avatar>
          <div className="text-left hidden md:block">
            <div className="text-sm font-semibold leading-tight">Айгуль С.</div>
            <div className="text-[10px] text-muted-foreground leading-tight flex items-center gap-1">
              <Crown className="h-2.5 w-2.5 text-secondary" /> Директор
            </div>
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="p-3">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12 ring-2 ring-secondary">
              <AvatarFallback className="bg-gradient-gold text-primary-foreground font-bold">АС</AvatarFallback>
            </Avatar>
            <div>
              <div className="font-display font-bold">Айгуль Серикбаевна</div>
              <div className="text-xs text-muted-foreground">Директор Aqbobek Lyceum</div>
              <div className="text-[10px] text-secondary mt-0.5 flex items-center gap-1">
                <Shield className="h-2.5 w-2.5" /> Полный доступ
              </div>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <Settings className="h-4 w-4 mr-2" /> Настройки профиля
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Crown className="h-4 w-4 mr-2" /> Стаж: 18 лет · Тариф: Премиум
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive">
          <LogOut className="h-4 w-4 mr-2" /> Выйти
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
