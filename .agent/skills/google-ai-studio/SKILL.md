---
name: google-ai-studio
description: Integrate, test, and manage Google AI Studio models (Gemini) within the AERA SCALE platform. Use this skill to create prompts, test model outputs, manage API keys, and wire Gemini into existing services.
---

# Google AI Studio Skill

## Overview

Google AI Studio (https://aistudio.google.com) is the web interface for building and testing Gemini prompts, managing API keys, and deploying AI features into your application.

AERA SCALE already uses Gemini via two paths:
- **Firebase Vertex AI** (`firebase/ai` package) — per-user auth, production use
- **Gemini REST API** (`geminiService.ts`) — direct API calls with `VITE_GEMINI_API_KEY`

---

## When to Use This Skill

- Creating or refining Gemini prompts for lease analysis, payment reasoning, or tenant scoring
- Generating a new `VITE_GEMINI_API_KEY` for local development
- Testing model responses before wiring them into `geminiService.ts`
- Switching between Gemini model versions (e.g. `gemini-2.0-flash`, `gemini-1.5-pro`)
- Debugging AI response issues by replaying the exact prompt in AI Studio

---

## Step 1 — Open Google AI Studio

Navigate to: https://aistudio.google.com

Sign in with the Google account that owns the Firebase project (`aera-scale`).

---

## Step 2 — Get or Regenerate an API Key

1. Click **"Get API key"** in the left sidebar
2. Select the project: **aera-scale**
3. Click **"Create API key in existing project"**
4. Copy the key

Update your local `.env.local`:
```
VITE_GEMINI_API_KEY=your_new_key_here
```

> For Cloud Run, update the secret in Google Secret Manager or set it via `gcloud run services update`.

---

## Step 3 — Test a Prompt

1. Click **"Create new prompt"** → **"Structured prompt"** or **"Freeform"**
2. Set the model to `gemini-2.0-flash` (fastest) or `gemini-1.5-pro` (most capable)
3. Paste your prompt from `geminiService.ts`
4. Run and inspect the output
5. Tune `temperature`, `maxOutputTokens`, `topP` as needed

---

## Step 4 — Wire Prompt into AERA SCALE

The main AI service file is:
```
services/geminiService.ts
```

Key functions already implemented:
| Function | Purpose |
|---|---|
| `analyzeLeaseWithGemini()` | Extract clauses from uploaded PDF |
| `reconcilePaymentsWithGemini()` | Match bank transactions to tenants |
| `generateSettlementText()` | Write NK-Abrechnung as legal text |
| `validateSettlement()` | Validate cost distribution logic |
| `generateMietrechnung()` | Draft rent invoice content |

### Adding a New AI Feature

```typescript
// In geminiService.ts — add a new function:
export async function myNewAIFeature(input: string): Promise<string> {
  const model = getGenerativeModel(ai, { model: 'gemini-2.0-flash' });
  const prompt = `Your system prompt here.\n\nInput: ${input}`;
  const result = await model.generateContent(prompt);
  return result.response.text();
}
```

---

## Step 5 — Model Selection Guide

| Model | Speed | Context | Best For |
|---|---|---|---|
| `gemini-2.0-flash` | ⚡ Fastest | 1M tokens | Payment matching, short extractions |
| `gemini-1.5-pro` | 🧠 Smartest | 2M tokens | Full lease PDF analysis, complex reasoning |
| `gemini-2.0-flash-thinking` | 🤔 Reasoning | 32K tokens | Settlement validation, multi-step logic |

Change model in `geminiService.ts`:
```typescript
const model = getGenerativeModel(ai, { model: 'gemini-2.0-flash' });
```

---

## Step 6 — Environment Variables

| Variable | Location | Purpose |
|---|---|---|
| `VITE_GEMINI_API_KEY` | `.env.local` | Direct Gemini REST API fallback |
| Firebase Vertex AI | Auto-configured via Firebase | Production AI path (no API key needed) |

The app uses Vertex AI (Firebase) in production and falls back to REST API if Vertex AI init fails.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `Vertex AI Init Failed` | Check Firebase project has Vertex AI API enabled in Google Cloud Console |
| `API key not valid` | Regenerate key in AI Studio, update `.env.local` |
| Empty AI response | Check `maxOutputTokens` limit, reduce prompt size |
| Model not found | Use exact model string: `gemini-2.0-flash` (no trailing version) |

---

## Useful Links

- [Google AI Studio](https://aistudio.google.com)
- [Gemini API Docs](https://ai.google.dev/gemini-api/docs)
- [Firebase Vertex AI Docs](https://firebase.google.com/docs/vertex-ai)
- [Model capabilities](https://ai.google.dev/gemini-api/docs/models/gemini)
