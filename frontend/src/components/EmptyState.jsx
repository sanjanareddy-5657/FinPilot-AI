import React from 'react';

/**
 * A beautiful, standardized empty state component.
 */
const EmptyState = ({ 
  icon: Icon, 
  title, 
  description, 
  actionLabel, 
  onAction,
  iconSize = 48,
  iconColor = 'var(--text-muted)'
}) => {
  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      padding: '4rem 2rem', 
      textAlign: 'center',
      color: 'var(--text-muted)',
      animation: 'fadeInUp 0.5s ease'
    }}>
      {Icon && (
        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          padding: '1.5rem',
          borderRadius: '50%',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Icon size={iconSize} color={iconColor} style={{ opacity: 0.8 }} />
        </div>
      )}
      
      <h3 style={{ 
        fontSize: '1.25rem', 
        color: 'var(--text-main)', 
        marginBottom: '0.75rem',
        fontWeight: 600
      }}>
        {title}
      </h3>
      
      {description && (
        <p style={{ 
          fontSize: '0.9rem', 
          maxWidth: '400px', 
          lineHeight: 1.6,
          marginBottom: actionLabel ? '2rem' : 0
        }}>
          {description}
        </p>
      )}
      
      {actionLabel && onAction && (
        <button 
          onClick={onAction} 
          className="btn btn-primary"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};

export default EmptyState;
