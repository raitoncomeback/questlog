// ============================================================
// QuestLog v2 — AI Stretch-Task Suggestions (OpenRouter)
// ============================================================
// Stub for Feature 1. Full implementation in Feature 3.
// ============================================================

const AI = (() => {
  const DEFAULT_MODEL = 'openai/gpt-oss-120b:free';
  const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

  async function suggestStretchTask(skillData, recentTasks, apiKey) {
    // Feature 1: always return null (fallback to rule-based ladder)
    // Feature 3: wire this up with OpenRouter
    return null;
  }

  async function callOpenRouter(messages, apiKey, model) {
    if (!apiKey) return null;
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': window.location.origin,
          'X-Title': 'QuestLog'
        },
        body: JSON.stringify({
          model: model || DEFAULT_MODEL,
          messages,
          temperature: 0.7,
          max_tokens: 256
        })
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.choices?.[0]?.message?.content || null;
    } catch {
      return null;
    }
  }

  return { suggestStretchTask, callOpenRouter, DEFAULT_MODEL };
})();
