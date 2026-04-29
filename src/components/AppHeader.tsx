import React from "react";
import {
  Layout,
  Button,
  Modal,
  Input,
  Typography,
  Space,
  Segmented,
  Tag,
  Tooltip,
  Popover,
  message,
} from "antd";
import {
  UploadOutlined,
  SaveOutlined,
  FolderOpenOutlined,
  CloudUploadOutlined,
  SettingOutlined,
  DownloadOutlined,
  CopyOutlined,
  QuestionCircleOutlined,
  CloudSyncOutlined,
} from "@ant-design/icons";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import OSSConfig from "./OSSConfig";
import appPackage from "../../package.json";
import { getUpdateFeedUrl, setUpdateFeedUrl } from "../utils/configStore";
import { checkForUpdate, type UpdateResult } from "../utils/updateCheck";

const { Header } = Layout;
const { Text, Title } = Typography;

interface AppHeaderProps {
  activePage: "editor" | "explorer";
  ossConfig: any;
  cachePath: string;
  pandocAvailable: boolean;
  isConverting: boolean;
  isUploading: boolean;
  isSyncingRelease: boolean;
  hasMarkdownContent: boolean;
  onOSSConfigChange: (cfg: any) => void;
  onCachePathChange: (path: string) => void;
  onFileUpload: () => void;
  onAddMarkdownFolder: () => void;
  onSaveMarkdown: () => void;
  onUploadMarkdown: () => void;
  onCopyDevToRelease: () => void;
  onCheckPandoc: () => void;
  onPageChange: (page: "editor" | "explorer") => void;
}

