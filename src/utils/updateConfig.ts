const trimmedRepository = (
  import.meta.env.VITE_GITHUB_REPOSITORY || "lingin0000/guide-tools"
).trim();

// 原生更新器读取 latest.json，而不是 GitHub releases/latest API。
export const DEFAULT_UPDATER_ENDPOINT = (
  import.meta.env.VITE_UPDATER_ENDPOINT ||
  import.meta.env.VITE_UPDATE_FEED_URL ||
  (trimmedRepository
    ? `https://github.com/${trimmedRepository}/releases/latest/download/latest.json`
    : "")
).trim();
