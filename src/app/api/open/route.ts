import { sanitizeUrl } from "@/lib/pipeline/urls";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("u");
  const target = sanitizeUrl(raw);
  if (!target) {
    return new Response("Missing or invalid source URL.", { status: 400 });
  }

  const escaped = target.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="refresh" content="0;url=${escaped}" />
    <title>Opening source</title>
    <style>
      body { font: 16px/1.4 Georgia, serif; background: #111; color: #eee; padding: 48px; }
      a { color: #e4b56a; }
    </style>
  </head>
  <body>
    <p>Opening source…</p>
    <p><a href="${escaped}" rel="noopener noreferrer">Continue to ${escaped}</a></p>
    <script>window.location.replace(${JSON.stringify(target)});</script>
  </body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
