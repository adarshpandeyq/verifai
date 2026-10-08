export function getPublicConfig() {
  const tavily = process.env.TAVILY_API_KEY || "";
  const serper = process.env.SERPER_API_KEY || "";
  const search = process.env.SEARCH_API_KEY || "";
  const provider = (process.env.SEARCH_PROVIDER || "").toLowerCase();

  let searchProvider: string | null = null;
  if (provider === "tavily" && (tavily || search)) searchProvider = "tavily";
  else if (provider === "serper" && (serper || search)) searchProvider = "serper";
  else if (tavily) searchProvider = "tavily";
  else if (serper) searchProvider = "serper";
  else if (search) searchProvider = "auto";

  const modelConfigured = Boolean(
    process.env.OPENAI_API_KEY ||
      process.env.MODEL_API_KEY ||
      process.env.HUGGINGFACE_API_KEY,
  );

  const wikipediaEnabled = process.env.WIKIPEDIA_ENABLED !== "false";

  return {
    searchConfigured: Boolean(searchProvider),
    modelConfigured,
    wikipediaEnabled,
    searchProvider,
    openaiKey: process.env.OPENAI_API_KEY || process.env.MODEL_API_KEY || "",
    tavilyKey: tavily || (searchProvider === "tavily" ? search : ""),
    serperKey: serper || (searchProvider === "serper" ? search : ""),
    huggingfaceKey: process.env.HUGGINGFACE_API_KEY || "",
  };
}
