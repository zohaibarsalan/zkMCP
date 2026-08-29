import { renderMermaidSVG } from "beautiful-mermaid";
import { CodeBlock, Pre } from "fumadocs-ui/components/codeblock";

function asDataUri(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function render(chart: string, dark: boolean): string {
  return asDataUri(
    renderMermaidSVG(chart, {
      accent: dark ? "#a3a3a3" : "#525252",
      bg: dark ? "#0a0a0a" : "#ffffff",
      border: dark ? "#404040" : "#d4d4d4",
      fg: dark ? "#f5f5f5" : "#171717",
      line: dark ? "#737373" : "#737373",
      muted: dark ? "#a3a3a3" : "#525252",
      surface: dark ? "#171717" : "#f5f5f5",
      transparent: true,
    })
  );
}

export function Mermaid({ chart }: { chart: string }) {
  try {
    const lightSource = render(chart, false);
    const darkSource = render(chart, true);

    return (
      <div className="zkmcp-mermaid">
        <img
          alt="Mermaid diagram"
          className="h-auto w-full dark:hidden"
          height={720}
          src={lightSource}
          width={1280}
        />
        <img
          alt="Mermaid diagram"
          className="hidden h-auto w-full dark:block"
          height={720}
          src={darkSource}
          width={1280}
        />
      </div>
    );
  } catch {
    return (
      <CodeBlock title="Mermaid">
        <Pre>{chart}</Pre>
      </CodeBlock>
    );
  }
}
