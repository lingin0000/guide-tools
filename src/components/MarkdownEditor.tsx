import React from "react";
import MDEditor, { ICommand } from "@uiw/react-md-editor";
import { Button } from "antd";

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  loading?: boolean;
}

const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
  value,
  onChange,
  loading = false,
}) => {
  const codePreview: ICommand = {
    name: "preview",
    keyCommand: "preview",
    value: "preview",
    icon: <Button />,
  };
  return (
    <MDEditor
      value={value}
      onChange={(v) => onChange(v || "")}
      height={window.innerHeight - 113}
      extraCommands={[codePreview]}
      visibleDragbar={true}
      preview="edit"
      onScroll={(e) => {
        console.log(e);
      }}
      style={{
        border: "none",
        borderRadius: 0,
      }}
      textareaProps={{
        placeholder: "在这里编辑Markdown内容...",
        disabled: loading,
        style: {
          fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
          fontSize: 14,
        },
      }}
    />
  );
};

export default MarkdownEditor;
