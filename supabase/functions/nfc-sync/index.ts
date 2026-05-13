import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const EXT_URL = Deno.env.get("EXTERNAL_NFC_SUPABASE_URL");
    const EXT_KEY = Deno.env.get("EXTERNAL_NFC_SUPABASE_KEY");
    const EXT_TABLE = Deno.env.get("EXTERNAL_NFC_TABLE") || "scans";
    if (!EXT_URL || !EXT_KEY) throw new Error("External NFC Supabase secrets not configured");

    const ext = createClient(EXT_URL, EXT_KEY, { auth: { persistSession: false } });
    const own = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    // Get last sync cursor
    const { data: cursorRow } = await own
      .from("app_profile")
      .select("metadata")
      .eq("key", "nfc_sync_cursor")
      .maybeSingle();
    const since = cursorRow?.metadata?.last_at || new Date(Date.now() - 24 * 3600 * 1000).toISOString();

    // Pull from external
    const { data: rows, error } = await ext
      .from(EXT_TABLE)
      .select("*")
      .gt("scanned_at", since)
      .order("scanned_at", { ascending: true })
      .limit(500);
    if (error) throw error;

    let inserted = 0;
    let lastAt = since;
    for (const r of rows || []) {
      const cardId = r.card_id ?? r.uid ?? r.tag_id ?? r.card ?? null;
      const studentName = r.student_name ?? r.name ?? r.student ?? "Unknown";
      const scannedAt = r.scanned_at ?? r.created_at ?? new Date().toISOString();
      const scanType = r.scan_type ?? r.type ?? "entry";
      if (!cardId) continue;

      // Dedup by card_id + scanned_at
      const { data: existing } = await own
        .from("nfc_scans")
        .select("id")
        .eq("card_id", String(cardId))
        .eq("scanned_at", scannedAt)
        .maybeSingle();
      if (existing) { lastAt = scannedAt; continue; }

      const { error: insErr } = await own.from("nfc_scans").insert({
        card_id: String(cardId),
        student_name: String(studentName),
        scan_type: String(scanType),
        scanned_at: scannedAt,
      });
      if (!insErr) inserted++;
      lastAt = scannedAt;
    }

    const cursorPayload = { metadata: { last_at: lastAt, updated_at: new Date().toISOString() } };
    if (cursorRow) {
      await own.from("app_profile").update(cursorPayload).eq("key", "nfc_sync_cursor");
    } else {
      await own.from("app_profile").insert({ key: "nfc_sync_cursor", ...cursorPayload });
    }

    return new Response(
      JSON.stringify({ ok: true, fetched: rows?.length || 0, inserted, last_at: lastAt }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
