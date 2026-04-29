import React from 'react';
import { Layout, Splitter, Tree, Select, Empty, Typography, Spin } from "antd";
import {
  FileMarkdownOutlined,
  FileWordOutlined,
  FolderOpenOutlined,
} from "@ant-design/icons";
import MarkdownEditor from './MarkdownEditor';
import MarkdownPreview from './MarkdownPreview';
import type { MarkdownFolderConfig } from "../utils/configStore";

const { Content } = Layout;
const { Text } = Typography;

interface FileTreeNode {
  key: string;
  title: string;
  path: string;
  node_type: "directory" | "markdown" | "word";
  children: FileTreeNode[];
  is_leaf: boolean;
}

interface CurrentDocument {
  filePath: string;
  fileName: string;
  documentType: "markdown" | "word";
  baseDir?: string;
}

interface TreeDataNode {
  key: string;
  title: string;
  isLeaf: boolean;
  selectable: boolean;
  icon: React.ReactNode;
  children: TreeDataNode[];
}

interface MainContentProps {
  markdownContent: string;
  isConverting: boolean;
  markdownFolders: MarkdownFolderConfig[];
  activeMarkdownFolderPath: string;
  fileTreeData: FileTreeNode[];
  treeLoading: boolean;
  currentDocument: CurrentDocument | null;
  onChange: (value: string) => void;
  onActiveMarkdownFolderChange: (path: string) => void;
  onSelectDocument: (filePath: string) => void;
}

const MainContent: React.FC<MainContentProps> = ({
  markdownContent,
  isConverting,
  markdownFolders,
  activeMarkdownFolderPath,
  fileTreeData,
  treeLoading,
  currentDocument,
  onChange,
  onActiveMarkdownFolderChange,
  onSelectDocument,
}) => {
  const [expandedKeys, setExpandedKeys] = React.useState<string[]>([]);

  React.useEffect(() => {
    const collectExpandedKeys = (nodes: FileTreeNode[]): string[] =>
      nodes.flatMap((node) => {
        if (node.node_type !== "directory") {
          return [];
        }

        return [node.key, ...collectExpandedKeys(node.children)];
      });

    setExpandedKeys(collectExpandedKeys(fileTreeData));
  }, [fileTreeData]);

  const treeData = React.useMemo<TreeDataNode[]>(() => {
    const mapTreeNode = (node: FileTreeNode): TreeDataNode => ({
      key: node.key,
      title: node.title,
      isLeaf: node.is_leaf,
      selectable: node.node_type !== "directory",
      icon:
        node.node_type === "directory" ? (
          <FolderOpenOutlined />
        ) : node.node_type === "word" ? (
          <FileWordOutlined />
        ) : (
          <FileMarkdownOutlined />
        ),
      children: node.children.map(mapTreeNode),
    });

    return fileTreeData.map(mapTreeNode);
  }, [fileTreeData]);

  return (
    <Content
      style={{
        padding: "12px",
        overflow: "auto",
        height: "calc(100vh - 120px)",
      }}
    >
      <Splitter style={{ height: "100%" }}>
        <Splitter.Panel min={260} defaultSize={300} max={420}>
          <div
            style={{
              height: "100%",
              background: "#fff",
              padding: 16,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <Text strong>Markdown 文件夹</Text>
            <Select
              placeholder="请选择 Markdown 文件夹"
              value={activeMarkdownFolderPath || undefined}
              options={markdownFolders.map((folder) => ({
                label: folder.name,
                value: folder.path,
              }))}
              onChange={onActiveMarkdownFolderChange}
              allowClear
              onClear={() => onActiveMarkdownFolderChange("")}
            />
            <div
              style={{
                flex: 1,
                overflow: "auto",
                border: "1px solid #f0f0f0",
                borderRadius: 8,
                padding: 8,
              }}
            >
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
              ) : treeData.length > 0 ? (
                <Tree
                  showIcon
                  treeData={treeData}
                  expandedKeys={expandedKeys}
                  selectedKeys={
                    currentDocument ? [currentDocument.filePath] : []
                  }
                  onExpand={(keys) => setExpandedKeys(keys as string[])}
                  onSelect={(keys) => {
                    if (keys.length === 0) {
                      return;
                    }

                    onSelectDocument(String(keys[0]));
                  }}
                />
              ) : (
                <Empty description="请先导入 Markdown 文件夹" />
              )}
            </div>
          </div>
        </Splitter.Panel>
        <Splitter.Panel min={"50%"}>
          <div
            style={{
              height: "100%",
              background: "#fff",
            }}
          >
            <div
              style={{
                height: 40,
                display: "flex",
                alignItems: "center",
                padding: "0 16px",
                borderBottom: "1px solid #e8e8e8",
              }}
            >
              <Text ellipsis>
                {currentDocument
                  ? `${currentDocument.documentType === "word" ? "Word 转 Markdown" : "Markdown"}：${currentDocument.fileName}`
                  : "未选择文档"}
              </Text>
            </div>
            <div style={{ height: "calc(100% - 40px)" }}>
              <MarkdownEditor
                value={markdownContent}
                onChange={onChange}
                loading={isConverting}
              />
            </div>
          </div>
        </Splitter.Panel>
        <Splitter.Panel min={400} defaultSize={400}>
          <div
            className="markdown-preview"
            style={{
              height: "100%",
              background: "#fff",
            }}
          >
            <div
              style={{
                height: 40,
                lineHeight: "40px",
                paddingLeft: 20,
                borderBottom: "1px solid #e8e8e8",
              }}
            >
              预览
            </div>
            <div
              style={{
                height: "calc(100% - 40px)",
                overflow: "auto",
                padding: 24,
              }}
            >
              <MarkdownPreview content={markdownContent} />
            </div>
          </div>
        </Splitter.Panel>
      </Splitter>
    </Content>
  );
};

export default MainContent;
