import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { API_BASE_URL } from '../config';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email) {
      toast.error('Please enter your email address.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to start password reset.');

      // Local development has no configured mail provider, so expose the
      // generated reset URL for testing. Production never receives this URL.
      if (data.reset_url) {
        console.info('Password reset URL (development only):', data.reset_url);
      }
      setIsSubmitted(true);
      toast.success('Reset link sent!');
    } catch {
      toast.error('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '70vh', padding: '2rem 1.5rem' }}>
      <div className="glass-panel animate-fade-in-up" style={{ width: '100%', maxWidth: '420px' }}>
        
        {!isSubmitted ? (
          <>
            <h2 style={{ fontSize: '1.75rem', marginBottom: '0.5rem', textAlign: 'center' }}>Reset Password</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '2rem', textAlign: 'center' }}>
              Enter your email to receive password reset instructions.
            </p>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-main)' }}>Email Address</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem 0.75rem 2.75rem',
                      borderRadius: '0.5rem',
                      border: '1px solid var(--surface-border)',
                      background: 'rgba(15, 23, 42, 0.6)',
                      color: 'white',
                      fontSize: '0.95rem',
                      outline: 'none'
                    }}
                    required
                  />
                </div>
              </div>

              <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem', width: '100%' }} disabled={isLoading}>
                {isLoading ? (
                  <>
                    <div className="spinner" style={{ width: '18px', height: '18px', borderLeftColor: 'white' }} />
                    Sending...
                  </>
                ) : 'Send Reset Link'}
              </button>
            </form>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <div style={{ background: 'rgba(16, 185, 129, 0.1)', display: 'inline-flex', padding: '1rem', borderRadius: '50%', marginBottom: '1.5rem' }}>
              <CheckCircle2 size={40} color="var(--secondary)" />
            </div>
            <h2 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>Check your email</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: '2rem', lineHeight: '1.6' }}>
              If an account exists for <strong style={{ color: 'white' }}>{email}</strong>, reset instructions are on their way. In local development, use the reset URL printed in the browser console.
            </p>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1.5rem', borderTop: '1px solid var(--surface-border)', paddingTop: '1.25rem' }}>
          <Link to="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.875rem' }}>
            <ArrowLeft size={16} /> Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
