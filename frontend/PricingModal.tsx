import React, { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, Box, Typography, Button, Chip,
  Card, CardContent, List, ListItem, ListItemIcon, ListItemText, IconButton
} from '@mui/material';
import { Check, X, Zap, Users, BookOpen } from 'lucide-react';
import { useAuth } from './AuthContext';

interface PricingModalProps {
  open: boolean;
  onClose: () => void;
  highlightFeature?: string;
}

const TIERS = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    period: 'forever',
    color: '#64748b',
    icon: BookOpen,
    features: [
      '10 lessons per month',
      'Chrome extension capture',
      'Basic lesson viewer',
      'JavaScript + Python runner',
    ],
    missing: ['Spaced repetition', 'Depth slider', 'Analytics dashboard', 'Community library', 'GitHub reader', 'Job gap analysis'],
    cta: 'Current plan',
    disabled: true,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$12',
    period: 'per month',
    color: '#6366f1',
    icon: Zap,
    badge: 'Most Popular',
    features: [
      'Unlimited lessons',
      'Spaced repetition (SM-2)',
      'Depth slider (ELI5 → Expert)',
      'Analytics dashboard',
      'Community library + fork',
      'GitHub codebase reader',
      'Job gap analysis',
      'Misconception engine',
      'Aha-moment detection',
    ],
    missing: [],
    cta: 'Upgrade to Pro',
    plan: 'pro',
  },
  {
    id: 'team',
    name: 'Team',
    price: '$49',
    period: 'per seat / month',
    color: '#0ea5e9',
    icon: Users,
    features: [
      'Everything in Pro',
      'Shared team lesson library',
      'Team knowledge graph',
      'Admin dashboard',
      'Priority support',
      'Custom depth presets',
    ],
    missing: [],
    cta: 'Start Team Trial',
    plan: 'team',
  },
];

export const PricingModal: React.FC<PricingModalProps> = ({ open, onClose, highlightFeature }) => {
  const { api } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);

  const handleUpgrade = async (plan: string) => {
    setLoading(plan);
    try {
      const resp = await api.post('/api/billing/create-checkout', {
        plan,
        success_url: window.location.origin + '/billing/success',
        cancel_url: window.location.origin + '/billing/cancel',
      });
      window.location.href = resp.data.checkout_url;
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Could not start checkout. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box className="flex justify-between items-center">
          <Box>
            <Typography variant="h5" fontWeight={700}>Upgrade VibeCode</Typography>
            {highlightFeature && (
              <Typography variant="body2" color="text.secondary">
                <strong>{highlightFeature}</strong> requires a Pro subscription.
              </Typography>
            )}
          </Box>
          <IconButton onClick={onClose}><X size={20} /></IconButton>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Box className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-4">
          {TIERS.map((tier) => {
            const Icon = tier.icon;
            return (
              <Card
                key={tier.id}
                variant="outlined"
                sx={{
                  border: `2px solid ${tier.color}`,
                  position: 'relative',
                  transition: 'transform 0.15s',
                  '&:hover': { transform: 'translateY(-2px)' },
                }}
              >
                {tier.badge && (
                  <Chip
                    label={tier.badge}
                    size="small"
                    sx={{
                      position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
                      bgcolor: tier.color, color: 'white', fontWeight: 700,
                    }}
                  />
                )}
                <CardContent>
                  <Box className="flex items-center gap-2 mb-2">
                    <Icon size={20} color={tier.color} />
                    <Typography variant="h6" fontWeight={700}>{tier.name}</Typography>
                  </Box>
                  <Box className="mb-3">
                    <Typography variant="h4" fontWeight={800} sx={{ color: tier.color }}>{tier.price}</Typography>
                    <Typography variant="caption" color="text.secondary">{tier.period}</Typography>
                  </Box>
                  <List dense disablePadding>
                    {tier.features.map((f) => (
                      <ListItem key={f} disableGutters sx={{ py: 0.25 }}>
                        <ListItemIcon sx={{ minWidth: 24 }}><Check size={14} color="#22c55e" /></ListItemIcon>
                        <ListItemText primary={f} primaryTypographyProps={{ variant: 'body2' }} />
                      </ListItem>
                    ))}
                    {tier.missing.map((f) => (
                      <ListItem key={f} disableGutters sx={{ py: 0.25, opacity: 0.4 }}>
                        <ListItemIcon sx={{ minWidth: 24 }}><X size={14} /></ListItemIcon>
                        <ListItemText primary={f} primaryTypographyProps={{ variant: 'body2' }} />
                      </ListItem>
                    ))}
                  </List>
                  <Button
                    variant={tier.disabled ? 'outlined' : 'contained'}
                    fullWidth
                    disabled={!!tier.disabled || loading === tier.plan}
                    onClick={() => tier.plan && handleUpgrade(tier.plan)}
                    sx={{ mt: 2, bgcolor: tier.disabled ? undefined : tier.color, '&:hover': { bgcolor: tier.color } }}
                  >
                    {loading === tier.plan ? 'Redirecting...' : tier.cta}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </Box>
      </DialogContent>
    </Dialog>
  );
};
