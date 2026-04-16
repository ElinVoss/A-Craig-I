const BACKEND_URL = "http://localhost:8000";

const grabBtn    = document.getElementById("grabBtn");
const sendBtn    = document.getElementById("sendBtn");
const lessonBtn  = document.getElementById("lessonBtn");
const statusDiv  = document.getElementById("status");
const platformBadge = document.getElementById("platformBadge");

let capturedData = null;

// ─── Auth token from storage ───────────────────────────────────────────────
function getToken() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['vibecode_token'], (r) => resolve(r.vibecode_token || null));
  });
}

// ─── Status helper ─────────────────────────────────────────────────────────
function updateStatus(message, type = "info") {
  statusDiv.textContent = message;
  statusDiv.className = type;
}

// ─── Platform detection on popup open ──────────────────────────────────────
(async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.tabs.sendMessage(tab.id, { action: "PING" }, (resp) => {
      if (resp?.platform) {
        const PLATFORM_LABELS = {
          chatgpt: '🤖 ChatGPT', claude: '🟠 Claude', gemini: '💎 Gemini',
          github: '🐙 GitHub', stackoverflow: '📚 Stack Overflow',
          cursor: '⬛ Cursor AI', v0: '▲ v0.dev', bolt: '⚡ Bolt',
          replit: '🔄 Replit', codesandbox: '📦 CodeSandbox',
          codepen: '🖊️ CodePen', generic: '🌐 Generic page',
        };
        platformBadge.textContent = PLATFORM_LABELS[resp.platform] || `🌐 ${resp.platform}`;
      } else {
        platformBadge.textContent = '⚠️ Extension not active here';
      }
    });
  } catch {}
})();

// ─── Grab code from page ────────────────────────────────────────────────────
grabBtn.addEventListener("click", async () => {
  updateStatus("Scanning page for code...", "loading");
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.tabs.sendMessage(tab.id, { action: "GRAB_DATA" }, (response) => {
      if (chrome.runtime.lastError) {
        updateStatus("❌ Cannot reach page. Try refreshing it.", "error");
        return;
      }
      if (response?.error) {
        updateStatus(`❌ ${response.error}`, "error");
        capturedData = null;
        sendBtn.disabled = true;
        lessonBtn.disabled = true;
      } else {
        capturedData = response;
        sendBtn.disabled = false;
        lessonBtn.disabled = false;
        const preview = (response.code || '').substring(0, 60).replace(/\n/g, ' ');
        updateStatus(`✅ Captured! "${preview}..." — ${(response.code||'').length} chars`, "success");
      }
    });
  } catch (error) {
    updateStatus(`❌ ${error.message}`, "error");
  }
});

// ─── Ingest to backend (legacy /ingest endpoint) ────────────────────────────
sendBtn.addEventListener("click", async () => {
  if (!capturedData) { updateStatus("❌ Grab code first.", "error"); return; }
  updateStatus("Sending to backend...", "loading");
  try {
    const response = await fetch(`${BACKEND_URL}/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: capturedData.code,
        context: capturedData.context,
        url: capturedData.url,
        source_model: capturedData.platform || "Unknown"
      })
    });
    if (!response.ok) throw new Error(`Server: HTTP ${response.status}`);
    const result = await response.json();
    updateStatus(`📥 Ingested! ID: ${result.project_id}`, "success");
  } catch (error) {
    updateStatus(`❌ ${error.message}`, "error");
  }
});

// ─── Generate lesson directly ────────────────────────────────────────────────
lessonBtn.addEventListener("click", async () => {
  if (!capturedData) { updateStatus("❌ Grab code first.", "error"); return; }
  updateStatus("🧠 Generating lesson...", "loading");
  const token = await getToken();
  try {
    const endpoint = token ? "/api/lessons/generate" : "/generate-lesson";
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const response = await fetch(`${BACKEND_URL}${endpoint}`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        code: capturedData.code,
        context: capturedData.context,
        url: capturedData.url,
        source_model: capturedData.platform || "Unknown",
        difficulty: "beginner"
      })
    });
    if (response.status === 402) {
      updateStatus("🔒 Free lesson limit reached. Upgrade to Pro in the dashboard.", "error");
      return;
    }
    if (!response.ok) throw new Error(`Server: HTTP ${response.status}`);
    const result = await response.json();
    const title = result.lesson?.title || result.title || "Lesson generated";
    updateStatus(`✨ "${title}" — open the dashboard to view!`, "success");
  } catch (error) {
    updateStatus(`❌ ${error.message}`, "error");
  }
});

