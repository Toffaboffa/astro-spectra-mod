import { validateStructuredResult, flattenStructuredResult } from './response.js';

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const DEFAULT_MODEL = 'gpt-5.6-terra';
const DEFAULT_TIMEOUT_MS = 35000;
const DEFAULT_MAX_OUTPUT_TOKENS = 700;

export class OpenAIConnectorError extends Error {
  constructor(code, message, status, details) {
    super(message);
    this.name = 'OpenAIConnectorError';
    this.code = code;
    this.status = status || 502;
    this.details = details || null;
  }
}

function boundedInteger(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

async function resolveApiKey(env) {
  const binding = env && env.OPENAI_API_KEY;
  if (typeof binding === 'string') return binding.trim();
  if (binding && typeof binding.get === 'function') {
    const value = await binding.get();
    return String(value == null ? '' : value).trim();
  }
  return '';
}

function extractOutputText(response) {
  if (response && typeof response.output_text === 'string' && response.output_text.trim()) {
    return response.output_text.trim();
  }
  const output = response && Array.isArray(response.output) ? response.output : [];
  const parts = [];
  output.forEach((item) => {
    const content = item && Array.isArray(item.content) ? item.content : [];
    content.forEach((part) => {
      if (part && part.type === 'output_text' && typeof part.text === 'string') parts.push(part.text);
    });
  });
  return parts.join('').trim();
}

function extractRefusal(response) {
  const output = response && Array.isArray(response.output) ? response.output : [];
  for (const item of output) {
    const content = item && Array.isArray(item.content) ? item.content : [];
    for (const part of content) {
      if (part && part.type === 'refusal' && typeof part.refusal === 'string' && part.refusal.trim()) {
        return part.refusal.trim();
      }
    }
  }
  return '';
}

function compactUsage(usage) {
  const u = usage && typeof usage === 'object' ? usage : {};
  const details = u.output_tokens_details && typeof u.output_tokens_details === 'object'
    ? u.output_tokens_details
    : {};
  return {
    inputTokens: Number.isFinite(Number(u.input_tokens)) ? Number(u.input_tokens) : null,
    outputTokens: Number.isFinite(Number(u.output_tokens)) ? Number(u.output_tokens) : null,
    totalTokens: Number.isFinite(Number(u.total_tokens)) ? Number(u.total_tokens) : null,
    reasoningTokens: Number.isFinite(Number(details.reasoning_tokens)) ? Number(details.reasoning_tokens) : null
  };
}

function publicUpstreamError(status) {
  if (status === 401 || status === 403) {
    return new OpenAIConnectorError('OPENAI_AUTH_FAILED', 'OpenAI rejected the project credentials or endpoint permissions.', 502);
  }
  if (status === 429) {
    return new OpenAIConnectorError('OPENAI_RATE_LIMITED', 'OpenAI rate limit reached. Try again shortly.', 503);
  }
  if (status >= 500) {
    return new OpenAIConnectorError('OPENAI_UNAVAILABLE', 'OpenAI is temporarily unavailable.', 503);
  }
  return new OpenAIConnectorError('OPENAI_REQUEST_REJECTED', 'OpenAI rejected the interpretation request.', 502);
}

export async function interpretWithOpenAI(promptPackage, env) {
  const apiKey = await resolveApiKey(env);
  if (!apiKey) {
    throw new OpenAIConnectorError('OPENAI_KEY_MISSING', 'The Worker cannot access its OpenAI API key binding.', 503);
  }

  const model = String((env && env.OPENAI_MODEL) || DEFAULT_MODEL).trim() || DEFAULT_MODEL;
  const timeoutMs = boundedInteger(env && env.OPENAI_TIMEOUT_MS, DEFAULT_TIMEOUT_MS, 5000, 60000);
  const maxOutputTokens = boundedInteger(env && env.OPENAI_MAX_OUTPUT_TOKENS, DEFAULT_MAX_OUTPUT_TOKENS, 300, 2400);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort('timeout'), timeoutMs);

  const requestBody = {
    model,
    input: [
      {
        role: 'developer',
        content: [{ type: 'input_text', text: promptPackage.instructions }]
      },
      {
        role: 'user',
        content: [{ type: 'input_text', text: promptPackage.input }]
      }
    ],
    text: {
      format: promptPackage.responseFormat,
      verbosity: 'low'
    },
    reasoning: { effort: 'low' },
    max_output_tokens: maxOutputTokens,
    store: false
  };

  let upstream;
  try {
    upstream = await fetch(OPENAI_RESPONSES_URL, {
      method: 'POST',
      headers: {
        'authorization': 'Bearer ' + apiKey,
        'content-type': 'application/json'
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new OpenAIConnectorError('OPENAI_TIMEOUT', 'OpenAI did not respond before the Worker timeout.', 504);
    }
    throw new OpenAIConnectorError('OPENAI_NETWORK_ERROR', 'The Worker could not reach OpenAI.', 502);
  } finally {
    clearTimeout(timeoutId);
  }

  let responseJson = null;
  try {
    responseJson = await upstream.json();
  } catch (_) {
    responseJson = null;
  }

  if (!upstream.ok) {
    const error = publicUpstreamError(upstream.status);
    error.details = {
      upstreamStatus: upstream.status,
      requestId: upstream.headers.get('x-request-id') || null,
      upstreamCode: responseJson && responseJson.error && responseJson.error.code ? String(responseJson.error.code) : null
    };
    throw error;
  }

  if (!responseJson || responseJson.status === 'failed') {
    throw new OpenAIConnectorError('OPENAI_RESPONSE_FAILED', 'OpenAI returned a failed response.', 502);
  }
  if (responseJson.status === 'incomplete') {
    throw new OpenAIConnectorError('OPENAI_RESPONSE_INCOMPLETE', 'OpenAI could not complete the structured interpretation within the output limit.', 502, {
      reason: responseJson.incomplete_details && responseJson.incomplete_details.reason
        ? String(responseJson.incomplete_details.reason)
        : null
    });
  }

  const refusal = extractRefusal(responseJson);
  if (refusal) {
    throw new OpenAIConnectorError('OPENAI_REFUSAL', 'The model declined to provide an interpretation for this request.', 422);
  }

  const outputText = extractOutputText(responseJson);
  if (!outputText) {
    throw new OpenAIConnectorError('OPENAI_EMPTY_RESPONSE', 'OpenAI returned no structured interpretation.', 502);
  }

  let result;
  try {
    result = JSON.parse(outputText);
  } catch (_) {
    throw new OpenAIConnectorError('OPENAI_INVALID_JSON', 'OpenAI returned an unreadable structured interpretation.', 502);
  }

  const checked = validateStructuredResult(result);
  if (!checked.ok) {
    throw new OpenAIConnectorError('OPENAI_SCHEMA_MISMATCH', 'OpenAI returned an interpretation that did not match the SPECTRA PRO response contract.', 502, {
      validation: checked.errors
    });
  }

  return {
    result,
    text: flattenStructuredResult(result),
    model: String(responseJson.model || model),
    responseId: typeof responseJson.id === 'string' ? responseJson.id : null,
    usage: compactUsage(responseJson.usage)
  };
}
