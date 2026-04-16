/**
 * DepthSlider — user sets their explanation depth once, injected into every lesson.
 *
 * Levels:
 *   ELI5        — like I'm 5, pure analogies, no jargon
 *   Beginner    — newcomer to programming, plain English
 *   Intermediate — knows basics, wants the real mechanics
 *   Expert      — senior dev, skip the hand-holding, show the tradeoffs
 *
 * Stored in user profile (PATCH /api/me/depth).
 * Used by LessonGenerator to tune Gemini's explanation style.
 */

import React, { useState } from 'react';
import {
  Box, Typography, Paper, Button, Chip, Dialog,
  DialogTitle, DialogContent, DialogActions, Snackbar, CircularProgress,
} from '@mui/material';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import { useAuth } from './AuthContext';

// ——————————————————————————————————————————————————————————————————
// Types
// ——————————————————————————————————————————————————————————————————

export type DepthLevel = 'eli5' | 'beginner' | 'intermediate' | 'expert';

interface DepthOption {
  value: DepthLevel;
  label: string;
  emoji: string;
  description: string;
  example: string;
}

const DEPTH_OPTIONS: DepthOption[] = [
  {
    value: 'eli5',
    label: 'ELI5',
    emoji: '🧸',
    description: 'No jargon, pure analogies. Explain it like you would to a curious child.',
    example: '"CORS is like a bouncer at a club checking you\'re on the guest list."',
  },
  {
    value: 'beginner',
    label: 'Beginner',
    emoji: '🌱',
    description: 'New to programming. Plain English, step by step, with code examples.',
    example: '"The `async` keyword tells JavaScript this function might need to wait."',
  },
  {
    value: 'intermediate',
    label: 'Intermediate',
    emoji: '⚡',
    description: 'Knows the basics. Wants real mechanics, edge cases, and performance notes.',
    example: '"Promises chain via microtask queue, which flushes before the next event loop tick."',
  },
  {
    value: 'expert',
    label: 'Expert',
    emoji: '🔬',
    description: 'Senior dev. Skip the fundamentals, focus on tradeoffs, patterns, and gotchas.',
    example: '"This pattern leaks closure references — consider WeakMap for private state."',
  },
];

const DEPTH_COLORS: Record<DepthLevel, string> = {
  eli5:         '#a78bfa',  // purple
  beginner:     '#34d399',  // green
  intermediate: '#fb923c',  // orange
  expert:       '#f87171',  // red
};

// ——————————————————————————————————————————————————————————————————
// Component
// ——————————————————————————————————————————————————————————————————

interface DepthSliderProps {
  currentDepth: DepthLevel;
  onDepthChange?: (depth: DepthLevel) => void;
  compact?: boolean;  // true = just a chip, click opens dialog
}

