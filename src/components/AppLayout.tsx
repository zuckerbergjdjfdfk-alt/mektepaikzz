import { ReactNode, useEffect, useRef } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "react-router-dom";
import { NotificationsBell } from "./NotificationsBell";
import { ProfileMenu } from "./ProfileMenu";
import { VoiceAssistant } from "./VoiceAssistant";
import { supabase } from "@/integrations/supabase/client";

export const AppLayout = ({ children }: { children: ReactNode }) => {
  const syncingRef = useRef(false);

  useEffect(() => {
    const syncChats = async () => {
      if (syncingRef.current || document.hidden) return;
      syncingRef.current = true;
      try {
        await Promise.allSettled([
          supabase.functions.invoke("telegram-poll", { body: {} }),
          supabase.functions.invoke("whatsapp-poll", { body: {} }),
        ]);
      } finally {
        syncingRef.current = false;
      }
    };

    syncChats();
    const intervalId = window.setInterval(syncChats, 30000);
    const handleVisibility = () => {
      if (!document.hidden) syncChats();
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  return (
    <SidebarProvider defaultOpen>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-xl">
            <SidebarTrigger className="text-foreground" />
            <div className="flex-1 flex items-center gap-3 max-w-xl">
              <div className="relative w-full">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Поиск по сотрудникам, классам, приказам..."
                  className="pl-9 bg-muted/40 border-transparent focus-visible:bg-background"
                />
              </div>
            </div>
            <Link to="/ai-chat">
              <Button variant="outline" size="sm" className="gap-2 hidden sm:flex">
                <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
                AI онлайн
              </Button>
            </Link>
            <NotificationsBell />
            <ProfileMenu />
          </header>
          <main className="flex-1 overflow-x-hidden">{children}</main>
        </div>
        <VoiceAssistant />
      </div>
    </SidebarProvider>
  );
};
