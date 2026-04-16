import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Stepper,
  Step,
  StepLabel,
  Radio,
  RadioGroup,
  FormControlLabel,
  TextField,
  Alert,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Chip,
  LinearProgress,
  AppBar,
  Toolbar,
  Menu,
  MenuItem,
} from '@mui/material';
import { CheckCircle, XCircle, Code, Lightbulb, Route, Save, BookOpen, LogOut } from 'lucide-react';
import { useAuth } from './AuthContext';

// Type definitions
interface QuizOption {
  id: string;
  text: string;
  correct: boolean;
  explanation: string;
}

interface Quiz {
  question: string;
  options: QuizOption[];
}

interface Blank {
  text: string;
  answer: string;
}

interface Exercise {
  headline: string;
  scenario: string;
  blanks: Blank[];
  solution: string;
}

interface StepContent {
  headline: string;
  explanation?: string;
  keyTakeaway?: string;
  codeSnippet?: string;
  quiz?: Quiz;
  exercise?: Exercise;
}

interface LessonStep {
  id: string;
  title: string;
  type: 'concept' | 'exercise' | 'visualization';
  content: StepContent;
}

interface Lesson {
  id?: string;
  title: string;
  description: string;
  difficulty: string;
  learningObjectives: string[];
  steps: LessonStep[];
}

interface LessonRendererProps {
  lessonData: Lesson;
  onLessonSave?: (lessonId: string) => void;
}

