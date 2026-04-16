/**
 * AnalyticsDashboard — the Pro tier conversion hook.
 *
 * Shows users exactly what they're forgetting and why they need to review.
 * Free tier: sees the numbers. Pro tier: sees the recommendations + concept breakdown.
 *
 * Sections:
 *   1. Stat cards:  Lessons this week / Cards due / Streak / Accuracy
 *   2. 7-day activity bar chart (SVG, no external library)
 *   3. Recent lessons with validation status badges
 *   4. Top concept mastery list
 */

import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, CircularProgress, Alert, Card, CardContent,
  Chip, LinearProgress, Divider, List, ListItem, ListItemText, Tooltip,
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ScheduleIcon from '@mui/icons-material/Schedule';
import VerifiedIcon from '@mui/icons-material/Verified';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { useAuth } from './AuthContext';

// ——————————————————————————————————————————————————————————————————
// Types
// ——————————————————————————————————————————————————————————————————

interface DayActivity {
  date: string;         // YYYY-MM-DD
  reviews: number;
  correct: number;
}

interface ConceptMastery {
  name: string;
  mastery: number;      // 0.0 – 1.0
  reviews: number;
}

interface RecentLesson {
  id: string;
  title: string;
  difficulty: string;
  created_at: string;
  validation_status: 'pass' | 'warn' | 'fail' | null;
  is_completed: boolean;
}

interface DashboardStats {
  lessons_this_week: number;
  total_lessons: number;
  total_cards: number;
  due_today: number;
  streak_days: number;
  total_reviews: number;
  reviews_this_week: number;
  accuracy_this_week: number;   // 0.0 – 1.0
  avg_easiness: number;
}

interface DashboardData {
  stats: DashboardStats;
  activity: DayActivity[];
  top_concepts: ConceptMastery[];
  recent_lessons: RecentLesson[];
}

// ——————————————————————————————————————————————————————————————————
// Helpers
// ——————————————————————————————————————————————————————————————————

const VALIDATION_ICON: Record<string, React.ReactNode> = {
  pass: <VerifiedIcon sx={{ fontSize: 14, color: 'success.main' }} />,
  warn: <WarningAmberIcon sx={{ fontSize: 14, color: 'warning.main' }} />,
  fail: <ErrorOutlineIcon sx={{ fontSize: 14, color: 'error.main' }} />,
};

const DIFFICULTY_COLOR: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
  beginner: 'success', intermediate: 'warning', advanced: 'error',
};

function masteryColor(mastery: number): string {
  if (mastery >= 0.8) return '#22c55e';
  if (mastery >= 0.5) return '#f97316';
  return '#ef4444';
}

function shortDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en', { weekday: 'short' });
}

// ——————————————————————————————————————————————————————————————————
// Stat Card
// ——————————————————————————————————————————————————————————————————

const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}> = ({ icon, label, value, sub, color = 'primary.main' }) => (
  <Card elevation={1} sx={{ flex: 1, minWidth: 140 }}>
    <CardContent sx={{ pb: '12px !important' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, color }}>
        {icon}
        <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {label}
        </Typography>
      </Box>
      <Typography variant="h4" fontWeight={700} sx={{ color }}>
        {value}
      </Typography>
      {sub && (
        <Typography variant="caption" color="text.secondary">{sub}</Typography>
      )}
    </CardContent>
  </Card>
);

// ——————————————————————————————————————————————————————————————————
// 7-day Activity Chart (pure SVG — no external library)
// ——————————————————————————————————————————————————————————————————

