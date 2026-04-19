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
import SubstitutionsPage from "./pages/SubstitutionsPage.tsx";
import IncidentsPage from "./pages/IncidentsPage.tsx";
import ChatsPage from "./pages/ChatsPage.tsx";
import NfcPage from "./pages/NfcPage.tsx";
import ReportsPage from "./pages/ReportsPage.tsx";
import { SplashScreen } from "./components/SplashScreen.tsx";
import { PlaceholderPage } from "./components/PlaceholderPage.tsx";
import { Users, GraduationCap, ClipboardList, BookOpen, Settings } from "lucide-react";

const queryClient = new QueryClient();

const App = () => {
  const [showSplash, setShowSplash] = useState(() => !sessionStorage.getItem("mektep_splash_seen"));
  const dismiss = () => {
    sessionStorage.setItem("mektep_splash_seen", "1");
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
            <Route path="/substitutions" element={<SubstitutionsPage />} />
            <Route path="/incidents" element={<IncidentsPage />} />
            <Route path="/chats" element={<ChatsPage />} />
            <Route path="/nfc" element={<NfcPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/staff" element={<PlaceholderPage title="Сотрудники" description="43 педагога Aqbobek Lyceum" icon={<Users className="h-8 w-8 text-primary" />} />} />
            <Route path="/classes" element={<PlaceholderPage title="Классы" description="13 классов 7-11" icon={<GraduationCap className="h-8 w-8 text-primary" />} />} />
            <Route path="/attendance" element={<PlaceholderPage title="Посещаемость" description="См. раздел AI-отчёты" icon={<BookOpen className="h-8 w-8 text-primary" />} />} />
            <Route path="/tasks" element={<PlaceholderPage title="Задачи" description="Голосовая постановка из AI-чата" icon={<ClipboardList className="h-8 w-8 text-primary" />} />} />
            <Route path="/settings" element={<PlaceholderPage title="Настройки" description="Telegram · Green API · профиль" icon={<Settings className="h-8 w-8 text-primary" />} />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
