import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { useAuthStore } from '../store/auth';

type Step = 'email' | 'otp' | 'username';

export default function LoginPage() {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  async function requestOTP(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    try {
      await api.post('/auth/request-otp', { email: email.trim() });
      toast.success('Check your email for the code!');
      setStep('otp');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  }

  async function verifyOTP(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/auth/verify-otp', { email: email.trim(), code: otp.trim(), username: username || undefined });
      setAuth(data.user, data.token);
      toast.success(`Welcome, ${data.user.username}!`);
      navigate(searchParams.get('redirect') || '/dashboard');
    } catch (err: any) {
      if (err.response?.data?.needUsername) {
        setStep('username');
      } else {
        toast.error(err.response?.data?.error || 'Invalid code');
      }
    } finally {
      setLoading(false);
    }
  }

  async function submitWithUsername(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || username.trim().length < 2) {
      toast.error('Username must be at least 2 characters');
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post('/auth/verify-otp', { email: email.trim(), code: otp.trim(), username: username.trim() });
      setAuth(data.user, data.token);
      toast.success(`Welcome, ${data.user.username}!`);
      navigate(searchParams.get('redirect') || '/dashboard');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-tavern-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="text-6xl block mb-3">⚔</Link>
          <h1 className="font-serif text-3xl font-bold text-tavern-gold-light tracking-widest">THE TAVERN</h1>
          <p className="text-tavern-muted text-sm mt-1">
            {step === 'email' ? 'Enter your email to continue' :
             step === 'otp' ? 'Enter the code sent to your email' :
             'Choose your adventurer name'}
          </p>
        </div>

        <div className="tavern-card p-6">
          {step === 'email' && (
            <form onSubmit={requestOTP} className="space-y-4">
              <div>
                <label className="label block mb-1.5">Email Address</label>
                <input
                  type="email"
                  className="tavern-input"
                  placeholder="wizard@tower.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <button type="submit" className="btn-primary w-full" disabled={loading}>
                {loading ? 'Sending...' : 'Send Magic Code'}
              </button>
            </form>
          )}

          {step === 'otp' && (
            <form onSubmit={verifyOTP} className="space-y-4">
              <div>
                <label className="label block mb-1.5">6-Digit Code</label>
                <input
                  type="text"
                  className="tavern-input text-center text-2xl tracking-widest"
                  placeholder="000000"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                  required
                  autoFocus
                />
                <p className="text-xs text-tavern-muted mt-1.5">Sent to {email}</p>
              </div>
              <button type="submit" className="btn-primary w-full" disabled={loading || otp.length !== 6}>
                {loading ? 'Verifying...' : 'Enter the Tavern'}
              </button>
              <button type="button" className="btn-secondary w-full text-sm" onClick={() => setStep('email')}>
                Change Email
              </button>
            </form>
          )}

          {step === 'username' && (
            <form onSubmit={submitWithUsername} className="space-y-4">
              <div>
                <label className="label block mb-1.5">Adventurer Name</label>
                <input
                  type="text"
                  className="tavern-input"
                  placeholder="Gandalf the Grey"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  minLength={2}
                  maxLength={30}
                  required
                  autoFocus
                />
                <p className="text-xs text-tavern-muted mt-1.5">This will be your display name</p>
              </div>
              <button type="submit" className="btn-primary w-full" disabled={loading || username.trim().length < 2}>
                {loading ? 'Creating...' : 'Claim Your Name'}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-tavern-muted text-xs mt-6 font-body">
          No password needed — we use magic email codes
        </p>
      </div>
    </div>
  );
}
