import { Handle, Position } from "@xyflow/react";
import { EpisodeItem, EpisodeNodeData } from "../../../lib/types/flow.types";
import { useTranslations } from "next-intl";
import { Checkbox } from "../../ui/checkbox";
import { ScrollArea } from "../../ui/scroll-area";
import { Wand2, Plus, UserCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

export const EpisodeNode = ({ data }: { data: EpisodeNodeData }) => {
  const tFlow = useTranslations("flow.episodeNode");

  const [activeEpisode, setActiveEpisode] = useState<EpisodeItem | null>(null);

  return (
    <div className="flex flex-col gap-2 w-65 relative">
      <div className="text-sm font-semibold text-foreground px-1">{tFlow("title")}</div>
      <div className="bg-card dark:bg-card rounded-xl shadow-lg border border-border p-4 text-card-foreground relative flex flex-col h-80">
        {/* Input Handle */}
        <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-muted border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors z-10 cursor-crosshair">
          <Plus className="w-4 h-4" />
          <Handle
            type="target"
            position={Position.Left}
            id="in"
            className="size-full bg-transparent border-none left-0 top-0 transform-none opacity-0"
          />
        </div>

        <ScrollArea className="flex-1 nodrag nowheel">
          <div className="flex flex-col gap-2 mt-2">
            {data.episodes?.map((ep) => (
              <div key={ep.id} className="flex items-center justify-between group w-full">
                <div className="flex items-center gap-3 overflow-hidden flex-1">
                  <Checkbox
                    checked={ep.checked}
                    onCheckedChange={(checked) => data.onEpisodeCheck?.(ep.id, !!checked)}
                    className="shrink-0"
                  />
                  <span
                    className={cn(
                      "text-sm  transition-colors truncate",
                      ep.checked ? "text-foreground" : "text-muted-foreground",
                    )}
                    title={ep.title}
                  >
                    {ep.title}
                  </span>
                </div>

                <div className="relative flex items-center h-full ml-2 shrink-0">
                  <button
                    onClick={() => setActiveEpisode(activeEpisode?.id === ep.id ? null : ep)}
                    className="p-1.5  rounded-md hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
                  >
                    <Wand2
                      className={cn(
                        "size-3 transition-colors",
                        activeEpisode?.id === ep.id
                          ? "text-primary"
                          : ep.checked
                            ? "text-foreground"
                            : "text-muted-foreground",
                      )}
                    />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* Main output handle like a Plus button */}
        <Handle
          type="source"
          position={Position.Right}
          id="main"
          className="w-6! h-6! flex items-center justify-center bg-background! border border-border! hover:bg-primary/80! transition-colors group-hover/node"
        >
          <Plus className="size-4 m-auto text-muted-foreground group-hover/node:text-white!" />
        </Handle>
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
            <UserCircle className="w-5 h-5 text-muted-foreground shrink-0 ml-2" />
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
