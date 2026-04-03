import { Handle, Position } from "@xyflow/react";
import { SceneNodeData, SceneItem } from "../../../lib/types/flow.types";
import { useTranslations } from "next-intl";
import { ScrollArea } from "../../ui/scroll-area";
import { Trash2, Plus, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { getNodeWrapperClassName } from "./utils";
import { useState, useEffect } from "react";
import { SceneEditDialog } from "./scene-edit-dialog";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { AssetMention } from "./scene-edit-dialog";

const SceneContent = ({ content, selected }: { content: string; selected?: boolean }) => {
  const editor = useEditor({
    editable: false,
    content: content || "",
    extensions: [
      StarterKit,
      AssetMention.configure({
        HTMLAttributes: {
          class: "asset-mention",
        },
      }),
    ],
    immediatelyRender: false,
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content || "");
    }
  }, [content, editor]);

  return (
    <div
      className={cn(
        "w-full bg-transparent overflow-hidden nodrag text-sm min-h-6 prose-sm prose-p:my-1 prose-span:text-primary",
        "text-muted-foreground",
        selected ? "text-white prose-span:text-white" : "",
      )}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <EditorContent editor={editor} />
    </div>
  );
};

export const SceneNode = ({ data, selected }: { data: SceneNodeData; selected?: boolean }) => {
  const tFlow = useTranslations("flow.sceneNode");
  const [editingScene, setEditingScene] = useState<SceneItem | null>(null);

  return (
    <div className="flex flex-col gap-2 w-100 relative">
      <div className="flex items-center gap-2 px-1">
        <span className="text-sm font-semibold text-foreground">{tFlow("sceneList")}</span>
        {data.title && (
          <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-sm">
            {data.title}
          </span>
        )}
      </div>

      <div className="relative w-full">
        <div
          className={getNodeWrapperClassName(
            selected,
            "flex flex-col p-4 text-card-foreground relative h-125 group/node w-full",
          )}
        >
          <ScrollArea className="flex-1  nodrag nowheel overflow-y-auto [&_[data-slot=scroll-area-viewport]>div]:flex! [&_[data-slot=scroll-area-viewport]>div]:flex-col!">
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
                        {`${scene.name}`}
                      </span>
                    </div>
                    <div className="pt-5 pb-2">
                      <SceneContent content={scene.content || ""} selected={scene.selected} />
                    </div>

                    {/* Actions (Always show on hover) */}
                    <div className="absolute bottom-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingScene(scene);
                        }}
                        className={cn(
                          "p-1.5 rounded-md transition-colors backdrop-blur-md hover:text-primary",
                          "text-muted-foreground bg-background/50 hover:bg-background/80",
                        )}
                        title={tFlow("edit") || "Edit"}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
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
        </div>

        {/* Input Handle */}
        <Handle
          type="target"
          position={Position.Left}
          id="in"
          className="w-4! h-4! flex items-center justify-center bg-background border border-border hover:bg-primary/80 transition-colors group-hover/node z-10"
        ></Handle>

        {/* Main output handle like a Plus button */}
        <Handle
          type="source"
          position={Position.Right}
          id="main"
          className="w-4! h-4! rounded-full flex items-center justify-center bg-background border border-border hover:bg-primary/80 transition-colors group-hover/node z-10"
        ></Handle>
      </div>

      {editingScene && (
        <SceneEditDialog
          scene={editingScene}
          onOpenChange={(open: boolean) => {
            if (!open) setEditingScene(null);
          }}
          onSave={(id: string, name: string, content: string, prompt?: string) => {
            if (data.onSceneChange) {
              data.onSceneChange(id, content, name, prompt);
            }
            setEditingScene(null);
          }}
        />
      )}
    </div>
  );
};
