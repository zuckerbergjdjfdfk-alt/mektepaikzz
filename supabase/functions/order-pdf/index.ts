// Generate a PDF for an order, save to storage, return public URL.
// Supports cyrillic via Noto Sans embedded font.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, rgb } from "npm:pdf-lib@1.17.1";
import fontkit from "npm:@pdf-lib/fontkit@1.1.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FONT_URL = "https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts/hinted/ttf/NotoSans/NotoSans-Regular.ttf";
const FONT_BOLD_URL = "https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts/hinted/ttf/NotoSans/NotoSans-Bold.ttf";

let cachedRegular: Uint8Array | null = null;
let cachedBold: Uint8Array | null = null;

async function getFonts() {
  if (!cachedRegular) {
    const r = await fetch(FONT_URL);
    cachedRegular = new Uint8Array(await r.arrayBuffer());
  }
  if (!cachedBold) {
    const r = await fetch(FONT_BOLD_URL);
    cachedBold = new Uint8Array(await r.arrayBuffer());
  }
  return { regular: cachedRegular!, bold: cachedBold! };
}

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if ((line + " " + word).trim().length > maxChars) {
      if (line) lines.push(line);
      line = word;
    } else {
      line = (line + " " + word).trim();
    }
  }
  if (line) lines.push(line);
  return lines;
}

async function renderPdf(markdown: string, title: string): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit as any);
  const { regular, bold } = await getFonts();
  const font = await pdfDoc.embedFont(regular);
  const fontBold = await pdfDoc.embedFont(bold);

  const pageW = 595.28; // A4
  const pageH = 841.89;
  const margin = 70;
  const maxWidth = pageW - margin * 2;
  let page = pdfDoc.addPage([pageW, pageH]);
  let y = pageH - margin;

  const lineHeight = 16;
  const drawLine = (text: string, opts: { font?: any; size?: number; align?: "left" | "center"; gap?: number } = {}) => {
    const f = opts.font || font;
    const size = opts.size || 11;
    const lines = wrapText(text, Math.floor(maxWidth / (size * 0.45)));
    for (const ln of lines) {
      if (y < margin + lineHeight) {
        page = pdfDoc.addPage([pageW, pageH]);
        y = pageH - margin;
      }
      const w = f.widthOfTextAtSize(ln, size);
      const x = opts.align === "center" ? (pageW - w) / 2 : margin;
      page.drawText(ln, { x, y, size, font: f, color: rgb(0, 0, 0) });
      y -= size + 4;
    }
    y -= opts.gap ?? 4;
  };

  // Title
  drawLine(title, { font: fontBold, size: 16, align: "center", gap: 14 });

  // Body
  for (const rawLine of markdown.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    if (!line.trim()) {
      y -= 8;
      continue;
    }
    if (line.startsWith("# ")) {
      drawLine(line.slice(2), { font: fontBold, size: 14, align: "center", gap: 8 });
    } else if (line.startsWith("## ")) {
      drawLine(line.slice(3), { font: fontBold, size: 13, gap: 6 });
    } else if (line.startsWith("### ")) {
      drawLine(line.slice(4), { font: fontBold, size: 12, gap: 4 });
    } else {
      // remove markdown bold/italic markers
      const clean = line.replace(/\*\*(.*?)\*\*/g, "$1").replace(/\*(.*?)\*/g, "$1").replace(/`(.*?)`/g, "$1");
      drawLine(clean, { size: 11 });
    }
  }

  return await pdfDoc.save();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json();
    const orderId: string | undefined = body.order_id;
    let markdown: string = body.markdown || "";
    let title: string = body.title || "Приказ";
    let version: number = body.version || 1;
    let isOriginal = !!body.is_original;
    const note: string | undefined = body.note;

    let order: any = null;
    if (orderId) {
      const { data } = await sb.from("generated_orders").select("*").eq("id", orderId).single();
      if (!data) throw new Error("Order not found");
      order = data;
      if (!markdown) markdown = data.content_md;
      if (!title || title === "Приказ") title = data.title;
      version = body.version ?? data.version ?? 1;
    }

    const pdfBytes = await renderPdf(markdown, title);
    const path = `${orderId || "adhoc"}/v${version}-${Date.now()}.pdf`;

    const { error: upErr } = await sb.storage.from("orders").upload(path, pdfBytes, {
      contentType: "application/pdf",
      upsert: true,
    });
    if (upErr) throw upErr;

    const { data: pub } = sb.storage.from("orders").getPublicUrl(path);
    const pdfUrl = pub.publicUrl;

    if (orderId) {
      // Save version row
      await sb.from("order_versions").insert({
        order_id: orderId,
        version,
        content_md: markdown,
        pdf_url: pdfUrl,
        note: note || (isOriginal ? "Оригинал" : `Версия ${version}`),
      });

      const update: any = { pdf_url_current: pdfUrl, version };
      if (isOriginal || !order.pdf_url_original) update.pdf_url_original = pdfUrl;
      await sb.from("generated_orders").update(update).eq("id", orderId);
    }

    return new Response(JSON.stringify({ ok: true, pdf_url: pdfUrl, version }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("order-pdf error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
