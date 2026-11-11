# PROJECT_CONTEXT: Context Cleaner & Markdown Extractor

## 1. Product Identity & Purpose
- **Name:** Context Cleaner & LLM Markdown Extractor (Extension)
- **Target Platform:** Google Chrome, Microsoft Edge, Brave (Chromium-based, Manifest V3).
- **Core Value Proposition:** One-click extraction of pure, readable Markdown from any web page, automatically stripping ads, sidebars, cookie banners, navigation links, and tracking scripts. Designed to format content directly for LLM context windows (ChatGPT, Claude, Gemini) with built-in token estimation.
- **Monetization Model:** Freemium.
  - *Free Tier:* Clean article extraction to Markdown, 1-click clipboard copy, basic token count.
  - *PRO Tier ($9 lifetime):* Custom system prompt prefixes, multi-tab batch merge, local regex filters, LLM-ready JSON/XML structuring.

---

## 2. Technical Stack & Architecture Constraints
- **Manifest Version:** 3 (`manifest_version: 3`).
- **Dependencies:** Minimalist, offline-first. No external CDN scripts inside the extension (strict Chrome Web Store CSP requirement).
  - DOM Parsing: `@mozilla/readability` (bundled locally in `/lib`).
  - Markdown Conversion: `turndown` (bundled locally in `/lib`).
- **Zero Server Infrastructure:** All parsing and formatting happens directly on client device via Content Scripts.
- **Hardware Target for Dev Machine:**
  - CPU: AMD Ryzen 5 2600 (6 cores / 12 threads)
  - GPU: GTX 1050 Ti 4GB VRAM
  - RAM: 16 GB DDR4
  - OS: Windows 10
  - Dev Environment: VS Code + Roo Code / Cline + Ollama (qwen2.5-coder:1.5b) for local edits.

---

## 3. Directory Layout
```text
context-cleaner-extension/
├── manifest.json              # Extension manifest (MV3)
├── PROJECT_CONTEXT.md         # Master instruction file for AI agents
├── icons/                     # Icons (16x16, 48x48, 128x128)
├── lib/                       # Bundled offline libraries (Readability, Turndown)
│   ├── readability.js
│   └── turndown.js
├── src/
│   ├── background.js          # Service worker (handles context menus & shortcuts)
│   ├── content.js             # Content script (DOM extraction & cleaning)
│   ├── popup.html             # UI popup interface
│   ├── popup.css              # Dark/light adaptive styling
│   └── popup.js               # UI interaction & token calculation logic
└── README.md                  # Installation & build documentation
```

---

## 4. Coding Standards & Agent Guidelines
1. **Security & Permissions:**
   - Request strictly minimal permissions: `["activeTab", "scripting", "storage", "clipboardWrite"]`.
   - Never inject arbitrary remote scripts.
2. **Error Handling:**
   - Gracefully handle single-page apps (SPAs) where DOM content renders dynamically.
   - If Readability fails to find article body, fallback to cleaned `document.body` clone.
3. **Performance:**
   - Extraction execution time must remain under 150ms for typical long-form articles.
   - Do not leak DOM nodes in memory.
