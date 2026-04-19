import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import SchedulePage from "./pages/SchedulePage.tsx";
import AIChatPage from "./pages/AIChatPage.tsx";
import OrdersPage from "./pages/OrdersPage.tsx";
import { SplashScreen } from "./components/SplashScreen.tsx";
import { PlaceholderPage } from "./components/PlaceholderPage.tsx";
import { Users, GraduationCap, ClipboardList, AlertTriangle, MessageSquare, BookOpen, Radio, Settings } from "lucide-react";

const queryClient = new QueryClient();

const App = () => {
  const [showSplash, setShowSplash] = useState(() => !sessionStorage.getItem("aqbobek_splash_seen"));

  const dismiss = () => {
    sessionStorage.setItem("aqbobek_splash_seen", "1");
    setShowSplash(false);
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner position="top-right" richColors />
        <AnimatePresence>{showSplash && <SplashScreen onDone={dismiss} />}</AnimatePresence>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/schedule" element={<SchedulePage />} />
            <Route path="/ai-chat" element={<AIChatPage />} />
            <Route path="/orders" element={<OrdersPage />} />
            <Route path="/staff" element={<PlaceholderPage title="Сотрудники" description="20 сотрудников школы" icon={<Users className="h-8 w-8 text-primary" />} />} />
            <Route path="/classes" element={<PlaceholderPage title="Классы" description="12 классов 1-4" icon={<GraduationCap className="h-8 w-8 text-primary" />} />} />
            <Route path="/attendance" element={<PlaceholderPage title="Посещаемость" description="Учёт по классам и NFC" icon={<BookOpen className="h-8 w-8 text-primary" />} />} />
            <Route path="/tasks" element={<PlaceholderPage title="Задачи" description="Голосовая постановка задач" icon={<ClipboardList className="h-8 w-8 text-primary" />} />} />
            <Route path="/incidents" element={<PlaceholderPage title="Инциденты" description="Из чатов TG/WA" icon={<AlertTriangle className="h-8 w-8 text-primary" />} />} />
            <Route path="/chats" element={<PlaceholderPage title="Чаты Telegram/WhatsApp" description="История диалогов с учителями" icon={<MessageSquare className="h-8 w-8 text-primary" />} />} />
            <Route path="/nfc" element={<PlaceholderPage title="NFC журнал" description="Сканирование карт учеников" icon={<Radio className="h-8 w-8 text-primary" />} />} />
            <Route path="/settings" element={<PlaceholderPage title="Настройки" description="Telegram, Green API (WhatsApp), профиль" icon={<Settings className="h-8 w-8 text-primary" />} />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
