/**
 * VibeCode content.js v0.2.0
 * 
 * Platform-aware code scraper. Detects which site you're on and uses
 * the best selector strategy for that platform.
 * 
 * Supported platforms:
 *   - ChatGPT (chatgpt.com, chat.openai.com)
 *   - Claude (claude.ai)
 *   - Gemini (gemini.google.com)
 *   - GitHub (files, PRs, gists, issues)
 *   - Stack Overflow / Stack Exchange
 *   - Cursor AI (cursor.sh)
 *   - v0.dev, Bolt, Replit, CodeSandbox, CodePen
 *   - Any page with <pre> or <code> blocks (fallback)
 */

// ─── Platform detection ────────────────────────────────────────────────────

function detectPlatform(url) {
  if (url.includes('chatgpt.com') || url.includes('chat.openai.com')) return 'chatgpt';
  if (url.includes('claude.ai')) return 'claude';
  if (url.includes('gemini.google.com')) return 'gemini';
  if (url.includes('github.com')) return 'github';
  if (url.includes('stackoverflow.com') || url.includes('stackexchange.com')) return 'stackoverflow';
  if (url.includes('cursor.sh')) return 'cursor';
  if (url.includes('v0.dev')) return 'v0';
  if (url.includes('bolt.new')) return 'bolt';
  if (url.includes('replit.com')) return 'replit';
  if (url.includes('codesandbox.io')) return 'codesandbox';
  if (url.includes('codepen.io')) return 'codepen';
  return 'generic';
}

// ─── Per-platform scrapers ─────────────────────────────────────────────────

const SCRAPERS = {

  chatgpt(doc) {
    // ChatGPT renders code in <code> inside <pre> inside .markdown
    const blocks = doc.querySelectorAll('pre code, [data-message-author-role="assistant"] pre');
    return pickLatestBlock(blocks) || genericFallback(doc);
  },

  claude(doc) {
    // Claude uses artifact containers and standard <pre>
    const blocks = doc.querySelectorAll(
      '[class*="artifact"] pre, [class*="code-block"] pre, .prose pre, pre'
    );
    return pickLatestBlock(blocks) || genericFallback(doc);
  },

  gemini(doc) {
    // Gemini uses [class*="code"], canvas-style artifacts
    const blocks = doc.querySelectorAll(
      '[class*="code-block"], [class*="artifact"], pre, code'
    );
    return pickLatestBlock(blocks) || genericFallback(doc);
  },

  github(doc) {
    // Prefer PR diff hunks, then file content, then README code blocks
    const diffLines = doc.querySelectorAll('.blob-code-addition, .blob-code-context');
    if (diffLines.length > 0) {
      // PR diff — grab full diff blob
      const lines = [...diffLines].map(el => el.innerText).join('\n');
      const prTitle = doc.querySelector('.js-issue-title, h1.gh-header-title')?.innerText?.trim() || '';
      return {
        code: lines.substring(0, 6000),
        context: `GitHub PR/diff: ${prTitle}`,
        platform: 'github',
        url: window.location.href,
        timestamp: new Date().toISOString(),
      };
    }
    // File view
    const fileBlob = doc.querySelector('#raw-url, .blob-wrapper pre, .highlight pre');
    if (fileBlob) {
      return {
        code: fileBlob.innerText.substring(0, 6000),
        context: `GitHub file: ${document.title}`,
        platform: 'github',
        url: window.location.href,
        timestamp: new Date().toISOString(),
      };
    }
    return genericFallback(doc);
  },

  stackoverflow(doc) {
    // Prefer accepted answer code blocks, then all answer code blocks
    const accepted = doc.querySelectorAll('.accepted-answer pre code, .answer.accepted-answer pre');
    if (accepted.length > 0) {
      return buildResult(accepted[accepted.length - 1], doc, 'stackoverflow');
    }
    const answers = doc.querySelectorAll('.answer pre code');
    return pickLatestBlock(answers) || genericFallback(doc);
  },

  cursor(doc) {
    // Cursor AI renders suggestions in .cm-content or standard <pre>
    const blocks = doc.querySelectorAll('.cm-content, .chat-code-block pre, pre code');
    return pickLatestBlock(blocks) || genericFallback(doc);
  },

  v0(doc) {
    const blocks = doc.querySelectorAll('[class*="code"] pre, pre code, pre');
    return pickLatestBlock(blocks) || genericFallback(doc);
  },

  bolt(doc) {
    const blocks = doc.querySelectorAll('.code-editor pre, [data-language] pre, pre code');
    return pickLatestBlock(blocks) || genericFallback(doc);
  },

  replit(doc) {
    const blocks = doc.querySelectorAll('.CodeMirror-code, .cm-content, pre code');
    return pickLatestBlock(blocks) || genericFallback(doc);
  },

  codesandbox(doc) {
    const blocks = doc.querySelectorAll('.view-lines, pre code, pre');
    return pickLatestBlock(blocks) || genericFallback(doc);
  },

  codepen(doc) {
    const blocks = doc.querySelectorAll('.CodeMirror-code, pre code, pre');
    return pickLatestBlock(blocks) || genericFallback(doc);
  },

  generic: genericFallback,
};

// ─── Helper utilities ──────────────────────────────────────────────────────

function pickLatestBlock(nodeList) {
  if (!nodeList || nodeList.length === 0) return null;
  const block = nodeList[nodeList.length - 1];
  return buildResult(block, document, detectPlatform(window.location.href));
}

function buildResult(block, doc, platform) {
  const code = block.innerText || block.textContent || '';
  if (!code.trim()) return null;
  // Walk up to find meaningful context (preceding text, question title, etc.)
  const contextEl = block.closest('article, section, .message, .answer, .conversation-turn')
    || block.parentElement;
  const context = contextEl ? contextEl.innerText.substring(0, 1200) : '';
  return {
    code: code.trim(),
    context: context.trim(),
    platform,
    url: window.location.href,
    timestamp: new Date().toISOString(),
  };
}

function genericFallback(doc) {
  // Widest net: any <pre> or <code> block on any page
  const blocks = doc.querySelectorAll(
    'pre code, pre, [class*="highlight"] code, [class*="code-block"], [class*="codeblock"]'
  );
  if (!blocks || blocks.length === 0) {
    return { error: 'No code found on this page.' };
  }
  return pickLatestBlock(blocks);
}

// ─── Main capture function ─────────────────────────────────────────────────

function captureContext() {
  const platform = detectPlatform(window.location.href);
  const scraper = SCRAPERS[platform] || SCRAPERS.generic;
  const result = scraper(document);
  if (!result || result.error) {
    return { error: result?.error || 'No code found on this page.' };
  }
  return result;
}

// ─── Message listener ──────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'GRAB_DATA') {
    sendResponse(captureContext());
  }
  if (request.action === 'PING') {
    // Used by popup to check if content script is loaded
    sendResponse({ ok: true, platform: detectPlatform(window.location.href) });
  }
  return true; // keep channel open for async
});

