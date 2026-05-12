// Отправка WhatsApp сообщений через Green API
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function getCreds() {
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data } = await sb.from("app_profile").select("metadata").eq("key", "default").maybeSingle();
  const cfg = data?.metadata?.whatsapp || {};
  return {
    instance_id: cfg.instance_id || Deno.env.get("GREEN_API_INSTANCE_ID") || "",
    token: cfg.token || Deno.env.get("GREEN_API_TOKEN") || "",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const { chat_id, message, phone } = await req.json();
    const { instance_id, token } = await getCreds();
    if (!instance_id || !token) throw new Error("Green API не настроен (Settings → WhatsApp)");

    const targetChatId = chat_id || (phone ? `${phone.replace(/\D/g, "")}@c.us` : null);
    if (!targetChatId) throw new Error("chat_id или phone обязателен");

    const url = `https://api.green-api.com/waInstance${instance_id}/sendMessage/${token}`;
    const r = await fetch(url, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId: targetChatId, message }),
    });
    const data = await r.json();
    return new Response(JSON.stringify({ ok: r.ok, data }), {
      status: r.ok ? 200 : 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
