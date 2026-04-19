import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Action =
  | { action: "generate_schedule"; params?: any }
  | { action: "smart_substitute"; teacher_id: string; date?: string }
  | { action: "voice_to_tasks"; transcript: string; staff: any[] }
  | { action: "parse_attendance"; messages: { sender: string; text: string }[] }
  | { action: "parse_incident"; text: string; sender?: string }
  | { action: "generate_order"; template: any; context: string }
  | { action: "edit_order"; current: string; instruction: string }
  | { action: "explain_order"; text: string }
  | { action: "morning_summary"; attendance: any[] }
  | { action: "chat"; messages: { role: string; content: string }[] };

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = (await req.json()) as Action;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const callAI = async (
      messages: any[],
      opts: { tools?: any[]; tool_choice?: any; model?: string; jsonMode?: boolean } = {}
    ) => {
      const reqBody: any = {
        model: opts.model || "google/gemini-2.5-flash",
        messages,
      };
      if (opts.tools) {
        reqBody.tools = opts.tools;
        if (opts.tool_choice) reqBody.tool_choice = opts.tool_choice;
      } else if (opts.jsonMode) {
        reqBody.response_format = { type: "json_object" };
      }
      const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify(reqBody),
      });
      if (r.status === 429) throw new Error("Rate limit. Попробуйте через минуту.");
      if (r.status === 402) throw new Error("Закончились AI-кредиты. Пополните в Settings → Workspace → Usage.");
      if (!r.ok) throw new Error(`AI gateway: ${r.status} — ${await r.text()}`);
      return r.json();
    };

    let result: any = {};

    switch (body.action) {
      case "voice_to_tasks": {
        const staffList = body.staff.map((s: any) => `${s.full_name} (${s.role})`).join(", ");
        const sys = `Ты AI-завуч школы Aqbobek. Извлекаешь задачи из голосовой команды директора.
Доступные сотрудники: ${staffList}.
Возвращай ТОЛЬКО JSON со списком tasks: [{title, description, assignee_full_name, priority (low|normal|high|urgent), due_hint}]`;
        const ai = await callAI(
          [{ role: "system", content: sys }, { role: "user", content: body.transcript }],
          {
            tools: [{
              type: "function",
              function: {
                name: "create_tasks",
                description: "Извлечь задачи",
                parameters: {
                  type: "object",
                  properties: {
                    tasks: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          title: { type: "string" },
                          description: { type: "string" },
                          assignee_full_name: { type: "string" },
                          priority: { type: "string", enum: ["low", "normal", "high", "urgent"] },
                          due_hint: { type: "string" },
                        },
                        required: ["title", "assignee_full_name", "priority"],
                      },
                    },
                  },
                  required: ["tasks"],
                },
              },
            }],
            tool_choice: { type: "function", function: { name: "create_tasks" } },
          }
        );
        const args = JSON.parse(ai.choices[0].message.tool_calls[0].function.arguments);
        result = args;
        break;
      }

      case "parse_attendance": {
        const text = body.messages.map((m) => `${m.sender}: ${m.text}`).join("\n");
        const sys = `Извлеки данные о посещаемости из сообщений учителей. Формат: "1А - 25 детей, 1 болеет".`;
        const ai = await callAI([
          { role: "system", content: sys },
          { role: "user", content: text },
        ], {
          tools: [{
            type: "function",
            function: {
              name: "extract_attendance",
              parameters: {
                type: "object",
                properties: {
                  records: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        class_name: { type: "string" },
                        present: { type: "number" },
                        absent: { type: "number" },
                        sick: { type: "number" },
                      },
                      required: ["class_name", "present"],
                    },
                  },
                  total_present: { type: "number" },
                  cafeteria_message: { type: "string", description: "Готовая заявка завстоловой" },
                },
                required: ["records", "total_present", "cafeteria_message"],
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "extract_attendance" } },
        });
        result = JSON.parse(ai.choices[0].message.tool_calls[0].function.arguments);
        break;
      }

      case "parse_incident": {
        const ai = await callAI([
          { role: "system", content: "Извлеки инцидент из сообщения. Поля: title (короткое), description, location, priority (low|normal|high)." },
          { role: "user", content: body.text },
        ], {
          tools: [{
            type: "function",
            function: {
              name: "extract_incident",
              parameters: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  description: { type: "string" },
                  location: { type: "string" },
                  priority: { type: "string", enum: ["low", "normal", "high"] },
                  category: { type: "string" },
                },
                required: ["title", "priority"],
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "extract_incident" } },
        });
        result = JSON.parse(ai.choices[0].message.tool_calls[0].function.arguments);
        break;
      }

      case "generate_order": {
        const sys = `Ты юрист-методист школы. Используешь шаблон и контекст для генерации хирургически точного приказа на русском языке. Заполняй умными формулировками, добавляй ссылки на нормативку (Приказ МЗ РК №76, №110, Приказ МОН РК №130) где уместно. Возвращай готовый markdown.`;
        const ai = await callAI([
          { role: "system", content: sys },
          { role: "user", content: `Шаблон: ${body.template.title} (${body.template.code})\n\n${body.template.template_md}\n\nКонтекст от директора:\n${body.context}\n\nЗаполни шаблон, замени все {placeholder} на реальные значения, добавь профессиональные формулировки.` },
        ], { model: "google/gemini-2.5-pro" });
        result = { content: ai.choices[0].message.content };
        break;
      }

      case "edit_order": {
        const ai = await callAI([
          { role: "system", content: "Ты редактируешь приказ. Возвращай ТОЛЬКО полный обновлённый markdown приказа без пояснений." },
          { role: "user", content: `Текущий приказ:\n\n${body.current}\n\nИнструкция: ${body.instruction}` },
        ]);
        result = { content: ai.choices[0].message.content };
        break;
      }

      case "explain_order": {
        const ai = await callAI([
          { role: "system", content: "Ты переводишь чиновничий язык на простой русский для учителей. Объясняй пунктами." },
          { role: "user", content: body.text },
        ]);
        result = { content: ai.choices[0].message.content };
        break;
      }

      case "morning_summary": {
        const ai = await callAI([
          { role: "system", content: "Подготовь утренний свод для директора. Кратко, дружелюбно, с эмодзи. Включи: общее число присутствующих, отсутствующих, заявку в столовую, любые аномалии." },
          { role: "user", content: `Данные посещаемости: ${JSON.stringify(body.attendance)}` },
        ]);
        result = { content: ai.choices[0].message.content };
        break;
      }

      case "chat": {
        const sys = `Ты AI-завуч "Aqbobek AI". Помогаешь директору школы. Можешь:
- Объяснить приказы МЗ РК №76, №110, МОН РК №130 простым языком
- Подсказать как составить приказ
- Проанализировать посещаемость
- Предложить замены при болезни учителей
- Распарсить голосовые команды в задачи
Отвечай по-русски, дружелюбно, с конкретикой.`;
        const ai = await callAI([
          { role: "system", content: sys },
          ...body.messages,
        ]);
        result = { content: ai.choices[0].message.content };
        break;
      }

      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("ai-orchestrator error:", e);
    return new Response(JSON.stringify({ error: e.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
