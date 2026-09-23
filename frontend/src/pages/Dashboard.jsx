import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Upload, FileText, Database,
  Layers, CheckCircle, RefreshCw, Clock
} from 'lucide-react';
import toast from 'react-hot-toast';
import SkeletonLoader from '../components/SkeletonLoader';
import EmptyState from '../components/EmptyState';
import { API_BASE_URL } from '../config';

const Dashboard = () => {
  const { token, user } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    total_docs: 0,
    storage_used: 0,
    pending_count: 0,
    completed_count: 0
  });
  const [recentDocs, setRecentDocs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch stats
      const statsRes = await fetch(`${API_BASE_URL}/documents/stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const statsData = await statsRes.json();
      if (!statsRes.ok) throw new Error(statsData.error || 'Failed to fetch stats.');
      setStats(statsData);

      // 2. Fetch recent docs (limit 5)
      const docsRes = await fetch(`${API_BASE_URL}/documents?limit=5`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const docsData = await docsRes.json();
      if (!docsRes.ok) throw new Error(docsData.error || 'Failed to fetch documents.');
      setRecentDocs(docsData.documents);
    } catch (err) {
      toast.error(err.message || 'Error loading dashboard data.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const formatSize = (bytes) => {
    if (bytes === 0) return '0 KB';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getRelativeTime = (dateString) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHrs = Math.floor(diffMins / 60);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHrs < 24) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  return (
    <div className="container" style={{ padding: '3rem 1.5rem' }}>
      
      {/* Title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
        <div className="animate-fade-in-up" style={{ opacity: 0 }}>
          <h2 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>Workspace Dashboard</h2>
          <p style={{ color: 'var(--text-muted)' }}>Welcome back, {user?.full_name}. Here is an overview of your financial analysis workspace.</p>
        </div>
        <button 
          onClick={fetchDashboardData} 
          className="btn btn-secondary animate-fade-in-up" 
          style={{ opacity: 0, padding: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', 
        gap: '1.5rem', 
        marginBottom: '3rem' 
      }}>
        {[
          { icon: <Database size={22} color="var(--primary)" />, title: 'Total Documents', value: stats.total_docs, desc: 'Files uploaded' },
          { icon: <Layers size={22} color="#F59E0B" />, title: 'Storage Used', value: formatSize(stats.storage_used), desc: 'Used of 100MB quota' },
          { icon: <Clock size={22} color="#3B82F6" />, title: 'Pending AI Analysis', value: stats.pending_count, desc: 'Files processing or queued' },
          { icon: <CheckCircle size={22} color="var(--secondary)" />, title: 'Completed Analysis', value: stats.completed_count, desc: 'Ready for chat' }
        ].map((card, i) => (
          <div key={i} className={`glass-panel animate-fade-in-up delay-${(i + 1) * 100}`} style={{ opacity: 0, padding: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.75rem', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {card.icon}
            </div>
            <div>
              <div style={{ fontSize: '0.825rem', color: 'var(--text-muted)', fontWeight: 500 }}>{card.title}</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0.25rem 0' }}>{card.value}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{card.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Sections */}
      <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
        
        {/* Upload Action Panel */}
        <div style={{ flex: '1 1 550px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="glass-panel animate-fade-in-up delay-200" style={{ opacity: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '5rem 2rem' }}>
            <div style={{ background: 'rgba(79, 70, 229, 0.1)', padding: '1.25rem', borderRadius: '50%', marginBottom: '1.5rem' }}>
              <Upload size={40} color="var(--primary)" />
            </div>
            <h3 style={{ marginBottom: '0.75rem', fontSize: '1.5rem' }}>Upload Financial Documents</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', maxWidth: '400px', fontSize: '0.95rem', lineHeight: '1.5' }}>
              Upload your financial statements (PDFs, Excel spreadsheets, or CSV tables) to start exploring them with AI.
            </p>
            <button className="btn btn-primary" onClick={() => navigate('/documents')}>
              Manage & Upload Files
            </button>
          </div>
        </div>

        {/* Sidebar - Recent Uploads */}
        <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="glass-panel animate-fade-in-up delay-300" style={{ opacity: 0, height: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.25rem' }}>Recent Uploads</h3>
              <Link to="/documents" style={{ fontSize: '0.825rem', color: 'var(--primary)', textDecoration: 'none', fontWeight: 500 }}>
                View All
              </Link>
            </div>
            
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '1rem 0' }}>
                <SkeletonLoader type="text" count={5} style={{ height: '3rem', borderRadius: '0.5rem' }} />
              </div>
            ) : recentDocs.length === 0 ? (
              <EmptyState 
                icon={FileText} 
                title="No recent documents" 
                description="Upload some financial documents to see them here." 
                iconSize={32}
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {recentDocs.map((item) => (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.5rem', borderRadius: '0.5rem', transition: 'background 0.2s', ':hover': { background: 'rgba(255,255,255,0.02)' } }}>
                    <div style={{ background: 'rgba(79, 70, 229, 0.08)', padding: '0.65rem', borderRadius: '0.5rem' }}>
                      <FileText size={18} color="var(--primary)" />
                    </div>
                    <div style={{ overflow: 'hidden', flex: 1 }}>
                      <div style={{ fontSize: '0.875rem', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={item.file_name}>
                        {item.file_name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{item.file_type}</span>
                        <span>•</span>
                        <span>{getRelativeTime(item.upload_date)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default Dashboard;
