import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const instanceId = Deno.env.get("GREEN_API_INSTANCE_ID")!;
    const token = Deno.env.get("GREEN_API_TOKEN")!;
    const backendUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    let processed = 0;
    const start = Date.now();

    while (Date.now() - start < 25000) {
      const response = await fetch(`https://api.green-api.com/waInstance${instanceId}/receiveNotification/${token}`);
      if (!response.ok) break;
      const notification = await response.json();
      if (!notification?.body) break;

      await fetch(`${backendUrl}/functions/v1/whatsapp-webhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${anonKey}` },
        body: JSON.stringify(notification.body),
      });
      processed++;

      await fetch(`https://api.green-api.com/waInstance${instanceId}/deleteNotification/${token}/${notification.receiptId}`, {
        method: "DELETE",
      });
    }

    return new Response(JSON.stringify({ ok: true, processed }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
