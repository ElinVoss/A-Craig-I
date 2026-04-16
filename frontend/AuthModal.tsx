import React, { useState } from 'react';
import {
  Dialog, DialogContent, DialogTitle, Tabs, Tab, Box,
  TextField, Button, Alert, CircularProgress,
} from '@mui/material';
import { useAuth } from './AuthContext';

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ open, onOpenChange }) => {
  const { signup, login } = useAuth();
  const [tab, setTab] = useState<'login' | 'signup'>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Login form
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Signup form
  const [signupEmail, setSignupEmail] = useState('');
  const [signupUsername, setSignupUsername] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirm, setSignupConfirm] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(loginEmail, loginPassword);
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (signupPassword !== signupConfirm) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      await signup(signupEmail, signupUsername, signupPassword);
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => onOpenChange(false)} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ textAlign: 'center', fontWeight: 700 }}>VibeCode Academy</DialogTitle>
      <DialogContent>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} centered sx={{ mb: 2 }}>
          <Tab label="Login" value="login" />
          <Tab label="Sign Up" value="signup" />
        </Tabs>

        {tab === 'login' && (
          <Box component="form" onSubmit={handleLogin} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField label="Email" type="email" value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)} disabled={loading} required size="small" />
            <TextField label="Password" type="password" value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)} disabled={loading} required size="small" />
            <Button type="submit" variant="contained" disabled={loading} fullWidth>
              {loading ? <CircularProgress size={20} /> : 'Login'}
            </Button>
          </Box>
        )}

        {tab === 'signup' && (
          <Box component="form" onSubmit={handleSignup} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField label="Email" type="email" value={signupEmail}
              onChange={(e) => setSignupEmail(e.target.value)} disabled={loading} required size="small" />
            <TextField label="Username" type="text" value={signupUsername}
              onChange={(e) => setSignupUsername(e.target.value)} disabled={loading} required size="small"
              inputProps={{ minLength: 3 }} />
            <TextField label="Password" type="password" value={signupPassword}
              onChange={(e) => setSignupPassword(e.target.value)} disabled={loading} required size="small"
              inputProps={{ minLength: 8 }}
              helperText="Min 8 chars, uppercase, lowercase, digit" />
            <TextField label="Confirm Password" type="password" value={signupConfirm}
              onChange={(e) => setSignupConfirm(e.target.value)} disabled={loading} required size="small" />
            <Button type="submit" variant="contained" disabled={loading} fullWidth>
              {loading ? <CircularProgress size={20} /> : 'Sign Up'}
            </Button>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
};
