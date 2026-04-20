import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Music,
  Image as ImageIcon,
  Video,
  Box,
  Users,
  Paperclip,
  Clapperboard,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Strip ANSI escape codes from terminal output
function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1B\[[0-9;]*[mGKHFABCDJM]/g, "").replace(/\x1B\][^\x07]*\x07/g, "");
}

// Detect if content looks like it has meaningful markdown
function hasMarkdown(content: string): boolean {
  return /^#{1,6}\s|`{1,3}|\*{1,2}[^*]|\[.+\]\(.+\)|^\s*[-*+]\s|^\s*\d+\.\s|^>\s/m.test(content);
}

// @uuid[suffix] pattern — same regex as use-chat-editor.ts
const MENTION_REGEX =
  /@([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})([a-zA-Z]*)/gi;

export interface AssetItem {
  id: string;
  name: string;
  category?: string;
  type?: string;
  url?: string;
}

// Color / icon mapping matching AssetNodeView in scene-edit-dialog.tsx
const COLOR_MAP: Record<string, string> = {
  characters: "bg-blue-500/10 border-blue-500/20 text-blue-600",
  scenes: "bg-green-500/10 border-green-500/20 text-green-600",
  props: "bg-amber-500/10 border-amber-500/20 text-amber-600",
  storyboard: "bg-teal-500/10 border-teal-500/20 text-teal-600",
  audio: "bg-purple-500/10 border-purple-500/20 text-purple-600",
  image: "bg-indigo-500/10 border-indigo-500/20 text-indigo-600",
  video: "bg-rose-500/10 border-rose-500/20 text-rose-600",
  temp: "bg-muted border-border/40 text-muted-foreground",
};

function getAssetType(suffix: string): string {
  if (!suffix) return "temp";
  if (suffix === "props") return "props";
  if (suffix === "temp") return "temp";
  if (["characters", "scenes", "storyboard", "audio", "image", "video"].includes(suffix))
    return suffix;
  return "temp";
}

function AssetTypeIcon({ type, className }: { type: string; className?: string }) {
  const cls = cn("w-3 h-3 shrink-0", className);
  switch (type) {
    case "characters":
      return <Users className={cls} />;
    case "scenes":
      return <Clapperboard className={cls} />;
    case "audio":
      return <Music className={cls} />;
    case "image":
    case "storyboard":
      return <ImageIcon className={cls} />;
    case "video":
      return <Video className={cls} />;
    case "props":
      return <Box className={cls} />;
    default:
      return <Paperclip className={cls} />;
  }
}

interface MentionChipProps {
  id: string;
  suffix: string;
  allAssets?: AssetItem[];
}

function MentionChip({ id, suffix, allAssets }: MentionChipProps) {
  const asset = allAssets?.find((a) => a.id === id);
  const assetType = asset
    ? asset.category || asset.type || getAssetType(suffix)
    : getAssetType(suffix);
  const label = asset?.name ?? `${id.slice(0, 8)}…`;
  const url = asset?.url;
  const colorClass = COLOR_MAP[assetType] ?? COLOR_MAP.temp;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-xl mx-0.5 align-middle border text-xs font-medium",
        colorClass,
      )}
    >
      {url &&
      (assetType === "image" ||
        assetType === "storyboard" ||
        assetType === "video" ||
        assetType === "characters" ||
        assetType === "scenes" ||
        assetType === "props") ? (
        <img src={url} alt={label} className="w-4 h-4 object-cover rounded-sm shrink-0" />
      ) : (
        <AssetTypeIcon type={assetType} />
      )}
      <span>{label}</span>
    </span>
  );
}

// Split content into text segments and @uuid mention tokens
function parseSegments(
  content: string,
): Array<{ type: "text"; value: string } | { type: "mention"; id: string; suffix: string }> {
  const segments: ReturnType<typeof parseSegments> = [];
  let lastIndex = 0;
  MENTION_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = MENTION_REGEX.exec(content)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", value: content.slice(lastIndex, match.index) });
    }
    segments.push({ type: "mention", id: match[1], suffix: match[2] || "" });
    lastIndex = MENTION_REGEX.lastIndex;
  }
  if (lastIndex < content.length) {
    segments.push({ type: "text", value: content.slice(lastIndex) });
  }
  return segments;
}

