import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

function Brand() {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="grid size-6 place-items-center rounded-md border border-fd-border bg-fd-secondary font-semibold text-[10px] tracking-[-0.04em]">
        zk
      </span>
      <span className="font-semibold tracking-[-0.02em]">zkMCP</span>
    </span>
  );
}

export function baseOptions(): BaseLayoutProps {
  return {
    githubUrl: "https://github.com/zohaibarsalan/zkMCP",
    links: [
      {
        active: "nested-url",
        on: "nav",
        text: "Documentation",
        url: "/docs",
      },
      {
        active: "url",
        on: "nav",
        text: "Playground",
        url: "/docs/playground",
      },
      {
        active: "url",
        on: "nav",
        text: "HTTP API",
        url: "/api-reference",
      },
    ],
    nav: {
      title: <Brand />,
      url: "/docs",
    },
  };
}
