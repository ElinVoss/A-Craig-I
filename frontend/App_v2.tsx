import React, { useState, useEffect } from 'react';
import { Box, AppBar, Toolbar, Button, Typography, Badge, MenuItem, Menu } from '@mui/material';
import { AuthProvider, useAuth } from './AuthContext';
import { AuthModal } from './AuthModal';
import { LessonRenderer } from './LessonRenderer_v2';
import { LessonLibrary } from './LessonLibrary';
import { DailyReview } from './DailyReview';
import { AnalyticsDashboard } from './AnalyticsDashboard';
import { DepthSlider, DepthLevel } from './DepthSlider';
import { BookOpen, LogOut } from 'lucide-react';
import { PricingModal } from './PricingModal';
import { CommunityLibrary } from './CommunityLibrary';
import { GitHubReader } from './GitHubReader';
import { JobGapAnalysis } from './JobGapAnalysis';

// Sample lesson for demonstration
const SAMPLE_LESSON = {
  title: 'Understanding React Hooks',
  description: 'Learn how React Hooks revolutionized functional components',
  difficulty: 'beginner',
  learningObjectives: [
    'Understand the useState hook',
    'Learn about useEffect for side effects',
    'Know when to use hooks vs classes',
    'Master hook rules and best practices',
  ],
  steps: [
    {
      id: 'step-1',
      title: 'The Hook: Why Functional Components?',
      type: 'concept',
      content: {
        headline: 'Why Hooks Changed Everything',
        explanation:
          'Before hooks, functional components couldn\'t have state or lifecycle methods. You had to use class components or use complex render props. Hooks solved this by giving functional components access to state and lifecycle features.',
        keyTakeaway:
          'Hooks let you use state and other React features without writing a class. They\'re backwards compatible and completely opt-in.',
        codeSnippet: `// Before hooks - had to use a class
class Counter extends React.Component {
  constructor(props) {
    super(props);
    this.state = { count: 0 };
  }
  render() {
    return <button onClick={() => this.setState({count: this.state.count + 1})}>
      Count: {this.state.count}
    </button>;
  }
}

// With hooks - simple functional component
function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>
    Count: {count}
  </button>;
}`,
        quiz: {
          question: 'What was the main problem hooks solved?',
          options: [
            {
              id: 'opt-1',
              text: 'Functional components couldn\'t use state or lifecycle methods',
              correct: true,
              explanation:
                'Exactly! Before hooks, you needed class components to access state and lifecycle features.',
            },
            {
              id: 'opt-2',
              text: 'Class components were too fast',
              correct: false,
              explanation: 'Class components were actually slower, not faster.',
            },
            {
              id: 'opt-3',
              text: 'There was no way to pass props',
              correct: false,
              explanation: 'Props have always worked in functional components.',
            },
            {
              id: 'opt-4',
              text: 'JSX didn\'t support functions',
              correct: false,
              explanation: 'JSX has always supported function components.',
            },
          ],
        },
      },
    },
    {
      id: 'step-2',
      title: 'useState: Managing Component State',
      type: 'exercise',
      content: {
        headline: 'useState Hook Deep Dive',
        explanation:
          'The useState hook lets you add state to functional components. It returns an array with two elements: the current state value and a function to update it.',
        keyTakeaway:
          'useState returns [currentValue, setterFunction]. The setter function triggers a re-render with the new value.',
        exercise: {
          headline: 'Fill in the useState code',
          scenario:
            'Complete the code to create a component that increments a counter when a button is clicked.',
          blanks: [
            {
              text: 'function Counter() {\n  const [count, _______] = useState(0);',
              answer: 'setCount',
            },
            {
              text: 'return <button onClick={() => _______}>\n    Count: {count}\n  </button>;',
              answer: 'setCount(count + 1)',
            },
          ],
          solution:
            'function Counter() {\n  const [count, setCount] = useState(0);\n  return <button onClick={() => setCount(count + 1)}>\n    Count: {count}\n  </button>;\n}',
        },
      },
    },
    {
      id: 'step-3',
      title: 'useEffect: Side Effects',
      type: 'concept',
      content: {
        headline: 'Managing Side Effects with useEffect',
        explanation:
          'useEffect lets you perform side effects in functional components. Side effects are things like fetching data, setting up subscriptions, or manually changing the DOM.',
        keyTakeaway:
          'useEffect runs after every render by default. Use the dependency array to control when it runs.',
        codeSnippet: `// Run after every render
useEffect(() => {
  document.title = 'Updated!';
});

// Run only once (on mount)
useEffect(() => {
  console.log('Component mounted');
}, []);

// Run when dependencies change
useEffect(() => {
  fetchUserData(userId);
}, [userId]);

// Cleanup function (on unmount)
useEffect(() => {
  const subscription = subscribe();
  return () => subscription.unsubscribe();
}, []);`,
        quiz: {
          question: 'When does useEffect run by default?',
          options: [
            {
              id: 'opt-1',
              text: 'After every render',
              correct: true,
              explanation: 'Yes! useEffect runs after every render unless you specify a dependency array.',
            },
            {
              id: 'opt-2',
              text: 'Only on component mount',
              correct: false,
              explanation: 'Only if you pass an empty dependency array [].',
            },
            {
              id: 'opt-3',
              text: 'Never automatically',
              correct: false,
              explanation: 'It does run automatically by default.',
            },
            {
              id: 'opt-4',
              text: 'Before every render',
              correct: false,
              explanation: 'It runs AFTER the render, not before.',
            },
          ],
        },
      },
    },
  ],
};

