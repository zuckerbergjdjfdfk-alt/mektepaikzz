import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Ты — AI-завуч школы Mektep AI, г. Актобе, Казахстан. Главный пользователь — директор Айгуль Серикбаевна.

ЛИЧНОСТЬ:
- Профессиональный, уважительный, лаконичный.
- Отвечаешь по-русски, при необходимости можешь использовать казахский.
- Если пользователь просит действие по расписанию, замене, приказу, отчёту, чатам — помогай как операционный AI школы.

ИНСТРУМЕНТЫ:
1. create_tasks — создать задачи из команды
2. generate_schedule — сгенерировать школьное расписание
3. find_substitute — найти замену учителю
4. generate_order — создать официальный приказ по шаблону
5. morning_digest — сформировать утренний свод
6. send_whatsapp — отправить сообщение в WhatsApp
7. send_telegram — отправить сообщение в Telegram

ПРАВИЛА:
- Если пользователь просит сгенерировать расписание, вызывай generate_schedule без лишних уточнений.
- Если пользователь просит утренний свод или отчёт, вызывай morning_digest без лишних уточнений.
- Если пользователь просит официальный приказ, помогай в деловом стиле Казахстана.
- После выполненного действия отвечай коротко и по делу.
- Не выдумывай данные о сотрудниках и классах.`;

const VOICE_HINT = "\n\nВАЖНО: ответ голосовой — максимум 2 коротких предложения, без markdown и списков.";

const TOOLS = [
  { type: "function", function: { name: "create_tasks", description: "Создать задачи из голосовой команды.", parameters: { type: "object", properties: { tasks: { type: "array", items: { type: "object", properties: { title: { type: "string" }, description: { type: "string" }, assignee_name: { type: "string" }, priority: { type: "string", enum: ["low", "normal", "high"] }, due_hint: { type: "string" } }, required: ["title", "assignee_name", "priority"] } } }, required: ["tasks"] } } },
  { type: "function", function: { name: "generate_schedule", description: "Сгенерировать полное расписание с лентами и балансировкой нагрузки.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "find_substitute", description: "Найти замену учителю.", parameters: { type: "object", properties: { teacher_name: { type: "string" }, day_of_week: { type: "number" } }, required: ["teacher_name"] } } },
  { type: "function", function: { name: "generate_order", description: "Сгенерировать приказ по коду шаблона и полям.", parameters: { type: "object", properties: { template_code: { type: "string" }, fields: { type: "object" } }, required: ["template_code", "fields"] } } },
  { type: "function", function: { name: "morning_digest", description: "Утренний свод по школе.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "send_whatsapp", description: "Отправить WhatsApp сообщение.", parameters: { type: "object", properties: { chat_id: { type: "string" }, phone: { type: "string" }, message: { type: "string" } }, required: ["message"] } } },
  { type: "function", function: { name: "send_telegram", description: "Отправить Telegram сообщение.", parameters: { type: "object", properties: { chat_id: { type: "string" }, message: { type: "string" } }, required: ["chat_id", "message"] } } },
];

async function callTool(name: string, args: any, sb: any): Promise<string> {
  const backendUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const invoke = (fn: string, body?: any) => fetch(`${backendUrl}/functions/v1/${fn}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${anonKey}` },
    body: JSON.stringify(body || {}),
  }).then(async (response) => await response.text());

  if (name === "create_tasks") {
    const { data: staff } = await sb.from("staff").select("id, full_name");
    const created: any[] = [];
    for (const task of args.tasks || []) {
      const first = (task.assignee_name || "").toLowerCase().split(" ")[0];
      const matched = staff?.find((person: any) => person.full_name.toLowerCase().includes(first));
      const { data } = await sb.from("tasks").insert({
        title: task.title,
        description: task.description || "",
        assignee_id: matched?.id,
        priority: task.priority || "normal",
        source: "voice",
      }).select().single();
      created.push({ ...data, assignee: matched?.full_name || task.assignee_name });
    }
    return JSON.stringify({ ok: true, count: created.length, tasks: created });
  }

  if (name === "generate_schedule") return await invoke("schedule-generator", { mode: "ai", ...(args || {}) });
  if (name === "find_substitute") return await invoke("smart-substitute", args);
  if (name === "morning_digest") return await invoke("morning-digest");
  if (name === "send_whatsapp") return await invoke("whatsapp-send", args);
  if (name === "send_telegram") return await invoke("telegram-webhook", { action: "send", chat_id: args.chat_id, text: args.message });

  if (name === "generate_order") {
    const { data: template } = await sb.from("order_templates").select("*").eq("code", args.template_code).maybeSingle();
    if (!template) return JSON.stringify({ error: `Шаблон ${args.template_code} не найден` });

    let content = template.template_md;
    for (const [key, value] of Object.entries(args.fields || {})) {
      content = content.replaceAll(`{${key}}`, String(value));
    }

    const { data: order } = await sb.from("generated_orders").insert({
      template_id: template.id,
      title: template.title,
      content_md: content,
      metadata: { fields: args.fields },
    }).select().single();

    return JSON.stringify({ ok: true, order_id: order?.id, preview: content.slice(0, 300) });
  }

  return JSON.stringify({ error: `Unknown tool: ${name}` });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json();
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;
    const messages = body.messages || (body.transcript ? [{ role: "user", content: body.transcript }] : []);

    if (messages.length === 0) {
      return new Response(JSON.stringify({ error: "messages required" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }

    let conversation: any[] = [{ role: "system", content: SYSTEM_PROMPT + (body.voice_mode ? VOICE_HINT : "") }, ...messages];

    for (let step = 0; step < 4; step++) {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${lovableApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-pro",
          messages: conversation,
          tools: TOOLS,
          temperature: body.voice_mode ? 0.3 : 0.55,
          max_tokens: 4096,
        }),
      });

      if (response.status === 429) return new Response(JSON.stringify({ error: "Лимит Lovable AI. Подождите минуту." }), { status: 429, headers: { ...cors, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "Кредиты Lovable AI закончились." }), { status: 402, headers: { ...cors, "Content-Type": "application/json" } });

      const data = await response.json();
      const message = data.choices?.[0]?.message;
      if (!message) throw new Error("No AI response");

      if (message.tool_calls?.length) {
        conversation.push(message);
        for (const toolCall of message.tool_calls) {
          let args = {};
          try {
            args = JSON.parse(toolCall.function.arguments || "{}");
          } catch {
            args = {};
          }
          const result = await callTool(toolCall.function.name, args, sb);
          conversation.push({ role: "tool", tool_call_id: toolCall.id, content: result });
        }
        continue;
      }

      return new Response(JSON.stringify({ content: message.content, tasks: [] }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ content: "Слишком много шагов." }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (error: any) {
    console.error("ai-orchestrator:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
