import Anthropic from "@anthropic-ai/sdk";

interface AIProvider {
  name: string;
  client: Anthropic;
  model: string;
}

function buildProviderChain(): AIProvider[] {
  const providers: AIProvider[] = [];

  // Primary: z.ai proxy (GLM models, included in z.ai coding subscription)
  if (process.env.ZAI_API_KEY) {
    providers.push({
      name: "zai",
      client: new Anthropic({
        apiKey: process.env.ZAI_API_KEY,
        baseURL: "https://api.z.ai/api/anthropic/v1",
      }),
      model: "claude-sonnet-4-5-20250929",
    });
  }

  // Optional fallback: Direct Anthropic API
  if (process.env.ANTHROPIC_API_KEY) {
    providers.push({
      name: "anthropic",
      client: new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }),
      model: "claude-sonnet-4-6",
    });
  }

  if (providers.length === 0) {
    throw new Error("No AI provider configured. Set ZAI_API_KEY or ANTHROPIC_API_KEY.");
  }

  return providers;
}

export async function callPM(params: {
  system: string;
  messages: Anthropic.MessageParam[];
  tools?: Anthropic.Tool[];
  maxTokens?: number;
}): Promise<Anthropic.Message> {
  const providers = buildProviderChain();

  for (const provider of providers) {
    try {
      return await provider.client.messages.create({
        model: provider.model,
        max_tokens: params.maxTokens ?? 4096,
        system: params.system,
        messages: params.messages,
        ...(params.tools && { tools: params.tools }),
      });
    } catch (err) {
      console.error(`[AI] ${provider.name} failed:`, err);
    }
  }

  throw new Error("All AI providers failed");
}