const ActivityChart: React.FC<{ activity: DayActivity[] }> = ({ activity }) => {
  const W = 420, H = 80, PAD = 8;
  const maxReviews = Math.max(...activity.map((d) => d.reviews), 1);
  const barW = (W - PAD * 2) / (activity.length || 1) - 4;

  return (
    <Box sx={{ overflowX: 'auto' }}>
      <svg width="100%" viewBox={`0 0 ${W} ${H + 24}`} style={{ display: 'block', minWidth: 260 }}>
        {activity.map((day, i) => {
          const x = PAD + i * ((W - PAD * 2) / activity.length);
          const barH = day.reviews === 0 ? 2 : Math.max(4, (day.reviews / maxReviews) * H);
          const y = H - barH;
          const accuracy = day.reviews > 0 ? day.correct / day.reviews : 0;
          const fill = day.reviews === 0 ? '#e2e8f0'
            : accuracy >= 0.8 ? '#22c55e'
            : accuracy >= 0.5 ? '#f97316'
            : '#ef4444';

          return (
            <g key={day.date}>
              <rect
                x={x + 2}
                y={y}
                width={barW}
                height={barH}
                fill={fill}
                rx={3}
                opacity={0.85}
              />
              <text
                x={x + barW / 2 + 2}
                y={H + 16}
                textAnchor="middle"
                fontSize={10}
                fill="#94a3b8"
              >
                {shortDate(day.date)}
              </text>
            </g>
          );
        })}
      </svg>
      <Box sx={{ display: 'flex', gap: 2, mt: 0.5 }}>
        {[
          { color: '#22c55e', label: '≥80% accuracy' },
          { color: '#f97316', label: '50–79%' },
          { color: '#ef4444', label: '<50%' },
          { color: '#e2e8f0', label: 'No reviews' },
        ].map(({ color, label }) => (
          <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 10, height: 10, borderRadius: 0.5, bgcolor: color }} />
            <Typography variant="caption" color="text.secondary">{label}</Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

// ——————————————————————————————————————————————————————————————————
// Main Dashboard
// ——————————————————————————————————————————————————————————————————

export const AnalyticsDashboard: React.FC = () => {
  const { api } = useAuth();

  const [data, setData]       = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    api.get('/api/analytics/dashboard')
      .then((res) => setData(res.data))
      .catch((e) => setError(e.response?.data?.detail ?? 'Failed to load analytics'))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 10, gap: 2 }}>
        <CircularProgress />
        <Typography color="text.secondary">Computing your learning analytics…</Typography>
      </Box>
    );
  }

  if (error || !data) {
    return (
      <Box sx={{ maxWidth: 600, mx: 'auto', p: 3 }}>
        <Alert severity="error">{error ?? 'Unknown error'}</Alert>
      </Box>
    );
  }

  const { stats, activity, top_concepts, recent_lessons } = data;
  const accuracyPct = Math.round(stats.accuracy_this_week * 100);

  return (
    <Box sx={{ maxWidth: 860, mx: 'auto', p: { xs: 2, sm: 3 } }}>
      <Typography variant="h5" fontWeight={700} gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <TrendingUpIcon /> Learning Analytics
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Your memory is being shaped by {stats.total_reviews} reviews.
        {stats.due_today > 0 && ` You have ${stats.due_today} card${stats.due_today > 1 ? 's' : ''} due today.`}
      </Typography>

      {/* ── Stat cards ── */}
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 4 }}>
        <StatCard
          icon={<LocalFireDepartmentIcon sx={{ fontSize: 18 }} />}
          label="Streak"
          value={`${stats.streak_days}d`}
          sub="consecutive review days"
          color="#f97316"
        />
        <StatCard
          icon={<ScheduleIcon sx={{ fontSize: 18 }} />}
          label="Due Today"
          value={stats.due_today}
          sub={stats.due_today === 0 ? 'All caught up! 🎉' : 'cards awaiting review'}
          color={stats.due_today > 0 ? '#ef4444' : '#22c55e'}
        />
        <StatCard
          icon={<CheckCircleIcon sx={{ fontSize: 18 }} />}
          label="Accuracy"
          value={`${accuracyPct}%`}
          sub="this week (Good/Easy)"
          color={accuracyPct >= 80 ? '#22c55e' : accuracyPct >= 50 ? '#f97316' : '#ef4444'}
        />
        <StatCard
          icon={<TrendingUpIcon sx={{ fontSize: 18 }} />}
          label="Lessons"
          value={stats.total_lessons}
          sub={`${stats.lessons_this_week} new this week`}
          color="#3b82f6"
        />
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.6fr 1fr' }, gap: 3 }}>
        {/* ── Left column ── */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>

          {/* 7-day activity */}
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
            <Typography variant="subtitle1" fontWeight={700} gutterBottom>
              7-Day Review Activity
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
              {stats.reviews_this_week} reviews this week · Bar height = volume, colour = accuracy
            </Typography>
            {activity.length > 0
              ? <ActivityChart activity={activity} />
              : <Typography variant="body2" color="text.secondary">No reviews yet — complete your first review to see activity.</Typography>
            }
          </Paper>

          {/* Recent lessons */}
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
            <Typography variant="subtitle1" fontWeight={700} gutterBottom>
              Recent Lessons
            </Typography>
            {recent_lessons.length === 0
              ? <Typography variant="body2" color="text.secondary">No lessons yet.</Typography>
              : (
                <List disablePadding>
                  {recent_lessons.map((lesson, idx) => (
                    <React.Fragment key={lesson.id}>
                      {idx > 0 && <Divider />}
                      <ListItem disableGutters sx={{ py: 1 }}>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              {lesson.validation_status && VALIDATION_ICON[lesson.validation_status]}
                              <Typography variant="body2" fontWeight={500}>{lesson.title}</Typography>
                            </Box>
                          }
                          secondary={
                            <Box sx={{ display: 'flex', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
                              <Chip label={lesson.difficulty} size="small" color={DIFFICULTY_COLOR[lesson.difficulty] ?? 'default'} variant="outlined" />
                              {lesson.is_completed && <Chip label="completed" size="small" color="success" variant="outlined" />}
                              <Typography variant="caption" color="text.secondary">
                                {new Date(lesson.created_at).toLocaleDateString()}
                              </Typography>
                            </Box>
                          }
                        />
                      </ListItem>
                    </React.Fragment>
                  ))}
                </List>
              )
            }
          </Paper>
        </Box>

        {/* ── Right column: concept mastery ── */}
        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, alignSelf: 'start' }}>
          <Typography variant="subtitle1" fontWeight={700} gutterBottom>
            Concept Mastery
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
            Based on SM-2 easiness factor across review cards
          </Typography>

          {top_concepts.length === 0
            ? (
              <Typography variant="body2" color="text.secondary">
                Mastery scores appear after your first review session.
              </Typography>
            )
            : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {top_concepts.map((concept) => (
                  <Box key={concept.name}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="body2" fontWeight={500}>{concept.name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {Math.round(concept.mastery * 100)}% · {concept.reviews} reviews
                      </Typography>
                    </Box>
                    <Tooltip title={`${Math.round(concept.mastery * 100)}% mastery`}>
                      <LinearProgress
                        variant="determinate"
                        value={concept.mastery * 100}
                        sx={{
                          height: 8,
                          borderRadius: 4,
                          bgcolor: 'grey.200',
                          '& .MuiLinearProgress-bar': { bgcolor: masteryColor(concept.mastery) },
                        }}
                      />
                    </Tooltip>
                  </Box>
                ))}
              </Box>
            )
          }
        </Paper>
      </Box>
    </Box>
  );
};
