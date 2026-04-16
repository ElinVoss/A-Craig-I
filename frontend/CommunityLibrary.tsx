import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, TextField, Chip, Card, CardContent, CardActions,
  Button, Select, MenuItem, FormControl, InputLabel, CircularProgress,
  Pagination, Alert, Tooltip
} from '@mui/material';
import { ThumbsUp, GitFork, CheckCircle, AlertTriangle, Search } from 'lucide-react';
import { useAuth } from './AuthContext';

interface CommunityLesson {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  upvote_count: number;
  fork_count: number;
  tags: string[];
  created_at: string;
  validation_status: string | null;
}

interface CommunityLibraryProps {
  onOpenLesson: (lessonId: string) => void;
}

const DIFFICULTY_COLORS: Record<string, 'success' | 'warning' | 'error'> = {
  beginner: 'success',
  intermediate: 'warning',
  advanced: 'error',
};

const ValidationBadge: React.FC<{ status: string | null }> = ({ status }) => {
  if (status === 'pass') return <Tooltip title="Validated by AI"><CheckCircle size={14} color="#22c55e" /></Tooltip>;
  if (status === 'warn') return <Tooltip title="Minor issues detected"><AlertTriangle size={14} color="#f59e0b" /></Tooltip>;
  if (status === 'fail') return <Tooltip title="Needs review"><AlertTriangle size={14} color="#ef4444" /></Tooltip>;
  return null;
};

export const CommunityLibrary: React.FC<CommunityLibraryProps> = ({ onOpenLesson }) => {
  const { api, isAuthenticated } = useAuth();
  const [lessons, setLessons] = useState<CommunityLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'upvotes' | 'recent' | 'forks'>('upvotes');
  const [page, setPage] = useState(1);
  const [upvoted, setUpvoted] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const fetchLessons = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ sort, page: String(page) });
      if (search) params.set('search', search);
      const resp = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/community?${params}`);
      const data = await resp.json();
      setLessons(data.lessons || []);
    } catch {
      setError('Could not load community lessons.');
    } finally {
      setLoading(false);
    }
  }, [search, sort, page]);

  useEffect(() => { fetchLessons(); }, [fetchLessons]);

  const handleUpvote = async (lessonId: string) => {
    if (!isAuthenticated) return;
    try {
      await api.post(`/api/lessons/${lessonId}/upvote`);
      setUpvoted(prev => {
        const next = new Set(prev);
        if (next.has(lessonId)) next.delete(lessonId); else next.add(lessonId);
        return next;
      });
      setLessons(prev => prev.map(l =>
        l.id === lessonId ? { ...l, upvote_count: l.upvote_count + (upvoted.has(lessonId) ? -1 : 1) } : l
      ));
    } catch {}
  };

  const handleFork = async (lessonId: string) => {
    if (!isAuthenticated) return;
    try {
      await api.post(`/api/lessons/${lessonId}/fork`);
      alert('Lesson forked to your library!');
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Fork failed');
    }
  };

  return (
    <Box className="max-w-5xl mx-auto p-6">
      <Typography variant="h4" fontWeight={700} className="mb-2">🌍 Community Library</Typography>
      <Typography color="text.secondary" className="mb-6">
        The best explanations of every concept, validated and ranked by the community.
      </Typography>

      {/* Search + Sort controls */}
      <Box className="flex gap-3 mb-6 flex-wrap">
        <TextField
          placeholder="Search concepts..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          InputProps={{ startAdornment: <Search size={16} className="mr-2 text-slate-400" /> }}
          size="small"
          sx={{ flexGrow: 1, minWidth: 200 }}
        />
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Sort by</InputLabel>
          <Select value={sort} label="Sort by" onChange={(e) => setSort(e.target.value as any)}>
            <MenuItem value="upvotes">Most Upvoted</MenuItem>
            <MenuItem value="recent">Most Recent</MenuItem>
            <MenuItem value="forks">Most Forked</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {error && <Alert severity="error" className="mb-4">{error}</Alert>}

      {loading ? (
        <Box className="flex justify-center py-12"><CircularProgress /></Box>
      ) : lessons.length === 0 ? (
        <Box className="text-center py-12 text-slate-400">
          <Typography variant="h6">No lessons yet.</Typography>
          <Typography variant="body2">Be the first to publish one!</Typography>
        </Box>
      ) : (
        <Box className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {lessons.map((lesson) => (
            <Card key={lesson.id} variant="outlined" className="hover:shadow-md transition-shadow">
              <CardContent>
                <Box className="flex justify-between items-start mb-1">
                  <Typography variant="h6" fontWeight={600} sx={{ lineHeight: 1.3, flex: 1 }}>
                    {lesson.title}
                  </Typography>
                  <Box className="ml-2 mt-0.5"><ValidationBadge status={lesson.validation_status} /></Box>
                </Box>
                <Typography variant="body2" color="text.secondary" className="mb-3 line-clamp-2">
                  {lesson.description}
                </Typography>
                <Box className="flex gap-2 flex-wrap">
                  <Chip
                    label={lesson.difficulty}
                    size="small"
                    color={DIFFICULTY_COLORS[lesson.difficulty] || 'default'}
                    variant="outlined"
                  />
                  {lesson.tags.slice(0, 3).map((tag) => (
                    <Chip key={tag} label={tag} size="small" variant="outlined" />
                  ))}
                </Box>
              </CardContent>
              <CardActions className="pt-0">
                <Button size="small" onClick={() => onOpenLesson(lesson.id)}>Open</Button>
                {isAuthenticated && (
                  <>
                    <Button
                      size="small"
                      startIcon={<ThumbsUp size={14} />}
                      onClick={() => handleUpvote(lesson.id)}
                      color={upvoted.has(lesson.id) ? 'primary' : 'inherit'}
                    >
                      {lesson.upvote_count}
                    </Button>
                    <Button
                      size="small"
                      startIcon={<GitFork size={14} />}
                      onClick={() => handleFork(lesson.id)}
                    >
                      {lesson.fork_count}
                    </Button>
                  </>
                )}
              </CardActions>
            </Card>
          ))}
        </Box>
      )}
      <Box className="flex justify-center mt-6">
        <Pagination count={10} page={page} onChange={(_, p) => setPage(p)} />
      </Box>
    </Box>
  );
};
