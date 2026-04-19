// Long-polling Green API: получаем входящие сообщения и обрабатываем как webhook
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const instanceId = Deno.env.get("GREEN_API_INSTANCE_ID")!;
    const token = Deno.env.get("GREEN_API_TOKEN")!;
    
    let processed = 0;
    const start = Date.now();
    
    // Polling loop до 25 секунд
    while (Date.now() - start < 25000) {
      const r = await fetch(`https://api.green-api.com/waInstance${instanceId}/receiveNotification/${token}`);
      if (!r.ok) break;
      const notif = await r.json();
      if (!notif || !notif.body) break;

      const body = notif.body;
      // Обрабатываем как webhook
      if (body.typeWebhook === "incomingMessageReceived") {
        const text = body.messageData?.textMessageData?.textMessage 
          || body.messageData?.extendedTextMessageData?.text || "";
        const senderName = body.senderData?.senderName || "Unknown";
        const chatName = body.senderData?.chatName || senderName;
        
        await sb.from("chat_messages").insert({
          channel: "whatsapp",
          chat_name: chatName,
          sender_name: senderName,
          content: text,
          raw: body,
        });
        processed++;
      }
      
      // Удаляем notification из очереди
      await fetch(`https://api.green-api.com/waInstance${instanceId}/deleteNotification/${token}/${notif.receiptId}`, {
        method: "DELETE",
      });
    }
    
    return new Response(JSON.stringify({ ok: true, processed }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
