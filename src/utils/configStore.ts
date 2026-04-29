import { Store } from '@tauri-apps/plugin-store';

export interface MarkdownFolderConfig {
  path: string;
  name: string;
}

const store = await Store.load('app_data.json');

export async function getConfig() {
  return {
    ossConfig: (await store.get("ossConfig")) || {},
    cachePath: (await store.get<string>("cachePath")) || "",
    markdownFolders:
      (await store.get<MarkdownFolderConfig[]>("markdownFolders")) || [],
    activeMarkdownFolderPath:
      (await store.get<string>("activeMarkdownFolderPath")) || "",
  };
}

export async function setOSSConfig(ossConfig: any) {
  await store.set('ossConfig', ossConfig);
  await store.save();
}

export async function setCachePath(cachePath: string) {
  await store.set('cachePath', cachePath);
  await store.save();
}

export async function setMarkdownFolders(markdownFolders: MarkdownFolderConfig[]) {
  await store.set('markdownFolders', markdownFolders);
  await store.save();
}

export async function setActiveMarkdownFolderPath(activeMarkdownFolderPath: string) {
  await store.set('activeMarkdownFolderPath', activeMarkdownFolderPath);
  await store.save();
}
