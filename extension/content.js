// Function to grab the latest code block and the text right before it
function captureContext() {
  const codeBlocks = document.querySelectorAll('pre, .code-block, [class*="artifact"], [class*="canvas"]');
  const latestBlock = codeBlocks[codeBlocks.length - 1];
  
  if (!latestBlock) return { error: "No code found!" };

  // Get the prompt text (usually in the preceding sibling or parent)
  const conversationContext = latestBlock.parentElement.innerText.substring(0, 1000);

  return {
    code: latestBlock.innerText,
    context: conversationContext,
    url: window.location.href,
    timestamp: new Date().toISOString()
  };
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "GRAB_DATA") {
    sendResponse(captureContext());
  }
});
