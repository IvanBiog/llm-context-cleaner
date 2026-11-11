let currentMode = "single"; // "single" or "batch"
let currentArticleData = null;
let currentBatchData = [];

const PRESETS = {
  none: "",
  summarize: "Please provide a concise executive summary and bulleted key takeaways from the following document(s):\n\n",
  code_audit: "Review the following code/documentation for security vulnerabilities, architectural bottlenecks, and optimization opportunities:\n\n",
  fact_check: "Extract all key factual claims, statistics, and verifiable assertions from the text below, flagging any unsupported assumptions:\n\n",
  qa_study: "Generate a comprehensive set of 5-10 deep conceptual questions and answers based strictly on this text:\n\n"
};

// Estimate LLM tokens (~3.8 chars per token for Latin, ~1.5 for Cyrillic/Code)
function estimateTokenCount(text) {
  if (!text) return 0;
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const chars = text.length;
  return Math.round((chars / 3.8 + words * 0.25) / 1.15);
}

function updateStats(text) {
  const chars = text.length;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const tokens = estimateTokenCount(text);
  const minutes = Math.max(1, Math.round(words / 200));

  document.getElementById("token-badge").textContent = `~${tokens.toLocaleString()} tokens`;
  document.getElementById("char-count").textContent = `${chars.toLocaleString()} chars`;
  document.getElementById("word-count").textContent = `${words.toLocaleString()} words`;
  document.getElementById("reading-time").textContent = `${minutes} min read`;
}

