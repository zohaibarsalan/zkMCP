import { DocsLayout } from "fumadocs-ui/layouts/docs";
import type { ReactNode } from "react";
import { baseOptions } from "@/lib/layout.shared";
import { source } from "@/lib/source";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout
      {...baseOptions()}
      containerProps={{ className: "zkmcp-docs-layout" }}
      sidebar={{ defaultOpenLevel: 0 }}
      tabs={false}
      tree={source.getPageTree()}
    >
      {children}
    </DocsLayout>
  );
}
