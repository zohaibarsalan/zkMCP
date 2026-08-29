import { renderMermaidSVG } from "beautiful-mermaid";
import { CodeBlock, Pre } from "fumadocs-ui/components/codeblock";
import { ImageZoom } from "fumadocs-ui/components/image-zoom";

function asDataUri(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function render(chart: string, dark: boolean): string {
  return asDataUri(
    renderMermaidSVG(chart, {
      accent: dark ? "#d4d4d4" : "#404040",
      bg: dark ? "#0a0a0a" : "#ffffff",
      border: dark ? "#404040" : "#d4d4d4",
      fg: dark ? "#f5f5f5" : "#171717",
      line: dark ? "#737373" : "#737373",
      muted: dark ? "#a3a3a3" : "#525252",
      surface: dark ? "#151515" : "#f5f5f5",
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
        <div className="dark:hidden">
          <ImageZoom
            alt="Architecture diagram. Click to zoom."
            height={720}
            src={lightSource}
            width={1280}
          />
        </div>
        <div className="hidden dark:block">
          <ImageZoom
            alt="Architecture diagram. Click to zoom."
            height={720}
            src={darkSource}
            width={1280}
          />
        </div>
        <span className="pointer-events-none absolute right-3 bottom-2.5 rounded-md border border-fd-border bg-fd-background/80 px-2 py-1 text-[10px] text-fd-muted-foreground backdrop-blur-sm">
          Click to zoom
        </span>
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
