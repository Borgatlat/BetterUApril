import { getAnthropicApiKey, getAnthropicApiKeyAsync } from '../utils/apiConfig';

const CLAUDE_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';

/** Haiku first for speed; Sonnet fallbacks when Haiku is unavailable on the account. */
export const CLAUDE_MODELS = [
  'claude-haiku-4-5-20251001',
  'claude-haiku-4-5',
  'claude-3-5-haiku-20241022',
  'claude-3-haiku-20240307',
  'claude-sonnet-4-6',
  'claude-sonnet-4-20250514',
  'claude-3-5-sonnet-20241022',
];

async function fetchWithTimeout(url, options = {}, timeoutMs = 45000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchWithRetry(url, options = {}, maxRetries = 2) {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      const timeoutMs = 45000 + attempt * 15000;
      const response = await fetchWithTimeout(url, options, timeoutMs);
      if (response.status >= 500 && attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));
        continue;
      }
      return response;
    } catch (err) {
      lastError = err;
      if (attempt >= maxRetries) break;
      await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));
    }
  }
  throw lastError || new Error('Network request failed');
}

function extractClaudeText(data) {
  const block = data?.content?.[0];
  if (block?.type === 'text' && typeof block.text === 'string') {
    return block.text;
  }
  return null;
}

/** True when Anthropic rejected the model id — try the next entry in CLAUDE_MODELS. */
function shouldTryNextClaudeModel(message, status) {
  if (status === 404) return true;
  const msg = String(message || '').toLowerCase();
  if (!msg) return false;
  if (msg.includes('not_found') || msg.includes('not found')) return true;
  if (msg.includes('deprecated') || msg.includes('retired')) return true;
  // API often returns bare `model: claude-…` when a snapshot was removed.
  if (/^model:\s*claude-/i.test(String(message || '').trim())) return true;
  return msg.includes('model') && msg.includes('invalid');
}

/**
 * Calls Anthropic Claude using EXPO_PUBLIC_ANTHROPIC_API_KEY from .env / app.config.
 */
async function callClaudeDirect(apiKey, systemPrompt, messages, maxTokens = 2500) {
  let lastError;
  const tried = [];

  for (let i = 0; i < CLAUDE_MODELS.length; i += 1) {
    const model = CLAUDE_MODELS[i];
    tried.push(model);
    try {
      const response = await fetchWithRetry(CLAUDE_MESSAGES_URL, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          system: systemPrompt,
          messages,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = data?.error?.message || data?.error?.type || `HTTP ${response.status}`;
        const err = new Error(message);
        err.status = response.status;
        throw err;
      }

      const text = extractClaudeText(data);
      if (text) return text;
      throw new Error('Unexpected response format from Claude');
    } catch (err) {
      lastError = err;
      if (!shouldTryNextClaudeModel(err?.message, err?.status)) break;
    }
  }

  const suffix = tried.length ? ` (tried: ${tried.join(', ')})` : '';
  if (lastError) {
    lastError.message = `${lastError.message}${suffix}`;
    throw lastError;
  }
  throw new Error(`Claude request failed${suffix}`);
}

/**
 * @param {{ systemPrompt: string, messages: Array<{role: string, content: string}>, maxTokens?: number }} params
 */
export async function callFutureUClaude({ systemPrompt, messages, maxTokens = 2500 }) {
  const apiKey = (await getAnthropicApiKeyAsync()) || getAnthropicApiKey();
  if (!apiKey) {
    throw new Error(
      'Add EXPO_PUBLIC_ANTHROPIC_API_KEY=sk-ant-... to BetterUCurrent/.env, then restart Expo with npx expo start -c.',
    );
  }
  return callClaudeDirect(apiKey, systemPrompt, messages, maxTokens);
}

export async function isFutureUClaudeAvailable() {
  const key = (await getAnthropicApiKeyAsync()) || getAnthropicApiKey();
  return Boolean(key);
}

export function formatFutureUClaudeError(err) {
  const raw = String(err?.message || err || '');
  const msg = raw.toLowerCase();

  if (msg.includes('expo_public_anthropic') || msg.includes('add expo_public')) {
    return raw;
  }
  if (msg.includes('401') || msg.includes('invalid x-api-key') || msg.includes('authentication')) {
    return 'Claude API key rejected. Use a valid Anthropic key (sk-ant-...) in .env and restart Expo.';
  }
  if (msg.includes('abort') || msg.includes('aborted')) {
    return 'Request timed out. Check your connection and try again.';
  }
  if (msg.includes('429') || msg.includes('rate_limit')) {
    return 'Too many AI requests. Wait a minute and try again.';
  }
  if (msg.includes('model') && (msg.includes('not found') || msg.includes('not_found') || msg.includes('deprecated'))) {
    return 'Claude model unavailable. Update the app or check your Anthropic account access.';
  }
  if (msg.includes('network request failed') || msg.includes('failed to fetch')) {
    return 'Network error. Check your connection and try again.';
  }
  return raw || 'Something went wrong. Please try again.';
}
