// AI-powered: take free text → determine template → fill fields → create order + PDF.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json();
    const text: string = (body.text || "").trim();
    if (!text) throw new Error("text required");

    const { data: templates } = await sb.from("order_templates").select("code, title, category, description, template_md");
    const today = new Date().toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
    const orderNo = `${Math.floor(100 + Math.random() * 900)}-АЛ`;

    const templatesList = (templates || []).map((t) => `- ${t.code}: ${t.title}${t.description ? " — " + t.description : ""}`).join("\n");

    const prompt = `Ты — помощник директора школы AISSchool (г. Актобе, Казахстан). На основе текста запроса:
1) Определи подходящий код шаблона приказа из списка (или используй "general", если ничего не подходит).
2) Сгенерируй готовый официальный приказ в markdown по казахстанскому деловому стандарту.

Доступные шаблоны:
${templatesList || "- general: Общий приказ"}

Запрос директора:
"""
${text}
"""

Дата: ${today}. Номер: №${orderNo}.

Структура приказа обязательна:
# ПРИКАЗ №${orderNo}
## КГУ «AISSchool», г. Актобе
## от ${today}
### О <тема в одной строке>

Основание: <если упомянуто в запросе, иначе нейтральная формулировка>.

ПРИКАЗЫВАЮ:

1. <пункт>
2. <пункт>
3. Контроль за исполнением настоящего приказа возложить на <ФИО или "себя">.

Директор школы AISSchool ___________________ Бекзат Сапаргалиевна

Верни ответ строго в JSON:
{"template_code":"<код>","title":"<краткое название приказа>","markdown":"<полный текст приказа>"}
Без markdown-обёртки, только чистый JSON.`;

    const aiKey = Deno.env.get("LOVABLE_API_KEY")!;
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${aiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.4,
        max_tokens: 3000,
      }),
    });
    if (aiResp.status === 429) return new Response(JSON.stringify({ error: "Rate limit. Подождите." }), { status: 429, headers: { ...cors, "Content-Type": "application/json" } });
    if (aiResp.status === 402) return new Response(JSON.stringify({ error: "Кредиты Lovable AI закончились." }), { status: 402, headers: { ...cors, "Content-Type": "application/json" } });

    const aiData = await aiResp.json();
    const raw = aiData.choices?.[0]?.message?.content || "{}";
    const cleaned = raw.replace(/```json\n?|```/g, "").trim();
    let parsed: any = {};
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = { template_code: "general", title: "Приказ", markdown: cleaned };
    }

    const template = (templates || []).find((t) => t.code === parsed.template_code);
    const title = parsed.title || template?.title || "Приказ";
    const markdown = parsed.markdown || cleaned;

    // Create order
    const { data: order } = await sb.from("generated_orders").insert({
      template_id: template?.id ?? null,
      title,
      content_md: markdown,
      status: "draft",
      version: 1,
      order_no: orderNo,
      order_date: new Date().toISOString().slice(0, 10),
      metadata: { source_text: text, template_code: parsed.template_code },
    }).select().single();

    // Generate PDF
    const pdfResp = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/order-pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}` },
      body: JSON.stringify({ order_id: order!.id, is_original: true, note: "Оригинал (создан из чата)" }),
    });
    const pdfData = await pdfResp.json();

    return new Response(JSON.stringify({
      ok: true,
      order_id: order!.id,
      title,
      template_code: parsed.template_code,
      pdf_url: pdfData.pdf_url,
      preview: markdown.slice(0, 500),
    }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (error: any) {
    console.error("order-from-text error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
