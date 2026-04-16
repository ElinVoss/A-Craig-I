const BACKEND_URL = "http://localhost:8000";

const grabBtn = document.getElementById("grabBtn");
const sendBtn = document.getElementById("sendBtn");
const statusDiv = document.getElementById("status");

let capturedData = null;

function updateStatus(message, type = "info") {
  statusDiv.textContent = message;
  statusDiv.className = type;
  if (type === "loading") {
    statusDiv.classList.add("loading");
  }
}

// Grab data from the current page
grabBtn.addEventListener("click", async () => {
  updateStatus("Grabbing data...", "loading");
  
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    chrome.tabs.sendMessage(tab.id, { action: "GRAB_DATA" }, (response) => {
      if (response?.error) {
        updateStatus(`❌ ${response.error}`, "error");
        capturedData = null;
        sendBtn.disabled = true;
      } else {
        capturedData = response;
        sendBtn.disabled = false;
        updateStatus(`✅ Grabbed! Code ready. Click "Send to Backend" to submit.`, "success");
      }
    });
  } catch (error) {
    updateStatus(`❌ Error: ${error.message}`, "error");
    sendBtn.disabled = true;
  }
});

// Send data to backend
sendBtn.addEventListener("click", async () => {
  if (!capturedData) {
    updateStatus("❌ No data grabbed. Click 'Grab Data' first.", "error");
    return;
  }

  updateStatus("Sending to backend...", "loading");

  try {
    const response = await fetch(`${BACKEND_URL}/ingest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        code: capturedData.code,
        context: capturedData.context,
        url: capturedData.url,
        source_model: "Unknown"
      })
    });

    if (!response.ok) {
      throw new Error(`Server responded with status ${response.status}`);
    }

    const result = await response.json();
    updateStatus(`✨ Success! Project ID: ${result.project_id}`, "success");
  } catch (error) {
    updateStatus(`❌ Backend error: ${error.message}`, "error");
  }
});
