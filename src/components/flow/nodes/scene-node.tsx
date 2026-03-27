import { Handle, Position } from "@xyflow/react";
import { SceneNodeData } from "../../../lib/types/flow.types";
import { useTranslations } from "next-intl";
import { ScrollArea } from "../../ui/scroll-area";
import { Trash2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export const SceneNode = ({ data }: { data: SceneNodeData }) => {
  const tFlow = useTranslations("flow.sceneNode");

  return (
    <div className="flex flex-col gap-2 w-100 relative">
      <div className="flex items-center gap-2 px-1">
        <span className="text-sm font-semibold text-foreground">{data.title}</span>
        {data.subtitle && (
          <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-sm">
            {data.subtitle}
          </span>
        )}
      </div>

      <div className="bg-card dark:bg-card rounded-xl shadow-lg border border-border p-4 text-card-foreground relative flex flex-col h-125 group/node">
        {/* Input Handle */}
        <Handle
          type="target"
          position={Position.Left}
          id="in"
          className="w-6! h-6! flex items-center justify-center bg-background! border border-border! hover:bg-primary/80! transition-colors group-hover/node"
        >
          <Plus className="size-4 m-auto text-muted-foreground group-hover/node:text-white!" />
        </Handle>

        <ScrollArea className="flex-1 pr-3 nodrag nowheel overflow-y-auto">
          <div className="flex flex-col">
            {/* Add Scene Button (Before first item) */}
            <div className="relative flex justify-center py-2 opacity-0 hover:opacity-100 transition-opacity group/add">
              <div className="absolute top-1/2 left-0 right-0 h-px bg-border/50 -translate-y-1/2"></div>
              <button
                onClick={() => data.onSceneAdd?.(0)}
                className="relative z-10 w-5 h-5 bg-background border border-border rounded flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary transition-colors"
                title={tFlow("add")}
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>

            {data.scenes?.map((scene, index) => (
              <div key={scene.id} className="flex flex-col">
                {/* Scene Item */}
                <div
                  className={cn(
                    "group relative p-3 rounded-lg border transition-colors cursor-pointer overflow-hidden",
                    scene.selected
                      ? "bg-primary/50 text-primary-foreground border-primary"
                      : "bg-muted/30 border-border hover:border-border/80",
                  )}
                  onClick={() => data.onSceneSelect?.(scene.id)}
                >
                  <div className="flex items-center gap-2 mb-1 absolute top-0 left-0 ">
                    <span
                      className={cn(
                        "text-xs font-medium px-1.5 py-0.5 rounded-br-lg",
                        scene.selected
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground group-hover:bg-muted-foreground/20",
                      )}
                    >
                      {scene.name}
                    </span>
                  </div>
                  <div className="pt-5">
                    <textarea
                      value={scene.content}
                      onChange={(e) => {
                        data.onSceneChange?.(scene.id, e.target.value);
                      }}
                      className={cn(
                        "w-full resize-none bg-transparent outline-none focus:ring-0 overflow-hidden nodrag",
                        "text-muted-foreground",
                        scene?.selected ? "text-white" : "",
                      )}
                      rows={1}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                      onInput={(e) => {
                        const target = e.target as HTMLTextAreaElement;
                        target.style.height = "auto";
                        target.style.height = `${target.scrollHeight}px`;
                      }}
                      ref={(el) => {
                        if (el) {
                          el.style.height = "auto";
                          el.style.height = `${el.scrollHeight}px`;
                        }
                      }}
                    />
                  </div>

                  {/* Actions (Always show on hover) */}
                  <div className="absolute bottom-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        data.onSceneDelete?.(scene.id);
                      }}
                      className={cn(
                        "p-1.5 rounded-md transition-colors backdrop-blur-md hover:text-destructive",
                        "text-muted-foreground bg-background/50  hover:bg-background/80",
                      )}
                      title={tFlow("delete")}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Add Scene Button (between items and at the end) */}
                <div className="relative flex justify-center py-2 opacity-0 hover:opacity-100 transition-opacity group/add">
                  <div className="absolute top-1/2 left-0 right-0 h-px bg-border/50 -translate-y-1/2"></div>
                  <button
                    onClick={() => data.onSceneAdd?.(index + 1)}
                    className="relative z-10 w-5 h-5 bg-background border border-border rounded flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary transition-colors"
                    title={tFlow("add")}
                  >
                    <Plus className="w-3 h-3" />
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
    </div>
  );
};
