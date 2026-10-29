import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSiteSettings } from '../hooks/useSiteSettings';

export default function Login() {
  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [error, setError]           = useState('');
  const [success, setSuccess]       = useState('');
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [loadingAuth, setLoadingAuth] = useState(false);
  const { login, loginWithGoogle, resetPassword, user } = useAuth();
  const navigate = useNavigate();
  const { settings } = useSiteSettings();

  useEffect(() => {
    if (settings) document.title = settings.seoTitle || settings.brandName || '';
  }, [settings]);

  useEffect(() => { if (user) navigate('/'); }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!email || !password) { setError('Please fill in all fields.'); return; }
    try {
      setLoadingAuth(true);
      await login(email, password);
      navigate('/');
    } catch (err) {
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Invalid email or password.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Too many failed attempts. Please try again later.');
      } else {
        setError('Failed to login. Please try again.');
      }
    } finally { setLoadingAuth(false); }
  };

  const handleGoogleLogin = async () => {
    setError(''); setSuccess('');
    try {
      setLoadingAuth(true);
      await loginWithGoogle();
      navigate('/');
    } catch { setError('Failed to login with Google.'); }
    finally { setLoadingAuth(false); }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!email) { setError('Please enter your email address.'); return; }
    try {
      setLoadingAuth(true);
      await resetPassword(email);
      setSuccess('Password reset link has been sent to your email.');
    } catch { setError('Failed to send reset link. Please check the email address.'); }
    finally { setLoadingAuth(false); }
  };

  const brandName = settings?.brandName || 'Pratamavisual';

  return (
    <div className="auth-card" id="login-form">
      <p className="auth-card__brand">{brandName}</p>

      <h1 className="auth-card__title">
        {isForgotPassword ? 'Reset Password' : 'Welcome Back'}
      </h1>
      <p className="auth-card__subtitle">
        {isForgotPassword
          ? 'Enter your email to receive a password reset link'
          : 'Sign in to your account'}
      </p>

      {error   && <div className="auth-card__error">{error}</div>}
      {success && <div className="auth-card__success">{success}</div>}

      {!isForgotPassword ? (
        <>
          <form onSubmit={handleSubmit} noValidate>
            <div className="form-group">
              <label className="form-label" htmlFor="login-email">Email</label>
              <input
                type="email" id="login-email" className="form-input"
                placeholder="your@email.com" value={email}
                onChange={(e) => setEmail(e.target.value)}
                required autoComplete="email"
              />
            </div>

            <div className="form-group">
              <div className="auth-card__pw-row">
                <label className="form-label" htmlFor="login-password">Password</label>
                <button
                  type="button" className="auth-card__forgot"
                  onClick={() => { setError(''); setSuccess(''); setIsForgotPassword(true); }}
                >
                  Forgot Password?
                </button>
              </div>
              <input
                type="password" id="login-password" className="form-input"
                placeholder="••••••••" value={password}
                onChange={(e) => setPassword(e.target.value)}
                required autoComplete="current-password"
              />
            </div>

            <button
              type="submit" id="login-submit"
              className="btn btn-primary auth-card__submit"
              disabled={loadingAuth}
            >
              {loadingAuth ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <div className="auth-card__divider"><span>OR</span></div>

          <button
            type="button" className="btn btn-outline auth-card__submit"
            onClick={handleGoogleLogin} disabled={loadingAuth}
            style={{ marginTop: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" style={{ width: '18px', height: '18px' }} />
            Continue with Google
          </button>
        </>
      ) : (
        <form onSubmit={handleResetPassword} noValidate>
          <div className="form-group">
            <label className="form-label" htmlFor="reset-email">Email</label>
            <input
              type="email" id="reset-email" className="form-input"
              placeholder="your@email.com" value={email}
              onChange={(e) => setEmail(e.target.value)}
              required autoComplete="email"
            />
          </div>
          <button type="submit" className="btn btn-primary auth-card__submit" disabled={loadingAuth}>
            {loadingAuth ? 'Sending…' : 'Send Reset Link'}
          </button>
          <button
            type="button" className="btn btn-outline auth-card__submit"
            style={{ marginTop: 'var(--space-sm)' }}
            onClick={() => { setError(''); setSuccess(''); setIsForgotPassword(false); }}
            disabled={loadingAuth}
          >
            Back to Login
          </button>
        </form>
      )}

      <p className="auth-card__footer">
        Don't have an account?{' '}
        <Link to="/register">Create one</Link>
      </p>
    </div>
  );
}
