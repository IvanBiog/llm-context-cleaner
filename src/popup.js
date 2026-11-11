(() => {
  "use strict";

  let currentMode = "single";
  let activeTabData = null;
  let batchTabsData = [];

  const PROMPT_PRESETS = {
    none: "",
    summarize: "Please provide a concise executive summary and bulleted key takeaways from the following document(s):\n\n",
    code_audit: "Review the following code/documentation for security vulnerabilities, architectural bottlenecks, and optimization opportunities:\n\n",
    fact_check: "Extract all key factual claims, statistics, and verifiable assertions from the text below, flagging any unsupported assumptions:\n\n",
    qa_study: "Generate a comprehensive set of 5-10 deep conceptual questions and answers based strictly on this text:\n\n"
  };

  // Weighted token estimation model
  function calculateTokenMetrics(text) {
    if (!text) return { tokens: 0, words: 0, chars: 0, readTime: "0m" };
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    const chars = text.length;
    // Optimized token multiplier for mixed markdown/code
    const tokens = Math.max(0, Math.round((chars / 3.7 + words * 0.28) / 1.12));
    const minutes = Math.max(1, Math.ceil(words / 220));
    return { tokens, words, chars, readTime: `${minutes}m` };
  }

  function updateMetricsDisplay(text) {
    const { tokens, words, chars, readTime } = calculateTokenMetrics(text);
    document.getElementById("token-badge").textContent = `~${tokens.toLocaleString()} tokens`;
    document.getElementById("char-count").textContent = chars.toLocaleString();
    document.getElementById("word-count").textContent = words.toLocaleString();
    document.getElementById("reading-time").textContent = readTime;
  }

  function formatSingleArticle(data, format) {
    if (!data) return "";
    switch (format) {
      case "text":
        return `${data.title}\nSource: ${data.url}\n\n${data.markdown.replace(/^[#*>\s`-]+/gm, "")}`;
      case "llm-xml":
        return `<document>\n  <source>${data.url}</source>\n  <title>${data.title}</title>\n  <content>\n${data.markdown}\n  </content>\n</document>`;
      default:
        return `# ${data.title}\nSource: ${data.url}\n\n${data.markdown}`;
    }
  }

  function formatBatchArticles(articles, format) {
    if (!articles || articles.length === 0) return "";
    if (format === "text") {
      return articles.map((a, i) => `=== Document ${i + 1}: ${a.title} ===\nSource: ${a.url}\n\n${a.markdown.replace(/^[#*>\s`-]+/gm, "")}`).join("\n\n---\n\n");
    }
    if (format === "llm-xml") {
      const docsXml = articles.map((a, i) => `  <document index="${i + 1}">\n    <title>${a.title}</title>\n    <source>${a.url}</source>\n    <content>\n${a.markdown}\n    </content>\n  </document>`).join("\n");
      return `<knowledge_base count="${articles.length}">\n${docsXml}\n</knowledge_base>`;
    }
    return `# Collected Knowledge Base (${articles.length} documents)\n\n` + articles.map((a, i) => `## [Doc ${i + 1}] ${a.title}\nSource: ${a.url}\n\n${a.markdown}`).join("\n\n---\n\n");
  }

  function buildOutput() {
    const format = document.querySelector('input[name="format"]:checked')?.value || "markdown";
    const presetKey = document.getElementById("prompt-preset")?.value || "none";
    const prefix = PROMPT_PRESETS[presetKey] || "";

    const raw = currentMode === "single"
      ? formatSingleArticle(activeTabData, format)
      : formatBatchArticles(batchTabsData, format);

    return raw ? prefix + raw : "";
  }

  function renderOutput() {
    const output = buildOutput();
    document.getElementById("preview-text").value = output;
    updateMetricsDisplay(output);
  }

  async function executeSingleExtraction() {
    const statusEl = document.getElementById("status-msg");
    const previewEl = document.getElementById("preview-text");

    statusEl.textContent = "Analyzing active viewport...";
    previewEl.value = "Extracting article structure...";

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      statusEl.textContent = "Error: Active tab inaccessible";
      return;
    }

    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["src/content.js"]
      });
    } catch {
      // Script injection fallback
    }

    chrome.tabs.sendMessage(tab.id, { action: "EXTRACT_CONTENT" }, (res) => {
      if (chrome.runtime.lastError || !res?.success) {
        statusEl.textContent = "Extraction restricted on this domain";
        previewEl.value = "Unable to extract content: this page is protected or empty.";
        return;
      }
      activeTabData = res.data;
      renderOutput();
      statusEl.textContent = "Ready";
    });
  }

  async function executeBatchExtraction() {
    const statusEl = document.getElementById("status-msg");
    const previewEl = document.getElementById("preview-text");

    statusEl.textContent = "Querying window tabs...";
    previewEl.value = "Merging open tabs into unified context...";

    const tabs = await chrome.tabs.query({ currentWindow: true });
    const eligibleTabs = tabs.filter(t => t.url && !t.url.startsWith("chrome://") && !t.url.startsWith("edge://") && !t.url.startsWith("about:"));

    if (eligibleTabs.length === 0) {
      statusEl.textContent = "No supported tabs found";
      previewEl.value = "No readable web pages open in this window.";
      return;
    }

    batchTabsData = [];
    let count = 0;

    for (const tab of eligibleTabs) {
      statusEl.textContent = `Processing tab ${++count} of ${eligibleTabs.length}...`;
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["src/content.js"]
        });

        const article = await new Promise((resolve) => {
          chrome.tabs.sendMessage(tab.id, { action: "EXTRACT_CONTENT" }, (response) => {
            resolve(response?.success ? response.data : null);
          });
        });

        if (article?.markdown?.length > 40) {
          batchTabsData.push(article);
        }
      } catch {
        // Skip uninjectable tabs
      }
    }

    renderOutput();
    statusEl.textContent = `Batch complete: ${batchTabsData.length} tab(s) unified`;
  }

  // Setup UI Listeners
  document.getElementById("mode-single-btn").addEventListener("click", () => {
    if (currentMode === "single") return;
    currentMode = "single";
    document.getElementById("mode-single-btn").classList.add("active");
    document.getElementById("mode-all-btn").classList.remove("active");
    if (activeTabData) renderOutput();
    else executeSingleExtraction();
  });

  document.getElementById("mode-all-btn").addEventListener("click", () => {
    if (currentMode === "batch") return;
    currentMode = "batch";
    document.getElementById("mode-all-btn").classList.add("active");
    document.getElementById("mode-single-btn").classList.remove("active");
    executeBatchExtraction();
  });

  document.getElementById("copy-btn").addEventListener("click", async () => {
    const text = document.getElementById("preview-text").value;
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      const btn = document.getElementById("copy-btn");
      const lbl = document.getElementById("copy-text");
      btn.classList.add("copied");
      lbl.textContent = "Context Copied!";
      setTimeout(() => {
        btn.classList.remove("copied");
        lbl.textContent = "Copy Context";
      }, 1800);
    } catch {
      document.getElementById("status-msg").textContent = "Clipboard access failed";
    }
  });

  document.querySelectorAll('input[name="format"]').forEach(radio => {
    radio.addEventListener("change", renderOutput);
  });

  document.getElementById("prompt-preset")?.addEventListener("change", renderOutput);

  document.getElementById("refresh-btn").addEventListener("click", () => {
    if (currentMode === "single") executeSingleExtraction();
    else executeBatchExtraction();
  });

  // PRO Drawer Control
  const proChip = document.getElementById("pro-badge-btn");
  const licenseDrawer = document.getElementById("license-panel");

  proChip.addEventListener("click", () => licenseDrawer.classList.toggle("hidden"));
  document.getElementById("close-license-btn").addEventListener("click", () => licenseDrawer.classList.add("hidden"));

  document.getElementById("activate-license-btn").addEventListener("click", async () => {
    const key = document.getElementById("license-key-input").value.trim().toUpperCase();
    if (key.startsWith("PRO-") && key.length >= 8) {
      await chrome.storage.local.set({ isProUser: true, proKey: key });
      proChip.classList.add("active");
      proChip.textContent = "PRO ACTIVE";
      licenseDrawer.classList.add("hidden");
      document.getElementById("status-msg").textContent = "PRO License Activated";
    } else {
      document.getElementById("status-msg").textContent = "Invalid license key format";
    }
  });

  async function checkLicense() {
    const { isProUser } = await chrome.storage.local.get(["isProUser"]);
    if (isProUser) {
      proChip.classList.add("active");
      proChip.textContent = "PRO ACTIVE";
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    checkLicense();
    executeSingleExtraction();
  });
})();
