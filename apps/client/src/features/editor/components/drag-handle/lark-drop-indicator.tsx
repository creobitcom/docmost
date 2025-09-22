import React from 'react';

interface LarkDropIndicatorProps {
  position: 'top' | 'bottom' | 'between';
  visible: boolean;
  style?: React.CSSProperties;
}

export const LarkDropIndicator: React.FC<LarkDropIndicatorProps> = ({ 
  position, 
  visible, 
  style 
}) => {
  if (!visible) return null;

  const getIndicatorStyle = (): React.CSSProperties => {
    const baseStyle: React.CSSProperties = {
      position: 'absolute',
      left: 0,
      right: 0,
      height: '3px',
      background: 'linear-gradient(90deg, #f59e0b, #d97706)',
      borderRadius: '2px',
      zIndex: 10000,
      pointerEvents: 'none',
      boxShadow: '0 0 8px rgba(245, 158, 11, 0.6)',
      animation: 'pulse 1.5s ease-in-out infinite',
    };

    switch (position) {
      case 'top':
        return { ...baseStyle, top: -2 };
      case 'bottom':
        return { ...baseStyle, bottom: -2 };
      case 'between':
        return { 
          ...baseStyle, 
          top: '50%', 
          transform: 'translateY(-50%)',
          background: 'linear-gradient(90deg, #f59e0b, #d97706, #f59e0b)',
          height: '4px',
          borderRadius: '3px',
        };
      default:
        return baseStyle;
    }
  };

  return (
    <>
      <div
        className={`lark-drop-indicator lark-drop-indicator-${position}`}
        style={{ ...getIndicatorStyle(), ...style }}
      />
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.8; }
          50% { opacity: 1; }
        }
      `}</style>
    </>
  );
};
