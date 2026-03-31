import type { Config } from "@docusaurus/types";

const config: Config = {
  title: "Matcha Docs",
  tagline: "Architecture, onboarding, and API documentation",
  url: "http://localhost",
  baseUrl: "/",
  organizationName: "matcha",
  projectName: "docs-site",
  presets: [
    [
      "classic",
      {
        docs: {
          path: "../docs",
          routeBasePath: "/",
          sidebarPath: "./sidebars.ts",
        },
        blog: false,
        pages: false,
      },
    ],
  ],
  themeConfig: {
    navbar: {
      title: "Matcha Docs",
      items: [
        {
          type: "docSidebar",
          sidebarId: "defaultSidebar",
          position: "left",
          label: "Docs",
        },
        {
          href: "/api/reference",
          label: "API Reference",
          position: "right",
        },
      ],
    },
  },
};

export default config;
