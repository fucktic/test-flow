"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils/index";

type ScreenplayMarkdownPreviewProps = {
  markdown: string;
  className?: string;
};

/** 剧本预览：与聊天侧 Markdown 结构一致，支持标题 / 引用 / 表格 / GFM */
export function ScreenplayMarkdownPreview({ markdown, className }: ScreenplayMarkdownPreviewProps) {
  if (!markdown.trim()) {
    return <p className="text-xs text-muted-foreground">—</p>;
  }

  return (
    <div
      className={cn(
        "prose prose-sm dark:prose-invert max-w-full text-foreground",
        "prose-headings:scroll-mt-4 prose-p:leading-relaxed",
        "wrap-break-words [word-break:break-word]",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className: codeClass, children, ...props }) {
            const isBlock = /language-(\w+)/.test(codeClass || "");
            const codeContent = String(children).replace(/\n$/, "");
            if (isBlock) {
              const lang = (codeClass || "").replace("language-", "");
              return (
                <div className="relative group my-3 not-prose">
                  {lang ? (
                    <span className="absolute top-2 right-3 text-[10px] font-mono text-muted-foreground/60 select-none">
                      {lang}
                    </span>
                  ) : null}
                  <pre className="overflow-x-auto rounded-lg bg-muted/60 border border-border/40 p-4 text-xs leading-relaxed">
                    <code className={cn("font-mono text-foreground/90", codeClass)}>
                      {codeContent}
                    </code>
                  </pre>
                </div>
              );
            }
            return (
              <code
                className="px-1.5 py-0.5 rounded bg-muted/60 border border-border/30 font-mono text-xs text-foreground/90"
                {...props}
              >
                {children}
              </code>
            );
          },
          pre({ children }) {
            return <>{children}</>;
          },
          p({ children }) {
            return <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>;
          },
          h1({ children }) {
            return <h1 className="text-base font-bold mb-2 mt-3 first:mt-0">{children}</h1>;
          },
          h2({ children }) {
            return <h2 className="text-sm font-bold mb-2 mt-3 first:mt-0">{children}</h2>;
          },
          h3({ children }) {
            return <h3 className="text-sm font-semibold mb-1.5 mt-2 first:mt-0">{children}</h3>;
          },
          h4({ children }) {
            return <h4 className="text-xs font-semibold mb-1 mt-2 first:mt-0">{children}</h4>;
          },
          ul({ children }) {
            return <ul className="list-disc list-outside pl-4 mb-2 space-y-0.5">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="list-decimal list-outside pl-4 mb-2 space-y-0.5">{children}</ol>;
          },
          li({ children }) {
            return <li className="leading-relaxed">{children}</li>;
          },
          blockquote({ children }) {
            return (
              <blockquote className="border-l-2 border-primary/40 pl-3 my-2 text-muted-foreground not-italic">
                {children}
              </blockquote>
            );
          },
          a({ children, href }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
              >
                {children}
              </a>
            );
          },
          table({ children }) {
            return (
              <div className="overflow-x-auto my-2 not-prose">
                <table className="w-full text-xs border-collapse">{children}</table>
              </div>
            );
          },
          th({ children }) {
            return (
              <th className="border border-border/50 bg-muted/50 px-2 py-1 text-left font-semibold">
                {children}
              </th>
            );
          },
          td({ children }) {
            return <td className="border border-border/50 px-2 py-1 align-top">{children}</td>;
          },
          hr() {
            return <hr className="border-border/40 my-3" />;
          },
          strong({ children }) {
            return <strong className="font-semibold text-foreground">{children}</strong>;
          },
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
