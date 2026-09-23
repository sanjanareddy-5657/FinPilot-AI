import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Profile from './pages/Profile';
import Documents from './pages/Documents';
import DocumentDetails from './pages/DocumentDetails';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Activity, LogOut, User } from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import { API_BASE_URL } from './config';

function AppContent() {
  const [health, setHealth] = useState(null);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`${API_BASE_URL}/health`)
      .then(res => res.json())
      .then(data => setHealth(data))
      .catch(() => setHealth({ status: 'error', message: 'Backend disconnected' }));
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="app-container" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Toaster 
        position="bottom-right" 
        toastOptions={{
          className: 'toast-container',
          style: {
            background: 'var(--surface)',
            color: 'var(--text-main)',
            border: '1px solid var(--surface-border)',
            backdropFilter: 'blur(12px)',
          }
        }} 
      />
      <header className="header container">
        <Link to="/" className="logo">
          <Activity color="var(--primary)" size={28} />
          FinPilot AI
        </Link>
        <nav style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {user ? (
            <>
              <Link to="/dashboard" className="btn btn-secondary" style={{ textDecoration: 'none' }}>
                Dashboard
              </Link>
              <Link to="/documents" className="btn btn-secondary" style={{ textDecoration: 'none' }}>
                Documents
              </Link>
              <Link to="/profile" className="btn btn-secondary" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <User size={16} /> Profile
              </Link>
              <button onClick={handleLogout} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <LogOut size={16} /> Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-secondary" style={{ textDecoration: 'none' }}>
                Sign In
              </Link>
              <Link to="/register" className="btn btn-primary" style={{ textDecoration: 'none' }}>
                Sign Up
              </Link>
            </>
          )}
        </nav>
      </header>

      <main style={{ flex: 1 }}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />
          <Route path="/documents" element={
            <ProtectedRoute>
              <Documents />
            </ProtectedRoute>
          } />
          <Route path="/documents/:id" element={
            <ProtectedRoute>
              <DocumentDetails />
            </ProtectedRoute>
          } />
          <Route path="/profile" element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          } />
        </Routes>
      </main>
      
      <footer style={{ padding: '1rem', textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
         Backend Status: 
         {health ? (
           <span style={{ color: health.status === 'ok' ? 'var(--secondary)' : 'var(--accent)', marginLeft: '0.5rem' }}>
             {health.status === 'ok' ? 'Connected' : 'Disconnected'}
           </span>
         ) : (
           <span style={{ marginLeft: '0.5rem' }}>Checking...</span>
         )}
      </footer>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </Router>
  );
}

export default App;
