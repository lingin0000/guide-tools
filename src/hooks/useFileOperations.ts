import { useState } from 'react';
import { message } from 'antd';
import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';

export interface DocumentContentResult {
  content: string;
  file_path: string;
  file_name: string;
  document_type: 'markdown' | 'word';
  base_dir?: string;
}

export const useFileOperations = () => {
  const [isConverting, setIsConverting] = useState<boolean>(false);

  const handleLoadDocument = async (
    filePath: string,
    cachePath: string,
    onLoaded: (document: DocumentContentResult) => void
  ) => {
    setIsConverting(true);
    try {
      const result = await invoke<DocumentContentResult>('load_document_content', {
        filePath,
        cachePath,
      });
      onLoaded(result);
      message.success(result.document_type === 'word' ? 'Word 文件转换成功！' : 'Markdown 文件加载成功！');
    } catch (error) {
      console.error('文件加载失败:', error);
      message.error('文件加载失败');
    } finally {
      setIsConverting(false);
    }
  };

  const handleFileUpload = async (
    cachePath: string,
    onLoaded: (document: DocumentContentResult) => void
  ) => {
    try {
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: 'Word Documents',
            extensions: ['doc', 'docx'],
          },
        ],
      });

      if (!selected) {
        return;
      }

      await handleLoadDocument(selected as string, cachePath, onLoaded);
    } catch (error) {
      console.error('文件选择失败:', error);
      message.error('文件选择失败');
    }
  };

  const handleSaveMarkdown = async (markdownContent: string, cachePath: string) => {
    if (!markdownContent) {
      message.warning('没有内容可保存');
      return;
    }

    try {
      const selected = await save({
        defaultPath: cachePath ? `${cachePath}/operate-guide.md` : 'operate-guide.md',
        filters: [
          {
            name: 'Markdown Files',
            extensions: ['md'],
          },
        ],
      });

      if (selected) {
        const filePath = selected as string;
        await invoke('save_markdown_file', {
          content: markdownContent,
          filePath,
        });
        message.success('Markdown文件保存成功！');
      }
    } catch (error) {
      console.error('保存失败:', error);
      message.error('保存失败');
    }
  };

  return {
    isConverting,
    handleLoadDocument,
    handleFileUpload,
    handleSaveMarkdown,
  };
};
