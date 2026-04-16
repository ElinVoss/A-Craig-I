import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  Grid,
  CircularProgress,
  Alert,
  Chip,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from '@mui/material';
import { BookOpen, Trash2, Share2, Download } from 'lucide-react';
import { useAuth } from './AuthContext';

interface LessonLibraryItem {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  created_at: string;
  rating: number;
  is_completed: boolean;
  completion_percentage?: number;
}

interface LessonLibraryProps {
  onSelectLesson: (lessonId: string) => void;
}

export const LessonLibrary: React.FC<LessonLibraryProps> = ({ onSelectLesson }) => {
  const { api, isAuthenticated } = useAuth();
  const [lessons, setLessons] = useState<LessonLibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLesson, setSelectedLesson] = useState<LessonLibraryItem | null>(null);
  const [filterDifficulty, setFilterDifficulty] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      fetchLessons();
    }
  }, [isAuthenticated]);

  const fetchLessons = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/lessons');
      setLessons(response.data.lessons);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load lessons');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLesson = async (lessonId: string) => {
    try {
      // This endpoint would be implemented in the backend
      await api.delete(`/api/lessons/${lessonId}`);
      setLessons(lessons.filter((l) => l.id !== lessonId));
    } catch (err: any) {
      setError('Failed to delete lesson');
    }
  };

  const filteredLessons = filterDifficulty
    ? lessons.filter((l) => l.difficulty === filterDifficulty)
    : lessons;

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner':
        return 'success';
      case 'intermediate':
        return 'warning';
      case 'advanced':
        return 'error';
      default:
        return 'default';
    }
  };

  if (!isAuthenticated) {
    return (
      <Box className="p-8 text-center">
        <Typography variant="h6">Sign in to view your lesson library</Typography>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box className="flex justify-center items-center min-h-screen">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <Box className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <BookOpen className="w-8 h-8 text-blue-600" />
          <Typography variant="h4">My Lesson Library</Typography>
        </div>
        <Typography variant="body1" className="text-slate-600">
          {lessons.length} lesson{lessons.length !== 1 ? 's' : ''} saved
        </Typography>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" className="mb-6">
          {error}
        </Alert>
      )}

      {/* Filters */}
      <Box className="mb-6 flex gap-2">
        <Button
          variant={filterDifficulty === null ? 'contained' : 'outlined'}
          onClick={() => setFilterDifficulty(null)}
          size="small"
        >
          All
        </Button>
        {['beginner', 'intermediate', 'advanced'].map((difficulty) => (
          <Button
            key={difficulty}
            variant={filterDifficulty === difficulty ? 'contained' : 'outlined'}
            onClick={() => setFilterDifficulty(difficulty)}
            size="small"
            color={getDifficultyColor(difficulty) as any}
          >
            {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
          </Button>
        ))}
      </Box>

      {/* Lessons Grid */}
      {filteredLessons.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <Typography variant="h6" className="text-slate-500">
              No lessons yet
            </Typography>
            <Typography variant="body2" className="text-slate-400">
              Generate your first lesson to get started!
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {filteredLessons.map((lesson) => (
            <Grid item xs={12} sm={6} md={4} key={lesson.id}>
              <Card className="h-full flex flex-col hover:shadow-lg transition-shadow">
                <CardContent className="flex-grow">
                  {/* Title & Difficulty */}
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <Typography variant="h6" className="flex-grow">
                      {lesson.title}
                    </Typography>
                    <Chip
                      label={lesson.difficulty}
                      size="small"
                      color={getDifficultyColor(lesson.difficulty) as any}
                      variant="outlined"
                    />
                  </div>

                  {/* Description */}
                  <Typography
                    variant="body2"
                    className="text-slate-600 mb-4 line-clamp-2"
                  >
                    {lesson.description}
                  </Typography>

                  {/* Rating */}
                  <div className="flex items-center gap-2 mb-4">
                    {'⭐'.repeat(Math.round(lesson.rating))}
                    <span className="text-sm text-slate-500">
                      {lesson.rating.toFixed(1)}
                    </span>
                  </div>

                  {/* Progress */}
                  {lesson.is_completed ? (
                    <div className="mb-4">
                      <Chip label="Completed" color="success" variant="outlined" />
                    </div>
                  ) : lesson.completion_percentage ? (
                    <Box className="mb-4">
                      <div className="flex justify-between mb-1">
                        <Typography variant="caption" className="text-slate-600">
                          Progress
                        </Typography>
                        <Typography variant="caption" className="text-slate-600">
                          {lesson.completion_percentage}%
                        </Typography>
                      </div>
                      <LinearProgress
                        variant="determinate"
                        value={lesson.completion_percentage}
                      />
                    </Box>
                  ) : null}

                  {/* Date */}
                  <Typography variant="caption" className="text-slate-400">
                    Created{' '}
                    {new Date(lesson.created_at).toLocaleDateString()}
                  </Typography>
                </CardContent>

                {/* Actions */}
                <CardActions className="flex justify-between pt-0">
                  <Button
                    size="small"
                    color="primary"
                    onClick={() => onSelectLesson(lesson.id)}
                  >
                    Open
                  </Button>
                  <div className="flex gap-1">
                    <Button
                      size="small"
                      startIcon={<Share2 className="w-4 h-4" />}
                      variant="text"
                    >
                      Share
                    </Button>
                    <Button
                      size="small"
                      startIcon={<Trash2 className="w-4 h-4" />}
                      color="error"
                      onClick={() => handleDeleteLesson(lesson.id)}
                      variant="text"
                    >
                      Delete
                    </Button>
                  </div>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
};
