import { GoogleGenAI } from "@google/genai";

// ─── Gemini (primary) ──────────────────────────────────────────────────────
// Google retired the old "@google/generative-ai" SDK (the package this file
// used to import) in favour of the unified "@google/genai" SDK. That matters
// here because Google also rolled out a new "auth key" format for Gemini API
// keys (they start with "AQ." instead of the classic "AIzaSy...") and AQ.
// keys are NOT accepted by the legacy REST endpoint the old SDK talked to —
// every request from it fails immediately, which is why Gemini looked like
// it was permanently "rate limited" even on the very first message.
// "@google/genai" understands both key formats, so switching to it is the
// actual fix. If VITE_GEMINI_PUBLIC_KEY in your .env still doesn't work after
// this change, generate a fresh key at https://aistudio.google.com/apikey.
const ai = new GoogleGenAI({
  apiKey: import.meta.env.VITE_GEMINI_PUBLIC_KEY,
});

const GEMINI_MODEL = "gemini-2.5-flash";

// Creates a fresh stateful chat session seeded with the existing message
// history. Keeps the same input shape NewPrompt already builds elsewhere:
// [{ role: "user" | "model", parts: [{ text }] }, ...]
export function createGeminiChat(history = []) {
  return ai.chats.create({
    model: GEMINI_MODEL,
    history: history.map(({ role, parts }) => ({
      role,
      parts: [{ text: parts[0].text }],
    })),
  });
}

// Fallback 1 — Claude
// export async function callClaude(messages) {
//   const key = import.meta.env.VITE_CLAUDE_API_KEY;
//   if (!key) throw new Error("No Claude key");
//   const response = await fetch("https://api.anthropic.com/v1/messages", {
//     method: "POST",
//     headers: {
//       "Content-Type": "application/json",
//       "x-api-key": key,
//       "anthropic-version": "2023-06-01",
//     },
//     body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1000, messages }),
//   });
//   if (!response.ok) throw new Error(`Claude ${response.status}`);
//   const data = await response.json();
//   return { text: data.content[0].text, source: "claude" };
// }



export async function callClaude(messages) {
  const key = import.meta.env.VITE_CLAUDE_API_KEY;
  if (!key || key === "your_claude_api_key_here") {
    throw new Error("No key set in .env");
  }
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1000, messages }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`HTTP ${response.status}${detail ? ` — ${detail.slice(0, 160)}` : ""}`);
  }
  const data = await response.json();
  return { text: data.content[0].text, source: "claude" };
}



// Fallback 2 — Groq (free, generous daily limit — get key at console.groq.com)
export async function callGroq(messages) {
  const key = import.meta.env.VITE_GROQ_API_KEY;
  if (!key) throw new Error("No key set in .env");
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      // "llama3-8b-8192" was decommissioned by Groq (May 2025). gpt-oss-20b
      // is the model Groq currently points existing users of that model at.
      model: "openai/gpt-oss-20b",
      messages: messages.map((m) => ({
        role: m.role === "model" ? "assistant" : m.role,
        content: m.content,
      })),
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`HTTP ${response.status}${detail ? ` — ${detail.slice(0, 160)}` : ""}`);
  }
  const data = await response.json();
  return { text: data.choices[0].message.content, source: "groq" };
}

// Fallback 3 — OpenRouter (free models — get key at openrouter.ai)
export async function callOpenRouter(messages) {
  const key = import.meta.env.VITE_OPENROUTER_API_KEY;
  if (!key) throw new Error("No key set in .env");
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      "HTTP-Referer": window.location.origin,
    },
    body: JSON.stringify({
      model: "mistralai/mistral-7b-instruct:free",
      messages: messages.map((m) => ({
        role: m.role === "model" ? "assistant" : m.role,
        content: m.content,
      })),
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`HTTP ${response.status}${detail ? ` — ${detail.slice(0, 160)}` : ""}`);
  }
  const data = await response.json();
  return { text: data.choices[0].message.content, source: "openrouter" };
}

export default ai;
