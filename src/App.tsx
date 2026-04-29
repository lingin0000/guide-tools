import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { Form, Input, Layout, Modal, Radio, message } from "antd";
import AppHeader from "./components/AppHeader";
import FileExplorerPage from "./components/FileExplorerPage";
import MainContent from "./components/MainContent";
import {
  useFileOperations,
  type DocumentContentResult,
} from "./hooks/useFileOperations";
import {
  useOSSOperations,
  type UploadEnvironment,
} from "./hooks/useOSSOperations";
import { usePandoc } from "./hooks/usePandoc";
import {
  getConfig,
  setOSSConfig,
  setCachePath,
  setActiveMarkdownFolderPath,
  setMarkdownFolders,
  type MarkdownFolderConfig,
} from "./utils/configStore";
import "./App.css";

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

interface UploadFormValues {
  fileName: string;
  environment: UploadEnvironment;
}

const getFolderName = (path: string) =>
  path.split(/[\\/]/).filter(Boolean).pop() || path;

const getUploadFileName = (currentDocument: CurrentDocument | null) => {
  if (!currentDocument) {
    return "operate-guide.md";
  }

  const normalizedName = currentDocument.fileName.replace(
    /\.(md|markdown|doc|docx)$/i,
    "",
  );
  return `${normalizedName || "operate-guide"}.md`;
};

