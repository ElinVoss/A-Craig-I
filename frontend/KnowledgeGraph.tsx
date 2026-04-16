/**
 * KnowledgeGraph — concept dependency visualization for a lesson.
 *
 * Layout (top→bottom):
 *   Prerequisites  (orange)  — what you should know BEFORE this lesson
 *        ↓ arrows
 *   Primary Concepts (blue)  — what THIS lesson teaches
 *
 * Data comes from GET /api/lessons/{id}/concepts
 * which is populated at generation time by LessonGenerator.extract_concepts().
 *
 * If the user is missing prerequisites (no lesson tagged with that concept),
 * we surface a "Generate lesson for X" CTA.
 */

import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Chip, CircularProgress, Alert, Paper, Button, Tooltip,
} from '@mui/material';
import SchoolIcon from '@mui/icons-material/School';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { useAuth } from './AuthContext';

// ——————————————————————————————————————————————————————————————————
// Types
// ——————————————————————————————————————————————————————————————————

interface ConceptData {
  primary_concepts: string[];
  prerequisites: string[];
  difficulty_context: string;
  covered_prerequisites: string[];    // prereqs user already has lessons for
  missing_prerequisites: string[];    // prereqs user is missing
}

interface KnowledgeGraphProps {
  lessonId: string;
  lessonTitle: string;
  onGenerateLesson?: (concept: string) => void;
}

// ——————————————————————————————————————————————————————————————————
// Component
// ——————————————————————————————————————————————————————————————————

export const KnowledgeGraph: React.FC<KnowledgeGraphProps> = ({
  lessonId,
  lessonTitle,
  onGenerateLesson,
}) => {
  const { api } = useAuth();

  const [data, setData]       = useState<ConceptData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!lessonId) return;
    setLoading(true);
    api.get(`/api/lessons/${lessonId}/concepts`)
      .then((res) => setData(res.data))
      .catch((e) => setError(e.response?.data?.detail ?? 'Failed to load concept graph'))
      .finally(() => setLoading(false));
  }, [lessonId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 2 }}>
        <CircularProgress size={16} />
        <Typography variant="body2" color="text.secondary">Mapping concept dependencies…</Typography>
      </Box>
    );
  }

  if (error || !data) {
    return (
      <Alert severity="info" icon={<SchoolIcon />}>
        Concept map not available for this lesson.
      </Alert>
    );
  }

  const hasMissing = data.missing_prerequisites.length > 0;

  return (
    <Box>
      {/* Missing prerequisites warning */}
      {hasMissing && (
        <Alert
          severity="warning"
          icon={<WarningAmberIcon />}
          sx={{ mb: 2 }}
        >
          <Typography variant="body2" fontWeight={600} gutterBottom>
            You may be missing prerequisite knowledge:
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 0.5 }}>
            {data.missing_prerequisites.map((prereq) => (
              <Chip
                key={prereq}
                label={prereq}
                size="small"
                color="warning"
                variant="outlined"
                onClick={() => onGenerateLesson?.(prereq)}
                sx={{ cursor: onGenerateLesson ? 'pointer' : 'default' }}
              />
            ))}
          </Box>
          {onGenerateLesson && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              Click any concept above to generate a lesson for it.
            </Typography>
          )}
        </Alert>
      )}

      {/* Graph layout */}
      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>

        {/* Prerequisites row */}
        {data.prerequisites.length > 0 && (
          <>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Prerequisites
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
              {data.prerequisites.map((prereq) => {
                const isCovered = data.covered_prerequisites.includes(prereq);
                return (
                  <Tooltip
                    key={prereq}
                    title={isCovered ? 'You have a lesson covering this ✅' : 'No lesson found — consider generating one'}
                  >
                    <Chip
                      label={prereq}
                      size="small"
                      variant={isCovered ? 'filled' : 'outlined'}
                      color={isCovered ? 'success' : 'warning'}
                      onClick={!isCovered && onGenerateLesson ? () => onGenerateLesson(prereq) : undefined}
                      sx={{ cursor: !isCovered && onGenerateLesson ? 'pointer' : 'default' }}
                    />
                  </Tooltip>
                );
              })}
            </Box>

            {/* Arrow connector */}
            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1.5 }}>
              <ArrowDownwardIcon sx={{ color: 'text.disabled', fontSize: 20 }} />
            </Box>
          </>
        )}

        {/* Current lesson node */}
        <Box
          sx={{
            border: '2px solid',
            borderColor: 'primary.400',
            borderRadius: 2,
            p: 1.5,
            bgcolor: 'primary.50',
            mb: data.primary_concepts.length > 0 ? 2 : 0,
            textAlign: 'center',
          }}
        >
          <Typography variant="caption" color="primary.600" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
            This Lesson
          </Typography>
          <Typography variant="body2" fontWeight={600} sx={{ mt: 0.25 }}>
            {lessonTitle}
          </Typography>
        </Box>

        {/* Primary concepts */}
        {data.primary_concepts.length > 0 && (
          <>
            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1.5 }}>
              <ArrowDownwardIcon sx={{ color: 'text.disabled', fontSize: 20 }} />
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <LightbulbIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
              <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                You will learn
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {data.primary_concepts.map((concept) => (
                <Chip
                  key={concept}
                  label={concept}
                  size="small"
                  color="primary"
                  variant="filled"
                />
              ))}
            </Box>
          </>
        )}

        {/* Difficulty context */}
        {data.difficulty_context && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2, fontStyle: 'italic' }}>
            {data.difficulty_context}
          </Typography>
        )}
      </Paper>
    </Box>
  );
};
