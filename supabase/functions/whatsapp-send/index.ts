// Отправка WhatsApp сообщений через Green API
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const { chat_id, message, phone } = await req.json();
    const instanceId = Deno.env.get("GREEN_API_INSTANCE_ID")!;
    const token = Deno.env.get("GREEN_API_TOKEN")!;
    if (!instanceId || !token) throw new Error("Green API not configured");

    // chatId формата 77001234567@c.us
    const targetChatId = chat_id || (phone ? `${phone.replace(/\D/g, "")}@c.us` : null);
    if (!targetChatId) throw new Error("chat_id или phone обязателен");

    const url = `https://api.green-api.com/waInstance${instanceId}/sendMessage/${token}`;
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId: targetChatId, message }),
    });
    const data = await r.json();
    return new Response(JSON.stringify({ ok: r.ok, data }), {
      status: r.ok ? 200 : 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
