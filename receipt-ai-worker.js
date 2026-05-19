const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,X-Receipt-DB-Token"
};

const RECEIPT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["store", "date", "total", "items", "warnings"],
  properties: {
    store: {
      type: "string",
      description: "Receipt store or branch name exactly as visible. Empty string if not visible."
    },
    date: {
      type: "string",
      description: "Purchase date in YYYY-MM-DD. Empty string if not visible."
    },
    total: {
      type: "number",
      description: "Final paid or payable total amount. Use 0 if not visible."
    },
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "qty", "unitPrice", "amount", "confidence", "note"],
        properties: {
          name: { type: "string" },
          qty: { type: "number" },
          unitPrice: { type: "number" },
          amount: { type: "number" },
          confidence: { type: "number", description: "0 to 1 confidence score for this line." },
          note: { type: "string", description: "Short note for uncertainty, discount, service, or free item." }
        }
      }
    },
    warnings: {
      type: "array",
      items: { type: "string" }
    }
  }
};

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method === "GET") {
      return json({
        ok: true,
        name: "receipt-ai-worker",
        model: env.OPENAI_MODEL || "gpt-5.4-mini"
      });
    }

    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    if (env.RECEIPT_DB_APP_TOKEN) {
      const token = request.headers.get("X-Receipt-DB-Token") || "";
      if (token !== env.RECEIPT_DB_APP_TOKEN) {
        return json({ error: "Unauthorized" }, 401);
      }
    }

    if (!env.OPENAI_API_KEY) {
      return json({ error: "OPENAI_API_KEY secret is missing" }, 500);
    }

    let payload = {};
    try {
      payload = await request.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }

    const image = String(payload.image || "");
    if (!image.startsWith("data:image/")) {
      return json({ error: "image must be a data:image/* URL" }, 400);
    }

    const model = env.OPENAI_MODEL || "gpt-5.4-mini";
    const openaiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: buildPrompt(payload.fileName || "")
              },
              {
                type: "input_image",
                image_url: image
              }
            ]
          }
        ],
        text: {
          format: {
            type: "json_schema",
            name: "receipt_extract",
            strict: true,
            schema: RECEIPT_SCHEMA
          }
        }
      })
    });

    const result = await openaiResponse.json().catch(() => ({}));
    if (!openaiResponse.ok) {
      return json({
        error: result?.error?.message || result?.error || "OpenAI request failed",
        details: result
      }, openaiResponse.status);
    }

    const outputText = extractOutputText(result);
    let extracted = {};
    try {
      extracted = JSON.parse(outputText);
    } catch {
      return json({
        error: "OpenAI response was not valid JSON",
        raw: outputText
      }, 502);
    }

    const receipt = normalizeReceipt(extracted);
    return json({
      receipt,
      warnings: receipt.warnings,
      model: result.model || model
    });
  }
};

function buildPrompt(fileName = "") {
  return [
    "You are extracting data from a Korean receipt image for a personal receipt database.",
    "Return only values visible in the image. Do not guess hidden text.",
    "The user will verify the result manually, so keep uncertainty in warnings instead of inventing values.",
    "Extract store, date, final total, and item rows with name, quantity, unit price, and amount.",
    "If an item is free/service/gift, use amount 0 and explain in note.",
    "If a discount is shown as its own row, use a negative amount.",
    "For Korean numbers, treat comma-separated amounts as KRW.",
    "If a receipt table clearly shows unit price, quantity, and amount, preserve those exact numbers.",
    `File name hint: ${fileName || "(none)"}`
  ].join("\n");
}

function extractOutputText(result = {}) {
  if (typeof result.output_text === "string") return result.output_text;
  const chunks = [];
  for (const output of result.output || []) {
    for (const content of output.content || []) {
      if (typeof content.text === "string") chunks.push(content.text);
      if (typeof content.output_text === "string") chunks.push(content.output_text);
    }
  }
  return chunks.join("\n").trim();
}

function normalizeReceipt(receipt = {}) {
  const items = Array.isArray(receipt.items) ? receipt.items.map(normalizeItem).filter(item => item.name) : [];
  const total = toNumber(receipt.total) || items.reduce((sum, item) => sum + item.amount, 0);
  return {
    store: String(receipt.store || "").trim(),
    date: normalizeDate(receipt.date || ""),
    total,
    items,
    warnings: Array.isArray(receipt.warnings) ? receipt.warnings.map(String).filter(Boolean) : []
  };
}

function normalizeItem(item = {}) {
  const qty = toNumber(item.qty) || 1;
  const amount = toNumber(item.amount);
  const unitPrice = toNumber(item.unitPrice) || (qty ? Math.round(amount / qty) : amount);
  return {
    name: String(item.name || "").trim(),
    qty,
    unitPrice,
    amount,
    confidence: Number(item.confidence || 0),
    note: String(item.note || "")
  };
}

function toNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const cleaned = String(value ?? "").replace(/[^\d.-]/g, "");
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : 0;
}

function normalizeDate(value) {
  const text = String(value || "").trim();
  const match = text.match(/(20\d{2})[.\-/년 ]\s*(\d{1,2})[.\-/월 ]\s*(\d{1,2})/);
  if (!match) return text;
  return `${match[1]}-${String(match[2]).padStart(2, "0")}-${String(match[3]).padStart(2, "0")}`;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json;charset=utf-8"
    }
  });
}