// Inline-render text with @uuid mention chips
function InlineWithMentions({ content, allAssets }: { content: string; allAssets?: AssetItem[] }) {
  const segments = useMemo(() => parseSegments(content), [content]);
  return (
    <>
      {segments.map((seg, i) =>
        seg.type === "mention" ? (
          <MentionChip key={i} id={seg.id} suffix={seg.suffix} allAssets={allAssets} />
        ) : (
          <span key={i} className="whitespace-pre-wrap break-all">
            {seg.value}
          </span>
        ),
      )}
    </>
  );
}

interface MessageContentProps {
  content: string;
  isUser?: boolean;
  className?: string;
  allAssets?: AssetItem[];
  /** 智能体过程输出，与正文分开展示（折叠） */
  agentProcess?: string;
}

export function MessageContent({
  content,
  isUser = false,
  className,
  allAssets,
  agentProcess,
}: MessageContentProps) {
  const t = useTranslations("chat");
  const [processOpen, setProcessOpen] = useState(true);
  const processScrollRef = useRef<HTMLDivElement>(null);
  const cleaned = stripAnsi(content);
  const hasMentions = MENTION_REGEX.test(cleaned);
  // Reset lastIndex after test()
  MENTION_REGEX.lastIndex = 0;

  if (isUser) {
    return (
      <span className={cn("leading-relaxed", className)}>
        <InlineWithMentions content={cleaned} allAssets={allAssets} />
      </span>
    );
  }

  const processCleaned = agentProcess ? stripAnsi(agentProcess) : "";
  const hasMainText = cleaned.trim().length > 0;

  useEffect(() => {
    const el = processScrollRef.current;
    if (!el || !processCleaned) return;
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, [processCleaned]);

  const mainBlock = (() => {
    if (!hasMainText) return null;
    const useMarkdown = !hasMentions && hasMarkdown(cleaned);

    if (!useMarkdown) {
      return (
        <span className={cn("leading-relaxed", className)}>
          <InlineWithMentions content={cleaned} allAssets={allAssets} />
        </span>
      );
    }

    return (
      <div className={cn("chat-markdown prose prose-sm max-w-none overflow-hidden", className)}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            code({ className: codeClass, children, ...props }) {
              const isBlock = /language-(\w+)/.test(codeClass || "");
              const codeContent = String(children).replace(/\n$/, "");
              if (isBlock) {
                const lang = (codeClass || "").replace("language-", "");
                return (
                  <div className="relative group my-3">
                    {lang && (
                      <span className="absolute top-2 right-3 text-[10px] font-mono text-muted-foreground/60 select-none">
                        {lang}
                      </span>
                    )}
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
            ul({ children }) {
              return <ul className="list-disc list-outside pl-4 mb-2 space-y-0.5">{children}</ul>;
            },
            ol({ children }) {
              return (
                <ol className="list-decimal list-outside pl-4 mb-2 space-y-0.5">{children}</ol>
              );
            },
            li({ children }) {
              return <li className="leading-relaxed">{children}</li>;
            },
            blockquote({ children }) {
              return (
                <blockquote className="border-l-2 border-primary/40 pl-3 my-2 text-muted-foreground italic">
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
                <div className="overflow-x-auto my-2">
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
              return <td className="border border-border/50 px-2 py-1">{children}</td>;
            },
            hr() {
              return <hr className="border-border/40 my-3" />;
            },
            strong({ children }) {
              return <strong className="font-semibold text-foreground">{children}</strong>;
            },
          }}
        >
          {cleaned}
        </ReactMarkdown>
      </div>
    );
  })();

  return (
    <div className="min-w-0 space-y-2">
      {processCleaned ? (
        <details
          open={processOpen}
          onToggle={(e) => setProcessOpen(e.currentTarget.open)}
          className="group rounded-lg border border-border/50 bg-muted/25 text-xs"
        >
          <summary className="cursor-pointer list-none px-2.5 py-2 font-medium text-muted-foreground transition-colors hover:text-foreground [&::-webkit-details-marker]:hidden">
            <span className="inline-flex items-center gap-1.5">
              <span className="text-[10px] opacity-70 group-open:rotate-90 transition-transform">
                ▸
              </span>
              {t("agentProcessSection")}
            </span>
          </summary>
          <div
            ref={processScrollRef}
            className="px-2.5 pb-2.5 max-h-52 overflow-y-auto border-t border-border/40 pt-2 text-muted-foreground"
          >
            <InlineWithMentions content={processCleaned} allAssets={allAssets} />
          </div>
        </details>
      ) : null}
      {mainBlock}
    </div>
  );
}
