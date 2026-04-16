import React, { useState } from 'react';
import {
  Box, Typography, TextField, Button, Card, CardContent,
  Alert, CircularProgress, Chip, List, ListItem, ListItemText
} from '@mui/material';
import { Github, BookOpen, ArrowRight } from 'lucide-react';
import { useAuth } from './AuthContext';

interface GitHubReaderProps {
  onLessonGenerated: (lessonData: any) => void;
}

const EXAMPLE_URLS = [
  'https://github.com/tiangolo/fastapi/blob/master/fastapi/routing.py',
  'https://github.com/pallets/flask/blob/main/src/flask/app.py',
  'https://github.com/psf/requests/blob/main/src/requests/models.py',
];

export const GitHubReader: React.FC<GitHubReaderProps> = ({ onLessonGenerated }) => {
  const { api } = useAuth();
  const [url, setUrl] = useState('');
  const [difficulty, setDifficulty] = useState('intermediate');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const isValidGitHubUrl = (s: string) =>
    s.startsWith('https://github.com/') && s.includes('/blob/');

  const handleGenerate = async () => {
    if (!isValidGitHubUrl(url)) {
      setError('Please provide a valid GitHub file URL (must include /blob/)');
      return;
    }
    setLoading(true);
    setError(null);
    setPreview(null);
    try {
      const resp = await api.post('/api/lessons/from-github', { github_url: url, difficulty });
      const { lesson } = resp.data;
      setPreview(lesson.title);
      onLessonGenerated(lesson);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (err?.response?.status === 402) {
        setError('Upgrade to Pro to use GitHub Reader.');
      } else {
        setError(detail || 'Failed to generate lesson. Is the file public?');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box className="max-w-2xl mx-auto p-6">
      <Box className="flex items-center gap-3 mb-2">
        <Github size={32} />
        <Typography variant="h4" fontWeight={700}>GitHub Reader</Typography>
      </Box>
      <Typography color="text.secondary" className="mb-6">
        Paste any public GitHub file URL. VibeCode reads the code, identifies the 3 most
        interesting functions, and builds a "Reading Real Code" lesson — the skill Codecademy never taught.
      </Typography>

      <Card variant="outlined" className="mb-6">
        <CardContent>
          <TextField
            fullWidth
            label="GitHub File URL"
            placeholder="https://github.com/owner/repo/blob/main/path/to/file.py"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
            error={!!error && !loading}
            className="mb-4"
            sx={{ mb: 2 }}
          />

          <Box className="flex gap-3 items-center">
            {['beginner', 'intermediate', 'expert'].map((d) => (
              <Chip
                key={d}
                label={d}
                onClick={() => setDifficulty(d)}
                color={difficulty === d ? 'primary' : 'default'}
                variant={difficulty === d ? 'filled' : 'outlined'}
                size="small"
              />
            ))}
            <Box flex={1} />
            <Button
              variant="contained"
              endIcon={loading ? <CircularProgress size={16} color="inherit" /> : <ArrowRight size={16} />}
              onClick={handleGenerate}
              disabled={!url || loading}
            >
              {loading ? 'Reading...' : 'Generate Lesson'}
            </Button>
          </Box>
        </CardContent>
      </Card>

      {error && <Alert severity={error.includes('Pro') ? 'warning' : 'error'} className="mb-4">{error}</Alert>}
      {preview && (
        <Alert severity="success" icon={<BookOpen size={16} />} className="mb-4">
          Generated: <strong>{preview}</strong>
        </Alert>
      )}

      <Typography variant="subtitle2" color="text.secondary" className="mb-2">
        Try these examples:
      </Typography>
      <List dense>
        {EXAMPLE_URLS.map((exUrl) => (
          <ListItem
            key={exUrl}
            button
            onClick={() => setUrl(exUrl)}
            sx={{ borderRadius: 1, '&:hover': { bgcolor: 'action.hover' } }}
          >
            <ListItemText
              primary={exUrl.split('/blob/')[1] || exUrl}
              secondary={exUrl.split('/').slice(3, 5).join('/')}
              primaryTypographyProps={{ variant: 'body2', fontFamily: 'monospace' }}
              secondaryTypographyProps={{ variant: 'caption' }}
            />
          </ListItem>
        ))}
      </List>
    </Box>
  );
};
