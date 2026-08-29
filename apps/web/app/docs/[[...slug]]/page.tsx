import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
  MarkdownCopyButton,
  ViewOptionsPopover,
} from "fumadocs-ui/layouts/docs/page";
import { notFound } from "next/navigation";
import { getMDXComponents } from "@/components/mdx";
import { source } from "@/lib/source";

export default async function Page(props: {
  params: Promise<{ slug?: string[] }>;
}) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) {
    notFound();
  }

  const MDX = page.data.body;
  const rawUrl = `https://raw.githubusercontent.com/zohaibarsalan/zkMCP/main/apps/web/content/docs/${page.path}`;
  const githubUrl = `https://github.com/zohaibarsalan/zkMCP/blob/main/apps/web/content/docs/${page.path}`;

  return (
    <DocsPage
      full={page.data.full}
      tableOfContent={{ single: false }}
      toc={page.data.toc}
    >
      <div className="zkmcp-page-heading">
        <DocsTitle>{page.data.title}</DocsTitle>
        <div className="zkmcp-page-actions">
          <MarkdownCopyButton markdownUrl={rawUrl}>
            Copy page
          </MarkdownCopyButton>
          <ViewOptionsPopover githubUrl={githubUrl} markdownUrl={rawUrl} />
        </div>
      </div>
      {page.data.description ? (
        <DocsDescription>{page.data.description}</DocsDescription>
      ) : null}
      <DocsBody>
        <MDX components={getMDXComponents()} />
      </DocsBody>
    </DocsPage>
  );
}

export function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata(props: {
  params: Promise<{ slug?: string[] }>;
}) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) {
    notFound();
  }

  return {
    description: page.data.description,
    title: page.data.title,
  };
}
