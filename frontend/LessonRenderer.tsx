import React, { useState } from 'react';
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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  LinearProgress,
} from '@mui/material';
import { CheckCircle, XCircle, Code, Lightbulb, Route } from 'lucide-react';

// Type definitions matching our lesson.json schema
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

interface CodeHighlight {
  language: string;
  snippet: string;
}

interface StepContent {
  headline: string;
  explanation?: string;
  scenario?: string;
  solution?: string;
  keyTakeaway?: string;
  codeHighlight?: CodeHighlight;
  modelBreakdown?: any;
  dataJourney?: any[];
  timeline?: any;
}

interface LessonStep {
  id: string;
  title: string;
  order: number;
  type: 'concept' | 'exercise' | 'visualization';
  content: StepContent;
  quiz?: Quiz;
  exercise?: any;
  keyPoints?: string[];
}

interface Lesson {
  title: string;
  description: string;
  difficulty: string;
  estimatedTime: string;
  learningObjectives: string[];
  steps: LessonStep[];
  summary: any;
  metadata: any;
}

interface LessonRendererProps {
  lesson: Lesson;
}

// Quiz Component
const QuizBlock: React.FC<{ quiz: Quiz; onAnswer: (correct: boolean) => void }> = ({
  quiz,
  onAnswer,
}) => {
  const [selected, setSelected] = useState<string | null>(null);
  const [answered, setAnswered] = useState(false);
  const selectedOption = quiz.options.find((o) => o.id === selected);

  const handleSubmit = () => {
    if (selected) {
      setAnswered(true);
      onAnswer(selectedOption?.correct || false);
    }
  };

  return (
    <Card sx={{ my: 3, backgroundColor: '#f5f5f5', border: '2px solid #e0e0e0' }}>
      <CardContent>
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
          ❓ Quick Check
        </Typography>
        <Typography variant="body1" sx={{ mb: 3 }}>
          {quiz.question}
        </Typography>

        <RadioGroup value={selected || ''} onChange={(e) => setSelected(e.target.value)}>
          {quiz.options.map((option) => (
            <Box
              key={option.id}
              sx={{
                mb: 2,
                p: 2,
                border: `2px solid ${
                  answered && option.id === selected
                    ? option.correct
                      ? '#4caf50'
                      : '#f44336'
                    : '#e0e0e0'
                }`,
                borderRadius: 1,
                backgroundColor:
                  answered && option.id === selected
                    ? option.correct
                      ? '#e8f5e9'
                      : '#ffebee'
                    : 'white',
                transition: 'all 0.2s',
                cursor: 'pointer',
              }}
            >
              <FormControlLabel
                value={option.id}
                control={<Radio />}
                label={option.text}
                sx={{ mb: answered && option.id === selected ? 1 : 0 }}
              />
              {answered && option.id === selected && (
                <Box sx={{ mt: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    {option.correct ? (
                      <CheckCircle size={20} color="#4caf50" />
                    ) : (
                      <XCircle size={20} color="#f44336" />
                    )}
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 'bold',
                        color: option.correct ? '#4caf50' : '#f44336',
                      }}
                    >
                      {option.correct ? 'Correct!' : 'Not quite.'}
                    </Typography>
                  </Box>
                  <Typography variant="body2" sx={{ color: '#555', fontStyle: 'italic' }}>
                    {option.explanation}
                  </Typography>
                </Box>
              )}
            </Box>
          ))}
        </RadioGroup>

        {!answered && (
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={!selected}
            sx={{ mt: 2, backgroundColor: '#667eea' }}
          >
            Check Answer
          </Button>
        )}
        {answered && (
          <Button
            variant="outlined"
            onClick={() => {
              setSelected(null);
              setAnswered(false);
            }}
            sx={{ mt: 2 }}
          >
            Try Another Question
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

// Fill-in-the-Blank Exercise Component
const FillInTheBlanksExercise: React.FC<{ exercise: any; onComplete: () => void }> = ({
  exercise,
  onComplete,
}) => {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);

  const handleChange = (blankId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [blankId]: value }));
  };

  const handleSubmit = () => {
    let correct = 0;
    exercise.blanks.forEach((blank: any) => {
      if (answers[blank.id]?.toLowerCase() === blank.answer.toLowerCase()) {
        correct++;
      }
    });
    setScore(correct);
    setSubmitted(true);
  };

  return (
    <Card sx={{ my: 3, backgroundColor: '#f9f9f9' }}>
      <CardContent>
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
          ✏️ {exercise.title}
        </Typography>
        <Typography variant="body2" sx={{ mb: 3, color: '#666' }}>
          {exercise.description}
        </Typography>

        <Paper
          sx={{
            p: 2,
            mb: 3,
            backgroundColor: '#f0f0f0',
            fontFamily: 'monospace',
            borderLeft: '4px solid #667eea',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          <Code size={16} style={{ marginRight: 8, marginBottom: 8 }} />
          {exercise.given.code.split(/(_______|___________)/g).map((part: string, idx: number) => {
            const blankIndex = exercise.blanks.findIndex(
              (b: any) =>
                exercise.given.code
                  .split(/(_______|___________)/g)
                  .slice(0, idx)
                  .join('').length === exercise.given.code.indexOf(part)
            );

            if (part === '_______' || part === '___________') {
              const blank = exercise.blanks[Object.keys(answers).length];
              return (
                <TextField
                  key={idx}
                  size="small"
                  value={answers[blank?.id] || ''}
                  onChange={(e) => handleChange(blank?.id, e.target.value)}
                  placeholder={blank?.hint || 'Answer'}
                  disabled={submitted}
                  sx={{
                    mx: 0.5,
                    width: '100px',
                    backgroundColor: 'white',
                  }}
                />
              );
            }
            return <span key={idx}>{part}</span>;
          })}
        </Paper>

        {exercise.blanks.map((blank: any) => (
          <Box key={blank.id} sx={{ mb: 2 }}>
            <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#667eea' }}>
              {blank.position}
            </Typography>
            <Typography variant="body2" sx={{ mb: 1, color: '#666' }}>
              💡 {blank.hint}
            </Typography>
            {!submitted && (
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {blank.options.map((option: string) => (
                  <Chip
                    key={option}
                    label={option}
                    onClick={() => handleChange(blank.id, option)}
                    variant={answers[blank.id] === option ? 'filled' : 'outlined'}
                    color={answers[blank.id] === option ? 'primary' : 'default'}
                  />
                ))}
              </Box>
            )}
            {submitted && (
              <Alert
                severity={
                  answers[blank.id]?.toLowerCase() === blank.answer.toLowerCase()
                    ? 'success'
                    : 'error'
                }
              >
                <Typography variant="body2">
                  {answers[blank.id]?.toLowerCase() === blank.answer.toLowerCase()
                    ? `✓ Correct: ${blank.answer}`
                    : `✗ Incorrect. The answer is: ${blank.answer}`}
                </Typography>
              </Alert>
            )}
          </Box>
        ))}

        {!submitted ? (
          <Button
            variant="contained"
            onClick={handleSubmit}
            sx={{ mt: 3, backgroundColor: '#667eea' }}
          >
            Submit Answers
          </Button>
        ) : (
          <Box sx={{ mt: 3 }}>
            <LinearProgress
              variant="determinate"
              value={(score / exercise.blanks.length) * 100}
              sx={{ mb: 2 }}
            />
            <Alert severity={score === exercise.blanks.length ? 'success' : 'info'}>
              Score: {score}/{exercise.blanks.length}
            </Alert>
            <Button
              variant="contained"
              onClick={() => {
                setAnswers({});
                setSubmitted(false);
                onComplete();
              }}
              sx={{ mt: 2, backgroundColor: '#667eea' }}
            >
              Continue to Next Step
            </Button>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

// Data Journey Timeline Component
const DataJourneyTimeline: React.FC<{ stages: any[]; timeline: any }> = ({
  stages,
  timeline,
}) => {
  const [expandedStage, setExpandedStage] = useState<number | null>(null);

  return (
    <Box sx={{ my: 3 }}>
      <Typography variant="h6" sx={{ mb: 3, fontWeight: 'bold' }}>
        🌊 Data Journey
      </Typography>

      {/* Timeline Visualization */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
          {stages.map((stage, idx) => (
            <Box
              key={idx}
              onClick={() => setExpandedStage(expandedStage === idx ? null : idx)}
              sx={{
                flex: 1,
                mx: 1,
                p: 2,
                textAlign: 'center',
                backgroundColor: expandedStage === idx ? '#667eea' : '#f0f0f0',
                color: expandedStage === idx ? 'white' : 'black',
                borderRadius: 1,
                cursor: 'pointer',
                transition: 'all 0.3s',
                '&:hover': {
                  backgroundColor: expandedStage === idx ? '#667eea' : '#e0e0e0',
                },
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
                {stage.stage}
              </Typography>
              <Typography variant="caption">{stage.location.split(' ')[0]}</Typography>
            </Box>
          ))}
        </Box>

        {expandedStage !== null && (
          <Card sx={{ mb: 3, backgroundColor: '#f9f9f9' }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
                {stages[expandedStage].location}
              </Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                <strong>Actor:</strong> {stages[expandedStage].actor}
              </Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                <strong>Action:</strong> {stages[expandedStage].action}
              </Typography>

              <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
                Code:
              </Typography>
              <Paper
                sx={{
                  p: 2,
                  mb: 2,
                  backgroundColor: '#1e1e1e',
                  color: '#d4d4d4',
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  overflow: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {stages[expandedStage].code}
              </Paper>

              {stages[expandedStage].output && (
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
                    Output:
                  </Typography>
                  <Paper
                    sx={{
                      p: 2,
                      backgroundColor: '#f0f0f0',
                      fontFamily: 'monospace',
                      fontSize: '12px',
                      overflow: 'auto',
                    }}
                  >
                    <pre>{JSON.stringify(stages[expandedStage].output, null, 2)}</pre>
                  </Paper>
                </Box>
              )}
            </CardContent>
          </Card>
        )}
      </Box>

      {/* Timeline Duration Breakdown */}
      {timeline?.segments && (
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 2 }}>
            ⏱️ {timeline.title}
          </Typography>
          {timeline.segments.map((segment: any, idx: number) => (
            <Box key={idx} sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="body2">
                  <strong>{segment.phase}</strong>
                </Typography>
                <Typography variant="body2" sx={{ color: '#667eea', fontWeight: 'bold' }}>
                  {segment.duration}
                </Typography>
              </Box>
              <Typography variant="caption" sx={{ color: '#999' }}>
                {segment.description}
              </Typography>
              <LinearProgress sx={{ mt: 1 }} />
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
};

// Main Lesson Renderer Component
export const LessonRenderer: React.FC<LessonRendererProps> = ({ lesson }) => {
  const [activeStep, setActiveStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  const handleStepComplete = () => {
    const newCompleted = new Set(completedSteps);
    newCompleted.add(activeStep);
    setCompletedSteps(newCompleted);
    if (activeStep < lesson.steps.length - 1) {
      setActiveStep(activeStep + 1);
    }
  };

  const currentStep = lesson.steps[activeStep];

  return (
    <Box sx={{ maxWidth: '1000px', mx: 'auto', py: 4, px: 2 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h3" sx={{ fontWeight: 'bold', mb: 1 }}>
          {lesson.title}
        </Typography>
        <Typography variant="body1" sx={{ color: '#666', mb: 3 }}>
          {lesson.description}
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
          <Chip label={`📊 ${lesson.difficulty}`} />
          <Chip label={`⏱️ ${lesson.estimatedTime}`} />
        </Box>

        {/* Learning Objectives */}
        <Card sx={{ backgroundColor: '#e3f2fd', mb: 3 }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 1, fontWeight: 'bold' }}>
              🎯 Learning Objectives
            </Typography>
            {lesson.learningObjectives.map((obj, idx) => (
              <Typography key={idx} variant="body2" sx={{ mb: 1, ml: 2 }}>
                ✓ {obj}
              </Typography>
            ))}
          </CardContent>
        </Card>
      </Box>

      {/* Stepper */}
      <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
        {lesson.steps.map((step, idx) => (
          <Step key={step.id} completed={completedSteps.has(idx)}>
            <StepLabel>{step.title}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {/* Current Step Content */}
      <Box sx={{ mb: 4 }}>
        {/* Step Header */}
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            {currentStep.type === 'concept' && <Lightbulb size={24} color="#667eea" />}
            {currentStep.type === 'exercise' && <Code size={24} color="#667eea" />}
            {currentStep.type === 'visualization' && <Route size={24} color="#667eea" />}
            <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
              {currentStep.title}
            </Typography>
          </Box>
        </Box>

        {/* Step Content */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
              {currentStep.content.headline}
            </Typography>

            {currentStep.content.explanation && (
              <Typography variant="body1" sx={{ mb: 2, lineHeight: 1.8 }}>
                {currentStep.content.explanation}
              </Typography>
            )}

            {currentStep.content.scenario && (
              <Alert severity="info" sx={{ mb: 2 }}>
                <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
                  📖 Scenario:
                </Typography>
                <Typography variant="body2">{currentStep.content.scenario}</Typography>
              </Alert>
            )}

            {currentStep.content.solution && (
              <Alert severity="success" sx={{ mb: 2 }}>
                <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
                  ✨ Solution:
                </Typography>
                <Typography variant="body2">{currentStep.content.solution}</Typography>
              </Alert>
            )}

            {currentStep.content.keyTakeaway && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
                  🔑 Key Takeaway:
                </Typography>
                <Typography variant="body2">{currentStep.content.keyTakeaway}</Typography>
              </Alert>
            )}

            {currentStep.content.codeHighlight && (
              <Paper
                sx={{
                  p: 2,
                  mb: 2,
                  backgroundColor: '#1e1e1e',
                  color: '#d4d4d4',
                  fontFamily: 'monospace',
                  fontSize: '13px',
                  overflow: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {currentStep.content.codeHighlight.snippet}
              </Paper>
            )}

            {currentStep.content.modelBreakdown && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>
                  📋 {currentStep.content.modelBreakdown.name} Fields:
                </Typography>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow sx={{ backgroundColor: '#f0f0f0' }}>
                        <TableCell sx={{ fontWeight: 'bold' }}>Field</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Type</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Required</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Description</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {currentStep.content.modelBreakdown.fields.map((field: any, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell sx={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
                            {field.name}
                          </TableCell>
                          <TableCell sx={{ fontFamily: 'monospace' }}>{field.type}</TableCell>
                          <TableCell>{field.required ? '✓' : '✗'}</TableCell>
                          <TableCell>{field.description}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}

            {currentStep.keyPoints && (
              <Box sx={{ mt: 3, p: 2, backgroundColor: '#f0f0f0', borderRadius: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
                  💡 Why It Matters:
                </Typography>
                {currentStep.keyPoints.map((point, idx) => (
                  <Typography key={idx} variant="body2" sx={{ mb: 1 }}>
                    • {point}
                  </Typography>
                ))}
              </Box>
            )}
          </CardContent>
        </Card>

        {/* Quiz */}
        {currentStep.quiz && (
          <QuizBlock
            quiz={currentStep.quiz}
            onAnswer={(correct) => {
              if (correct) handleStepComplete();
            }}
          />
        )}

        {/* Exercise */}
        {currentStep.exercise && (
          <FillInTheBlanksExercise
            exercise={currentStep.exercise}
            onComplete={handleStepComplete}
          />
        )}

        {/* Visualization */}
        {currentStep.type === 'visualization' &&
          currentStep.content.dataJourney &&
          currentStep.content.timeline && (
            <DataJourneyTimeline
              stages={currentStep.content.dataJourney}
              timeline={currentStep.content.timeline}
            />
          )}
      </Box>

      {/* Navigation Buttons */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
        <Button
          variant="outlined"
          onClick={() => setActiveStep(Math.max(0, activeStep - 1))}
          disabled={activeStep === 0}
        >
          ← Previous
        </Button>
        <Typography variant="body2" sx={{ alignSelf: 'center', color: '#999' }}>
          Step {activeStep + 1} of {lesson.steps.length}
        </Typography>
        <Button
          variant="contained"
          onClick={() => setActiveStep(Math.min(lesson.steps.length - 1, activeStep + 1))}
          disabled={activeStep === lesson.steps.length - 1}
          sx={{ backgroundColor: '#667eea' }}
        >
          Next →
        </Button>
      </Box>
    </Box>
  );
};

export default LessonRenderer;
