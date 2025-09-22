import React from 'react';

interface PlaceholderBlockProps {
  block: any;
}

export const PlaceholderBlock: React.FC<PlaceholderBlockProps> = ({ block }) => {
  return (
    <div style={{ padding: '10px', border: '1px dashed #ccc', margin: '5px 0' }}>
      <p>Блок недоступен для редактирования</p>
    </div>
  );
};


