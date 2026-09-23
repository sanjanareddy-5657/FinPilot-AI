import React from 'react';
import './SkeletonLoader.css'; // We'll add some specific CSS for this

/**
 * Skeleton Loader Component
 * Generates pulsing skeleton blocks for loading states.
 * 
 * @param {string} type - 'text', 'circular', 'rectangular', 'card', 'tableRow'
 * @param {number} count - number of skeletons to render
 */
const SkeletonLoader = ({ type = 'text', count = 1, style = {}, className = '' }) => {
  
  const renderSkeleton = (key) => {
    let specificStyles = {};
    
    switch (type) {
      case 'circular':
        specificStyles = { width: '48px', height: '48px', borderRadius: '50%' };
        break;
      case 'rectangular':
        specificStyles = { width: '100%', height: '200px', borderRadius: '0.75rem' };
        break;
      case 'card':
        return (
          <div key={key} className={`skeleton-container ${className}`} style={{ padding: '1.5rem', borderRadius: '1rem', border: '1px solid var(--surface-border)', background: 'var(--surface)', ...style }}>
            <div className="skeleton-pulse" style={{ width: '40px', height: '40px', borderRadius: '0.5rem', marginBottom: '1rem' }} />
            <div className="skeleton-pulse" style={{ width: '60%', height: '1.25rem', borderRadius: '4px', marginBottom: '0.5rem' }} />
            <div className="skeleton-pulse" style={{ width: '100%', height: '2rem', borderRadius: '4px', marginBottom: '0.5rem' }} />
            <div className="skeleton-pulse" style={{ width: '40%', height: '0.875rem', borderRadius: '4px' }} />
          </div>
        );
      case 'tableRow':
        return (
          <div key={key} style={{ display: 'flex', gap: '1rem', padding: '1rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.03)', ...style }}>
            <div className="skeleton-pulse" style={{ width: '30%', height: '1.25rem', borderRadius: '4px' }} />
            <div className="skeleton-pulse" style={{ width: '15%', height: '1.25rem', borderRadius: '4px' }} />
            <div className="skeleton-pulse" style={{ width: '15%', height: '1.25rem', borderRadius: '4px' }} />
            <div className="skeleton-pulse" style={{ width: '20%', height: '1.25rem', borderRadius: '4px' }} />
            <div className="skeleton-pulse" style={{ width: '20%', height: '1.25rem', borderRadius: '4px' }} />
          </div>
        );
      case 'text':
      default:
        specificStyles = { width: '100%', height: '1rem', borderRadius: '4px', marginBottom: '0.5rem' };
        break;
    }

    return (
      <div 
        key={key} 
        className={`skeleton-pulse ${className}`} 
        style={{ ...specificStyles, ...style }} 
      />
    );
  };

  const skeletons = [];
  for (let i = 0; i < count; i++) {
    skeletons.push(renderSkeleton(i));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: type === 'card' ? '1.5rem' : '0' }}>
      {skeletons}
    </div>
  );
};

export default SkeletonLoader;
