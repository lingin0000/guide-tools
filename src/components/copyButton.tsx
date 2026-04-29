import { CheckOutlined, CopyOutlined } from '@ant-design/icons';
import { message, Tooltip } from 'antd';
import classNames from 'classnames';
import React, { memo, useRef, useCallback, useEffect } from 'react';

// 代码复制按钮组件
interface CopyButtonProps {
  code: string;
  onCopy?: (code: string) => void;
  onError?: (error: Error) => void;
  darkTheme?: boolean;
}

const CopyButton: React.FC<CopyButtonProps> = memo(({ code, onCopy, onError, darkTheme }) => {
  const [copied, setCopied] = React.useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      onCopy?.(code);
      message.success('代码已复制到剪贴板');

      // 清除之前的定时器
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // 2秒后重置状态
      timeoutRef.current = setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (err) {
      // 降级方案
      try {
        const textArea = document.createElement('textarea');
        textArea.value = code;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);

        setCopied(true);
        onCopy?.(code);
        message.success('代码已复制到剪贴板');

        timeoutRef.current = setTimeout(() => {
          setCopied(false);
        }, 2000);
      } catch (fallbackErr) {
        const error = fallbackErr as Error;
        onError?.(error);
        message.error('复制失败，请手动复制');
      }
    }
  }, [code, onCopy, onError]);

  useEffect(
    () => () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    },
    []
  );

  return (
    <Tooltip title={copied ? '已复制' : '复制代码'} placement="top">
      <button
        type="button"
        className={classNames('copy-button', {
          'copy-button-dark': darkTheme,
          'copy-button-copied': copied,
        })}
        onClick={handleCopy}
        aria-label={copied ? '已复制' : '复制代码'}
      >
        {copied ? (
          <>
            <CheckOutlined className="copy-icon" />
            <span className="copy-text">已复制</span>
          </>
        ) : (
          <>
            <CopyOutlined className="copy-icon" />
            <span className="copy-text">复制</span>
          </>
        )}
      </button>
    </Tooltip>
  );
});

CopyButton.displayName = 'CopyButton';

export default CopyButton;
