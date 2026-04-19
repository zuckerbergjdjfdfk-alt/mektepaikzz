// Long-poll Telegram (вместо webhook). Запускается с фронта или по cron.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TG_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const TG_API = `https://api.telegram.org/bot${TG_TOKEN}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Получаем offset из notifications (используем последнюю запись tg_offset)
    const { data: offsetRow } = await sb.from("notifications")
      .select("payload").eq("type", "tg_offset").order("created_at", { ascending: false }).limit(1).maybeSingle();
    const offset = (offsetRow?.payload as any)?.update_id || 0;

    const r = await fetch(`${TG_API}/getUpdates?offset=${offset + 1}&timeout=20&allowed_updates=["message"]`);
    const data = await r.json();
    if (!data.ok) throw new Error(JSON.stringify(data));

    let lastId = offset;
    let processed = 0;

    for (const upd of data.result || []) {
      lastId = upd.update_id;
      const msg = upd.message;
      if (!msg) continue;
      
      // Перенаправляем в webhook
      await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/telegram-webhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}` },
        body: JSON.stringify(upd),
      });
      processed++;
    }

    if (lastId > offset) {
      await sb.from("notifications").insert({
        type: "tg_offset",
        title: "TG offset",
        payload: { update_id: lastId },
      });
    }

    return new Response(JSON.stringify({ ok: true, processed, lastId }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
