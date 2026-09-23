import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import { API_BASE_URL } from '../config';

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const token = searchParams.get('token');

  const submit = async (event) => {
    event.preventDefault();
    if (!token) return toast.error('This reset link is missing its token.');
    if (password.length < 6) return toast.error('Password must be at least 6 characters long.');
    if (password !== confirmPassword) return toast.error('Passwords do not match.');

    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, new_password: password })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to reset password.');
      toast.success('Password reset. Please sign in.');
      navigate('/login');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '70vh', padding: '2rem 1.5rem' }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '420px' }}>
        <h2 style={{ fontSize: '1.75rem', marginBottom: '0.5rem', textAlign: 'center' }}>Choose a new password</h2>
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginBottom: '2rem' }}>Use a strong password with at least 6 characters.</p>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {[['New password', password, setPassword], ['Confirm password', confirmPassword, setConfirmPassword]].map(([label, value, setter]) => (
            <label key={label} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              {label}
              <span style={{ position: 'relative' }}>
                <Lock size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input type="password" value={value} onChange={(event) => setter(event.target.value)} required style={{ width: '100%', boxSizing: 'border-box', padding: '0.75rem 1rem 0.75rem 2.75rem', borderRadius: '0.5rem', border: '1px solid var(--surface-border)', background: 'rgba(15, 23, 42, 0.6)', color: 'white', fontSize: '0.95rem', outline: 'none' }} />
              </span>
            </label>
          ))}
          <button type="submit" className="btn btn-primary" disabled={isLoading}>{isLoading ? 'Resetting...' : 'Reset password'}</button>
        </form>
        <Link to="/login" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.875rem', marginTop: '1.5rem' }}><ArrowLeft size={16} /> Back to sign in</Link>
      </div>
    </div>
  );
};

export default ResetPassword;
