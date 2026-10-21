import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";

const sidebars: SidebarsConfig = {
  docsSidebar: [
    {
      type: "category",
      label: "Getting Started",
      collapsed: false,
      items: ["intro", "installation", "quick-start"],
    },
    {
      type: "category",
      label: "Configuration",
      items: ["options", "themes-addons", "frontmatter"],
    },
    {
      type: "category",
      label: "Components",
      items: [
        "overview-page",
        "presentation-page",
        "slidev-link",
        "slidev-card",
      ],
    },
    {
      type: "category",
      label: "Advanced",
      items: [
        "categories",
        "playlists",
        "parallel-builds",
        "dev-server",
        "custom-styling",
        "troubleshooting",
        "security",
      ],
    },
    {
      type: "category",
      label: "API Reference",
      items: ["plugin-api", "types"],
    },
    {
      type: "category",
      label: "Tooling",
      items: ["cli"],
    },
  ],
};

export default sidebars;