// Quiz Block Component
const QuizBlock: React.FC<{
  quiz: Quiz;
  onAnswer: (isCorrect: boolean) => void;
}> = ({ quiz, onAnswer }) => {
  const [selected, setSelected] = useState<string | null>(null);
  const [answered, setAnswered] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  const handleSubmit = () => {
    if (selected === null) return;
    const option = quiz.options.find((o) => o.id === selected);
    if (option) {
      setIsCorrect(option.correct);
      setAnswered(true);
      onAnswer(option.correct);
    }
  };

  return (
    <Card className="mb-4">
      <CardContent className="pt-6">
        <Typography variant="h6" className="mb-4">
          {quiz.question}
        </Typography>

        <RadioGroup value={selected || ''} onChange={(e) => setSelected(e.target.value)}>
          {quiz.options.map((option) => (
            <FormControlLabel
              key={option.id}
              value={option.id}
              control={<Radio />}
              label={option.text}
              disabled={answered}
            />
          ))}
        </RadioGroup>

        {!answered && (
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={!selected}
            className="mt-4"
          >
            Submit Answer
          </Button>
        )}

        {answered && (
          <>
            <Alert severity={isCorrect ? 'success' : 'error'} className="mt-4">
              {isCorrect ? '✅ Correct!' : '❌ Incorrect'}
            </Alert>
            {quiz.options.find((o) => o.id === selected)?.explanation && (
              <Typography variant="body2" className="mt-2 italic">
                {quiz.options.find((o) => o.id === selected)?.explanation}
              </Typography>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

// Fill-in-the-Blank Component
const FillInTheBlanksExercise: React.FC<{
  exercise: Exercise;
  onComplete: (scores: Record<string, boolean>) => void;
}> = ({ exercise, onComplete }) => {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [scores, setScores] = useState<Record<string, boolean>>({});

  const handleSubmit = () => {
    const newScores: Record<string, boolean> = {};
    exercise.blanks.forEach((blank, idx) => {
      const key = `blank_${idx}`;
      newScores[key] =
        answers[key]?.toLowerCase().trim() === blank.answer.toLowerCase().trim();
    });
    setScores(newScores);
    setSubmitted(true);
    onComplete(newScores);
  };

  return (
    <Card className="mb-4">
      <CardContent className="pt-6">
        <Typography variant="h6" className="mb-4">
          {exercise.headline}
        </Typography>
        <Typography variant="body2" className="mb-4">
          {exercise.scenario}
        </Typography>

        <div className="space-y-3">
          {exercise.blanks.map((blank, idx) => (
            <div key={idx}>
              <Typography variant="body2" className="mb-2">
                {blank.text}
              </Typography>
              <TextField
                fullWidth
                placeholder={`Enter the answer...`}
                value={answers[`blank_${idx}`] || ''}
                onChange={(e) =>
                  setAnswers({ ...answers, [`blank_${idx}`]: e.target.value })
                }
                disabled={submitted}
                error={submitted && !scores[`blank_${idx}`]}
              />
              {submitted && (
                <Typography
                  variant="caption"
                  color={scores[`blank_${idx}`] ? 'success' : 'error'}
                >
                  {scores[`blank_${idx}`] ? '✅ Correct' : `❌ Expected: ${blank.answer}`}
                </Typography>
              )}
            </div>
          ))}
        </div>

        {!submitted && (
          <Button variant="contained" onClick={handleSubmit} className="mt-4">
            Check Answers
          </Button>
        )}

        {submitted && (
          <Alert severity="info" className="mt-4">
            <strong>Solution:</strong> {exercise.solution}
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

// Main LessonRenderer Component
export const LessonRenderer: React.FC<LessonRendererProps> = ({
  lessonData,
  onLessonSave,
}) => {
  const { user, logout, isAuthenticated } = useAuth();
  const [activeStep, setActiveStep] = useState(0);
  const [scores, setScores] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [saveDialog, setSaveDialog] = useState(false);
  const [userMenuAnchor, setUserMenuAnchor] = useState<null | HTMLElement>(null);

  const handleNext = () => {
    if (activeStep < lessonData.steps.length - 1) {
      setActiveStep(activeStep + 1);
    }
  };

  const handlePrevious = () => {
    if (activeStep > 0) {
      setActiveStep(activeStep - 1);
    }
  };

  const handleSaveProgress = async () => {
    if (!isAuthenticated || !lessonData.id) return;

    setSaving(true);
    try {
      const completionPercentage = Math.round(
        ((activeStep + 1) / lessonData.steps.length) * 100
      );

      // This would normally call the API
      console.log('Saving progress:', {
        lesson_id: lessonData.id,
        current_step: activeStep,
        completion_percentage: completionPercentage,
        quiz_scores: scores,
      });

      setSaveDialog(true);
    } finally {
      setSaving(false);
    }
  };

  const handleQuizAnswer = (stepId: string, isCorrect: boolean) => {
    setScores({
      ...scores,
      [stepId]: isCorrect,
    });
  };

  const currentStep = lessonData.steps[activeStep];
  const completionPercentage = Math.round(
    ((activeStep + 1) / lessonData.steps.length) * 100
  );

  return (
    <Box className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* App Bar */}
      <AppBar position="static" className="bg-white shadow-sm border-b">
        <Toolbar className="flex justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-blue-600" />
            <Typography variant="h6" className="text-slate-900">
              VibeCode Academy
            </Typography>
          </div>

          {isAuthenticated && (
            <div className="flex items-center gap-4">
              <Typography variant="body2" className="text-slate-600">
                {user?.username}
              </Typography>
              <Button
                size="small"
                onClick={(e) => setUserMenuAnchor(e.currentTarget)}
              >
                ⋮
              </Button>
              <Menu
                anchorEl={userMenuAnchor}
                open={!!userMenuAnchor}
                onClose={() => setUserMenuAnchor(null)}
              >
                <MenuItem onClick={() => setUserMenuAnchor(null)}>
                  My Lessons
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    logout();
                    setUserMenuAnchor(null);
                  }}
                >
                  Logout
                </MenuItem>
              </Menu>
            </div>
          )}
        </Toolbar>
      </AppBar>

      <Box className="max-w-4xl mx-auto p-6">
        {/* Lesson Header */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <Typography variant="h4" className="mb-2">
                  {lessonData.title}
                </Typography>
                <Typography variant="body1" className="text-slate-600">
                  {lessonData.description}
                </Typography>
              </div>
              <Chip
                label={lessonData.difficulty}
                color={
                  lessonData.difficulty === 'beginner'
                    ? 'success'
                    : lessonData.difficulty === 'intermediate'
                      ? 'warning'
                      : 'error'
                }
                variant="outlined"
              />
            </div>

            {/* Learning Objectives */}
            <Typography variant="subtitle2" className="mb-2 font-semibold">
              Learning Objectives:
            </Typography>
            <ul className="list-disc list-inside space-y-1">
              {lessonData.learningObjectives.map((obj, idx) => (
                <li key={idx} className="text-sm text-slate-700">
                  {obj}
                </li>
              ))}
            </ul>

            {/* Progress Bar */}
            <Box className="mt-6">
              <div className="flex justify-between items-center mb-2">
                <Typography variant="caption">Progress</Typography>
                <Typography variant="caption">{completionPercentage}%</Typography>
              </div>
              <LinearProgress
                variant="determinate"
                value={completionPercentage}
              />
            </Box>
          </CardContent>
        </Card>

        {/* Stepper */}
        <Stepper activeStep={activeStep} className="mb-6 bg-white p-4 rounded-lg">
          {lessonData.steps.map((step, idx) => (
            <Step
              key={step.id}
              onClick={() => setActiveStep(idx)}
              className="cursor-pointer"
            >
              <StepLabel>{step.title}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {/* Step Content */}
        {currentStep && (
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-4">
                {currentStep.type === 'concept' && (
                  <Lightbulb className="w-5 h-5 text-amber-500" />
                )}
                {currentStep.type === 'exercise' && (
                  <Code className="w-5 h-5 text-blue-500" />
                )}
                {currentStep.type === 'visualization' && (
                  <Route className="w-5 h-5 text-purple-500" />
                )}
                <Typography variant="h5">{currentStep.title}</Typography>
              </div>

              <Typography variant="body1" className="mb-6 text-slate-700">
                {currentStep.content.headline}
              </Typography>

              {currentStep.content.explanation && (
                <Typography variant="body2" className="mb-4 text-slate-600">
                  {currentStep.content.explanation}
                </Typography>
              )}

              {currentStep.content.codeSnippet && (
                <Paper
                  className="bg-slate-900 text-slate-100 p-4 mb-6 rounded font-mono text-sm overflow-x-auto"
                  elevation={0}
                >
                  {currentStep.content.codeSnippet}
                </Paper>
              )}

              {currentStep.content.keyTakeaway && (
                <Alert severity="info" className="mb-6">
                  <strong>Key Takeaway:</strong> {currentStep.content.keyTakeaway}
                </Alert>
              )}

              {/* Quiz */}
              {currentStep.content.quiz && (
                <QuizBlock
                  quiz={currentStep.content.quiz}
                  onAnswer={(isCorrect) =>
                    handleQuizAnswer(currentStep.id, isCorrect)
                  }
                />
              )}

              {/* Exercise */}
              {currentStep.content.exercise && (
                <FillInTheBlanksExercise
                  exercise={currentStep.content.exercise}
                  onComplete={(exerciseScores) =>
                    handleQuizAnswer(currentStep.id, Object.values(exerciseScores).every(Boolean))
                  }
                />
              )}
            </CardContent>
          </Card>
        )}

        {/* Navigation & Save */}
        <Box className="flex justify-between items-center">
          <Button
            disabled={activeStep === 0}
            onClick={handlePrevious}
            variant="outlined"
          >
            Previous
          </Button>

          <div className="flex gap-2">
            {isAuthenticated && (
              <Button
                variant="contained"
                startIcon={<Save className="w-4 h-4" />}
                onClick={handleSaveProgress}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Progress'}
              </Button>
            )}
            <Button
              disabled={activeStep === lessonData.steps.length - 1}
              onClick={handleNext}
              variant="contained"
            >
              Next
            </Button>
          </div>
        </Box>

        {/* Save Dialog */}
        <Dialog open={saveDialog} onClose={() => setSaveDialog(false)}>
          <DialogTitle>Progress Saved</DialogTitle>
          <DialogContent>
            <Typography>
              Your progress has been saved! You can resume this lesson anytime from your library.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setSaveDialog(false)}>Close</Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Box>
  );
};
