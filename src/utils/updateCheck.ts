import { fetch } from "@tauri-apps/plugin-http";

export type UpdateStatus = "no_source" | "up_to_date" | "update_available";

export interface UpdateResult {
  status: UpdateStatus;
  currentVersion: string;
  latestVersion?: string;
  downloadUrl?: string;
  releaseUrl?: string;
  notes?: string;
}

const normalizeVersion = (value: string) => value.trim().replace(/^v/i, "");

const parseVersionParts = (value: string) =>
  normalizeVersion(value)
    .split(".")
    .map((segment) => Number.parseInt(segment, 10))
    .map((segment) => (Number.isFinite(segment) ? segment : 0));

const compareSemver = (left: string, right: string) => {
  const a = parseVersionParts(left);
  const b = parseVersionParts(right);
  const max = Math.max(a.length, b.length);
  for (let index = 0; index < max; index += 1) {
    const diff = (a[index] ?? 0) - (b[index] ?? 0);
    if (diff !== 0) {
      return diff;
    }
  }
  return 0;
};

const parseUpdatePayload = (payload: any) => {
  if (payload && typeof payload === "object") {
    if (typeof payload.tag_name === "string") {
      const assets = Array.isArray(payload.assets) ? payload.assets : [];
      const firstAsset = assets.find(
        (asset: any) => typeof asset?.browser_download_url === "string",
      );
      return {
        latestVersion: payload.tag_name,
        releaseUrl: typeof payload.html_url === "string" ? payload.html_url : undefined,
        downloadUrl:
          typeof firstAsset?.browser_download_url === "string"
            ? firstAsset.browser_download_url
            : undefined,
        notes: typeof payload.body === "string" ? payload.body : undefined,
      };
    }

    if (typeof payload.version === "string") {
      return {
        latestVersion: payload.version,
        releaseUrl: typeof payload.releaseUrl === "string" ? payload.releaseUrl : undefined,
        downloadUrl: typeof payload.downloadUrl === "string" ? payload.downloadUrl : undefined,
        notes: typeof payload.notes === "string" ? payload.notes : undefined,
      };
    }
  }

  return null;
};

export async function checkForUpdate(currentVersion: string, updateFeedUrl: string) {
  const trimmedUrl = updateFeedUrl.trim();
  if (!trimmedUrl) {
    return { status: "no_source", currentVersion } satisfies UpdateResult;
  }

  const response = await fetch(trimmedUrl, { method: "GET" });
  if (!response.ok) {
    throw new Error(`更新源请求失败：${response.status} ${response.statusText}`);
  }

  const payload = await response.json();
  const parsed = parseUpdatePayload(payload);
  if (!parsed?.latestVersion) {
    throw new Error("更新源返回格式不支持（需要 GitHub releases/latest 或自定义 version JSON）");
  }

  const isUpdateAvailable = compareSemver(parsed.latestVersion, currentVersion) > 0;

  if (!isUpdateAvailable) {
    return {
      status: "up_to_date",
      currentVersion,
      latestVersion: parsed.latestVersion,
      releaseUrl: parsed.releaseUrl,
      downloadUrl: parsed.downloadUrl,
      notes: parsed.notes,
    } satisfies UpdateResult;
  }

  return {
    status: "update_available",
    currentVersion,
    latestVersion: parsed.latestVersion,
    releaseUrl: parsed.releaseUrl,
    downloadUrl: parsed.downloadUrl,
    notes: parsed.notes,
  } satisfies UpdateResult;
}
