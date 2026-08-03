// Server-only Lovable AI Gateway helper (Responses API).
type JsonSchema = Record<string, unknown>;

export async function aiJson<T>(opts: {
  system: string;
  prompt: string;
  schemaName: string;
  schema: JsonSchema;
}): Promise<T> {
  const key = process.env['LOVABLE_API_KEY'];
  if (!key) throw new Error("AI is not configured yet.");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": key,
    },
    body: JSON.stringify({
      model: "openai/gpt-5.6-sol",
      input: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.prompt },
      ],
      text: {
        format: {
          type: "json_schema",
          name: opts.schemaName,
          strict: true,
          schema: opts.schema,
        },
      },
    }),
  });

  if (res.status === 429) throw new Error("AI rate limit reached — try again shortly.");
  if (res.status === 402) throw new Error("AI credits exhausted — add credits to continue.");
  if (!res.ok) {
    const detail = await res.text();
    console.error("[ai] gateway error", res.status, detail.slice(0, 500));
    throw new Error("AI service is temporarily unavailable.");
  }

  const json = (await res.json()) as {
    output_text?: string;
    output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  };

  let text = json.output_text ?? "";
  if (!text) {
    for (const item of json.output ?? []) {
      for (const part of item.content ?? []) {
        if (typeof part.text === "string" && part.text.trim()) text += part.text;
      }
    }
  }
  if (!text) throw new Error("AI returned an empty response.");
  return JSON.parse(text) as T;
}

export function strictObject(properties: Record<string, unknown>): JsonSchema {
  return {
    type: "object",
    additionalProperties: false,
    required: Object.keys(properties),
    properties,
  };
}

export const strArray = { type: "array", items: { type: "string" } };