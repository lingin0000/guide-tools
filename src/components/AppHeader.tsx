import React from "react";
import {
  Layout,
  Button,
  Modal,
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
  ReloadOutlined,
} from "@ant-design/icons";
import { getVersion } from "@tauri-apps/api/app";
import { ask } from "@tauri-apps/plugin-dialog";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { relaunch } from "@tauri-apps/plugin-process";
import { check } from "@tauri-apps/plugin-updater";
import OSSConfig from "./OSSConfig";
import appPackage from "../../package.json";
import { DEFAULT_UPDATER_ENDPOINT } from "../utils/updateConfig";

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
  const fallbackVersion = appPackage.version;
  const hasValidOSSConfig = Boolean(
    ossConfig?.access_key_id &&
    ossConfig?.access_key_secret &&
    ossConfig?.bucket &&
    ossConfig?.region,
  );

  const [updateModalOpen, setUpdateModalOpen] = React.useState(false);
  const [appVersion, setAppVersion] = React.useState(fallbackVersion);
  const [isCheckingUpdate, setIsCheckingUpdate] = React.useState(false);
  const [isInstallingUpdate, setIsInstallingUpdate] = React.useState(false);
  const [updateStatusText, setUpdateStatusText] = React.useState("");
  const [latestVersion, setLatestVersion] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const version = await getVersion();
        if (!cancelled) {
          // 运行时优先使用 Tauri 实际版本，避免和 package.json 版本不一致。
          setAppVersion(version);
        }
      } catch {
        if (!cancelled) {
          setAppVersion(fallbackVersion);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fallbackVersion]);

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

  const handleCheckUpdate = async () => {
    if (isCheckingUpdate || isInstallingUpdate) {
      return;
    }

    try {
      if (!DEFAULT_UPDATER_ENDPOINT) {
        message.warning("请先在应用配置中设置默认更新地址");
        return;
      }

      setIsCheckingUpdate(true);
      setUpdateStatusText("正在检查更新...");
      setLatestVersion(null);
      const update = await check();

      if (!update) {
        setUpdateStatusText("当前已是最新版本");
        message.success("当前已是最新版本");
        return;
      }

      setLatestVersion(update.version);
      setUpdateStatusText(`发现新版本 ${update.version}，准备下载并安装`);

      const confirmed = await ask(
        `检测到新版本 ${update.version}，是否立即下载并安装？`,
        {
          title: "发现新版本",
          kind: "info",
          okLabel: "立即更新",
          cancelLabel: "稍后再说",
        },
      );
      if (!confirmed) {
        setUpdateStatusText(`已发现新版本 ${update.version}，你可以稍后安装`);
        return;
      }

      setIsInstallingUpdate(true);
      setUpdateStatusText("正在下载更新...");
      let downloadedBytes = 0;
      let totalBytes = 0;
      await update.downloadAndInstall((event) => {
        if (event.event === "Started") {
          totalBytes = event.data.contentLength || 0;
          setUpdateStatusText("开始下载更新包...");
          return;
        }
        if (event.event === "Progress") {
          downloadedBytes += event.data.chunkLength;
          if (!totalBytes) {
            setUpdateStatusText("正在下载更新包...");
            return;
          }

          const progress = Math.min(
            100,
            Math.round((downloadedBytes / totalBytes) * 100),
          );
          setUpdateStatusText(`正在下载更新包... ${progress}%`);
          return;
        }

        setUpdateStatusText("下载完成，正在安装更新...");
      });

      setUpdateStatusText("更新安装完成，正在重启应用...");
      message.success("更新已安装，应用即将重启");
      await relaunch();
    } catch (error) {
      setUpdateStatusText("");
      message.error(`检查更新失败：${String(error)}`);
    } finally {
      setIsCheckingUpdate(false);
      setIsInstallingUpdate(false);
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
              icon={<CloudSyncOutlined />}
              onClick={() => {
                setUpdateModalOpen(true);
                setLatestVersion(null);
                setUpdateStatusText("");
              }}
            >
              检查更新
            </Button>
            <Tag>v{appVersion}</Tag>
            {latestVersion ? (
              <Tag color="warning">可更新到 {latestVersion}</Tag>
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
              loading={isCheckingUpdate || isInstallingUpdate}
              onClick={() => void handleCheckUpdate()}
            >
              检查并安装
            </Button>
          </Space>
        }
      >
        <Space direction="vertical" style={{ width: "100%" }} size={12}>
          <div>
            <Text type="secondary">当前版本：</Text>
            <Text>{appVersion}</Text>
          </div>
          {updateStatusText ? (
            <Space align="center">
              <ReloadOutlined spin={isCheckingUpdate || isInstallingUpdate} />
              <Text>{updateStatusText}</Text>
            </Space>
          ) : null}
        </Space>
      </Modal>
    </Header>
  );
};

export default AppHeader;
