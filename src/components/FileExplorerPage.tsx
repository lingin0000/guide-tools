import React from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Button,
  Drawer,
  Dropdown,
  Empty,
  Layout,
  Space,
  Spin,
  Tag,
  Tabs,
  Tooltip,
  Tree,
  Typography,
  message,
} from "antd";
import { FileOutlined, FolderOpenOutlined, ReloadOutlined } from "@ant-design/icons";
import type { DataNode, EventDataNode } from "antd/es/tree";
import MarkdownPreview from "./MarkdownPreview";

const { Content } = Layout;
const { Text } = Typography;
const TREE_TIME_COLUMN_WIDTH = 176;

interface OSSConfig {
  access_key_id?: string;
  access_key_secret?: string;
  bucket?: string;
  region?: string;
  endpoint?: string;
  file_path?: string;
}

interface OSSTreeNode {
  key: string;
  title: string;
  path: string;
  node_type: "directory" | "file";
  last_modified?: string | null;
  children: OSSTreeNode[];
  is_leaf: boolean;
}

interface OSSFileContentResult {
  file_path: string;
  file_name: string;
  content: string;
  preview_content: string;
  content_type: "markdown" | "text";
}

interface OSSClipboardNode {
  path: string;
  title: string;
  node_type: "directory" | "file";
}

interface TreeDataNode extends DataNode {
  key: string;
  title: string;
  path: string;
  isLeaf: boolean;
  selectable: boolean;
  icon: React.ReactNode;
  lastModified?: string | null;
  children?: TreeDataNode[];
  loaded?: boolean;
}

interface FileExplorerPageProps {
  ossConfig: OSSConfig;
}

const normalizePrefix = (path: string) => {
  const normalizedPath = path.trim().replace(/^\/+|\/+$/g, "");
  return normalizedPath || "static";
};

const getParentPath = (path: string, fallbackRoot: string) => {
  const normalizedPath = path.trim().replace(/^\/+|\/+$/g, "");
  const pathSegments = normalizedPath.split("/").filter(Boolean);
  if (pathSegments.length <= 1) {
    return normalizePrefix(fallbackRoot);
  }

  return pathSegments.slice(0, -1).join("/");
};

const mapNode = (node: OSSTreeNode): TreeDataNode => ({
  key: node.key,
  title: node.title,
  path: node.path,
  isLeaf: node.is_leaf,
  selectable: true,
  icon: node.node_type === "directory" ? <FolderOpenOutlined /> : <FileOutlined />,
  lastModified: node.last_modified,
  // 目录节点先不挂 children，让 Tree 在展开时触发 loadData 懒加载。
  children: node.is_leaf ? [] : undefined,
  loaded: node.is_leaf,
});

