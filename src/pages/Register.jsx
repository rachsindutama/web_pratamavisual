import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSiteSettings } from '../hooks/useSiteSettings';

export default function Register() {
  const [displayName, setDisplayName]         = useState('');
  const [email, setEmail]                     = useState('');
  const [password, setPassword]               = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError]                     = useState('');
  const [loadingAuth, setLoadingAuth]         = useState(false);
  const { register, loginWithGoogle, user } = useAuth();
  const navigate = useNavigate();
  const { settings } = useSiteSettings();

  useEffect(() => {
    if (settings) document.title = settings.seoTitle || settings.brandName || '';
  }, [settings]);

  useEffect(() => { if (user) navigate('/'); }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!displayName || !email || !password) { setError('Please fill in all fields.'); return; }
    if (password !== confirmPassword)         { setError('Passwords do not match.'); return; }
    if (password.length < 6)                  { setError('Password must be at least 6 characters.'); return; }
    try {
      setLoadingAuth(true);
      await register(email, password, displayName);
      navigate('/');
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') {
        setError('An account with this email already exists.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password is too weak. Please use a stronger password.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Invalid email address.');
      } else {
        setError('Failed to create account. Please try again.');
      }
    } finally { setLoadingAuth(false); }
  };

  const handleGoogleSignup = async () => {
    setError('');
    try {
      setLoadingAuth(true);
      await loginWithGoogle();
      navigate('/');
    } catch { setError('Failed to create account with Google.'); }
    finally { setLoadingAuth(false); }
  };

  const brandName = settings?.brandName || 'Pratamavisual';

  return (
    <div className="auth-card" id="register-form">
      <p className="auth-card__brand">{brandName}</p>
      <h1 className="auth-card__title">Create Account</h1>
      <p className="auth-card__subtitle">Join us and explore beautiful moments</p>

      {error && <div className="auth-card__error">{error}</div>}

      <form onSubmit={handleSubmit} noValidate>
        <div className="form-group">
          <label className="form-label" htmlFor="register-name">Full Name</label>
          <input
            type="text" id="register-name" className="form-input"
            placeholder="Your full name" value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required autoComplete="name"
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="register-email">Email</label>
          <input
            type="email" id="register-email" className="form-input"
            placeholder="your@email.com" value={email}
            onChange={(e) => setEmail(e.target.value)}
            required autoComplete="email"
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="register-password">Password</label>
          <input
            type="password" id="register-password" className="form-input"
            placeholder="Min. 6 characters" value={password}
            onChange={(e) => setPassword(e.target.value)}
            required autoComplete="new-password"
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="register-confirm">Confirm Password</label>
          <input
            type="password" id="register-confirm" className="form-input"
            placeholder="Re-enter password" value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required autoComplete="new-password"
          />
        </div>

        <button
          type="submit" id="register-submit"
          className="btn btn-primary auth-card__submit"
          disabled={loadingAuth}
        >
          {loadingAuth ? 'Creating Account…' : 'Create Account'}
        </button>
      </form>

      <div className="auth-card__divider"><span>OR</span></div>

      <button
        type="button" className="btn btn-outline auth-card__submit"
        onClick={handleGoogleSignup} disabled={loadingAuth}
        style={{ marginTop: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
      >
        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" style={{ width: '18px', height: '18px' }} />
        Continue with Google
      </button>

      <p className="auth-card__footer">
        Already have an account?{' '}
        <Link to="/login">Sign in</Link>
      </p>
    </div>
  );
}