function formatSingleArticle(data, formatType) {
  if (!data) return "";
  if (formatType === "markdown") {
    return `# ${data.title}\nSource: ${data.url}\n\n${data.markdown}`;
  } else if (formatType === "text") {
    return `${data.title}\nSource: ${data.url}\n\n${data.markdown.replace(/^[#*>\s`-]+/gm, "")}`;
  } else if (formatType === "llm-xml") {
    return `<document>\n  <source>${data.url}</source>\n  <title>${data.title}</title>\n  <content>\n${data.markdown}\n  </content>\n</document>`;
  }
  return data.markdown;
}

function formatBatchArticles(articles, formatType) {
  if (!articles || articles.length === 0) return "";
  
  if (formatType === "markdown") {
    let result = `# Collected Knowledge Base (${articles.length} documents)\n\n`;
    articles.forEach((art, index) => {
      result += `## [Document ${index + 1}] ${art.title}\nSource: ${art.url}\n\n${art.markdown}\n\n---\n\n`;
    });
    return result;
  } else if (formatType === "text") {
    let result = `Collected Knowledge Base (${articles.length} documents)\n\n`;
    articles.forEach((art, index) => {
      result += `=== Document ${index + 1}: ${art.title} ===\nSource: ${art.url}\n\n${art.markdown.replace(/^[#*>\s`-]+/gm, "")}\n\n`;
    });
    return result;
  } else if (formatType === "llm-xml") {
    let result = `<knowledge_base count="${articles.length}">\n`;
    articles.forEach((art, index) => {
      result += `  <document index="${index + 1}">\n    <title>${art.title}</title>\n    <source>${art.url}</source>\n    <content>\n${art.markdown}\n    </content>\n  </document>\n`;
    });
    result += `</knowledge_base>`;
    return result;
  }
  return "";
}

function formatContent(formatType) {
  const presetKey = document.getElementById("prompt-preset") ? document.getElementById("prompt-preset").value : "none";
  const promptPrefix = PRESETS[presetKey] || "";

  let baseOutput = "";
  if (currentMode === "single") {
    baseOutput = formatSingleArticle(currentArticleData, formatType);
  } else {
    baseOutput = formatBatchArticles(currentBatchData, formatType);
  }

  return promptPrefix + baseOutput;
}

async function requestSingleExtraction() {
  const statusEl = document.getElementById("status-msg");
  const previewArea = document.getElementById("preview-text");
  
  statusEl.textContent = "Analyzing active page...";
  previewArea.value = "Extracting content...";

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) {
    statusEl.textContent = "Error: No active tab found.";
    return;
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["src/content.js"]
    });
  } catch (e) {
    // Already injected or restricted
  }

  chrome.tabs.sendMessage(tab.id, { action: "EXTRACT_CONTENT" }, (response) => {
    if (chrome.runtime.lastError || !response || !response.success) {
      statusEl.textContent = "Could not extract: browser page is protected or empty.";
      previewArea.value = "Extraction unavailable for this page.";
      return;
    }

    currentArticleData = response.data;
    renderCurrentFormat();
    statusEl.textContent = "Ready to copy.";
  });
}

async function requestBatchExtraction() {
  const statusEl = document.getElementById("status-msg");
  const previewArea = document.getElementById("preview-text");

  statusEl.textContent = "Scanning all open tabs...";
  previewArea.value = "Collecting content from all open tabs...";

  const tabs = await chrome.tabs.query({ currentWindow: true });
  const validTabs = tabs.filter(t => t.url && !t.url.startsWith("chrome://") && !t.url.startsWith("edge://") && !t.url.startsWith("about:"));

  if (validTabs.length === 0) {
    statusEl.textContent = "No supported web tabs found.";
    previewArea.value = "Open some web pages first.";
    return;
  }

  currentBatchData = [];
  let processed = 0;

  for (const tab of validTabs) {
    statusEl.textContent = `Processing tab ${++processed} of ${validTabs.length}...`;
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["src/content.js"]
      });

      const res = await new Promise((resolve) => {
        chrome.tabs.sendMessage(tab.id, { action: "EXTRACT_CONTENT" }, (response) => {
          if (chrome.runtime.lastError || !response || !response.success) {
            resolve(null);
          } else {
            resolve(response.data);
          }
        });
      });

      if (res && res.markdown && res.markdown.length > 50) {
        currentBatchData.push(res);
      }
    } catch (e) {
      // Tab failed (e.g. discard state or permission)
    }
  }

  if (currentBatchData.length === 0) {
    statusEl.textContent = "Failed to extract clean content from tabs.";
    previewArea.value = "No readable articles found in open tabs.";
    return;
  }

  renderCurrentFormat();
  statusEl.textContent = `Batch complete: ${currentBatchData.length} tabs merged.`;
}

function renderCurrentFormat() {
  const format = document.querySelector('input[name="format"]:checked').value;
  const formattedText = formatContent(format);
  
  const previewArea = document.getElementById("preview-text");
  previewArea.value = formattedText;
  updateStats(formattedText);
}

// Mode tab switching
document.getElementById("mode-single-btn").addEventListener("click", () => {
  if (currentMode === "single") return;
  currentMode = "single";
  document.getElementById("mode-single-btn").classList.add("active");
  document.getElementById("mode-all-btn").classList.remove("active");
  if (currentArticleData) {
    renderCurrentFormat();
  } else {
    requestSingleExtraction();
  }
});

document.getElementById("mode-all-btn").addEventListener("click", () => {
  if (currentMode === "batch") return;
  currentMode = "batch";
  document.getElementById("mode-all-btn").classList.add("active");
  document.getElementById("mode-single-btn").classList.remove("active");
  requestBatchExtraction();
});

// Copy action with UI feedback
document.getElementById("copy-btn").addEventListener("click", async () => {
  const previewArea = document.getElementById("preview-text");
  const copyBtn = document.getElementById("copy-btn");
  const copyText = document.getElementById("copy-text");

  if (!previewArea.value) return;

  try {
    await navigator.clipboard.writeText(previewArea.value);
    copyBtn.classList.add("copied");
    copyText.textContent = "Copied to Clipboard!";
    setTimeout(() => {
      copyBtn.classList.remove("copied");
      copyText.textContent = "Copy to Clipboard";
    }, 2000);
  } catch (err) {
    document.getElementById("status-msg").textContent = "Clipboard permission error.";
  }
});

// Format and Preset listeners
document.querySelectorAll('input[name="format"]').forEach((radio) => {
  radio.addEventListener("change", renderCurrentFormat);
});

const presetSelect = document.getElementById("prompt-preset");
if (presetSelect) {
  presetSelect.addEventListener("change", renderCurrentFormat);
}

// Refresh button
document.getElementById("refresh-btn").addEventListener("click", () => {
  if (currentMode === "single") {
    requestSingleExtraction();
  } else {
    requestBatchExtraction();
  }
});

// PRO Panel Toggles & Validation
const proBtn = document.getElementById("pro-btn");
const licensePanel = document.getElementById("license-panel");
const closeLicenseBtn = document.getElementById("close-license-btn");
const activateBtn = document.getElementById("activate-license-btn");
const licenseInput = document.getElementById("license-key-input");
const statusEl = document.getElementById("status-msg");

proBtn.addEventListener("click", () => {
  licensePanel.classList.toggle("hidden");
});

closeLicenseBtn.addEventListener("click", () => {
  licensePanel.classList.add("hidden");
});

activateBtn.addEventListener("click", async () => {
  const key = licenseInput.value.trim().toUpperCase();
  if (!key) return;

  // Key validation: PRO-XXXXXXXX pattern
  if (key.startsWith("PRO-") && key.length >= 8) {
    await chrome.storage.local.set({ isProUser: true, proKey: key });
    statusEl.textContent = "PRO License Activated! Enjoy unlimited batching.";
    licensePanel.classList.add("hidden");
    proBtn.textContent = "⭐ PRO Active";
    proBtn.style.borderColor = "var(--success-color)";
    proBtn.style.color = "var(--success-color)";
  } else {
    statusEl.textContent = "Invalid license key format. Use PRO-XXXX...";
  }
});

// Check PRO status on startup
async function initLicenseStatus() {
  const data = await chrome.storage.local.get(["isProUser", "proKey"]);
  if (data.isProUser) {
    proBtn.textContent = "⭐ PRO Active";
    proBtn.style.borderColor = "var(--success-color)";
    proBtn.style.color = "var(--success-color)";
  }
}

// Auto-run on open
document.addEventListener("DOMContentLoaded", () => {
  initLicenseStatus();
  requestSingleExtraction();
});