const formatLastModified = (value?: string | null) => {
  if (!value) {
    return "";
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(parsedDate);
};

const updateTreeNodes = (
  nodes: TreeDataNode[],
  targetKey: React.Key,
  children: TreeDataNode[]
): TreeDataNode[] => {
  return nodes.map((node) => {
    if (node.key === targetKey) {
      return {
        ...node,
        children,
        loaded: true,
      };
    }

    if (!node.children || node.children.length === 0) {
      return node;
    }

    return {
      ...node,
      children: updateTreeNodes(node.children, targetKey, children),
    };
  });
};

const FileExplorerPage: React.FC<FileExplorerPageProps> = ({ ossConfig }) => {
  const [treeLoading, setTreeLoading] = React.useState<boolean>(false);
  const [treeDataSource, setTreeDataSource] = React.useState<TreeDataNode[]>([]);
  const [expandedKeys, setExpandedKeys] = React.useState<string[]>([]);
  const [selectedKeys, setSelectedKeys] = React.useState<string[]>([]);
  const [previewOpen, setPreviewOpen] = React.useState<boolean>(false);
  const [previewLoading, setPreviewLoading] = React.useState<boolean>(false);
  const [previewFile, setPreviewFile] = React.useState<OSSFileContentResult | null>(null);
  const [clipboardNode, setClipboardNode] = React.useState<OSSClipboardNode | null>(null);
  const suppressNextSelectRef = React.useRef<boolean>(false);
  const suppressSelectTimerRef = React.useRef<number | null>(null);

  const rootPrefix = React.useMemo(() => {
    return normalizePrefix(ossConfig.file_path || "");
  }, [ossConfig.file_path]);

  const hasValidOSSConfig = React.useMemo(
    () =>
      Boolean(
        ossConfig.access_key_id &&
          ossConfig.access_key_secret &&
          ossConfig.bucket &&
          ossConfig.region
      ),
    [
      ossConfig.access_key_id,
      ossConfig.access_key_secret,
      ossConfig.bucket,
      ossConfig.region,
    ]
  );

  const loadTree = React.useCallback(
    async (options?: { preserveExpandedKeys?: boolean; preserveSelectedKeys?: boolean }) => {
      if (!hasValidOSSConfig) {
        setTreeDataSource([]);
        setExpandedKeys([]);
        return;
      }

      try {
        setTreeLoading(true);
        const nextTree = await invoke<OSSTreeNode[]>("list_oss_directory_tree", {
          ossConfig,
          prefix: rootPrefix,
        });
        setTreeDataSource(nextTree.map(mapNode));
        if (!options?.preserveExpandedKeys) {
          setExpandedKeys([]);
        }
        if (!options?.preserveSelectedKeys) {
          setSelectedKeys([]);
        }
      } catch (error) {
        console.error("加载 OSS 文件树失败:", error);
        message.error("加载 OSS 文件树失败");
      } finally {
        setTreeLoading(false);
      }
    },
    [hasValidOSSConfig, ossConfig, rootPrefix]
  );

  React.useEffect(() => {
    loadTree();
  }, [loadTree]);

  React.useEffect(() => {
    return () => {
      if (suppressSelectTimerRef.current !== null) {
        window.clearTimeout(suppressSelectTimerRef.current);
      }
    };
  }, []);

  const suppressTreeSelect = React.useCallback(() => {
    suppressNextSelectRef.current = true;
    if (suppressSelectTimerRef.current !== null) {
      window.clearTimeout(suppressSelectTimerRef.current);
    }
    suppressSelectTimerRef.current = window.setTimeout(() => {
      suppressNextSelectRef.current = false;
      suppressSelectTimerRef.current = null;
    }, 120);
  }, []);

  const loadNodeChildren = React.useCallback(
    async (treeNode: EventDataNode<TreeDataNode>) => {
      if (treeNode.isLeaf || treeNode.loaded) {
        return;
      }

      try {
        const nextTree = await invoke<OSSTreeNode[]>("list_oss_directory_tree", {
          ossConfig,
          prefix: String(treeNode.path),
        });
        const children = nextTree.map(mapNode);
        setTreeDataSource((currentTree) =>
          updateTreeNodes(currentTree, treeNode.key, children)
        );
      } catch (error) {
        console.error("加载 OSS 子目录失败:", error);
        message.error("加载 OSS 子目录失败");
      }
    },
    [ossConfig]
  );

  const handleCopyNode = React.useCallback((node: OSSClipboardNode) => {
    // 仅在应用内部维护复制状态，避免额外引入系统级写权限。
    setClipboardNode(node);
    message.success(`已复制${node.node_type === "directory" ? "文件夹" : "文件"}：${node.title}`);
  }, []);

  const handlePasteNode = React.useCallback(
    async (targetDir: string) => {
      if (!clipboardNode) {
        message.warning("请先复制文件或文件夹");
        return;
      }

      try {
        suppressTreeSelect();
        const copiedCount = await invoke<number>("copy_oss_node", {
          ossConfig,
          sourcePath: clipboardNode.path,
          targetDir,
          nodeType: clipboardNode.node_type,
        });
        message.success(`已粘贴 ${copiedCount} 个对象到目标目录`);
        await loadTree({
          preserveExpandedKeys: true,
          preserveSelectedKeys: true,
        });
      } catch (error) {
        console.error("OSS 粘贴失败:", error);
        message.error(`OSS 粘贴失败：${String(error)}`);
      }
    },
    [clipboardNode, loadTree, ossConfig, suppressTreeSelect]
  );

  const handlePreviewFile = React.useCallback(
    async (objectKey: string) => {
      try {
        setPreviewOpen(true);
        setPreviewLoading(true);
        const fileContent = await invoke<OSSFileContentResult>("read_oss_file_content", {
          ossConfig,
          objectKey,
        });
        setPreviewFile(fileContent);
      } catch (error) {
        console.error("读取 OSS 文件内容失败:", error);
        message.error("读取 OSS 文件内容失败");
        setPreviewOpen(false);
      } finally {
        setPreviewLoading(false);
      }
    },
    [ossConfig]
  );

  const renderNodeTitle = React.useCallback(
    (node: TreeDataNode) => {
      const pasteTargetDir = node.isLeaf ? getParentPath(node.path, rootPrefix) : node.path;
      const menuItems = [
        {
          key: "copy",
          label: node.isLeaf ? "复制文件" : "复制文件夹",
        },
        {
          key: "paste",
          label: node.isLeaf ? "粘贴到同级目录" : "粘贴到当前目录",
          disabled: !clipboardNode,
        },
      ];

      return (
        <Dropdown
          trigger={["contextMenu"]}
          menu={{
            items: menuItems,
            onClick: ({ key, domEvent }) => {
              domEvent.preventDefault();
              domEvent.stopPropagation();
              suppressTreeSelect();
              if (key === "copy") {
                handleCopyNode({
                  path: node.path,
                  title: node.title,
                  node_type: node.isLeaf ? "file" : "directory",
                });
                return;
              }
              if (key === "paste") {
                void handlePasteNode(pasteTargetDir);
              }
            },
          }}
        >
          <div
            title={node.path}
            onMouseDown={(event) => {
              if (event.button === 2) {
                suppressTreeSelect();
              }
            }}
            onContextMenu={() => {
              suppressTreeSelect();
            }}
            className="oss-tree-row"
          >
            <Tooltip title={node.title} mouseEnterDelay={0.4}>
              <span className={`oss-tree-name ${node.isLeaf ? "is-file" : "is-directory"}`}>
                {node.title}
              </span>
            </Tooltip>
            {node.isLeaf ? (
              <Text type="secondary" className="oss-tree-time">
                {node.lastModified ? formatLastModified(node.lastModified) : "--"}
              </Text>
            ) : <span className="oss-tree-time oss-tree-time-placeholder" />}
          </div>
        </Dropdown>
      );
    },
    [clipboardNode, handleCopyNode, handlePasteNode, rootPrefix, suppressTreeSelect]
  );

  return (
    <Content
      style={{
        padding: "24px",
        overflow: "auto",
        height: "calc(100vh - 120px)",
      }}
    >
      <div
        style={{
          height: "100%",
          background: "#fff",
          borderRadius: 8,
          padding: 16,
          display: "grid",
          gridTemplateRows: "auto auto 1fr",
          gap: 12,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Space wrap size={12}>
              <Text strong>Bucket:</Text>
              <Text>{ossConfig.bucket || "-"}</Text>
              <Text strong>浏览前缀:</Text>
              <Text code>{rootPrefix}</Text>
            </Space>
            <Text type="secondary">
              右键节点可复制，右键目录可粘贴到当前目录，右键文件可粘贴到同级目录。
            </Text>
          </div>
          <Space wrap>
            <Tag color={clipboardNode ? "processing" : "default"}>
              {clipboardNode ? `已复制：${clipboardNode.title}` : "剪贴板为空"}
            </Tag>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => void loadTree()}
              disabled={!hasValidOSSConfig}
            >
              刷新
            </Button>
          </Space>
        </div>

        <div
          style={{
            minHeight: 0,
            border: "1px solid #f0f0f0",
            borderRadius: 8,
            overflow: "hidden",
            display: "grid",
            gridTemplateRows: "auto 1fr",
            background: "#fff",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `minmax(0, 1fr) ${TREE_TIME_COLUMN_WIDTH}px`,
              alignItems: "center",
              gap: 16,
              padding: "10px 16px",
              background: "#fafafa",
              borderBottom: "1px solid #f0f0f0",
            }}
          >
            <Text type="secondary" strong>
              名称
            </Text>
            <Text type="secondary" strong style={{ textAlign: "right" }}>
              最后修改时间
            </Text>
          </div>
          {treeLoading ? (
            <div
              style={{
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Spin />
            </div>
          ) : !hasValidOSSConfig ? (
            <Empty description="请先在 OSS 配置中填写访问密钥、Bucket、地域信息" />
          ) : treeDataSource.length > 0 ? (
            <div
              className="oss-tree-panel"
              style={{ minHeight: 0, overflow: "auto", padding: "8px 12px 12px" }}
            >
              <Tree<TreeDataNode>
                className="oss-file-tree"
                blockNode
                showIcon
                treeData={treeDataSource}
                expandedKeys={expandedKeys}
                selectedKeys={selectedKeys}
                loadData={loadNodeChildren}
                titleRender={renderNodeTitle}
                onExpand={(keys) => setExpandedKeys(keys as string[])}
                onSelect={(keys, info) => {
                  if (suppressNextSelectRef.current) {
                    suppressNextSelectRef.current = false;
                    return;
                  }
                  setSelectedKeys(keys as string[]);
                  if (!info.node.isLeaf) {
                    return;
                  }

                  void handlePreviewFile(info.node.path);
                }}
              />
            </div>
          ) : (
            <Empty description="当前 OSS 前缀下没有文件" />
          )}
        </div>
      </div>
      <Drawer
        title={previewFile?.file_name || "文件内容"}
        open={previewOpen}
        width={840}
        onClose={() => setPreviewOpen(false)}
        destroyOnHidden
      >
        {previewLoading ? (
          <div
            style={{
              minHeight: 240,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Spin />
          </div>
        ) : previewFile ? (
          <Tabs
            items={[
              {
                key: "preview",
                label: previewFile.content_type === "markdown" ? "预览" : "文本预览",
                children: (
                  previewFile.content_type === "markdown" ? (
                    <MarkdownPreview
                      content={previewFile.preview_content}
                      maxHeight="calc(100vh - 220px)"
                    />
                  ) : (
                    <pre
                      style={{
                        margin: 0,
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                        maxHeight: "calc(100vh - 220px)",
                        overflow: "auto",
                      }}
                    >
                      {previewFile.content}
                    </pre>
                  )
                ),
              },
              {
                key: "source",
                label: "源码",
                children: (
                  <pre
                    style={{
                      margin: 0,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      maxHeight: "calc(100vh - 220px)",
                      overflow: "auto",
                    }}
                  >
                    {previewFile.content}
                  </pre>
                ),
              },
            ]}
          />
        ) : (
          <Empty description="暂无可预览内容" />
        )}
      </Drawer>
    </Content>
  );
};

export default FileExplorerPage;
