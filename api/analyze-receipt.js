const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,X-Receipt-DB-Token"
};

const DEFAULT_MODEL = "gpt-4.1-mini";

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

export default async function handler(request, response) {
  setCors(response);

  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }

  if (request.method === "GET") {
    json(response, {
      ok: true,
      name: "receipt-ai-vercel-server",
      model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
      ready: !!process.env.OPENAI_API_KEY
    });
    return;
  }

  if (request.method !== "POST") {
    json(response, { error: "Method not allowed" }, 405);
    return;
  }

  if (process.env.RECEIPT_DB_APP_TOKEN) {
    const token = request.headers["x-receipt-db-token"] || "";
    if (token !== process.env.RECEIPT_DB_APP_TOKEN) {
      json(response, { error: "Unauthorized" }, 401);
      return;
    }
  }

  if (!process.env.OPENAI_API_KEY) {
    json(response, { error: "OPENAI_API_KEY secret is missing" }, 500);
    return;
  }

  const payload = typeof request.body === "object" && request.body ? request.body : {};
  const image = String(payload.image || "");
  if (!image.startsWith("data:image/")) {
    json(response, { error: "image must be a data:image/* URL" }, 400);
    return;
  }

  const model = process.env.OPENAI_MODEL || DEFAULT_MODEL;
  let openaiResponse;
  try {
    openaiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
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
                image_url: image,
                detail: "high"
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
  } catch (error) {
    json(response, {
      error: "OpenAI API에 연결하지 못했습니다. 잠시 후 다시 시도하거나 Vercel 배포 상태를 확인해주세요.",
      errorCode: "openai_network_error",
      details: String(error?.message || error)
    }, 502);
    return;
  }

  const result = await openaiResponse.json().catch(() => ({}));
  if (!openaiResponse.ok) {
    const openaiError = normalizeOpenAiError(result);
    json(response, {
      error: openaiError.error,
      errorCode: openaiError.errorCode,
      openaiMessage: openaiError.openaiMessage,
      model,
      details: result
    }, openaiResponse.status);
    return;
  }

  const outputText = extractOutputText(result);
  let extracted = {};
  try {
    extracted = JSON.parse(outputText);
  } catch {
    json(response, {
      error: "OpenAI response was not valid JSON",
      raw: outputText
    }, 502);
    return;
  }

  const receipt = normalizeReceipt(extracted);
  json(response, {
    receipt,
    warnings: receipt.warnings,
    model: result.model || model
  });
}

function setCors(response) {
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    response.setHeader(key, value);
  }
}

function json(response, data, status = 200) {
  response.status(status).json(data);
}

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

function normalizeOpenAiError(result = {}) {
  const raw = result?.error || result || {};
  const message = String(raw.message || raw.error || raw || "OpenAI request failed");
  const code = String(raw.code || "");
  const combined = `${message} ${code}`;

  if (/country|region|territory|unsupported/i.test(combined)) {
    return {
      errorCode: "openai_region_unsupported",
      error: "OpenAI API 지역 제한으로 분석하지 못했습니다. Vercel 프로젝트 지역을 미국 또는 일본 등 OpenAI API 지원 지역으로 설정해 다시 배포해주세요.",
      openaiMessage: message
    };
  }

  if (/api key|authentication|unauthorized|incorrect/i.test(combined)) {
    return {
      errorCode: "openai_api_key_invalid",
      error: "OpenAI API 키가 올바르지 않습니다. Vercel Environment Variable의 OPENAI_API_KEY 값에 실제 API 키가 들어갔는지 확인해주세요.",
      openaiMessage: message
    };
  }

  if (/model|does not exist|not found/i.test(combined)) {
    return {
      errorCode: "openai_model_error",
      error: "OpenAI 모델 설정에 문제가 있습니다. OPENAI_MODEL 값이 있다면 gpt-4.1-mini로 바꾸거나 비워주세요.",
      openaiMessage: message
    };
  }

  return {
    errorCode: code || "openai_request_failed",
    error: message,
    openaiMessage: message
  };
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
