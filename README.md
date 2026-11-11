# ⚡ LLM Context Cleaner & Markdown Extractor

> A high-performance, privacy-first Chromium extension (Manifest V3) that extracts clean, ad-free Markdown from webpages and batch-merges open browser tabs into token-optimized context for ChatGPT, Claude, and Gemini.

![License](https://img.shields.io/badge/License-MIT-blue.svg)
![Manifest](https://img.shields.io/badge/Manifest-V3-success.svg)
![Platform](https://img.shields.io/badge/Platform-Chrome%20%7C%20Brave%20%7C%20Edge-purple.svg)

---

## 🌟 Why This Exists

Feeding raw web URLs into ChatGPT or Claude often fails:
1. **Cloudflare & Anti-bot Paywalls:** Cloud LLMs get blocked by `403 Forbidden` or CAPTCHA challenges when crawling web links.
2. **Context Window Waste:** Scraping raw HTML injects hundreds of lines of navigation menus, cookie banners, tracking scripts, and advertisements, burning up your token limits.
3. **Multi-Tab Chaos:** When researching across 10 different documentation pages or Wikipedia articles, manually copying and cleaning each one takes 15+ minutes.

**Context Cleaner solves this in 1 click:** It extracts the core article directly from your rendered browser DOM, converts it to structured Markdown or `<document>` XML, estimates token cost, and copies it to your clipboard.

---

## 🚀 Key Features

* **🧹 DOM Sanitization:** Aggressively removes ads, cookie banners, navigation sidebars, and interactive clutter while keeping code blocks, tables, headings, and lists intact.
* **📚 Batch Tab Collector (PRO):** Scans all open tabs in your current window and merges them into a single, structured knowledge base with XML index tags (`<knowledge_base count="N">`).
* **🎯 Built-in Prompt Presets:** One-click prefixes for:
  - `TL;DR / Key Insights` (Executive summarization)
  - `Code & Architecture Audit` (Bug & vulnerability review)
  - `Fact-Check & Verification` (Extract verifiable claims)
  - `Generate Q&A / Flashcards` (Study & revision aids)
* **🪙 Live Token Counter:** Instant calculation of approximate tokens (split by Latin, Cyrillic, and code density) so you know before sending to your LLM.
* **🔒 100% Local & Offline-First:** Zero remote server tracking. All DOM parsing happens locally inside your browser via standard Web APIs.

---

## 📦 Project Structure

```text
context-cleaner-extension/
├── manifest.json              # Extension Manifest V3 descriptor
├── PROJECT_CONTEXT.md         # Master architecture guidelines & coding standards
├── README.md                  # Documentation and quickstart guide
├── icons/                     # Extension branding icons (16, 48, 128px)
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── lib/                       # Bundled offline utilities
└── src/
    ├── background.js          # Service worker (handles Alt+Shift+C shortcuts)
    ├── content.js             # Content script (DOM heuristic extraction & URL decoder)
    ├── popup.html             # Extension UI interface
    ├── popup.css              # Dark theme styling
    └── popup.js               # Event handling, token counter & batch collector logic
```

---

## 🛠️ Installation & Development

### Local Developer Mode
1. Clone or download this repository to your local drive (`d:\ui_life\context-cleaner-extension`).
2. Open Google Chrome (or any Chromium browser like Brave/Edge).
3. Navigate to `chrome://extensions/` in the address bar.
4. Toggle **Developer mode** (top-right corner).
5. Click **Load unpacked** (Загрузить распакованное расширение) and select the `context-cleaner-extension` directory.
6. Open any article or documentation site and click the extension icon (or press `Alt+Shift+C`).

---

## ⌨️ Keyboard Shortcuts

* **`Alt + Shift + C`**: Instantly extract and copy current active page to clipboard without even opening the popup.

---

## 💎 Monetization & PRO Features

Context Cleaner is built on an offline-first freemium architecture:
- **Free Tier:** Unlimited single-tab cleaning, Markdown / Raw Text / XML exports, live token counter.
- **PRO Tier ($9 Lifetime License):** Unlimited multi-tab batch collector, custom system prompt injection.
- Payment & Merchant of Record: Managed via [Polar.sh](https://polar.sh) with instant key generation (`PRO-XXXX-XXXX`).

---

## 📄 License

MIT License. Free for personal and commercial modification.
