import { useState } from 'react';
import { message } from 'antd';
import { invoke } from '@tauri-apps/api/core';

interface OSSConfig {
  access_key_id: string;
  access_key_secret: string;
  bucket: string;
  region: string;
  endpoint?: string;
  file_path?: string;
}

interface ImageUploadResult {
  original_path: string;
  oss_url: string;
}

interface ResolvedImagePath {
  original_path: string;
  resolved_path: string;
}

interface UniqueImageUploadTask {
  original_path: string;
  resolved_path: string;
}

export type UploadEnvironment = "dev" | "release";

const normalizeOSSPrefix = (prefix?: string) =>
  (prefix || "")
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .join("/");

const buildEnvironmentOSSConfig = (
  ossConfig: OSSConfig,
  environment: UploadEnvironment,
): OSSConfig => {
  // 统一在这里拼接环境前缀，避免上传 Markdown 和图片时出现路径不一致。
  const basePrefix = normalizeOSSPrefix(ossConfig.file_path);
  const envPrefix = normalizeOSSPrefix(environment);

  return {
    ...ossConfig,
    file_path: [basePrefix, envPrefix].filter(Boolean).join("/"),
  };
};

const buildSharedImageOSSConfig = (ossConfig: OSSConfig): OSSConfig => {
  const basePrefix = normalizeOSSPrefix(ossConfig.file_path);

  return {
    ...ossConfig,
    // 图片走共享目录，避免 release 复用 dev Markdown 时还需要再复制图片。
    file_path: [basePrefix, "images"].filter(Boolean).join("/"),
  };
};

export const useOSSOperations = () => {
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isSyncingRelease, setIsSyncingRelease] = useState<boolean>(false);

  const handleUploadCurrentMarkdown = async (
    markdownContent: string,
    ossConfig: OSSConfig,
    fileName: string,
    baseDir: string | undefined,
    setMarkdownContent: (content: string) => void,
    environment: UploadEnvironment,
  ) => {
    if (!markdownContent) {
      message.warning("当前没有可上传的 Markdown 内容");
      return false;
    }

    if (!fileName) {
      message.warning("请先设置上传文件名");
      return false;
    }

    if (!ossConfig.access_key_id || !ossConfig.access_key_secret) {
      message.warning("请先配置阿里云OSS信息");
      return false;
    }

    try {
      setIsUploading(true);
      const targetOSSConfig = buildEnvironmentOSSConfig(ossConfig, environment);
      const sharedImageOSSConfig = buildSharedImageOSSConfig(ossConfig);
      const resolvedImagePaths = await invoke<ResolvedImagePath[]>(
        "resolve_markdown_image_paths",
        {
          markdown: markdownContent,
          baseDir,
        },
      );

      let finalMarkdown = markdownContent;
      const uploadedImageUrls: string[] = [];
      if (resolvedImagePaths.length > 0) {
        // 基于实际文件路径去重，避免同一张图片在 Markdown 中多次引用时重复上传。
        const uniqueTasks = Array.from(
          resolvedImagePaths
            .reduce((taskMap, imagePath) => {
              if (!taskMap.has(imagePath.resolved_path)) {
                taskMap.set(imagePath.resolved_path, {
                  original_path: imagePath.original_path,
                  resolved_path: imagePath.resolved_path,
                });
              }
              return taskMap;
            }, new Map<string, UniqueImageUploadTask>())
            .values(),
        );
        const uploadedByResolvedPath = new Map<string, ImageUploadResult>();

        try {
          await Promise.all(
            uniqueTasks.map(async (imagePath) => {
              const uploaded = await invoke<ImageUploadResult>(
                "upload_image_to_oss",
                {
                  imagePath: imagePath.resolved_path,
                  ossConfig: sharedImageOSSConfig,
                },
              );
              uploadedImageUrls.push(uploaded.oss_url);
              uploadedByResolvedPath.set(imagePath.resolved_path, uploaded);
              return uploaded;
            }),
          );

          const imageMappings = resolvedImagePaths.map((imagePath) => {
            const uploaded = uploadedByResolvedPath.get(
              imagePath.resolved_path,
            );
            if (!uploaded) {
              throw new Error(`图片上传结果缺失：${imagePath.resolved_path}`);
            }

            return {
              ...uploaded,
              original_path: imagePath.original_path,
            };
          });

          finalMarkdown = await invoke<string>("replace_image_links", {
            markdown: markdownContent,
            imageMappings,
          });
          setMarkdownContent(finalMarkdown);
        } catch (imageUploadError) {
          if (uploadedImageUrls.length > 0) {
            try {
              await invoke<number>("delete_oss_objects", {
                ossUrls: uploadedImageUrls,
                ossConfig: sharedImageOSSConfig,
              });
            } catch (rollbackError) {
              console.error("回滚已上传图片失败:", rollbackError);
            }
          }

          throw new Error(`图片上传失败：${String(imageUploadError)}`);
        }
      }

      try {
        const uploadResult = await invoke<string>("upload_content_to_oss", {
          content: finalMarkdown,
          ossConfig: targetOSSConfig,
          fileName,
        });

        message.success(`Markdown 上传成功！OSS地址: ${uploadResult}`);
        return true;
      } catch (markdownUploadError) {
        if (uploadedImageUrls.length > 0) {
          try {
            await invoke<number>("delete_oss_objects", {
              ossUrls: uploadedImageUrls,
              ossConfig: sharedImageOSSConfig,
            });
          } catch (rollbackError) {
            console.error("Markdown 上传失败后回滚图片失败:", rollbackError);
          }
        }

        setMarkdownContent(markdownContent);
        throw new Error(`Markdown 上传失败：${String(markdownUploadError)}`);
      }
    } catch (error) {
      console.error("Markdown 上传失败:", error);
      message.error(String(error));
      return false;
    } finally {
      setIsUploading(false);
    }
  };

  const handleCopyDevFolderToRelease = async (ossConfig: OSSConfig) => {
    if (!ossConfig.access_key_id || !ossConfig.access_key_secret) {
      message.warning("请先配置阿里云OSS信息");
      return false;
    }

    try {
      setIsSyncingRelease(true);
      const copiedCount = await invoke<number>("copy_oss_environment_folder", {
        ossConfig,
        sourceEnv: "dev",
        targetEnv: "release",
      });
      message.success(
        `已将 dev 环境 ${copiedCount} 个文件覆盖复制到 release 环境`,
      );
      return true;
    } catch (error) {
      console.error("同步 dev 到 release 失败:", error);
      message.error(`同步 dev 到 release 失败：${String(error)}`);
      return false;
    } finally {
      setIsSyncingRelease(false);
    }
  };

  return {
    isUploading,
    isSyncingRelease,
    handleUploadCurrentMarkdown,
    handleCopyDevFolderToRelease,
  };
};
