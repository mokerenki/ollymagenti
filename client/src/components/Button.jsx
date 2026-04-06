function Button({ children, onClick, variant = 'primary', size = 'md', disabled = false, loading = false, className = '' }) {
  const variants = {
    primary: {
      background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
      color: 'white',
      border: 'none'
    },
    secondary: {
      background: 'white',
      color: '#4f46e5',
      border: '1px solid #e5e7eb'
    },
    danger: {
      background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
      color: 'white',
      border: 'none'
    },
    ghost: {
      background: 'transparent',
      color: '#6b7280',
      border: 'none'
    }
  };
  
  const sizes = {
    sm: { padding: '0.25rem 0.75rem', fontSize: '12px' },
    md: { padding: '0.5rem 1rem', fontSize: '14px' },
    lg: { padding: '0.75rem 1.5rem', fontSize: '16px' }
  };
  
  const style = {
    ...variants[variant],
    ...sizes[size],
    borderRadius: '8px',
    cursor: disabled || loading ? 'not-allowed' : 'pointer',
    opacity: disabled || loading ? 0.6 : 1,
    transition: 'all 0.2s ease',
    fontWeight: '500',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    ...(variant !== 'ghost' && { boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)' })
  };
  
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      style={style}
      className={`btn-hover-effect ${className}`}
    >
      {loading && <div className="spinner" style={{ width: '14px', height: '14px', borderTopColor: 'white' }} />}
      {children}
    </button>
  );
}

export default Button;