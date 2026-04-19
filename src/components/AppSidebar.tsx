import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Calendar, Users, GraduationCap, ClipboardList,
  AlertTriangle, MessageSquare, FileText, Bot, Radio, Settings, Sparkles, BookOpen
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";

const mainItems = [
  { title: "Главная", url: "/", icon: LayoutDashboard },
  { title: "Расписание", url: "/schedule", icon: Calendar, badge: "AI" },
  { title: "Сотрудники", url: "/staff", icon: Users },
  { title: "Классы", url: "/classes", icon: GraduationCap },
  { title: "Посещаемость", url: "/attendance", icon: BookOpen },
];

const opsItems = [
  { title: "Задачи", url: "/tasks", icon: ClipboardList },
  { title: "Замены", url: "/substitutions", icon: Users, badge: "AI" },
  { title: "Инциденты", url: "/incidents", icon: AlertTriangle },
  { title: "Чаты TG/WA", url: "/chats", icon: MessageSquare },
  { title: "NFC журнал", url: "/nfc", icon: Radio },
];

const aiItems = [
  { title: "AI-чат", url: "/ai-chat", icon: Bot, badge: "★" },
  { title: "Приказы", url: "/orders", icon: FileText },
  { title: "AI-отчёты", url: "/reports", icon: BookOpen },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();

  const renderItem = (item: typeof mainItems[number] & { badge?: string }) => {
    const active = location.pathname === item.url;
    return (
      <SidebarMenuItem key={item.url}>
        <SidebarMenuButton asChild className={active ? "bg-sidebar-accent text-sidebar-primary-foreground font-semibold" : ""}>
          <NavLink to={item.url} end className="flex items-center gap-3">
            <item.icon className="h-4 w-4 shrink-0" />
            {!collapsed && (
              <>
                <span className="flex-1">{item.title}</span>
                {item.badge && (
                  <span className="rounded-md bg-secondary px-1.5 py-0.5 text-[10px] font-bold text-secondary-foreground">
                    {item.badge}
                  </span>
                )}
              </>
            )}
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar collapsible="icon" className="border-r-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border px-4 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-gold shadow-gold">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div>
              <div className="font-display text-lg font-bold text-sidebar-foreground">Mektep AI</div>
              <div className="text-[11px] text-sidebar-foreground/60">Aqbobek Lyceum</div>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-3">
        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel>Управление</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>{mainItems.map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel>Операции</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>{opsItems.map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel>AI инструменты</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>{aiItems.map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <NavLink to="/settings" className="flex items-center gap-3">
                <Settings className="h-4 w-4" />
                {!collapsed && <span>Настройки</span>}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