function App() {
  const [activePage, setActivePage] = useState<"editor" | "explorer">("editor");
  const [markdownContent, setMarkdownContent] = useState<string>("");
  const [ossConfig, setOssConfigState] = useState<any>({});
  const [cachePath, setCachePathState] = useState<string>("");
  const [markdownFolders, setMarkdownFoldersState] = useState<
    MarkdownFolderConfig[]
  >([]);
  const [activeMarkdownFolderPath, setActiveMarkdownFolderPathState] =
    useState<string>("");
  const [fileTreeData, setFileTreeData] = useState<FileTreeNode[]>([]);
  const [treeLoading, setTreeLoading] = useState<boolean>(false);
  const [currentDocument, setCurrentDocument] =
    useState<CurrentDocument | null>(null);
  const [uploadModalOpen, setUploadModalOpen] = useState<boolean>(false);
  const [uploadFileName, setUploadFileName] =
    useState<string>("operate-guide.md");
  const [uploadForm] = Form.useForm<UploadFormValues>();

  const { pandocAvailable, checkPandoc } = usePandoc();
  const {
    isConverting,
    handleFileUpload,
    handleLoadDocument,
    handleSaveMarkdown,
  } = useFileOperations();
  const {
    isUploading,
    isSyncingRelease,
    handleUploadCurrentMarkdown,
    handleCopyDevFolderToRelease,
  } = useOSSOperations();
  const hasMarkdownContent = useMemo(
    () => markdownContent.trim().length > 0,
    [markdownContent],
  );

  useEffect(() => {
    getConfig().then((cfg) => {
      setOssConfigState(cfg.ossConfig || {});
      setCachePathState(cfg.cachePath || "");
      setMarkdownFoldersState(cfg.markdownFolders || []);
      setActiveMarkdownFolderPathState(cfg.activeMarkdownFolderPath || "");
    });
  }, []);

  useEffect(() => {
    if (!activeMarkdownFolderPath) {
      setFileTreeData([]);
      return;
    }

    const loadTree = async () => {
      try {
        setTreeLoading(true);
        const tree = await invoke<FileTreeNode[]>("list_markdown_directory", {
          path: activeMarkdownFolderPath,
        });
        setFileTreeData(tree);
      } catch (error) {
        console.error("加载 Markdown 文件夹失败:", error);
        message.error("加载 Markdown 文件夹失败");
      } finally {
        setTreeLoading(false);
      }
    };

    loadTree();
  }, [activeMarkdownFolderPath]);

  const handleOSSConfigChange = (cfg: any) => {
    setOssConfigState(cfg);
    setOSSConfig(cfg);
  };

  const handleCachePathChange = (path: string) => {
    setCachePathState(path);
    setCachePath(path);
  };

  const handleDocumentLoaded = (document: DocumentContentResult) => {
    setMarkdownContent(document.content);
    setCurrentDocument({
      filePath: document.file_path,
      fileName: document.file_name,
      documentType: document.document_type,
      baseDir: document.base_dir,
    });
  };

  const handleAddMarkdownFolder = async () => {
    try {
      const selected = await open({ directory: true, multiple: false });
      if (!selected) {
        return;
      }

      const folderPath = selected as string;
      const nextFolders = markdownFolders.some(
        (folder) => folder.path === folderPath,
      )
        ? markdownFolders
        : [
            ...markdownFolders,
            {
              path: folderPath,
              name: getFolderName(folderPath),
            },
          ];

      setMarkdownFoldersState(nextFolders);
      setMarkdownFolders(nextFolders);
      setActiveMarkdownFolderPathState(folderPath);
      setActiveMarkdownFolderPath(folderPath);
      message.success("Markdown 文件夹导入成功");
    } catch (error) {
      console.error("导入 Markdown 文件夹失败:", error);
      message.error("导入 Markdown 文件夹失败");
    }
  };

  const handleActiveFolderChange = (path: string) => {
    setActiveMarkdownFolderPathState(path);
    setActiveMarkdownFolderPath(path);
  };

  const handleSelectDocument = async (filePath: string) => {
    await handleLoadDocument(filePath, cachePath, handleDocumentLoaded);
  };

  const handleOpenUploadModal = () => {
    if (!hasMarkdownContent) {
      message.warning("当前没有可上传的内容");
      return;
    }

    const suggestedName = getUploadFileName(currentDocument);
    setUploadFileName(suggestedName);
    uploadForm.setFieldsValue({
      fileName: suggestedName,
      environment: "dev",
    });
    setUploadModalOpen(true);
  };

  const handleConfirmUpload = async () => {
    const values = await uploadForm.validateFields();
    const normalizedFileName = values.fileName.endsWith(".md")
      ? values.fileName
      : `${values.fileName}.md`;

    setUploadFileName(normalizedFileName);
    const uploadSucceeded = await handleUploadCurrentMarkdown(
      markdownContent,
      ossConfig,
      normalizedFileName,
      currentDocument?.baseDir,
      setMarkdownContent,
      values.environment,
    );

    if (uploadSucceeded) {
      setUploadModalOpen(false);
    }
  };

  const handleCopyDevToRelease = () => {
    Modal.confirm({
      title: "确认覆盖 release 环境",
      content:
        "会将当前 OSS 前缀下 dev 文件夹中的文件覆盖复制到 release 环境。",
      okText: "开始覆盖",
      cancelText: "取消",
      okButtonProps: { loading: isSyncingRelease },
      onOk: async () => {
        await handleCopyDevFolderToRelease(ossConfig);
      },
    });
  };

  return (
    <Layout style={{ height: "100vh" }}>
      <AppHeader
        activePage={activePage}
        ossConfig={ossConfig}
        cachePath={cachePath}
        pandocAvailable={pandocAvailable}
        isConverting={isConverting}
        isUploading={isUploading}
        isSyncingRelease={isSyncingRelease}
        hasMarkdownContent={hasMarkdownContent}
        onOSSConfigChange={handleOSSConfigChange}
        onCachePathChange={handleCachePathChange}
        onFileUpload={() => handleFileUpload(cachePath, handleDocumentLoaded)}
        onAddMarkdownFolder={handleAddMarkdownFolder}
        onSaveMarkdown={() => handleSaveMarkdown(markdownContent, cachePath)}
        onUploadMarkdown={handleOpenUploadModal}
        onCopyDevToRelease={handleCopyDevToRelease}
        onCheckPandoc={checkPandoc}
        onPageChange={setActivePage}
      />
      {activePage === "editor" ? (
        <MainContent
          markdownContent={markdownContent}
          isConverting={isConverting}
          markdownFolders={markdownFolders}
          activeMarkdownFolderPath={activeMarkdownFolderPath}
          fileTreeData={fileTreeData}
          treeLoading={treeLoading}
          currentDocument={currentDocument}
          onChange={setMarkdownContent}
          onActiveMarkdownFolderChange={handleActiveFolderChange}
          onSelectDocument={handleSelectDocument}
        />
      ) : (
        <FileExplorerPage ossConfig={ossConfig} />
      )}
      <Modal
        title="上传 Markdown 到 OSS"
        open={uploadModalOpen}
        confirmLoading={isUploading}
        onCancel={() => setUploadModalOpen(false)}
        onOk={handleConfirmUpload}
      >
        <Form
          form={uploadForm}
          layout="vertical"
          initialValues={{ fileName: uploadFileName, environment: "dev" }}
        >
          <Form.Item
            label="文件名"
            name="fileName"
            rules={[{ required: true, message: "请输入 Markdown 文件名" }]}
          >
            <Input
              placeholder="请输入上传文件名"
              onChange={(event) => setUploadFileName(event.target.value)}
            />
          </Form.Item>
          <Form.Item label="上传环境" name="environment">
            <Radio.Group>
              <Radio.Button value="dev">dev</Radio.Button>
              <Radio.Button value="release">release</Radio.Button>
            </Radio.Group>
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  );
}

export default App;