export const DepthSlider: React.FC<DepthSliderProps> = ({
  currentDepth,
  onDepthChange,
  compact = false,
}) => {
  const { api } = useAuth();
  const [open, setOpen]         = useState(false);
  const [selected, setSelected] = useState<DepthLevel>(currentDepth);
  const [saving, setSaving]     = useState(false);
  const [toast, setToast]       = useState<string | null>(null);

  const currentOption = DEPTH_OPTIONS.find((o) => o.value === currentDepth)!;

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch('/api/me/depth', { depth_level: selected });
      onDepthChange?.(selected);
      setToast(`Depth set to ${DEPTH_OPTIONS.find((o) => o.value === selected)?.label}`);
      setOpen(false);
    } catch {
      setToast('Failed to save depth preference');
    } finally {
      setSaving(false);
    }
  };

  // ——— Compact chip trigger ———
  if (compact) {
    return (
      <>
        <Chip
          icon={<AutoStoriesIcon sx={{ fontSize: '0.9rem !important' }} />}
          label={`${currentOption.emoji} ${currentOption.label}`}
          onClick={() => { setSelected(currentDepth); setOpen(true); }}
          size="small"
          sx={{ bgcolor: DEPTH_COLORS[currentDepth], color: 'white', fontWeight: 600, cursor: 'pointer' }}
        />
        <DepthDialog
          open={open}
          selected={selected}
          saving={saving}
          onSelect={setSelected}
          onSave={handleSave}
          onClose={() => setOpen(false)}
        />
        <Snackbar
          open={!!toast}
          autoHideDuration={3000}
          onClose={() => setToast(null)}
          message={toast}
        />
      </>
    );
  }

  // ——— Full card ———
  return (
    <Box>
      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <AutoStoriesIcon /> Explanation Depth
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Set once — every lesson generated will match your level.
      </Typography>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4,1fr)' }, gap: 1.5, mb: 3 }}>
        {DEPTH_OPTIONS.map((opt) => (
          <Paper
            key={opt.value}
            onClick={() => setSelected(opt.value)}
            elevation={selected === opt.value ? 4 : 1}
            sx={{
              p: 2,
              cursor: 'pointer',
              border: '2px solid',
              borderColor: selected === opt.value ? DEPTH_COLORS[opt.value] : 'transparent',
              transition: 'all 0.2s',
              '&:hover': { borderColor: DEPTH_COLORS[opt.value], opacity: 0.9 },
              borderRadius: 2,
            }}
          >
            <Typography variant="h4" align="center" sx={{ mb: 0.5 }}>{opt.emoji}</Typography>
            <Typography variant="subtitle2" align="center" fontWeight={700}>{opt.label}</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, textAlign: 'center', lineHeight: 1.3 }}>
              {opt.description}
            </Typography>
          </Paper>
        ))}
      </Box>

      {selected && (
        <Paper
          variant="outlined"
          sx={{ p: 2, mb: 3, bgcolor: 'grey.50', borderRadius: 2, fontStyle: 'italic' }}
        >
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
            Example explanation at this level:
          </Typography>
          <Typography variant="body2">
            {DEPTH_OPTIONS.find((o) => o.value === selected)?.example}
          </Typography>
        </Paper>
      )}

      <Button
        variant="contained"
        onClick={handleSave}
        disabled={saving || selected === currentDepth}
        startIcon={saving ? <CircularProgress size={16} color="inherit" /> : null}
        sx={{ bgcolor: DEPTH_COLORS[selected] }}
      >
        {saving ? 'Saving…' : 'Save Depth Preference'}
      </Button>

      <Snackbar open={!!toast} autoHideDuration={3000} onClose={() => setToast(null)} message={toast} />
    </Box>
  );
};

// ——————————————————————————————————————————————————————————————————
// Dialog (used in compact mode)
// ——————————————————————————————————————————————————————————————————

const DepthDialog: React.FC<{
  open: boolean;
  selected: DepthLevel;
  saving: boolean;
  onSelect: (d: DepthLevel) => void;
  onSave: () => void;
  onClose: () => void;
}> = ({ open, selected, saving, onSelect, onSave, onClose }) => (
  <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
    <DialogTitle>Explanation Depth</DialogTitle>
    <DialogContent>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        This setting controls how every lesson explanation is phrased. Set it once and all future lessons adapt.
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {DEPTH_OPTIONS.map((opt) => (
          <Paper
            key={opt.value}
            onClick={() => onSelect(opt.value)}
            variant="outlined"
            sx={{
              p: 1.5,
              cursor: 'pointer',
              border: '2px solid',
              borderColor: selected === opt.value ? DEPTH_COLORS[opt.value] : 'divider',
              transition: 'border-color 0.15s',
              '&:hover': { borderColor: DEPTH_COLORS[opt.value] },
              borderRadius: 1.5,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 1.5,
            }}
          >
            <Typography variant="h5" sx={{ mt: 0.25 }}>{opt.emoji}</Typography>
            <Box>
              <Typography variant="subtitle2" fontWeight={700}>{opt.label}</Typography>
              <Typography variant="caption" color="text.secondary">{opt.description}</Typography>
            </Box>
          </Paper>
        ))}
      </Box>
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose}>Cancel</Button>
      <Button
        variant="contained"
        onClick={onSave}
        disabled={saving}
        sx={{ bgcolor: DEPTH_COLORS[selected] }}
      >
        {saving ? 'Saving…' : 'Save'}
      </Button>
    </DialogActions>
  </Dialog>
);
