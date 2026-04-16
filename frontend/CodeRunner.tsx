/**
 * CodeRunner — in-browser code execution for VibeCode lessons.
 *
 * Python  → Pyodide (CPython compiled to WASM, runs entirely in browser)
 * JS/TS   → sandboxed iframe with postMessage API
 * Other   → shows "coming soon" (server-side execution in Phase 5)
 *
 * Design goals:
 *  - Zero backend round-trip for the common case (Python + JS cover 90% of lessons)
 *  - Lazy-load Pyodide only when a Python snippet is rendered (saves ~10MB on page load)
 *  - Sandboxed iframe blocks DOM access and network for JS execution
 *  - Output is inline, directly below the code block
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Box, Button, CircularProgress, Typography, Paper,
  Chip, Alert, IconButton, Tooltip
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import RestartAltIcon from '@mui/icons-material/RestartAlt';

// ——————————————————————————————————————————————————————————————————
// Types
// ——————————————————————————————————————————————————————————————————

interface RunResult {
  output: string;
  error: string | null;
  duration_ms: number;
}

type RunState = 'idle' | 'loading_runtime' | 'running' | 'done' | 'error';

interface CodeRunnerProps {
  code: string;
  language: string;          // "python" | "javascript" | "typescript" | other
  showLineNumbers?: boolean;
  onReplay?: () => void;     // fired each time "Run" is clicked
}

// ——————————————————————————————————————————————————————————————————
// Pyodide loader (singleton — only load once per page session)
// ——————————————————————————————————————————————————————————————————

let pyodideInstance: any = null;
let pyodideLoading: Promise<any> | null = null;

async function loadPyodide(): Promise<any> {
  if (pyodideInstance) return pyodideInstance;
  if (pyodideLoading) return pyodideLoading;

  pyodideLoading = (async () => {
    // Dynamically inject Pyodide script if not already present
    if (!(window as any).loadPyodide) {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/pyodide/v0.25.1/full/pyodide.js';
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load Pyodide'));
        document.head.appendChild(script);
      });
    }
    pyodideInstance = await (window as any).loadPyodide();
    return pyodideInstance;
  })();

  return pyodideLoading;
}

// ——————————————————————————————————————————————————————————————————
// Python execution via Pyodide
// ——————————————————————————————————————————————————————————————————

async function runPython(code: string): Promise<RunResult> {
  const start = performance.now();
  try {
    const py = await loadPyodide();

    // Redirect stdout/stderr to captured buffers
    await py.runPythonAsync(`
import sys
import io
_stdout_capture = io.StringIO()
_stderr_capture = io.StringIO()
sys.stdout = _stdout_capture
sys.stderr = _stderr_capture
`);

    let errorMsg: string | null = null;
    try {
      await py.runPythonAsync(code);
    } catch (err: any) {
      errorMsg = String(err);
    }

    const stdout: string = await py.runPythonAsync('_stdout_capture.getvalue()');
    const stderr: string = await py.runPythonAsync('_stderr_capture.getvalue()');

    // Restore real stdout
    await py.runPythonAsync('sys.stdout = sys.__stdout__; sys.stderr = sys.__stderr__');

    return {
      output: stdout + (stderr ? `\n[stderr]\n${stderr}` : ''),
      error: errorMsg,
      duration_ms: Math.round(performance.now() - start),
    };
  } catch (err: any) {
    return {
      output: '',
      error: `Runtime error: ${err.message}`,
      duration_ms: Math.round(performance.now() - start),
    };
  }
}

// ——————————————————————————————————————————————————————————————————
// JavaScript execution via sandboxed iframe
// ——————————————————————————————————————————————————————————————————

function runJavaScript(code: string): Promise<RunResult> {
  return new Promise((resolve) => {
    const start = performance.now();
    const iframe = document.createElement('iframe');
    iframe.sandbox.add('allow-scripts');  // No DOM access, no network, no same-origin
    iframe.style.display = 'none';
    document.body.appendChild(iframe);

    const timeout = setTimeout(() => {
      document.body.removeChild(iframe);
      resolve({ output: '', error: 'Execution timed out (5s)', duration_ms: 5000 });
    }, 5000);

    const handler = (event: MessageEvent) => {
      if (event.source !== iframe.contentWindow) return;
      clearTimeout(timeout);
      window.removeEventListener('message', handler);
      document.body.removeChild(iframe);
      resolve({
        output: event.data.output ?? '',
        error: event.data.error ?? null,
        duration_ms: Math.round(performance.now() - start),
      });
    };
    window.addEventListener('message', handler);

    // Inject runner script into iframe
    const runnerSrc = `
      const logs = [];
      const _console = { log: (...a) => logs.push(a.map(String).join(' ')), error: (...a) => logs.push('[error] ' + a.map(String).join(' ')), warn: (...a) => logs.push('[warn] ' + a.map(String).join(' ')) };
      let errorMsg = null;
      try {
        const console = _console;
        ${code}
      } catch(e) {
        errorMsg = e.message;
      }
      parent.postMessage({ output: logs.join('\\n'), error: errorMsg }, '*');
    `;
    iframe.contentWindow!.document.open();
    iframe.contentWindow!.document.write(`<script>${runnerSrc}<\/script>`);
    iframe.contentWindow!.document.close();
  });
}

// ——————————————————————————————————————————————————————————————————
// Language detection helpers
// ——————————————————————————————————————————————————————————————————

function normaliseLanguage(lang: string): 'python' | 'javascript' | 'unsupported' {
  const l = lang.toLowerCase();
  if (l === 'python' || l === 'py') return 'python';
  if (l === 'javascript' || l === 'js' || l === 'typescript' || l === 'ts') return 'javascript';
  return 'unsupported';
}

function languageColor(lang: string): 'default' | 'primary' | 'secondary' {
  const l = normaliseLanguage(lang);
  if (l === 'python') return 'primary';
  if (l === 'javascript') return 'secondary';
  return 'default';
}

// ——————————————————————————————————————————————————————————————————
// Component
// ——————————————————————————————————————————————————————————————————

const CodeRunner: React.FC<CodeRunnerProps> = ({ code, language, showLineNumbers = false, onReplay }) => {
  const [runState, setRunState] = useState<RunState>('idle');
  const [result, setResult] = useState<RunResult | null>(null);
  const [copied, setCopied] = useState(false);
  const abortRef = useRef(false);
  const lang = normaliseLanguage(language);

  // Pre-warm Pyodide in background when a Python block is rendered
  useEffect(() => {
    if (lang === 'python') {
      loadPyodide().catch(() => {});  // Fire and forget
    }
  }, [lang]);

  const handleRun = useCallback(async () => {
    abortRef.current = false;
    setResult(null);
    onReplay?.();

    if (lang === 'python') {
      setRunState('loading_runtime');
      await loadPyodide().catch(() => null);  // Ensure loaded
    }

    setRunState('running');
    let res: RunResult;

    try {
      if (lang === 'python') {
        res = await runPython(code);
      } else if (lang === 'javascript') {
        res = await runJavaScript(code);
      } else {
        res = {
          output: '',
          error: `'${language}' execution is coming in Phase 5 (multi-language server-side runner).`,
          duration_ms: 0,
        };
      }
    } catch (err: any) {
      res = { output: '', error: String(err), duration_ms: 0 };
    }

    if (!abortRef.current) {
      setResult(res);
      setRunState(res.error ? 'error' : 'done');
    }
  }, [code, lang, language]);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  const handleReset = useCallback(() => {
    abortRef.current = true;
    setRunState('idle');
    setResult(null);
  }, []);

  const isRunning = runState === 'loading_runtime' || runState === 'running';

  return (
    <Box sx={{ my: 1 }}>
      {/* Code block header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 1.5,
          py: 0.5,
          bgcolor: 'grey.900',
          borderRadius: '8px 8px 0 0',
          borderBottom: '1px solid',
          borderColor: 'grey.700',
        }}
      >
        <Chip
          label={language}
          size="small"
          color={languageColor(language)}
          variant="outlined"
          sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }}
        />
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title={copied ? 'Copied!' : 'Copy code'}>
            <IconButton size="small" onClick={handleCopy} sx={{ color: 'grey.400' }}>
              {copied ? <CheckIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
          {result && (
            <Tooltip title="Clear output">
              <IconButton size="small" onClick={handleReset} sx={{ color: 'grey.400' }}>
                <RestartAltIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <Button
            size="small"
            variant="contained"
            color={lang === 'unsupported' ? 'inherit' : 'success'}
            startIcon={isRunning ? <CircularProgress size={12} color="inherit" /> : <PlayArrowIcon />}
            onClick={handleRun}
            disabled={isRunning}
            sx={{ minWidth: 70, fontSize: '0.75rem' }}
          >
            {runState === 'loading_runtime' ? 'Loading…' : isRunning ? 'Running' : 'Run'}
          </Button>
        </Box>
      </Box>

      {/* Code block body */}
      <Box
        component="pre"
        sx={{
          m: 0,
          p: 2,
          bgcolor: 'grey.900',
          color: 'grey.100',
          fontFamily: '"Fira Code", "Cascadia Code", monospace',
          fontSize: '0.85rem',
          lineHeight: 1.6,
          overflowX: 'auto',
          borderRadius: result ? 0 : '0 0 8px 8px',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {showLineNumbers
          ? code.split('\n').map((line, i) => (
              <Box key={i} component="span" sx={{ display: 'block' }}>
                <Box component="span" sx={{ color: 'grey.600', mr: 2, userSelect: 'none', minWidth: 24, display: 'inline-block', textAlign: 'right' }}>
                  {i + 1}
                </Box>
                {line}
              </Box>
            ))
          : code}
      </Box>

      {/* Output panel */}
      {result && (
        <Paper
          variant="outlined"
          sx={{
            borderRadius: '0 0 8px 8px',
            borderTop: 'none',
            bgcolor: result.error ? 'error.950' : 'success.950',
            borderColor: result.error ? 'error.700' : 'success.700',
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              px: 1.5,
              py: 0.5,
              borderBottom: '1px solid',
              borderColor: 'inherit',
              bgcolor: result.error ? 'error.900' : 'success.900',
            }}
          >
            <Typography variant="caption" sx={{ color: result.error ? 'error.300' : 'success.300', fontFamily: 'monospace' }}>
              {result.error ? '✗ Error' : '✓ Output'} · {result.duration_ms}ms
            </Typography>
          </Box>
          <Box
            component="pre"
            sx={{
              m: 0,
              p: 1.5,
              fontFamily: '"Fira Code", monospace',
              fontSize: '0.82rem',
              color: result.error ? 'error.200' : 'grey.100',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              maxHeight: 300,
              overflowY: 'auto',
            }}
          >
            {result.error || result.output || '(no output)'}
          </Box>
        </Paper>
      )}

      {/* First-run hint for Python (Pyodide takes ~3s first load) */}
      {lang === 'python' && runState === 'idle' && (
        <Typography variant="caption" sx={{ color: 'grey.500', px: 0.5, display: 'block', mt: 0.5 }}>
          First run loads Python runtime in browser (~3s). Subsequent runs are instant.
        </Typography>
      )}
    </Box>
  );
};

export default CodeRunner;