interface AppProps {
  initialView?: 'library' | 'lesson' | 'home' | 'review' | 'analytics' | 'community' | 'github' | 'job-gap';
}

const AppContent: React.FC<AppProps> = ({ initialView = 'home' }) => {
  const { isAuthenticated, user, logout, api } = useAuth();
  const [currentView, setCurrentView] = useState<'library' | 'lesson' | 'home' | 'review' | 'analytics' | 'community' | 'github' | 'job-gap'>(
    initialView
  );
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [dueCount, setDueCount] = useState(0);
  const [depthLevel, setDepthLevel] = useState<DepthLevel>('beginner');
  const [userMenuAnchor, setUserMenuAnchor] = useState<null | HTMLElement>(null);
  const [pricingOpen, setPricingOpen] = useState(false);

  // Fetch review due count + user depth on auth
  useEffect(() => {
    if (!isAuthenticated) { setDueCount(0); return; }
    api.get('/api/review/stats')
      .then((res) => setDueCount(res.data.due_today ?? 0))
      .catch(() => setDueCount(0));
    api.get('/api/me')
      .then((res) => setDepthLevel((res.data.depth_level ?? 'beginner') as DepthLevel))
      .catch(() => {});
  }, [isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectLesson = (lessonId: string) => {
    setSelectedLessonId(lessonId);
    setCurrentView('lesson');
  };

  return (
    <Box className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Top Navigation */}
      <AppBar position="static" className="bg-white shadow-sm border-b">
        <Toolbar className="flex justify-between">
          <div
            className="flex items-center gap-2 cursor-pointer hover:opacity-80"
            onClick={() => setCurrentView('home')}
          >
            <BookOpen className="w-6 h-6 text-blue-600" />
            <Typography variant="h6" className="text-slate-900">
              VibeCode Academy
            </Typography>
          </div>

          <div className="flex items-center gap-4">
            {isAuthenticated && (
              <>
                <Button
                  variant={currentView === 'library' ? 'contained' : 'text'}
                  onClick={() => setCurrentView('library')}
                >
                  My Library
                </Button>
                <Badge badgeContent={dueCount || undefined} color="error">
                  <Button
                    variant={currentView === 'review' ? 'contained' : 'outlined'}
                    onClick={() => setCurrentView('review')}
                    size="small"
                  >
                    🧠 Review
                  </Button>
                </Badge>
                <Button
                  variant={currentView === 'analytics' ? 'contained' : 'text'}
                  onClick={() => setCurrentView('analytics')}
                  size="small"
                >
                  📊 Analytics
                </Button>
                <Button
                  variant={currentView === 'community' ? 'contained' : 'text'}
                  onClick={() => setCurrentView('community')}
                  size="small"
                >
                  🌍 Community
                </Button>
                <Button
                  variant={currentView === 'github' ? 'contained' : 'text'}
                  onClick={() => setCurrentView('github')}
                  size="small"
                >
                  🐙 GitHub
                </Button>
                <Button
                  variant={currentView === 'job-gap' ? 'contained' : 'text'}
                  onClick={() => setCurrentView('job-gap')}
                  size="small"
                >
                  💼 Job Gap
                </Button>
                <Typography variant="body2" className="text-slate-600">
                  {user?.username}
                </Typography>
                {/* User menu with depth slider */}
                <Button
                  size="small"
                  onClick={(e) => setUserMenuAnchor(e.currentTarget)}
                  variant="outlined"
                >
                  ⚙️
                </Button>
                <Menu
                  anchorEl={userMenuAnchor}
                  open={!!userMenuAnchor}
                  onClose={() => setUserMenuAnchor(null)}
                  PaperProps={{ sx: { p: 2, minWidth: 340 } }}
                >
                  <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>
                    Settings
                  </Typography>
                  <DepthSlider
                    currentDepth={depthLevel}
                    onDepthChange={(d) => { setDepthLevel(d); setUserMenuAnchor(null); }}
                  />
                  <Box sx={{ mt: 2, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
                    <MenuItem
                      onClick={() => { setPricingOpen(true); setUserMenuAnchor(null); }}
                      sx={{ borderRadius: 1 }}
                    >
                      ✨ Upgrade to Pro
                    </MenuItem>
                    <MenuItem
                      onClick={() => { logout(); setUserMenuAnchor(null); }}
                      sx={{ color: 'error.main', borderRadius: 1 }}
                    >
                      <LogOut size={14} style={{ marginRight: 8 }} /> Logout
                    </MenuItem>
                  </Box>
                </Menu>
              </>
            )}
            {!isAuthenticated && (
              <Button
                variant="contained"
                onClick={() => setAuthModalOpen(true)}
              >
                Sign In
              </Button>
            )}
          </div>
        </Toolbar>
      </AppBar>

      {/* Content Area */}
      {currentView === 'home' && (
        <Box className="max-w-4xl mx-auto p-8 text-center">
          <Typography variant="h3" className="mb-4 font-bold">
            Learn Code the Interactive Way
          </Typography>
          <Typography variant="h6" className="text-slate-600 mb-8">
            Paste code from Claude, ChatGPT, or Gemini to get an interactive
            lesson with quizzes and exercises.
          </Typography>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <div className="text-3xl mb-2">🎯</div>
              <Typography variant="h6">Personalized Lessons</Typography>
              <Typography variant="body2" className="text-slate-600">
                Get tailored lessons based on your code
              </Typography>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <div className="text-3xl mb-2">📊</div>
              <Typography variant="h6">Track Progress</Typography>
              <Typography variant="body2" className="text-slate-600">
                Save lessons and track your learning journey
              </Typography>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <div className="text-3xl mb-2">🚀</div>
              <Typography variant="h6">Learn Faster</Typography>
              <Typography variant="body2" className="text-slate-600">
                Interactive quizzes and exercises speed up learning
              </Typography>
            </div>
          </div>

          {!isAuthenticated && (
            <Button
              variant="contained"
              size="large"
              onClick={() => setAuthModalOpen(true)}
            >
              Get Started - Sign In
            </Button>
          )}

          {isAuthenticated && (
            <Button
              variant="contained"
              size="large"
              onClick={() => setCurrentView('lesson')}
            >
              Try Sample Lesson
            </Button>
          )}
        </Box>
      )}

      {currentView === 'library' && isAuthenticated && (
        <LessonLibrary onSelectLesson={handleSelectLesson} />
      )}

      {currentView === 'review' && isAuthenticated && (
        <DailyReview onBack={() => setCurrentView('home')} />
      )}

      {currentView === 'analytics' && isAuthenticated && (
        <AnalyticsDashboard />
      )}

      {currentView === 'lesson' && (
        <LessonRenderer lessonData={SAMPLE_LESSON} />
      )}

      {currentView === 'community' && isAuthenticated && (
        <CommunityLibrary onOpenLesson={handleSelectLesson} />
      )}

      {currentView === 'github' && isAuthenticated && (
        <GitHubReader onLessonGenerated={(lesson) => {
          setCurrentView('lesson');
        }} />
      )}

      {currentView === 'job-gap' && isAuthenticated && (
        <JobGapAnalysis onGenerateLesson={(concept) => {
          setCurrentView('lesson');
        }} />
      )}

      {/* Auth Modal */}
      <AuthModal open={authModalOpen} onOpenChange={setAuthModalOpen} />

      {/* Pricing Modal */}
      <PricingModal open={pricingOpen} onClose={() => setPricingOpen(false)} />
    </Box>
  );
};

export default function App({ initialView = 'home' }: AppProps) {  return (
    <AuthProvider>
      <AppContent initialView={initialView} />
    </AuthProvider>
  );
}
