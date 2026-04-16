import React, { useState } from 'react';
import {
  Box, Typography, Select, MenuItem, FormControl, InputLabel,
  Button, Card, CardContent, LinearProgress, Chip, Alert,
  CircularProgress, List, ListItem, ListItemText, Divider
} from '@mui/material';
import { Briefcase, Zap, TrendingUp, Clock } from 'lucide-react';
import { useAuth } from './AuthContext';

interface GapConcept {
  name: string;
  importance: 'critical' | 'important' | 'nice-to-have';
  description: string;
  estimated_hours: number;
}

interface Resource {
  concept: string;
  action: string;
}

interface JobGapResult {
  role: string;
  user_concept_count: number;
  coverage_percent: number;
  known_concepts: string[];
  gap_concepts: GapConcept[];
  summary: string;
  top_resources: Resource[];
}

const IMPORTANCE_COLORS: Record<string, 'error' | 'warning' | 'default'> = {
  critical: 'error',
  important: 'warning',
  'nice-to-have': 'default',
};

const ROLES = [
  { value: 'junior-react-developer', label: 'Junior React Developer' },
  { value: 'junior-python-developer', label: 'Junior Python Developer' },
  { value: 'fullstack-nextjs-developer', label: 'Full-Stack Next.js Developer' },
  { value: 'backend-fastapi-developer', label: 'Backend FastAPI Developer' },
  { value: 'data-scientist-ml', label: 'Data Scientist / ML Engineer' },
  { value: 'devops-engineer', label: 'DevOps / Platform Engineer' },
  { value: 'ios-swift-developer', label: 'iOS Swift Developer' },
];

interface JobGapAnalysisProps {
  onGenerateLesson: (concept: string) => void;
}

export const JobGapAnalysis: React.FC<JobGapAnalysisProps> = ({ onGenerateLesson }) => {
  const { api } = useAuth();
  const [role, setRole] = useState('junior-react-developer');
  const [result, setResult] = useState<JobGapResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runAnalysis = async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await api.get(`/api/job-gap?role=${encodeURIComponent(role)}`);
      setResult(resp.data);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Analysis failed. Make sure you have some saved lessons first.');
    } finally {
      setLoading(false);
    }
  };

  const coverageColor = (pct: number) =>
    pct >= 70 ? '#22c55e' : pct >= 40 ? '#f59e0b' : '#ef4444';

  const totalHours = result?.gap_concepts.reduce((s, c) => s + c.estimated_hours, 0) ?? 0;

  return (
    <Box className="max-w-3xl mx-auto p-6">
      <Box className="flex items-center gap-3 mb-2">
        <Briefcase size={32} />
        <Typography variant="h4" fontWeight={700}>Job Gap Analysis</Typography>
      </Box>
      <Typography color="text.secondary" className="mb-6">
        VibeCode maps your learned concepts against real job requirements.
        Discover exactly what to learn next to land your target role.
      </Typography>

      <Card variant="outlined" className="mb-6">
        <CardContent>
          <Box className="flex gap-3 items-center flex-wrap">
            <FormControl size="small" sx={{ minWidth: 260 }}>
              <InputLabel>Target Role</InputLabel>
              <Select value={role} label="Target Role" onChange={(e) => setRole(e.target.value)}>
                {ROLES.map((r) => (
                  <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button
              variant="contained"
              startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <TrendingUp size={16} />}
              onClick={runAnalysis}
              disabled={loading}
            >
              {loading ? 'Analyzing...' : 'Analyze My Gaps'}
            </Button>
          </Box>
        </CardContent>
      </Card>

      {error && <Alert severity="error" className="mb-4">{error}</Alert>}

      {result && (
        <Box>
          {/* Coverage overview */}
          <Card variant="outlined" className="mb-4">
            <CardContent>
              <Box className="flex justify-between items-center mb-2">
                <Typography variant="h6">Coverage for <strong>{ROLES.find(r => r.value === result.role)?.label}</strong></Typography>
                <Typography variant="h4" fontWeight={800} sx={{ color: coverageColor(result.coverage_percent) }}>
                  {result.coverage_percent}%
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={result.coverage_percent}
                sx={{
                  height: 10, borderRadius: 5, mb: 2,
                  '& .MuiLinearProgress-bar': { bgcolor: coverageColor(result.coverage_percent) }
                }}
              />
              <Typography variant="body2" color="text.secondary">{result.summary}</Typography>
              <Box className="flex gap-2 mt-2">
                <Chip icon={<Zap size={12} />} label={`${result.user_concept_count} concepts learned`} size="small" color="primary" variant="outlined" />
                <Chip icon={<Clock size={12} />} label={`~${totalHours}h to close gaps`} size="small" variant="outlined" />
              </Box>
            </CardContent>
          </Card>

          {/* Known concepts */}
          {result.known_concepts.length > 0 && (
            <Card variant="outlined" className="mb-4">
              <CardContent>
                <Typography variant="subtitle1" fontWeight={600} className="mb-2">✅ What you already know</Typography>
                <Box className="flex gap-2 flex-wrap">
                  {result.known_concepts.map((c) => (
                    <Chip key={c} label={c} size="small" color="success" variant="outlined" />
                  ))}
                </Box>
              </CardContent>
            </Card>
          )}

          {/* Gaps */}
          <Card variant="outlined" className="mb-4">
            <CardContent>
              <Typography variant="subtitle1" fontWeight={600} className="mb-3">🎯 Gaps to close</Typography>
              <List disablePadding>
                {result.gap_concepts.map((gap, idx) => (
                  <React.Fragment key={gap.name}>
                    {idx > 0 && <Divider component="li" />}
                    <ListItem
                      disableGutters
                      secondaryAction={
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => onGenerateLesson(gap.name)}
                        >
                          Learn
                        </Button>
                      }
                    >
                      <ListItemText
                        primary={
                          <Box className="flex items-center gap-2">
                            <Typography variant="body2" fontWeight={600}>{gap.name}</Typography>
                            <Chip label={gap.importance} size="small" color={IMPORTANCE_COLORS[gap.importance]} />
                            <Typography variant="caption" color="text.secondary">~{gap.estimated_hours}h</Typography>
                          </Box>
                        }
                        secondary={gap.description}
                        secondaryTypographyProps={{ variant: 'caption' }}
                      />
                    </ListItem>
                  </React.Fragment>
                ))}
              </List>
            </CardContent>
          </Card>

          {/* Top resources */}
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle1" fontWeight={600} className="mb-2">🚀 Recommended next steps</Typography>
              <List dense disablePadding>
                {result.top_resources.map((r) => (
                  <ListItem key={r.concept} disableGutters>
                    <ListItemText
                      primary={r.action}
                      secondary={r.concept}
                      primaryTypographyProps={{ variant: 'body2' }}
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Box>
      )}
    </Box>
  );
};
