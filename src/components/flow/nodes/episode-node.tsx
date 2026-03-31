import { Handle, Position } from "@xyflow/react";
import { EpisodeItem, EpisodeNodeData } from "../../../lib/types/flow.types";
import { useTranslations } from "next-intl";
import { Checkbox } from "../../ui/checkbox";
import { ScrollArea } from "../../ui/scroll-area";
import { Wand2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { getNodeWrapperClassName } from "./utils";

export const EpisodeNode = ({ data, selected }: { data: EpisodeNodeData; selected?: boolean }) => {
  const tFlow = useTranslations("flow.episodeNode");

  const [activeEpisode, setActiveEpisode] = useState<EpisodeItem | null>(null);

  return (
    <div className="flex flex-col gap-2 w-65 relative">
      <div className="text-sm font-semibold text-foreground px-1">{tFlow("title")}</div>

      <div className="relative w-full">
        {/* Input Handle */}

        <div
          className={getNodeWrapperClassName(
            selected,
            "flex flex-col p-4 text-card-foreground relative h-80 w-full",
          )}
        >
          <ScrollArea className="flex-1 nodrag nowheel overflow-y-auto [&_[data-slot=scroll-area-viewport]>div]:flex! [&_[data-slot=scroll-area-viewport]>div]:flex-col!">
            <ul className="flex flex-col gap-2 mt-2 w-full max-w-full">
              {data.episodes?.map((ep) => {
                const checkedCount = data.episodes?.filter((e) => e.checked).length || 0;
                const isDisabled = !ep.checked && checkedCount >= 3;

                return (
                  <li
                    key={ep.id}
                    className={cn(
                      "flex items-center justify-between group w-full gap-2 relative overflow-hidden p-2 rounded-lg transition-all",
                      ep.checked
                        ? "bg-primary/10 border border-primary/20 shadow-sm"
                        : "border border-transparent",
                      isDisabled && "opacity-50 grayscale",
                    )}
                  >
                    <Checkbox
                      checked={ep.checked}
                      disabled={isDisabled}
                      onCheckedChange={(checked) =>
                        !isDisabled && data.onEpisodeCheck?.(ep.id, !!checked)
                      }
                      className={cn("shrink-0", isDisabled && "cursor-not-allowed")}
                    />

                    <div
                      className={cn(
                        "text-sm transition-colors flex-1 overflow-hidden",
                        ep.checked ? "text-foreground font-medium" : "text-foreground",
                        isDisabled && "text-muted-foreground cursor-not-allowed",
                      )}
                      title={ep.title}
                    >
                      <div className="truncate">{ep.title}</div>
                    </div>
                    <div className="flex items-center h-full shrink-0">
                      <button
                        onClick={() => setActiveEpisode(activeEpisode?.id === ep.id ? null : ep)}
                        className={cn(
                          "p-1.5 rounded-md transition-colors cursor-pointer",
                          activeEpisode?.id === ep.id
                            ? "bg-primary/20 text-primary"
                            : "hover:bg-accent hover:text-accent-foreground text-muted-foreground",
                        )}
                      >
                        <Wand2 className="size-3" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        </div>

        {/* Main output handle like a Plus button */}
        <Handle
          type="source"
          position={Position.Right}
          id="main"
          className="w-4! h-4! flex items-center justify-center bg-background border border-border hover:bg-primary/80 transition-colors group-hover/node"
        ></Handle>
      </div>

      {/* Expanded Script Panel */}
      {activeEpisode?.script && (
        <div className="absolute top-0 left-[calc(100%+24px)] bg-card rounded-xl shadow-xl border border-border flex flex-col w-80 h-100 overflow-hidden text-card-foreground z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 bg-muted/50 border-b border-border">
            <div className="flex items-center gap-4 overflow-hidden">
              <h3
                className="text-base font-semibold tracking-wide truncate"
                title={activeEpisode.script.title}
              >
                {activeEpisode.script.title}
              </h3>
              <span className="text-xs text-muted-foreground shrink-0">
                {activeEpisode.script.timestamp}
              </span>
            </div>
            <button
              onClick={() => setActiveEpisode(null)}
              className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors ml-2 shrink-0 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <ScrollArea className="flex-1 min-h-0 nodrag nowheel">
            <div className="p-5 text-[13px] text-muted-foreground leading-[1.8] whitespace-pre-wrap">
              {activeEpisode.script.content}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
};
