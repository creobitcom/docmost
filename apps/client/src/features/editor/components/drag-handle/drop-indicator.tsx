import React from 'react';

interface DropIndicatorProps {
  position: 'top' | 'bottom' | 'inside';
  visible: boolean;
  style?: React.CSSProperties;
}

export const DropIndicator: React.FC<DropIndicatorProps> = ({ 
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
      height: '2px',
      background: '#3b82f6',
      borderRadius: '1px',
      zIndex: 10000,
      pointerEvents: 'none',
      boxShadow: '0 0 4px rgba(59, 130, 246, 0.5)',
    };

    switch (position) {
      case 'top':
        return { ...baseStyle, top: 0 };
      case 'bottom':
        return { ...baseStyle, bottom: 0 };
      case 'inside':
        return { 
          ...baseStyle, 
          top: '50%', 
          transform: 'translateY(-50%)',
          background: 'rgba(59, 130, 246, 0.3)',
          height: '4px'
        };
      default:
        return baseStyle;
    }
  };

  return (
    <div
      className={`drop-indicator drop-indicator-${position}`}
      style={{ ...getIndicatorStyle(), ...style }}
    />
  );
};
