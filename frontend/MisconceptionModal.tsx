/**
 * MisconceptionModal — 60-second micro-lesson triggered by a wrong quiz answer.
 *
 * On mount (when `open` becomes true):
 *   1. POSTs to /api/misconception with the quiz question + wrong/correct answers
 *   2. Gemini returns a 3-part micro-lesson: why_it_seemed_right / correct_mental_model / analogy
 *   3. Renders inline before the user can continue
 *
 * Design principles:
 *   - Compassionate: validates that the wrong answer was a reasonable guess
 *   - Concise: < 100 words total — this is a micro-lesson, not a lecture
 *   - Sticky: the analogy is designed to make the correct answer memorable
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Typography, Box, CircularProgress, Alert, Divider,
} from '@mui/material';
import PsychologyIcon from '@mui/icons-material/Psychology';
import { useAuth } from './AuthContext';

// ——————————————————————————————————————————————————————————————————
// Types
// ——————————————————————————————————————————————————————————————————

interface MicroLesson {
  why_it_seemed_right: string;
  correct_mental_model: string;
  analogy: string;
}

export interface MisconceptionModalProps {
  open: boolean;
  question: string;
  wrongAnswer: string;
  correctAnswer: string;
  lessonContext: string;
  onClose: () => void;
}

// ——————————————————————————————————————————————————————————————————
// Component
// ——————————————————————————————————————————————————————————————————

export const MisconceptionModal: React.FC<MisconceptionModalProps> = ({
  open,
  question,
  wrongAnswer,
  correctAnswer,
  lessonContext,
  onClose,
}) => {
  const { api } = useAuth();

  const [loading, setLoading]         = useState(false);
  const [microLesson, setMicroLesson] = useState<MicroLesson | null>(null);
  const [error, setError]             = useState<string | null>(null);

  // Fire API call when modal opens (and again if question changes)
  useEffect(() => {
    if (!open || !question) return;

    let cancelled = false;

    const generate = async () => {
      setLoading(true);
      setError(null);
      setMicroLesson(null);

      try {
        const res = await api.post('/api/misconception', {
          question,
          wrong_answer: wrongAnswer,
          correct_answer: correctAnswer,
          lesson_context: lessonContext,
        });
        if (!cancelled) setMicroLesson(res.data.micro_lesson);
      } catch (e: any) {
        if (!cancelled) setError(e.response?.data?.detail ?? e.message ?? 'Could not generate explanation');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    generate();
    return () => { cancelled = true; };
  }, [open, question]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pb: 1 }}>
        <PsychologyIcon color="primary" />
        <span>Let's understand why</span>
      </DialogTitle>

      <DialogContent dividers>
        {/* What the student answered vs. correct */}
        <Box sx={{ display: 'flex', gap: 1.5, mb: 2 }}>
          <Box
            sx={{
              flex: 1,
              bgcolor: 'error.50',
              border: '1px solid',
              borderColor: 'error.200',
              borderRadius: 1.5,
              p: 1.5,
            }}
          >
            <Typography
              variant="caption"
              color="error.700"
              fontWeight={700}
              sx={{ textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', mb: 0.5 }}
            >
              Your answer
            </Typography>
            <Typography variant="body2">"{wrongAnswer}"</Typography>
          </Box>

          <Box
            sx={{
              flex: 1,
              bgcolor: 'success.50',
              border: '1px solid',
              borderColor: 'success.200',
              borderRadius: 1.5,
              p: 1.5,
            }}
          >
            <Typography
              variant="caption"
              color="success.700"
              fontWeight={700}
              sx={{ textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', mb: 0.5 }}
            >
              Correct answer
            </Typography>
            <Typography variant="body2">"{correctAnswer}"</Typography>
          </Box>
        </Box>

        <Divider sx={{ mb: 2 }} />

        {/* Loading */}
        {loading && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 2 }}>
            <CircularProgress size={20} />
            <Typography variant="body2" color="text.secondary">
              Generating personalised explanation…
            </Typography>
          </Box>
        )}

        {/* Error fallback — don't block the user, just skip the AI part */}
        {error && !loading && (
          <Alert severity="warning" sx={{ mb: 1 }}>
            AI explanation unavailable — the correct answer is shown above. Keep going!
          </Alert>
        )}

        {/* Micro-lesson */}
        {microLesson && !loading && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box>
              <Typography variant="subtitle2" color="primary" gutterBottom>
                🤔 Why it seemed right
              </Typography>
              <Typography variant="body2">
                {microLesson.why_it_seemed_right}
              </Typography>
            </Box>

            <Box>
              <Typography variant="subtitle2" color="primary" gutterBottom>
                💡 The correct mental model
              </Typography>
              <Typography variant="body2">
                {microLesson.correct_mental_model}
              </Typography>
            </Box>

            <Box
              sx={{
                bgcolor: 'primary.50',
                border: '1px solid',
                borderColor: 'primary.100',
                borderRadius: 1.5,
                p: 2,
              }}
            >
              <Typography variant="subtitle2" color="primary" gutterBottom>
                🧠 Lock it in with this analogy
              </Typography>
              <Typography variant="body2" fontStyle="italic">
                {microLesson.analogy}
              </Typography>
            </Box>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} variant="contained" disabled={loading}>
          Got it — next question
        </Button>
      </DialogActions>
    </Dialog>
  );
};
