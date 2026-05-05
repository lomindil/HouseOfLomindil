import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { useAuthStore } from '../store/auth';
import clsx from 'clsx';

type Mode = 'signin' | 'register';
type RegisterStep = 'email' | 'otp' | 'details';

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('signin');

  // Sign-in state
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  // Register state
  const [regStep, setRegStep] = useState<RegisterStep>('email');
  const [regEmail, setRegEmail] = useState('');
  const [regOtp, setRegOtp] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPasswordConfirm, setRegPasswordConfirm] = useState('');
  const [isExistingUser, setIsExistingUser] = useState(false);

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { setAuth } = useAuthStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get('redirect') || '/dashboard';

  function switchMode(m: Mode) {
    setMode(m);
    setRegStep('email');
    setRegOtp('');
    setRegUsername('');
    setRegPassword('');
    setRegPasswordConfirm('');
    setIsExistingUser(false);
  }

  // ── Sign In ──────────────────────────────────────────────────────────────────
  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { identifier: identifier.trim(), password });
      setAuth(data.user, data.token);
      toast.success(`Welcome back, ${data.user.username}!`);
      navigate(redirect);
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Sign in failed';
      toast.error(msg);
      if (err.response?.data?.noPassword) {
        // Guide them to register to set a password
        setRegEmail(identifier.includes('@') ? identifier : '');
        switchMode('register');
      }
    } finally {
      setLoading(false);
    }
  }

  // ── Register: request OTP ────────────────────────────────────────────────────
  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/request-otp', { email: regEmail.trim() });
      toast.success('Code sent! Check your email.');
      setRegStep('otp');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to send code');
    } finally {
      setLoading(false);
    }
  }

  // ── Register: verify OTP ─────────────────────────────────────────────────────
  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      // Probe OTP validity before asking for details
      await api.post('/auth/verify-otp', { email: regEmail.trim(), code: regOtp.trim() });
      // If this returns 200, it means existing user with no password somehow — shouldn't happen
      // but handle it gracefully by treating as details step
      setRegStep('details');
    } catch (err: any) {
      const data = err.response?.data;
      if (data?.needDetails) {
        // OTP valid, server wants username/password — move to details step
        setIsExistingUser(!data?.error?.toLowerCase().includes('username'));
        setRegStep('details');
      } else {
        toast.error(data?.error || 'Invalid code');
      }
    } finally {
      setLoading(false);
    }
  }

  // ── Register: submit details ─────────────────────────────────────────────────
  async function handleRegisterDetails(e: React.FormEvent) {
    e.preventDefault();
    if (!isExistingUser && regUsername.trim().length < 2) {
      toast.error('Username must be at least 2 characters'); return;
    }
    if (regPassword.length < 6) {
      toast.error('Password must be at least 6 characters'); return;
    }
    if (regPassword !== regPasswordConfirm) {
      toast.error('Passwords do not match'); return;
    }
    setLoading(true);
    try {
      const { data } = await api.post('/auth/verify-otp', {
        email: regEmail.trim(),
        code: regOtp.trim(),
        username: isExistingUser ? undefined : regUsername.trim(),
        password: regPassword,
      });
      setAuth(data.user, data.token);
      toast.success(isExistingUser ? 'Password updated! Welcome back.' : `Welcome, ${data.user.username}!`);
      navigate(redirect);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  const subtitle = mode === 'signin'
    ? 'Sign in to your account'
    : regStep === 'email' ? 'Enter your email to register'
    : regStep === 'otp'   ? `Enter the code sent to ${regEmail}`
    : isExistingUser      ? 'Set a new password'
    :                       'Choose your name and password';

  return (
    <div className="min-h-screen bg-tavern-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="text-5xl block mb-3">⚔</Link>
          <h1 className="font-serif text-2xl font-bold text-tavern-gold-light tracking-widest">HOUSE OF LOMINDIL</h1>
          <p className="text-tavern-muted text-sm mt-1">{subtitle}</p>
        </div>

        {/* Mode tabs */}
        <div className="flex border border-tavern-border rounded-lg overflow-hidden mb-4">
          {(['signin', 'register'] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => switchMode(m)}
              className={clsx(
                'flex-1 py-2 text-sm font-serif transition-colors',
                mode === m
                  ? 'bg-tavern-gold/20 text-tavern-gold'
                  : 'text-tavern-muted hover:text-tavern-text bg-tavern-card'
              )}
            >
              {m === 'signin' ? 'Sign In' : 'Register'}
            </button>
          ))}
        </div>

        <div className="tavern-card p-6">

          {/* ── Sign In form ── */}
          {mode === 'signin' && (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <label className="label block mb-1.5">Username or Email</label>
                <input
                  className="tavern-input"
                  placeholder="Gandalf or wizard@tower.com"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="label block mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="tavern-input pr-10"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-tavern-muted hover:text-tavern-text text-xs"
                  >
                    {showPassword ? 'hide' : 'show'}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? 'Signing in...' : 'Enter the Tavern'}
              </button>
              <p className="text-xs text-tavern-muted text-center">
                No account yet?{' '}
                <button type="button" onClick={() => switchMode('register')} className="text-tavern-gold hover:underline">
                  Register here
                </button>
              </p>
            </form>
          )}

          {/* ── Register: email step ── */}
          {mode === 'register' && regStep === 'email' && (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <div>
                <label className="label block mb-1.5">Email Address</label>
                <input
                  type="email"
                  className="tavern-input"
                  placeholder="wizard@tower.com"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? 'Sending...' : 'Send Verification Code'}
              </button>
              <p className="text-xs text-tavern-muted text-center">
                Already have an account?{' '}
                <button type="button" onClick={() => switchMode('signin')} className="text-tavern-gold hover:underline">
                  Sign in
                </button>
              </p>
            </form>
          )}

          {/* ── Register: OTP step ── */}
          {mode === 'register' && regStep === 'otp' && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <label className="label block mb-1.5">6-Digit Code</label>
                <input
                  type="text"
                  inputMode="numeric"
                  className="tavern-input text-center text-2xl tracking-widest"
                  placeholder="000000"
                  value={regOtp}
                  onChange={(e) => setRegOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                  required
                  autoFocus
                />
                <p className="text-xs text-tavern-muted mt-1.5">Sent to {regEmail}</p>
              </div>
              <button type="submit" disabled={loading || regOtp.length !== 6} className="btn-primary w-full">
                {loading ? 'Verifying...' : 'Verify Code'}
              </button>
              <button type="button" className="btn-secondary w-full text-sm" onClick={() => setRegStep('email')}>
                Change Email
              </button>
            </form>
          )}

          {/* ── Register: details step (username + password) ── */}
          {mode === 'register' && regStep === 'details' && (
            <form onSubmit={handleRegisterDetails} className="space-y-4">
              {!isExistingUser && (
                <div>
                  <label className="label block mb-1.5">Adventurer Name</label>
                  <input
                    className="tavern-input"
                    placeholder="Gandalf the Grey"
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    minLength={2}
                    maxLength={30}
                    required
                    autoFocus
                  />
                  <p className="text-xs text-tavern-muted mt-1">This will be your display name</p>
                </div>
              )}
              <div>
                <label className="label block mb-1.5">{isExistingUser ? 'New Password' : 'Password'}</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="tavern-input pr-10"
                    placeholder="At least 6 characters"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    minLength={6}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-tavern-muted hover:text-tavern-text text-xs"
                  >
                    {showPassword ? 'hide' : 'show'}
                  </button>
                </div>
              </div>
              <div>
                <label className="label block mb-1.5">Confirm Password</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="tavern-input"
                  placeholder="Same as above"
                  value={regPasswordConfirm}
                  onChange={(e) => setRegPasswordConfirm(e.target.value)}
                  minLength={6}
                  required
                />
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading
                  ? 'Saving...'
                  : isExistingUser ? 'Set Password & Sign In' : 'Create Account'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
