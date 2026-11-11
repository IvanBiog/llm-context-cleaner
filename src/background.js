// Service Worker for keyboard shortcuts and context menus
chrome.commands.onCommand.addListener(async (command) => {
  if (command === "quick-extract") {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) return;

    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: extractPageCleanText,
      });

      if (results && results[0] && results[0].result) {
        const markdown = results[0].result;
        // Copy directly using offscreen or return to storage
        await chrome.storage.local.set({ lastExtracted: markdown, timestamp: Date.now() });
      }
    } catch (err) {
      console.error("Quick extract failed:", err);
    }
  }
});

// Fallback extraction function injected directly if needed
function extractPageCleanText() {
  const title = document.title || "";
  const url = window.location.href;
  const clone = document.body.cloneNode(true);

  // Remove noisy DOM elements
  const selectorsToRemove = [
    "script", "style", "noscript", "iframe", "svg",
    "nav", "header", "footer", "aside",
    ".ad", ".ads", ".advertisement", "#cookie-banner", ".cookie-consent"
  ];
  clone.querySelectorAll(selectorsToRemove.join(", ")).forEach(el => el.remove());

  const cleanText = clone.innerText
    .split("\n")
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join("\n\n");

  return `# ${title}\n\nSource: ${url}\n\n${cleanText}`;
}
