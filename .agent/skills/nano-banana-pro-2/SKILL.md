---
name: nano-banana-pro-2
description: Full UI/UX Frontend Design & Generation skill for AERA SCALE using Gemini Pro (VITE_GEMINI_API_KEY). Use this skill to design, generate, and improve all frontend components, views, layouts, and visuals — including text-to-image for UI assets.
---

# Nano Banana Pro 2 — Full UI/UX Frontend Skill

## Overview

This skill uses **Gemini Pro** (`VITE_GEMINI_API_KEY`) to design and generate the complete frontend of the AERA SCALE platform.

**Design System:** ANTIGRAVITY v2 (Forest `#2D4A3E`, Gold `#C9A84C`, Cream `#F5F0E8`)  
**Stack:** React + TypeScript + Tailwind CSS + Lucide Icons + Framer Motion  
**API Key:** `VITE_GEMINI_API_KEY` in `.env.local`

---

## Scope — What This Skill Covers

| Area | Details |
|---|---|
| **Views** | Dashboard, Properties, Tenants, Finance, Settings, LoginPage |
| **Components** | Sidebar, Modals, Cards, Tables, Forms, Charts |
| **Design Tokens** | Colors, Typography, Shadows, Border Radius, Spacing |
| **Animations** | Framer Motion transitions, hover effects, micro-animations |
| **Images/Visuals** | Text-to-Image via Imagen API for illustrations, property photos, placeholders |
| **Responsive** | Mobile-first, breakpoints: sm/md/lg/xl |

---

## Design System — ANTIGRAVITY v2 (MANDATORY)

```css
Forest:       #2D4A3E  /* primary backgrounds, headers, sidebar */
Forest-dark:  #1A2E25  /* deep text, dark sections */
Gold:         #C9A84C  /* CTAs, active states, accents */
Gold-dark:    #A6883A  /* hover states on gold */
Cream:        #F5F0E8  /* page backgrounds */
Cream-dark:   #EDE7DB  /* card backgrounds, inputs */
Cream-deeper: #D4CFC6  /* borders, dividers */
```

**Fonts:**
- Headings → `Cormorant Garamond` (serif, bold)
- Body → `DM Sans` (sans-serif)
- Numbers/Code → `JetBrains Mono` (monospace)

---

## Gemini AI Usage for UI Generation

Use Gemini to generate component code, layouts, and designs:

```typescript
const prompt = `
You are a senior UI/UX engineer specializing in React and Tailwind CSS.
Design System: ANTIGRAVITY v2
- Forest: #2D4A3E, Gold: #C9A84C, Cream: #F5F0E8
- Fonts: Cormorant Garamond (headings), DM Sans (body), JetBrains Mono (numbers)
- Style: Premium SaaS, glassmorphism, micro-animations

Generate a React TypeScript component for: [COMPONENT_DESCRIPTION]
Use Tailwind CSS classes. Export as default.
`;

const response = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${import.meta.env.VITE_GEMINI_API_KEY}`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  }
);
const code = (await response.json()).candidates?.[0]?.content?.parts?.[0]?.text;
```

---

## Text-to-Image for UI Assets (Imagen)

```typescript
const imgResponse = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key=${import.meta.env.VITE_GEMINI_API_KEY}`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      instances: [{ prompt: 'Modern luxury apartment building, forest green and gold palette, architectural photography' }],
      parameters: { sampleCount: 1, aspectRatio: '16:9' },
    }),
  }
);
const base64 = (await imgResponse.json()).predictions?.[0]?.bytesBase64Encoded;
```

---

## Component Naming Convention

| Component | File | Location |
|---|---|---|
| Main views | `Dashboard.tsx`, `Properties.tsx` etc. | `components/` |
| Shared UI | `Sidebar.tsx`, `Modal.tsx` | `components/` |
| CSS tokens | Design variables | `index.css` |
| Tailwind config | Custom tokens | `tailwind.config.js` |

---

## Quality Standards

- ✅ All colors from ANTIGRAVITY v2 palette only
- ✅ Cormorant Garamond for all `<h1>`–`<h3>` headings
- ✅ JetBrains Mono for all monetary values and numbers
- ✅ Gold gradient CTAs (`btn-gold` class)
- ✅ Floating label inputs
- ✅ `rounded-2xl` cards with `shadow-soft`
- ✅ Hover + focus states on every interactive element
- ✅ Framer Motion for page transitions
- ❌ No plain blue, indigo, slate, or emerald colors
- ❌ No hardcoded hex values outside `index.css`
