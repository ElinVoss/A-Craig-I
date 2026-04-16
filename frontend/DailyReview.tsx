/**
 * DailyReview — Mobile-first spaced repetition review UI.
 *
 * Flow:
 *   1. Mount → GET /api/review/due → show first card
 *   2. User clicks "Show Answer" → card flips (front: title + recall prompt; back: description)
 *   3. User rates: Again / Hard / Good / Easy
 *   4. POST /api/review/complete → SM-2 schedules next review → advance to next card
 *   5. All cards done → show session summary with accuracy
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Button, CircularProgress, Chip, LinearProgress,
  Card, Alert, IconButton, Tooltip,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { useAuth } from './AuthContext';

// ——————————————————————————————————————————————————————————————————
// Types
// ——————————————————————————————————————————————————————————————————

interface DueCard {
  card_id: string;
  lesson_id: string;
  lesson_title: string;
  lesson_description: string;
  lesson_difficulty: string;
  interval_days: number;
  repetitions: number;
  days_overdue: number;
}

export interface DailyReviewProps {
  onBack: () => void;
}

// ——————————————————————————————————————————————————————————————————
// Constants
// ——————————————————————————————————————————————————————————————————

const RATING_LABELS = [
  { value: 1, label: 'Again',  color: '#ef4444', emoji: '❌', help: 'Blank — see tomorrow'     },
  { value: 2, label: 'Hard',   color: '#f97316', emoji: '😓', help: 'Remembered with effort'   },
  { value: 3, label: 'Good',   color: '#22c55e', emoji: '✅', help: 'Recalled correctly'        },
  { value: 4, label: 'Easy',   color: '#3b82f6', emoji: '⚡', help: 'Effortless recall'         },
] as const;

const DIFFICULTY_COLOR: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
  beginner:     'success',
  intermediate: 'warning',
  advanced:     'error',
};

// ——————————————————————————————————————————————————————————————————
// Component
// ——————————————————————————————————————————————————————————————————

export const DailyReview: React.FC<DailyReviewProps> = ({ onBack }) => {
  const { accessToken, api } = useAuth();

  const [cards, setCards]               = useState<DueCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped]           = useState(false);
  const [loading, setLoading]           = useState(true);
  const [submitting, setSubmitting]     = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [sessionCorrect, setSessionCorrect] = useState(0);

  // Fetch due cards on mount
  useEffect(() => {
    if (!accessToken) return;
    setLoading(true);
    api.get('/api/review/due')
      .then((res) => setCards(res.data.cards ?? []))
      .catch((e) => setError(e.message ?? 'Failed to load review queue'))
      .finally(() => setLoading(false));
  }, [accessToken]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRate = useCallback(async (rating: number) => {
    const card = cards[currentIndex];
    if (!card) return;
    setSubmitting(true);
    try {
      await api.post('/api/review/complete', { card_id: card.card_id, rating });
      if (rating >= 3) setSessionCorrect((c) => c + 1);
      // Brief pause so the flip-back animation is visible
      setFlipped(false);
      setTimeout(() => setCurrentIndex((i) => i + 1), 320);
    } catch (e: any) {
      setError(e.message ?? 'Failed to submit rating');
    } finally {
      setSubmitting(false);
    }
  }, [api, cards, currentIndex]);

  // ——————————————————————————————————————————————————————————————
  // Loading state
  // ——————————————————————————————————————————————————————————————

  if (loading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 10, gap: 2 }}>
        <CircularProgress />
        <Typography color="text.secondary">Loading your review queue…</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ maxWidth: 480, mx: 'auto', p: 3 }}>
        <Alert severity="error" action={<Button onClick={onBack} size="small">Go Back</Button>}>
          {error}
        </Alert>
      </Box>
    );
  }

  // ——————————————————————————————————————————————————————————————
  // Session complete
  // ——————————————————————————————————————————————————————————————

  if (currentIndex >= cards.length) {
    const accuracy = cards.length > 0
      ? Math.round((sessionCorrect / cards.length) * 100)
      : 0;

    return (
      <Box sx={{ maxWidth: 480, mx: 'auto', p: 3, textAlign: 'center' }}>
        <CheckCircleOutlineIcon sx={{ fontSize: 72, color: 'success.main', mb: 2 }} />

        <Typography variant="h4" fontWeight={700} gutterBottom>
          {cards.length === 0 ? 'Nothing due today! 🎉' : 'Queue complete! 🎉'}
        </Typography>

        {cards.length > 0 && (
          <>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              {cards.length} card{cards.length !== 1 ? 's' : ''} reviewed · {accuracy}% accuracy
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              SM-2 has scheduled your next reviews. Cards rated Good/Easy won't
              appear for several days; cards rated Again come back tomorrow.
            </Typography>

            <Box
              sx={{
                bgcolor: 'grey.100', borderRadius: 2, p: 2, mb: 3,
                border: '1px solid', borderColor: 'grey.200', textAlign: 'left',
              }}
            >
              <Typography variant="body2" fontWeight={600} gutterBottom>
                📈 How your memory is being optimised
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Each time you answer <em>Good</em> or <em>Easy</em>, the interval doubles.
                After 5 successful reviews a card typically won't appear for 30+ days —
                meaning it's locked into long-term memory.
              </Typography>
            </Box>
          </>
        )}

        <Button variant="contained" onClick={onBack} size="large">
          Back to Dashboard
        </Button>
      </Box>
    );
  }

  // ——————————————————————————————————————————————————————————————
  // Review session
  // ——————————————————————————————————————————————————————————————

  const card     = cards[currentIndex];
  const progress = (currentIndex / cards.length) * 100;

  return (
    <Box sx={{ maxWidth: 560, mx: 'auto', p: { xs: 2, sm: 3 } }}>

      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 1 }}>
        <IconButton onClick={onBack} size="small">
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h6" sx={{ flex: 1 }}>Daily Review</Typography>
        <Typography variant="body2" color="text.secondary">
          {currentIndex + 1} / {cards.length}
        </Typography>
        <Tooltip title="Rate 'Again' if you couldn't recall it. SM-2 will show it again tomorrow.">
          <IconButton size="small"><HelpOutlineIcon fontSize="small" /></IconButton>
        </Tooltip>
      </Box>

      {/* Progress bar */}
      <LinearProgress
        variant="determinate"
        value={progress}
        sx={{ mb: 3, borderRadius: 1, height: 6 }}
      />

      {/* Overdue warning */}
      {card.days_overdue > 2 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          This card is <strong>{card.days_overdue} days overdue</strong>.
          Reviewing now re-consolidates the memory trace.
        </Alert>
      )}

      {/* ——— Flashcard ——— */}
      <Box sx={{ perspective: '1000px', mb: 3 }}>
        <Box
          sx={{
            position: 'relative',
            minHeight: 240,
            transition: 'transform 0.55s cubic-bezier(0.4, 0, 0.2, 1)',
            transformStyle: 'preserve-3d',
            transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          }}
        >
          {/* FRONT — recall prompt */}
          <Card
            elevation={3}
            sx={{
              position: 'absolute',
              width: '100%',
              minHeight: 240,
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              textAlign: 'center',
              p: 3,
            }}
          >
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ mb: 2, textTransform: 'uppercase', letterSpacing: 1 }}
            >
              Can you recall this lesson?
            </Typography>

            <Typography variant="h5" fontWeight={700} gutterBottom>
              {card.lesson_title}
            </Typography>

            <Chip
              label={card.lesson_difficulty}
              color={DIFFICULTY_COLOR[card.lesson_difficulty] ?? 'default'}
              size="small"
              variant="outlined"
              sx={{ mb: 3 }}
            />

            <Button
              variant="contained"
              size="large"
              onClick={() => setFlipped(true)}
            >
              Show Answer
            </Button>
          </Card>

          {/* BACK — answer + rating */}
          <Card
            elevation={3}
            sx={{
              position: 'absolute',
              width: '100%',
              minHeight: 240,
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
              p: 3,
            }}
          >
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ textTransform: 'uppercase', letterSpacing: 1, display: 'block', mb: 1 }}
            >
              Answer
            </Typography>

            <Typography variant="body1" sx={{ mb: 2 }}>
              {card.lesson_description || 'Review your notes for this lesson.'}
            </Typography>

            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block' }}
            >
              ⏱ Reviewed {card.repetitions} time{card.repetitions !== 1 ? 's' : ''} ·
              Current interval: {card.interval_days} day{card.interval_days !== 1 ? 's' : ''}
            </Typography>
          </Card>
        </Box>
      </Box>

      {/* Rating buttons — visible only after flip */}
      {flipped && (
        <Box>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', textAlign: 'center', mb: 1.5 }}
          >
            How well did you remember?
          </Typography>

          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1 }}>
            {RATING_LABELS.map(({ value, label, color, emoji, help }) => (
              <Box key={value} sx={{ textAlign: 'center' }}>
                <Button
                  fullWidth
                  variant="contained"
                  disabled={submitting}
                  onClick={() => handleRate(value)}
                  sx={{
                    bgcolor: color,
                    '&:hover': { bgcolor: color, filter: 'brightness(0.88)' },
                    fontWeight: 700,
                    py: 1,
                    mb: 0.5,
                    fontSize: '0.8rem',
                  }}
                >
                  {emoji} {label}
                </Button>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontSize: '0.62rem', lineHeight: 1.2, display: 'block' }}
                >
                  {help}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
};
