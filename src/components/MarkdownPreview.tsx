/* eslint-disable react/jsx-props-no-spreading */
import React, { memo, useMemo, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import { Image } from 'antd';
import classNames from 'classnames';
import type { Components, Options } from 'react-markdown';
import CopyButton from './copyButton';
import './index.less';

// 类型定义
export interface MarkdownProps {
  /** Markdown 内容 */
  content: string;
  /** 自定义类名 */
  className?: string;
  /** 自定义样式 */
  style?: React.CSSProperties;
  /** 是否显示代码复制按钮 */
  showCopyButton?: boolean;
  /** 是否启用语法高亮 */
  enableSyntaxHighlight?: boolean;
  /** 是否允许 HTML */
  allowHtml?: boolean;
  /** 最大高度，超出显示滚动条 */
  maxHeight?: number | string;
  /** 是否使用暗色主题 */
  darkTheme?: boolean;
  /** 自定义渲染器 */
  customComponents?: Partial<Components>;
  /** 点击链接回调 */
  onLinkClick?: (href: string, event: React.MouseEvent) => void;
  /** 图片加载错误回调 */
  onImageError?: (src: string) => void;
  /** 代码复制成功回调 */
  onCodeCopy?: (code: string) => void;
  /** 代码复制失败回调 */
  onCodeCopyError?: (error: Error) => void;
  /** 是否启用表格支持 */
  enableTables?: boolean;
  /** 是否启用任务列表 */
  enableTaskLists?: boolean;
  /** 是否启用删除线 */
  enableStrikethrough?: boolean;
  /** 是否启用换行符转换 */
  enableBreaks?: boolean;
  /** 图片预览配置 */
  imagePreview?: boolean;
}

// 主要的 Markdown 组件
const MarkdownPreview: React.FC<MarkdownProps> = memo(
  ({
    content,
    className,
    style,
    showCopyButton = true,
    enableSyntaxHighlight = true,
    allowHtml = false,
    maxHeight,
    darkTheme = false,
    customComponents = {},
    onLinkClick,
    onImageError,
    onCodeCopy,
    onCodeCopyError,
    enableTables = true,
    enableTaskLists = true,
    enableStrikethrough = true,
    enableBreaks = true,
    imagePreview = true,
  }) => {
    // 构建 remark 插件列表
    const remarkPlugins = useMemo(() => {
      const plugins: Options['remarkPlugins'] = [];

      if (enableTables || enableTaskLists || enableStrikethrough) {
        plugins.push(remarkGfm);
      }

      if (enableBreaks) {
        plugins.push(remarkBreaks);
      }

      return plugins;
    }, [enableTables, enableTaskLists, enableStrikethrough, enableBreaks]);

    // 构建 rehype 插件列表
    const rehypePlugins = useMemo(() => {
      const plugins: Options['rehypePlugins'] = [];

      if (allowHtml) {
        plugins.push(rehypeRaw);
        plugins.push(rehypeSanitize);
      }

      return plugins;
    }, [allowHtml]);

    // 自定义代码块渲染器
    const CodeBlock = useCallback(
      ({
        className: _className,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        style: _style,
        children,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        ref,
        ...props
      }: React.ComponentProps<'code'>) => {
        const match = /language-(\w+)/.exec(_className || '');
        const language = match ? match[1] : '';
        const code = String(children).replace(/\n$/, '');
        if (!language) {
          return (
            <code className={classNames('inline-code', className)} {...props}>
              {children}
            </code>
          );
        }

        return (
          <div className="code-block-wrapper">
            {showCopyButton && (
              <CopyButton code={code} onCopy={onCodeCopy} onError={onCodeCopyError} darkTheme={darkTheme} />
            )}
            {enableSyntaxHighlight ? (
              <SyntaxHighlighter
                style={darkTheme ? oneDark : oneLight}
                language={language}
                PreTag="div"
                className={classNames('syntax-highlighter', {
                  'syntax-highlighter-dark': darkTheme,
                })}
                {...props}
              >
                {code}
              </SyntaxHighlighter>
            ) : (
              <pre className={classNames('code-block', className)} {...props} ref={ref as React.Ref<HTMLPreElement>}>
                <code>{children}</code>
              </pre>
            )}
          </div>
        );
      },
      [showCopyButton, onCodeCopy, onCodeCopyError, darkTheme, enableSyntaxHighlight, className]
    );

    // 自定义链接渲染器
    const LinkRenderer = useCallback(
      ({ href, children, ...props }: React.ComponentProps<'a'>) => {
        const handleClick = (event: React.MouseEvent) => {
          if (onLinkClick && href) {
            event.preventDefault();
            onLinkClick(href, event);
          }
        };

        return (
          <a
            href={href}
            className="markdown-link"
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleClick}
            {...props}
          >
            {children}
          </a>
        );
      },
      [onLinkClick]
    );

    // 自定义图片渲染器
    const ImageRenderer = useCallback(
      ({ src, alt, onClick }: React.ComponentProps<'img'>) => {
        const handleError = () => {
          if (src) {
            onImageError?.(src);
          }
        };

        if (!src) {
          return null;
        }

        return (
          <span className="markdown-image-wrapper">
            <Image
              src={src}
              alt={alt || "图片"}
              className="markdown-image"
              preview={imagePreview}
              loading="lazy"
              onError={handleError}
              onClick={
                onClick as (
                  e: React.MouseEvent<HTMLDivElement, MouseEvent>
                ) => void
              }
              fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMIAAADDCAYAAADQvc6UAAABRWlDQ1BJQ0MgUHJvZmlsZQAAKJFjYGASSSwoyGFhYGDIzSspCnJ3UoiIjFJgf8LAwSDCIMogwMCcmFxc4BgQ4ANUwgCjUcG3awyMIPqyLsis7PPOq3QdDFcvjV3jOD1boQVTPQrgSkktTgbSf4A4LbmgqISBgTEFyFYuLykAsTuAbJEioKOA7DkgdjqEvQHEToKwj4DVhAQ5A9k3gGyB5IxEoBmML4BsnSQk8XQkNtReEOBxcfXxUQg1Mjc0dyHgXNJBSWpFCYh2zi+oLMpMzyhRcASGUqqCZ16yno6CkYGRAQMDKMwhqj/fAIcloxgHQqxAjIHBEugw5sUIsSQpBobtQPdLciLEVJYzMPBHMDBsayhILEqEO4DxG0txmrERhM29nYGBddr//5/DGRjYNRkY/l7////39v///y4Dmn+LgeHANwDrkl1AuO+pmgAAADhlWElmTU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAAqACAAQAAAABAAAAwqADAAQAAAABAAAAwwAAAAD9b/HnAAAHlklEQVR4Ae3dP3Ik1RnG4W+FgYxN"
            />
          </span>
        );
      },
      [onImageError, imagePreview]
    );

    // 自定义表格渲染器
    const TableRenderer = useCallback(
      ({ children, ...props }: React.ComponentProps<'table'>) => (
        <div className="table-wrapper">
          <table className="markdown-table" {...props}>
            {children}
          </table>
        </div>
      ),
      []
    );

    const H1Renderer = useCallback(
      ({ children, ...props }: React.ComponentProps<'h1'>) => (
        <h1 className="markdown-h1" {...props}>
          {children}
        </h1>
      ),
      []
    );

    const H2Renderer = useCallback(
      ({ children, ...props }: React.ComponentProps<'h2'>) => (
        <h2 className="markdown-h2" {...props}>
          {children}
        </h2>
      ),
      []
    );

    const H3Renderer = useCallback(
      ({ children, ...props }: React.ComponentProps<'h3'>) => (
        <h3 className="markdown-h3" {...props}>
          {children}
        </h3>
      ),
      []
    );

    const H4Renderer = useCallback(
      ({ children, ...props }: React.ComponentProps<'h4'>) => (
        <h4 className="markdown-h4" {...props}>
          {children}
        </h4>
      ),
      []
    );

    const H5Renderer = useCallback(
      ({ children, ...props }: React.ComponentProps<'h5'>) => (
        <h5 className="markdown-h5" {...props}>
          {children}
        </h5>
      ),
      []
    );

    const H6Renderer = useCallback(
      ({ children, ...props }: React.ComponentProps<'h6'>) => (
        <h6 className="markdown-h6" {...props}>
          {children}
        </h6>
      ),
      []
    );

    const PRenderer = useCallback(
      ({ children, ...props }: React.ComponentProps<'p'>) => (
        <p className="markdown-p" {...props}>
          {children}
        </p>
      ),
      []
    );

    const UlRenderer = useCallback(
      ({ children, ...props }: React.ComponentProps<'ul'>) => (
        <ul className="markdown-ul" {...props}>
          {children}
        </ul>
      ),
      []
    );

    const LiRenderer = useCallback(
      ({ children, ...props }: React.ComponentProps<'li'>) => (
        <li className="markdown-li" {...props}>
          {children}
        </li>
      ),
      []
    );

    const OlRenderer = useCallback(
      ({ children, ...props }: React.ComponentProps<'ol'>) => (
        <ol className="markdown-ol" {...props}>
          {children}
        </ol>
      ),
      []
    );

    const BlockquoteRenderer = useCallback(
      ({ children, ...props }: React.ComponentProps<'blockquote'>) => (
        <blockquote className="markdown-blockquote" {...props}>
          {children}
        </blockquote>
      ),
      []
    );

    const HrRenderer = useCallback(
      ({ ...props }: React.ComponentProps<'hr'>) => <hr className="markdown-hr" {...props} />,
      []
    );

    const StrongRenderer = useCallback(
      ({ children, ...props }: React.ComponentProps<'strong'>) => (
        <strong className="markdown-strong" {...props}>
          {children}
        </strong>
      ),
      []
    );

    const EmRenderer = useCallback(
      ({ children, ...props }: React.ComponentProps<'em'>) => (
        <em className="markdown-em" {...props}>
          {children}
        </em>
      ),
      []
    );

    const DelRenderer = useCallback(
      ({ children, ...props }: React.ComponentProps<'del'>) => (
        <del className="markdown-del" {...props}>
          {children}
        </del>
      ),
      []
    );

    // 合并自定义组件
    const components = useMemo(
      (): Components => ({
        code: CodeBlock,
        a: LinkRenderer,
        img: ImageRenderer,
        table: TableRenderer,
        h1: H1Renderer,
        h2: H2Renderer,
        h3: H3Renderer,
        h4: H4Renderer,
        h5: H5Renderer,
        h6: H6Renderer,
        p: PRenderer,
        ul: UlRenderer,
        ol: OlRenderer,
        li: LiRenderer,
        blockquote: BlockquoteRenderer,
        hr: HrRenderer,
        strong: StrongRenderer,
        em: EmRenderer,
        del: DelRenderer,
        ...customComponents,
      }),
      [
        CodeBlock,
        LinkRenderer,
        ImageRenderer,
        TableRenderer,
        H1Renderer,
        H2Renderer,
        H3Renderer,
        H4Renderer,
        H5Renderer,
        H6Renderer,
        PRenderer,
        UlRenderer,
        OlRenderer,
        LiRenderer,
        BlockquoteRenderer,
        HrRenderer,
        StrongRenderer,
        EmRenderer,
        DelRenderer,
        customComponents,
      ]
    );

    const containerStyle = useMemo(
      () => ({
        ...style,
        ...(maxHeight && {
          maxHeight: typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight,
          overflowY: 'auto' as const,
        }),
      }),
      [style, maxHeight]
    );

    return (
      <div
        className={classNames(
          'markdown-renderer',
          {
            'markdown-renderer-dark': darkTheme,
            'markdown-renderer-scrollable': maxHeight,
          },
          className
        )}
        style={containerStyle}
      >
        <ReactMarkdown
          remarkPlugins={remarkPlugins}
          rehypePlugins={rehypePlugins}
          components={components}
          skipHtml={!allowHtml}
        >
          {content}
        </ReactMarkdown>
      </div>
    );
  }
);

MarkdownPreview.displayName = 'MarkdownRenderer';

// 导出主组件
export default MarkdownPreview;
