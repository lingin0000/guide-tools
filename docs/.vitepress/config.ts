import { defineConfig } from "vitepress";

// GitHub Pages 项目站点通常需要类似 /repo-name/ 的 base。
const base = process.env.DOCS_BASE || "/";
const githubRepository =
  process.env.VITE_GITHUB_REPOSITORY || "lingin0000/guide-tools";

export default defineConfig({
  lang: "zh-CN",
  title: "Guide Tools",
  description: "Guide Tools 使用文档与部署说明",
  base,
  cleanUrls: true,
  lastUpdated: true,
  themeConfig: {
    nav: [
      { text: "下载", link: "https://github.com/lingin0000/guide-tools/releases/latest" },
      { text: "首页", link: "/" },
      { text: "快速开始", link: "/quick-start" },
      { text: "使用指南", link: "/usage" },
      { text: "部署托管", link: "/deployment" },
      { text: "NSIS 离线准备", link: "/nsis-offline" },
    ],
    sidebar: [
      {
        text: "使用文档",
        items: [
          { text: "项目概览", link: "/" },
          { text: "快速开始", link: "/quick-start" },
          { text: "使用指南", link: "/usage" },
          { text: "部署托管", link: "/deployment" },
          { text: "NSIS 离线准备", link: "/nsis-offline" },
        ],
      },
    ],
    socialLinks: [
      {
        icon: "github",
        link: `https://github.com/${githubRepository}`,
      },
    ],
    footer: {
      message: "基于 VitePress 构建，可部署到 GitHub Pages、Cloudflare Pages、Netlify、Vercel。",
      copyright: "Copyright © Guide Tools",
    },
    search: {
      provider: "local",
    },
  },
});
