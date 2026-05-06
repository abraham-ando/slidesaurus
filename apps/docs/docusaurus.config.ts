import { themes as prismThemes } from "prism-react-renderer";
import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";
import { SlidesaurusPluginOptions } from "slidesaurus";

const isProd = process.env.NODE_ENV === "production";

const slidesaurusPluginOptions: SlidesaurusPluginOptions = {
  path: "./slidev",
  routeBasePath: "/training",
  theme: "seriph",
  uiTheme: "default",
  pageTitle: "Training",
  pageTagline: "Hands-on training presentations",
  download: false,
  exportFormats: ["pdf", "pptx"],
  maxParallelBuilds: 4,
  // Use port range 8700-8799 to avoid collision with @slidesaurus/sample (8600-8699)
  devServerBasePort: 8700,
  // Slidev dev server needs time for Vite + dependencies on first start
  devServerTimeout: 60000,
};

const config: Config = {
  title: "🦕 slidesaurus",
  tagline:
    "Seamlessly integrate Slidev presentations into your Docusaurus site",
  favicon: "img/favicon.ico",

  url: "http://localhost:3001",
  baseUrl: "/",

  onBrokenLinks: "throw",

  markdown: {
    hooks: {
      onBrokenMarkdownLinks: "warn",
    },
  },

  i18n: {
    defaultLocale: "en",
    locales: ["en"],
  },

  headTags: [
    // CSP is only applied in production: webpack dev server uses eval() for
    // source maps which violates script-src without 'unsafe-eval', causing a
    // blank page in development mode.
    ...(isProd
      ? [
          {
            tagName: "meta",
            attributes: {
              "http-equiv": "Content-Security-Policy",
              content:
                "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'self'; frame-src 'self'; img-src 'self' data: blob:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self' https: http: wss: ws:; upgrade-insecure-requests",
            },
          },
        ]
      : []),
    {
      tagName: "meta",
      attributes: {
        name: "referrer",
        content: "strict-origin-when-cross-origin",
      },
    },
  ],

  presets: [
    [
      "classic",
      {
        docs: {
          sidebarPath: "./sidebars.ts",
          editUrl:
            "https://github.com/abraham-ando/slidesaurus/tree/main/apps/docs/",
        },
        blog: false,
        theme: {
          customCss: "./src/css/custom.css",
        },
      } satisfies Preset.Options,
    ],
  ],

  plugins: [["slidesaurus", { ...slidesaurusPluginOptions }]],

  themeConfig: {
    navbar: {
      title: "🦕 slidesaurus",
      items: [
        {
          type: "docSidebar",
          sidebarId: "docsSidebar",
          position: "left",
          label: "Docs",
        },
        {
          to: "/docs/plugin-api",
          label: "API",
          position: "left",
        },
        {
          to: "/training",
          label: "Training",
          position: "left",
        },
        {
          href: "https://github.com/abraham-ando/slidesaurus",
          label: "GitHub",
          position: "right",
        },
      ],
    },
    footer: {
      style: "dark",
      links: [
        {
          title: "Docs",
          items: [
            { label: "Introduction", to: "/docs/intro" },
            { label: "Quick Start", to: "/docs/quick-start" },
            { label: "Configuration", to: "/docs/options" },
          ],
        },
        {
          title: "Resources",
          items: [
            { label: "Training", to: "/training" },
            { label: "API Reference", to: "/docs/plugin-api" },
            { label: "Troubleshooting", to: "/docs/troubleshooting" },
          ],
        },
        {
          title: "More",
          items: [
            {
              label: "GitHub",
              href: "https://github.com/abraham-ando/slidesaurus",
            },
            {
              label: "Slidev",
              href: "https://sli.dev",
            },
            {
              label: "Docusaurus",
              href: "https://docusaurus.io",
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} 🦕 slidesaurus. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ["bash", "yaml", "json"],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
