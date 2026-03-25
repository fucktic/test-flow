import { Handle, Position, useNodeId, useStore } from "@xyflow/react";
import { EpisodeNodeData } from "../../../lib/types/flow.types";
import { useTranslations } from "next-intl";
import { Checkbox } from "../../ui/checkbox";
import { ScrollArea } from "../../ui/scroll-area";
import { Wand2, Plus, UserCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export const EpisodeNode = ({ data }: { data: EpisodeNodeData }) => {
  const tFlow = useTranslations("flow.episodeNode");
  const activeEpisode = data.episodes?.find((ep) => ep.id === data.activeEpisodeId);
  const nodeId = useNodeId();

  // Check if there is an outgoing edge from this node's main handle
  const hasConnection = useStore((state) =>
    state.edges.some((edge) => edge.source === nodeId && edge.sourceHandle === "main"),
  );

  return (
    <div className="flex flex-col gap-2 w-65 relative">
      <div className="text-sm font-semibold text-foreground px-1">{tFlow("title")}</div>
      <div className="bg-card dark:bg-card rounded-xl shadow-lg border border-border p-4 text-card-foreground relative flex flex-col h-80">
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
                      "text-sm font-medium transition-colors truncate",
                      ep.checked ? "text-foreground" : "text-muted-foreground",
                    )}
                    title={ep.title}
                  >
                    {ep.title}
                  </span>
                </div>

                <div className="relative flex items-center h-full ml-2 shrink-0">
                  <button
                    onClick={() => data.onEpisodeSelect?.(ep.id)}
                    className="p-1.5  rounded-md hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
                  >
                    <Wand2
                      className={cn(
                        "size-3 transition-colors",
                        data.activeEpisodeId === ep.id
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
        <div
          className={cn(
            "absolute -right-1.5 top-1/2 -translate-y-1/2 size-3 rounded-full flex items-center justify-center border transition-all z-10",
            hasConnection
              ? "bg-background border-border"
              : "bg-primary border-primary text-primary-foreground cursor-crosshair hover:bg-primary/90",
          )}
        >
          {!hasConnection && <Plus className="size-2" />}
          <Handle
            type="source"
            position={Position.Right}
            id="main"
            className="size-full bg-transparent border-none right-0 top-0 transform-none opacity-0"
          />
        </div>
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
