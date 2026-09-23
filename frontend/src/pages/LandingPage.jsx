import React from 'react';
import { ArrowRight, BarChart2, Shield, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <div className="container" style={{ padding: '6rem 1.5rem', textAlign: 'center' }}>
      <div className="animate-fade-in-up" style={{ opacity: 0 }}>
        <h1>Next-Generation Financial Intelligence</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.25rem', maxWidth: '700px', margin: '0 auto 2.5rem' }}>
          Harness the power of AI to analyze documents, extract insights, and make data-driven financial decisions with unparalleled speed.
        </p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={() => navigate('/dashboard')}>
            Get Started <ArrowRight size={18} style={{ marginLeft: '0.5rem' }} />
          </button>
          <button className="btn btn-secondary">Learn More</button>
        </div>
      </div>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
        gap: '2rem', 
        marginTop: '8rem' 
      }}>
        {[
          { icon: <Zap size={24} color="#818CF8" />, title: 'Lightning Fast', desc: 'Process hundreds of pages in seconds.' },
          { icon: <BarChart2 size={24} color="#34D399" />, title: 'Deep Insights', desc: 'Uncover hidden trends and analytics instantly.' },
          { icon: <Shield size={24} color="#FBBF24" />, title: 'Bank-grade Security', desc: 'Your data is encrypted and completely secure.' }
        ].map((feature, i) => (
          <div key={i} className={`glass-panel animate-fade-in-up delay-${(i + 1) * 100}`} style={{ opacity: 0, textAlign: 'left' }}>
            <div style={{ marginBottom: '1rem', background: 'rgba(255,255,255,0.05)', display: 'inline-block', padding: '0.75rem', borderRadius: '0.5rem' }}>
              {feature.icon}
            </div>
            <h3 style={{ marginBottom: '0.5rem' }}>{feature.title}</h3>
            <p style={{ color: 'var(--text-muted)' }}>{feature.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LandingPage;
