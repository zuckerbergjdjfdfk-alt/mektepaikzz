Большой план — разбит на этапы. Подтвердите, и я выполню по порядку.

## 1. Ребрендинг → AISSchool
- Переименовать «Mektep AI» / «Aqbobek» → **AISSchool** во всех местах: `index.html` (title/meta), `SplashScreen`, `AppSidebar`, страницы, системные промпты edge-функций, тексты Telegram/WhatsApp ботов.

## 2. Дизайн: стеклянный минимализм + тёмная/светлая тема
- В `src/index.css` добавить glass-утилиты (`.glass`, `.glass-card`, `.glass-nav`) — `backdrop-blur`, полупрозрачный фон, тонкая рамка, мягкая тень.
- Уменьшить визуальный шум: убрать лишние градиенты на карточках, оставить акценты только на hero/CTA.
- Тема: добавить `ThemeProvider` (light/dark), переключатель в `ProfileMenu`. Хранить в `localStorage`. Класс `.dark` уже определён.

## 3. Локализация RU / KZ
- Подключить `react-i18next` + 2 словаря (`ru.json`, `kk.json`) с ключами для всех меню, заголовков страниц, кнопок, тостов.
- Переключатель языка в `ProfileMenu` (рядом с темой). Сохранять в `localStorage`.
- Переводим UI; пользовательские данные (имена, тексты приказов, чаты) остаются как есть.

## 4. Журнал приказов с версионированием
**Миграция БД:**
- Добавить в `generated_orders`: `version int default 1`, `parent_order_id uuid null`, `pdf_url_original text`, `pdf_url_current text`, `incident_id uuid null`, `absence_id uuid null`.
- Новая таблица `order_versions` (`order_id`, `version`, `content_md`, `pdf_url`, `created_at`, `note`).
- Storage bucket `orders` (public read) для PDF.

**UI `OrdersPage`:**
- Список приказов сгруппирован по дате; раскрытие → версии.
- Кнопки: «Скачать оригинал (v1)», «Скачать текущую версию», «Новая редакция» (создаёт новую версию + PDF).
- Поиск/фильтр по типу/дате.

## 5. Генерация PDF
- Edge-функция `order-to-pdf`: принимает `order_id` (или `markdown`), рендерит PDF через `npm:pdf-lib` + простой layout (заголовок, реквизиты школы, тело, подпись), грузит в bucket `orders/{order_id}/v{n}.pdf`, возвращает URL.
- Сохраняем оригинал при первом создании приказа, текущая версия обновляется при правках.

## 6. Кнопка «Сгенерировать приказ» в чате с ИИ
- В `AIChatPage` рядом с input — кнопка ⚡ «Сгенерировать приказ».
- Вызывает edge-функцию `order-from-text`: отправляет текст в Lovable AI, тот определяет `template_code` + заполняет `fields` (Output API структурированный), создаёт `generated_orders`, рендерит PDF, возвращает превью + ссылку.
- В чате появляется карточка с приказом и кнопками «Скачать PDF» / «Открыть в журнале».

## 7. Авто-приказ при отсутствии учителя
- В `telegram-webhook` и `whatsapp-webhook`, ветка `teacher_absence` после `smart-substitute`:
  1. Создать запись `teacher_absences` (новая таблица: `teacher_id`, `reason`, `date`, `substitutions jsonb`, `order_id`, `created_at`).
  2. Вызвать `ai-orchestrator` → `generate_order` с `template_code = 'substitution'`.
  3. Сгенерировать PDF через `order-to-pdf`, сохранить URL.
  4. Привязать `order_id` к каждой строке `schedule_slots` с `is_substitution=true` (новое поле `substitution_order_id`).
  5. Создать `notifications` тип `teacher_absence` с payload (учитель, причина, время, кол-во замен, order_id).

## 8. Карточка отсутствия на дашборде
- На главной (`Index.tsx`) — секция «Отсутствия сегодня»: карточки из `teacher_absences` за сегодня с причиной, временем, списком замен и кнопкой «Открыть приказ (PDF)».
- Realtime-подписка на новые записи.

## 9. WhatsApp: привязка номеров и звонки
**Миграция:** в `staff` уже есть `whatsapp`. Добавить `profiles` (или поле в `staff` для директора) с собственным WhatsApp.
**UI `StaffPage`:** колонка «WhatsApp» с инпутом + кнопкой «Позвонить» (`https://wa.me/<номер>` или `whatsapp://send?phone=`).
**ProfilePage:** поле «Мой WhatsApp» — сохраняется в `profiles`.
Кнопка позвонить открывает WhatsApp-клиент (звонок инициируется в приложении WhatsApp; прямой call через API недоступен).

## 10. Тестирование всех разделов
После реализации прогоню через `supabase--test_edge_functions` и быстрый smoke по страницам (build + curl edge-функций).

## 11. HFC модуль
Отложен — реализуем после подтверждения базового пакета.

---

### Технические детали
- PDF: `pdf-lib` через `npm:` импорт в Deno; шрифт с поддержкой кириллицы (встрою `noto-sans` через base64 или `fontkit`).
- i18n: ключи в плоском JSON, hook `useTranslation`.
- Glass: `backdrop-filter: blur(20px); background: hsl(var(--card)/0.6); border: 1px solid hsl(var(--border)/0.4);`

### Вопрос перед стартом
Запускать всё одним заходом (большой объём) или разбить на 2-3 итерации с показом прогресса? По умолчанию — иду подряд по пунктам 1-10.