import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PROFILE_KEY = "default";

async function loadConfig(sb: any) {
  const { data } = await sb.from("app_profile").select("metadata").eq("key", PROFILE_KEY).maybeSingle();
  const meta = data?.metadata || {};
  const cfg = meta.whatsapp || {};
  return {
    instance_id: cfg.instance_id || Deno.env.get("GREEN_API_INSTANCE_ID") || "",
    token: cfg.token || Deno.env.get("GREEN_API_TOKEN") || "",
    saved_at: cfg.saved_at || null,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || (req.method === "GET" ? "status" : "save");

    if (action === "status") {
      const cfg = await loadConfig(sb);
      let connected = false; let stateInstance: string | null = null; let phone: string | null = null;
      if (cfg.instance_id && cfg.token) {
        try {
          const r = await fetch(`https://api.green-api.com/waInstance${cfg.instance_id}/getStateInstance/${cfg.token}`);
          if (r.ok) {
            const d = await r.json();
            stateInstance = d?.stateInstance || null;
            connected = stateInstance === "authorized";
          }
          const r2 = await fetch(`https://api.green-api.com/waInstance${cfg.instance_id}/getSettings/${cfg.token}`);
          if (r2.ok) {
            const d2 = await r2.json();
            phone = d2?.wid || d2?.phone || null;
          }
        } catch {}
      }
      const webhook_url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/whatsapp-webhook`;
      return new Response(JSON.stringify({
        configured: !!(cfg.instance_id && cfg.token),
        instance_id: cfg.instance_id ? cfg.instance_id.slice(0, 4) + "***" : "",
        has_token: !!cfg.token,
        connected, stateInstance, phone, webhook_url, saved_at: cfg.saved_at,
      }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    const body = await req.json().catch(() => ({}));

    if (action === "save") {
      const { instance_id, token } = body;
      if (!instance_id || !token) throw new Error("instance_id и token обязательны");
      const { data: existing } = await sb.from("app_profile").select("id, metadata").eq("key", PROFILE_KEY).maybeSingle();
      const meta = { ...(existing?.metadata || {}), whatsapp: { instance_id, token, saved_at: new Date().toISOString() } };
      if (existing) await sb.from("app_profile").update({ metadata: meta }).eq("id", existing.id);
      else await sb.from("app_profile").insert({ key: PROFILE_KEY, metadata: meta });
      return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    if (action === "set_webhook") {
      const cfg = await loadConfig(sb);
      if (!cfg.instance_id || !cfg.token) throw new Error("Сначала сохраните Green API креды");
      const webhookUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/whatsapp-webhook`;
      const r = await fetch(`https://api.green-api.com/waInstance${cfg.instance_id}/setSettings/${cfg.token}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          webhookUrl, webhookUrlToken: "",
          incomingWebhook: "yes", outgoingMessageWebhook: "yes",
          outgoingAPIMessageWebhook: "yes", stateWebhook: "yes",
        }),
      });
      const d = await r.json();
      return new Response(JSON.stringify({ ok: r.ok, webhook_url: webhookUrl, response: d }), {
        status: r.ok ? 200 : 500, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    if (action === "test_send") {
      const cfg = await loadConfig(sb);
      const phone = (body.phone || "").replace(/\D/g, "");
      const message = body.message || "✅ AISSchool: тестовое сообщение от системы.";
      if (!cfg.instance_id || !cfg.token) throw new Error("Сначала сохраните Green API креды");
      if (!phone) throw new Error("phone обязателен");
      const r = await fetch(`https://api.green-api.com/waInstance${cfg.instance_id}/sendMessage/${cfg.token}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId: `${phone}@c.us`, message }),
      });
      const d = await r.json();
      return new Response(JSON.stringify({ ok: r.ok, response: d }), {
        status: r.ok ? 200 : 500, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
