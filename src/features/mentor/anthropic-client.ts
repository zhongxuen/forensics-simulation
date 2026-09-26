import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { MentorModelRunner } from "./model";

/**
 * The real model runner, backed by the official Anthropic TypeScript SDK (docs/plan/14-mentor.md,
 * prompt 10.1). This is the ONLY module in the feature that imports the SDK, and `import "server-only"`
 * makes importing it from any client module a build error, so the API key can never reach the
 * browser bundle. The route is the only caller.
 *
 * We stream (`client.messages.stream`) so a slow response never hits an HTTP timeout, and so the
 * handler can release Noor's hint sentence by sentence as it validates.
 */
let sharedRunner: { readonly apiKey: string; readonly runner: MentorModelRunner } | undefined;

/**
 * The runner the routes share, built once per server instance: the SDK client is reusable and holds
 * no per-request state, so nothing about a player or a request outlives the request. It is only
 * ever created when a key is present, so no key means no client.
 */
export function getAnthropicRunner(apiKey: string): MentorModelRunner {
  if (sharedRunner?.apiKey !== apiKey) {
    sharedRunner = { apiKey, runner: createAnthropicRunner(apiKey) };
  }
  return sharedRunner.runner;
}

export function createAnthropicRunner(apiKey: string): MentorModelRunner {
  const client = new Anthropic({ apiKey });

  return (input, signal) => {
    const stream = client.messages.stream(
      {
        model: input.model,
        max_tokens: input.maxTokens,
        system: input.system,
        // The transcript and any player text are inside the user message, wrapped in a delimited
        // block the system prompt names as data, never instructions.
        messages: input.messages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
        // The review's answer is JSON in a fixed shape (structured outputs). The text still streams
        // as text deltas; the handler parses and checks it once it's complete.
        ...(input.jsonSchema && {
          output_config: { format: { type: "json_schema", schema: { ...input.jsonSchema } } },
        }),
      },
      { signal },
    );

    async function* textDeltas(): AsyncGenerator<string> {
      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          yield event.delta.text;
        }
      }
    }

    const iterator = textDeltas();
    return {
      [Symbol.asyncIterator]: () => iterator,
      usage: async () => {
        const message = await stream.finalMessage();
        return {
          inputTokens: message.usage.input_tokens,
          outputTokens: message.usage.output_tokens,
        };
      },
    };
  };
}
