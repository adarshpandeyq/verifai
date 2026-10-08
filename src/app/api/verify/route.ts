import { runVerificationPipeline } from "@/lib/pipeline/run";
import type { VerifyEvent } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  let claim = "";
  let image: Buffer | null = null;
  let earlyError: string | null = null;

  try {
    const form = await req.formData();
    claim = String(form.get("claim") || "").trim();
    if (claim.length < 8) {
      earlyError = "Enter a claim of at least 8 characters.";
    } else if (claim.length > 4000) {
      earlyError = "Claim is too long (max 4000 characters).";
    } else {
      const file = form.get("image");
      if (file instanceof File && file.size > 0) {
        if (file.size > 8 * 1024 * 1024) {
          earlyError = "Image must be 8 MB or smaller.";
        } else {
          const bytes = await file.arrayBuffer();
          image = Buffer.from(bytes);
        }
      }
    }
  } catch {
    earlyError = "Could not read the submitted claim or image.";
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: VerifyEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      try {
        if (earlyError) {
          send({ type: "error", message: earlyError });
          return;
        }
        const verification = await runVerificationPipeline({ claim, image, emit: send });
        send({ type: "result", verification });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Verification failed.";
        send({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