const AppHeader: React.FC<AppHeaderProps> = ({
  activePage,
  ossConfig,
  cachePath,
  pandocAvailable,
  isConverting,
  isUploading,
  isSyncingRelease,
  hasMarkdownContent,
  onOSSConfigChange,
  onCachePathChange,
  onFileUpload,
  onAddMarkdownFolder,
  onSaveMarkdown,
  onUploadMarkdown,
  onCopyDevToRelease,
  onCheckPandoc,
  onPageChange,
}) => {
  const appVersion = appPackage.version;
  const hasValidOSSConfig = Boolean(
    ossConfig?.access_key_id &&
    ossConfig?.access_key_secret &&
    ossConfig?.bucket &&
    ossConfig?.region,
  );

  const [updateModalOpen, setUpdateModalOpen] = React.useState(false);
  const [updateFeedUrl, setUpdateFeedUrlState] = React.useState("");
  const [isCheckingUpdate, setIsCheckingUpdate] = React.useState(false);
  const [updateResult, setUpdateResult] = React.useState<UpdateResult | null>(
    null,
  );

  const usageItems = React.useMemo(
    () => [
      {
        title: "导入 Word",
        description:
          "选择本地 Word 文件并转换为 Markdown（需要 Pandoc 可用）。",
      },
      {
        title: "导入 Markdown 文件夹",
        description: "将本地已有 Markdown 工程载入编辑器（适合已有文档项目）。",
      },
      {
        title: "保存草稿",
        description: "将当前编辑内容保存到缓存目录，避免中途丢失。",
      },
      {
        title: "上传到 OSS",
        description:
          "发布当前文档到 OSS（上传面板可选择 dev / release 环境）。",
      },
      {
        title: "dev 覆盖到 release",
        description:
          "将 dev 环境内容覆盖复制到 release（用于一次性发布/同步）。",
      },
    ],
    [],
  );

  const usageContent = React.useMemo(
    () => (
      <div
        style={{
          maxWidth: 420,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {usageItems.map((item) => (
          <div key={item.title}>
            <Text strong>{item.title}</Text>
            <div>
              <Text type="secondary">{item.description}</Text>
            </div>
          </div>
        ))}
        <Text type="secondary">
          提示：上传和同步都会使用右侧「连接配置」中的 OSS 信息与前缀路径。
        </Text>
      </div>
    ),
    [usageItems],
  );

  const handleSelectFolder = async () => {
    const selected = await openDialog({ directory: true });
    if (selected) {
      onCachePathChange(selected as string);
    }
  };

  React.useEffect(() => {
    if (!updateModalOpen) {
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const saved = await getUpdateFeedUrl();
        if (!cancelled) {
          setUpdateFeedUrlState(saved);
        }
      } catch {
        if (!cancelled) {
          setUpdateFeedUrlState("");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [updateModalOpen]);

  const handleCheckUpdate = async () => {
    try {
      setIsCheckingUpdate(true);
      await setUpdateFeedUrl(updateFeedUrl);
      const result = await checkForUpdate(appVersion, updateFeedUrl);
      setUpdateResult(result);
      if (result.status === "no_source") {
        message.warning("请先配置更新源 URL");
      } else if (result.status === "up_to_date") {
        message.success("当前已是最新版本");
      } else {
        message.info(`发现新版本：${result.latestVersion}`);
      }
    } catch (error) {
      setUpdateResult(null);
      message.error(`检查更新失败：${String(error)}`);
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const handleOpenUpdateLink = async (url?: string) => {
    if (!url) {
      message.warning("未提供下载链接");
      return;
    }
    try {
      await openUrl(url);
    } catch (error) {
      message.error(`打开链接失败：${String(error)}`);
    }
  };

  return (
    <Header
      style={{
        background: "#fff",
        height: "auto",
        padding: "16px 24px",
        lineHeight: "normal",
        borderBottom: "1px solid #f0f0f0",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Space align="center" wrap>
            <div>
              <Title level={5} style={{ margin: 0 }}>
                工作台
              </Title>
            </div>
            <Segmented<"editor" | "explorer">
              value={activePage}
              onChange={onPageChange}
              options={[
                { label: "文档编辑", value: "editor" },
                { label: "文件浏览", value: "explorer" },
              ]}
            />
          </Space>

          {activePage === "editor" ? (
            <Space wrap>
              <Button
                variant="filled"
                type="primary"
                icon={<UploadOutlined />}
                onClick={onFileUpload}
                loading={isConverting}
                disabled={!pandocAvailable}
              >
                导入 Word
              </Button>
              <Button
                variant="filled"
                type="primary"
                icon={<UploadOutlined />}
                onClick={onAddMarkdownFolder}
                loading={isConverting}
                disabled={!pandocAvailable}
              >
                导入 Markdown 文件夹
              </Button>
              <Button
                icon={<SaveOutlined />}
                onClick={onSaveMarkdown}
                disabled={!hasMarkdownContent}
              >
                保存草稿
              </Button>

              <Button
                variant="filled"
                icon={<CloudUploadOutlined />}
                onClick={onUploadMarkdown}
                loading={isUploading}
                disabled={!hasMarkdownContent}
              >
                上传到 OSS
              </Button>
              <Button
                variant="filled"
                icon={<CopyOutlined />}
                onClick={onCopyDevToRelease}
                loading={isSyncingRelease}
              >
                dev 覆盖到 release
              </Button>
              <Popover
                placement="bottomLeft"
                title="使用说明"
                content={usageContent}
                trigger="click"
              >
                <Button type="link" icon={<QuestionCircleOutlined />}>
                  使用说明
                </Button>
              </Popover>
            </Space>
          ) : (
            <Text type="secondary">
              文件浏览模式聚焦 OSS 文件查看与下载，编辑动作已自动收起。
            </Text>
          )}
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 12,
          }}
        >
          <Space wrap>
            <Button
              size="small"
              type="link"
              disabled
              icon={<CloudSyncOutlined />}
              onClick={() => {
                setUpdateModalOpen(true);
                setUpdateResult(null);
              }}
            >
              检查更新
            </Button>
            <Tag>v{appVersion}</Tag>
            {updateResult?.status === "update_available" &&
            updateResult.latestVersion ? (
              <Tag color="warning">可更新到 {updateResult.latestVersion}</Tag>
            ) : null}
            <Tag color={hasValidOSSConfig ? "success" : "warning"}>
              {hasValidOSSConfig ? "OSS 已配置" : "OSS 待配置"}
            </Tag>
            <Tag color={pandocAvailable ? "success" : "warning"}>
              {pandocAvailable ? "Pandoc 可用" : "Pandoc 未就绪"}
            </Tag>
            {isSyncingRelease ? (
              <Tag color="processing">正在同步 release</Tag>
            ) : null}
          </Space>

          <Space wrap>
            <Tooltip title={cachePath || "尚未选择缓存目录"}>
              <Button
                icon={<FolderOpenOutlined />}
                onClick={handleSelectFolder}
              >
                缓存目录
              </Button>
            </Tooltip>
            <OSSConfig
              config={ossConfig}
              onConfigChange={onOSSConfigChange}
              triggerLabel="连接配置"
              triggerIcon={<SettingOutlined />}
            />
            {!pandocAvailable ? (
              <Space size={4}>
                <Button size="small" type="link" onClick={onCheckPandoc}>
                  重新检测
                </Button>
                <Button
                  size="small"
                  type="link"
                  icon={<DownloadOutlined />}
                  href="https://github.com/jgm/pandoc/releases/download/3.7.0.2/pandoc-3.7.0.2-windows-x86_64.msi"
                >
                  下载 Pandoc
                </Button>
              </Space>
            ) : null}
          </Space>
        </div>
      </div>

      <Modal
        title="检查更新"
        open={updateModalOpen}
        onCancel={() => setUpdateModalOpen(false)}
        footer={
          <Space>
            <Button onClick={() => setUpdateModalOpen(false)}>关闭</Button>
            <Button
              type="primary"
              loading={isCheckingUpdate}
              onClick={() => void handleCheckUpdate()}
            >
              检查
            </Button>
          </Space>
        }
      >
        <Space direction="vertical" style={{ width: "100%" }} size={12}>
          <div>
            <Text type="secondary">当前版本：</Text>
            <Text>{appVersion}</Text>
          </div>
          <div>
            <Text type="secondary">更新源 URL：</Text>
            <Input
              value={updateFeedUrl}
              onChange={(event) => setUpdateFeedUrlState(event.target.value)}
              placeholder="支持 GitHub releases/latest 或自定义 {version, downloadUrl, notes} JSON"
            />
          </div>
          {updateResult?.status === "up_to_date" ? (
            <Text type="secondary">
              最新版本：{updateResult.latestVersion || appVersion}
            </Text>
          ) : null}
          {updateResult?.status === "update_available" ? (
            <Space direction="vertical" style={{ width: "100%" }} size={8}>
              <Text>
                发现新版本：{updateResult.latestVersion}（当前 {appVersion}）
              </Text>
              <Space wrap>
                <Button
                  type="primary"
                  onClick={() =>
                    void handleOpenUpdateLink(
                      updateResult.downloadUrl || updateResult.releaseUrl,
                    )
                  }
                >
                  打开下载页
                </Button>
                {updateResult.releaseUrl ? (
                  <Button
                    onClick={() =>
                      void handleOpenUpdateLink(updateResult.releaseUrl)
                    }
                  >
                    打开发布页
                  </Button>
                ) : null}
              </Space>
              {updateResult.notes ? (
                <Input.TextArea
                  value={updateResult.notes}
                  readOnly
                  autoSize={{ minRows: 6, maxRows: 12 }}
                />
              ) : null}
            </Space>
          ) : null}
        </Space>
      </Modal>
    </Header>
  );
};

export default AppHeader;
