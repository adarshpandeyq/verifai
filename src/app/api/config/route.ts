import { getPublicConfig } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function GET() {
  const cfg = getPublicConfig();
  return Response.json({
    searchConfigured: cfg.searchConfigured,
    modelConfigured: cfg.modelConfigured,
    wikipediaEnabled: cfg.wikipediaEnabled,
    searchProvider: cfg.searchProvider,
  });
}
