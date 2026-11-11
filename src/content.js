// DOM Extractor & Cleaner
function extractArticleContent() {
  let url = window.location.href;
  try {
    url = decodeURI(url);
  } catch (e) {
    // Keep raw URL if decode fails
  }
  const title = document.title || "Untitled Document";

  // Work on a deep clone to preserve real DOM state
  const clone = document.body.cloneNode(true);

  // Blacklist of clutter and non-informative containers
  const clutterSelectors = [
    "script", "style", "noscript", "iframe", "svg", "canvas",
    "nav", "footer", "header", "aside",
    "[role='alert']", "[role='banner']", "[role='navigation']",
    ".ad", ".ads", ".advertisement", ".banner",
    ".cookie-banner", ".cookie-notice", ".cookie-consent",
    ".social-share", ".share-buttons", ".newsletter-signup",
    ".comments", "#comments", ".disqus"
  ];

  clone.querySelectorAll(clutterSelectors.join(", ")).forEach(el => el.remove());

  // Heuristic main content detection: search for standard semantic tags
  let mainContainer = clone.querySelector("article, main, [role='main'], .post-content, .article-body, #content");
  if (!mainContainer) {
    mainContainer = clone;
  }

  // Convert elements into clean Markdown format
  function domToMarkdown(element) {
    let md = "";
    for (const node of element.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent.replace(/\s+/g, " ");
        md += text;
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const tag = node.tagName.toLowerCase();
        
        if (["h1", "h2", "h3", "h4", "h5", "h6"].includes(tag)) {
          const level = parseInt(tag[1], 10);
          const prefix = "#".repeat(level) + " ";
          md += `\n\n${prefix}${node.textContent.trim()}\n\n`;
        } else if (tag === "p") {
          md += `\n\n${domToMarkdown(node).trim()}\n\n`;
        } else if (tag === "pre" || tag === "code") {
          if (tag === "pre") {
            md += `\n\n\`\`\`\n${node.textContent.trim()}\n\`\`\`\n\n`;
          } else {
            md += `\`${node.textContent}\``;
          }
        } else if (tag === "blockquote") {
          md += `\n\n> ${node.textContent.trim().replace(/\n/g, "\n> ")}\n\n`;
        } else if (tag === "ul") {
          md += "\n\n";
          node.querySelectorAll(":scope > li").forEach(li => {
            md += `* ${domToMarkdown(li).trim()}\n`;
          });
          md += "\n";
        } else if (tag === "ol") {
          md += "\n\n";
          let idx = 1;
          node.querySelectorAll(":scope > li").forEach(li => {
            md += `${idx++}. ${domToMarkdown(li).trim()}\n`;
          });
          md += "\n";
        } else if (tag === "a") {
          let href = node.getAttribute("href");
          const text = node.textContent.trim();
          if (href && text && !href.startsWith("javascript:")) {
            try {
              href = decodeURI(href);
            } catch (e) {}
            // Convert relative Wikipedia/site links to absolute
            if (href.startsWith("/")) {
              try {
                const u = new URL(href, window.location.origin);
                href = decodeURI(u.href);
              } catch (e) {}
            }
            md += ` [${text}](${href}) `;
          } else {
            md += text;
          }
        } else {
          md += domToMarkdown(node);
        }
      }
    }
    return md;
  }

  const rawMarkdown = domToMarkdown(mainContainer);

  // Normalize excessive blank lines
  const cleanMarkdown = rawMarkdown
    .split("\n")
    .map(line => line.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return {
    title,
    url,
    markdown: cleanMarkdown,
    extractedAt: new Date().toISOString()
  };
}

// Listen for popup messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "EXTRACT_CONTENT") {
    try {
      const data = extractArticleContent();
      sendResponse({ success: true, data });
    } catch (err) {
      sendResponse({ success: false, error: err.message });
    }
  }
  return true;
});
