import React from 'react';
import { Editor } from '@tiptap/react';

interface LarkEditorWrapperProps {
  editor: Editor | null;
  children?: React.ReactNode;
}

export const LarkEditorWrapper: React.FC<LarkEditorWrapperProps> = ({ 
  editor, 
  children 
}) => {
  return (
    <div className="lark-editor-wrapper">
      {children}
    </div>
  );
};
