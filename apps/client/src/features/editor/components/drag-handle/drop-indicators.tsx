import React from 'react';

export interface DropIndicatorsProps {
  type: 'block' | 'element' | 'inlineElement';
  position: 'before' | 'after' | 'inside';
  isValid: boolean;
  message?: string;
}

export const DropIndicators: React.FC<DropIndicatorsProps> = ({
  type,
  position,
  isValid,
  message
}) => {
  const getIndicatorClass = () => {
    const baseClass = 'drop-indicator';
    const positionClass = position === 'before' ? 'drop-indicator-before' : 'drop-indicator-after';
    const validityClass = isValid ? 'valid' : 'invalid';
    
    return `${baseClass} ${positionClass} ${validityClass}`;
  };

  const getIndicatorStyle = () => {
    if (type === 'element') {
      return {
        background: isValid 
          ? 'linear-gradient(90deg, #3b82f6, #8b5cf6)' 
          : 'linear-gradient(90deg, #ef4444, #dc2626)',
        height: '2px'
      };
    }
    
    if (type === 'inlineElement') {
      return {
        background: isValid 
          ? 'linear-gradient(90deg, #10b981, #059669)' 
          : 'linear-gradient(90deg, #ef4444, #dc2626)',
        height: '1px',
        borderRadius: '0.5px'
      };
    }
    
    // Default block indicator
    return {
      background: isValid 
        ? 'linear-gradient(90deg, #3b82f6, #8b5cf6)' 
        : 'linear-gradient(90deg, #ef4444, #dc2626)',
      height: '4px'
    };
  };

  return (
    <div
      className={getIndicatorClass()}
      style={getIndicatorStyle()}
      title={message}
    />
  );
};

export const AnimatedDropIndicator: React.FC<{
  position: 'before' | 'after';
  isValid: boolean;
  message?: string;
}> = ({ position, isValid, message }) => {
  return (
    <div
      className={`insert-indicator ${position === 'before' ? 'insert-indicator-before' : 'insert-indicator-after'}`}
      style={{
        background: isValid 
          ? 'linear-gradient(90deg, #3b82f6, #8b5cf6)' 
          : 'linear-gradient(90deg, #ef4444, #dc2626)',
        opacity: 1,
        transition: 'all 0.2s ease'
      }}
      title={message}
    />
  );
};

export const ListDropIndicator: React.FC<{
  position: 'before' | 'after';
  isValid: boolean;
  message?: string;
}> = ({ position, isValid, message }) => {
  return (
    <div
      className={`list-drop-indicator ${position === 'before' ? 'list-drop-indicator-before' : 'list-drop-indicator-after'}`}
      style={{
        background: isValid 
          ? 'linear-gradient(90deg, #8b5cf6, #a855f7)' 
          : 'linear-gradient(90deg, #ef4444, #dc2626)',
        height: '3px',
        borderRadius: '1.5px',
        opacity: 1,
        transition: 'all 0.2s ease'
      }}
      title={message}
    />
  );
};


