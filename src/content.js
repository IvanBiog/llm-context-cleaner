// High-Performance DOM Extractor & Markdown Converter
(() => {
  "use strict";

  const NOISE_SELECTORS = [
    "script", "style", "noscript", "iframe", "svg", "canvas", "video", "audio",
    "nav", "footer", "header", "aside",
    "[role='alert']", "[role='banner']", "[role='navigation']",
    ".ad", ".ads", ".advertisement", ".banner",
    ".cookie-banner", ".cookie-notice", ".cookie-consent",
    ".social-share", ".share-buttons", ".newsletter-signup",
    ".comments", "#comments", ".disqus"
  ];

  function cleanUrl(rawUrl) {
    try {
      return decodeURI(rawUrl);
    } catch {
      return rawUrl;
    }
  }

  function resolveLink(href, baseOrigin) {
    if (!href || href.startsWith("javascript:") || href.startsWith("#")) return "";
    try {
      const resolved = new URL(href, baseOrigin);
      return decodeURI(resolved.href);
    } catch {
      return href;
    }
  }

  function domToMarkdown(element, baseOrigin) {
    let output = "";

    for (const node of element.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        output += node.textContent.replace(/\s+/g, " ");
        continue;
      }

      if (node.nodeType !== Node.ELEMENT_NODE) continue;

      // Skip invisible elements
      const style = window.getComputedStyle(node);
      if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
        continue;
      }

      const tag = node.tagName.toLowerCase();

      if (/^h[1-6]$/.test(tag)) {
        const level = parseInt(tag[1], 10);
        output += `\n\n${"#".repeat(level)} ${node.textContent.trim()}\n\n`;
      } else if (tag === "p") {
        const pText = domToMarkdown(node, baseOrigin).trim();
        if (pText) output += `\n\n${pText}\n\n`;
      } else if (tag === "pre") {
        output += `\n\n\`\`\`\n${node.textContent.trim()}\n\`\`\`\n\n`;
      } else if (tag === "code") {
        output += `\`${node.textContent}\``;
      } else if (tag === "blockquote") {
        const quoteText = domToMarkdown(node, baseOrigin).trim().replace(/\n/g, "\n> ");
        if (quoteText) output += `\n\n> ${quoteText}\n\n`;
      } else if (tag === "ul") {
        output += "\n";
        node.querySelectorAll(":scope > li").forEach((li) => {
          output += `* ${domToMarkdown(li, baseOrigin).trim()}\n`;
        });
        output += "\n";
      } else if (tag === "ol") {
        output += "\n";
        let index = 1;
        node.querySelectorAll(":scope > li").forEach((li) => {
          output += `${index++}. ${domToMarkdown(li, baseOrigin).trim()}\n`;
        });
        output += "\n";
      } else if (tag === "a") {
        const href = resolveLink(node.getAttribute("href"), baseOrigin);
        const text = node.textContent.trim();
        output += href && text ? ` [${text}](${href}) ` : text;
      } else if (tag === "table") {
        // Table support
        const rows = Array.from(node.querySelectorAll("tr"));
        if (rows.length > 0) {
          output += "\n\n";
          rows.forEach((tr, rIdx) => {
            const cells = Array.from(tr.querySelectorAll("th, td")).map(c => c.textContent.trim().replace(/\|/g, "\\|"));
            output += `| ${cells.join(" | ")} |\n`;
            if (rIdx === 0) {
              output += `| ${cells.map(() => "---").join(" | ")} |\n`;
            }
          });
          output += "\n\n";
        }
      } else {
        output += domToMarkdown(node, baseOrigin);
      }
    }

    return output;
  }

  function extractContent() {
    const origin = window.location.origin;
    const url = cleanUrl(window.location.href);
    const title = document.title ? document.title.trim() : "Untitled Document";

    const clone = document.body.cloneNode(true);
    clone.querySelectorAll(NOISE_SELECTORS.join(",")).forEach((el) => el.remove());

    const mainElement = clone.querySelector("article, main, [role='main'], .post-content, .article-body, #content") || clone;
    const rawMarkdown = domToMarkdown(mainElement, origin);

    const formattedMarkdown = rawMarkdown
      .split("\n")
      .map((line) => line.trimEnd())
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    return {
      title,
      url,
      markdown: formattedMarkdown,
      timestamp: Date.now()
    };
  }

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "EXTRACT_CONTENT") {
      try {
        const payload = extractContent();
        sendResponse({ success: true, data: payload });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    }
    return true;
  });
})();
