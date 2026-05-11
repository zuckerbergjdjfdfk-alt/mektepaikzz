import { createContext, useContext, useState, ReactNode } from "react";

type Lang = "ru" | "kk";

const dict = {
  ru: {
    "nav.main": "Управление",
    "nav.ops": "Операции",
    "nav.ai": "AI инструменты",
    "nav.home": "Главная",
    "nav.schedule": "Расписание",
    "nav.staff": "Сотрудники",
    "nav.classes": "Классы",
    "nav.attendance": "Посещаемость",
    "nav.tasks": "Задачи",
    "nav.subs": "Замены",
    "nav.incidents": "Инциденты",
    "nav.chats": "Чаты TG/WA",
    "nav.nfc": "NFC журнал",
    "nav.aichat": "AI-чат",
    "nav.orders": "Приказы",
    "nav.reports": "AI-отчёты",
    "nav.settings": "Настройки",
    "common.theme": "Тема",
    "common.language": "Язык",
    "common.dark": "Тёмная",
    "common.light": "Светлая",
    "common.absences_today": "Отсутствия сегодня",
    "common.no_absences": "Сегодня все на месте",
    "common.open_pdf": "Открыть PDF",
    "common.original": "Оригинал",
    "common.current": "Текущая версия",
    "common.new_revision": "Новая редакция",
    "common.versions": "Версии",
    "common.generate_order": "Сгенерировать приказ",
    "common.school": "Школа AISSchool",
    "common.director": "Директор",
    "common.call_whatsapp": "WhatsApp",
    "common.my_whatsapp": "Мой WhatsApp",
    "orders.history": "Журнал приказов",
  },
  kk: {
    "nav.main": "Басқару",
    "nav.ops": "Операциялар",
    "nav.ai": "AI құралдары",
    "nav.home": "Басты бет",
    "nav.schedule": "Кесте",
    "nav.staff": "Қызметкерлер",
    "nav.classes": "Сыныптар",
    "nav.attendance": "Қатысу",
    "nav.tasks": "Тапсырмалар",
    "nav.subs": "Алмастырулар",
    "nav.incidents": "Оқиғалар",
    "nav.chats": "TG/WA чаттар",
    "nav.nfc": "NFC журналы",
    "nav.aichat": "AI чат",
    "nav.orders": "Бұйрықтар",
    "nav.reports": "AI есептер",
    "nav.settings": "Баптаулар",
    "common.theme": "Тақырып",
    "common.language": "Тіл",
    "common.dark": "Қараңғы",
    "common.light": "Жарық",
    "common.absences_today": "Бүгінгі болмаушылар",
    "common.no_absences": "Бүгін барлығы орнында",
    "common.open_pdf": "PDF ашу",
    "common.original": "Түпнұсқа",
    "common.current": "Ағымдағы нұсқа",
    "common.new_revision": "Жаңа редакция",
    "common.versions": "Нұсқалар",
    "common.generate_order": "Бұйрық жасау",
    "common.school": "AISSchool мектебі",
    "common.director": "Директор",
    "common.call_whatsapp": "WhatsApp",
    "common.my_whatsapp": "Менің WhatsApp",
    "orders.history": "Бұйрықтар журналы",
  },
} as const;

const I18nContext = createContext<{ lang: Lang; t: (k: keyof typeof dict.ru) => string; setLang: (l: Lang) => void }>({
  lang: "ru",
  t: (k) => k,
  setLang: () => {},
});

export const I18nProvider = ({ children }: { children: ReactNode }) => {
  const [lang, setLangState] = useState<Lang>(() => (localStorage.getItem("aiss_lang") as Lang) || "ru");
  const setLang = (l: Lang) => {
    localStorage.setItem("aiss_lang", l);
    setLangState(l);
  };
  const t = (k: keyof typeof dict.ru) => dict[lang][k] ?? dict.ru[k] ?? k;
  return <I18nContext.Provider value={{ lang, t, setLang }}>{children}</I18nContext.Provider>;
};

export const useI18n = () => useContext(I18nContext);
