"use client";

import { useState, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { type StoryboardListNodeData, useCanvasStore } from "@/store/use-canvas-store";
import { NODE_WIDTH_CLASS } from "../constants";

const MAX_SELECTED_STORYBOARDS = 3;

type StoryboardListNodeType = Node<StoryboardListNodeData, "storyboard-list-node">;

export function StoryboardListNode({ data, selected }: NodeProps<StoryboardListNodeType>) {
  const t = useTranslations("Canvas");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const addStoryboard = useCanvasStore((state) => state.addStoryboard);
  const deleteStoryboard = useCanvasStore((state) => state.deleteStoryboard);
  const moveStoryboard = useCanvasStore((state) => state.moveStoryboard);
  const selectedMediaGridSceneId = useCanvasStore((state) => state.selectedMediaGridItem?.sceneId);
  const selectedStoryboardIds = useCanvasStore((state) => state.selectedStoryboardIds);
  const toggleStoryboardSelection = useCanvasStore((state) => state.toggleStoryboardSelection);
  const active =
    selected ||
    data.storyboards.some(
      (storyboard) =>
        storyboard.id === selectedMediaGridSceneId || selectedStoryboardIds.includes(storyboard.id),
    );
  const pendingDeleteStoryboard = data.storyboards.find(
    (storyboard) => storyboard.id === pendingDeleteId,
  );
  const pendingDeleteName = pendingDeleteStoryboard
    ? pendingDeleteStoryboard.name.trim() ||
      t("storyboardList.itemLabel", {
        index: data.storyboards.findIndex((storyboard) => storyboard.id === pendingDeleteId) + 1,
      })
    : "";

  const toggleSelectedStoryboard = (storyboardId: string, disabled: boolean) => {
    if (!disabled) toggleStoryboardSelection(storyboardId);
  };

  const handleStoryboardKeyDown = (
    event: KeyboardEvent<HTMLDivElement>,
    storyboardId: string,
    disabled: boolean,
  ) => {
    if (event.key !== "Enter" && event.key !== " ") return;

    event.preventDefault();
    toggleSelectedStoryboard(storyboardId, disabled);
  };

  return (
    <div className={cn("relative", NODE_WIDTH_CLASS)}>
      <div className="flex max-w-62.5 items-center justify-between gap-2 pb-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-xs font-bold leading-none text-foreground">
            {t("storyboardList.title")}
          </span>
          <span className="truncate rounded-3xl border border-border bg-primary px-1.5 py-0.5 text-xs leading-none text-foreground shadow-sm">
            {data.episodeName}
          </span>
        </div>
      </div>

      <section
        className={cn(
          "rounded-2xl border bg-card p-1.5 text-card-foreground shadow-xl transition-[border-color,box-shadow] duration-200",
          active
            ? "border-foreground/45 shadow-[0_0_30px_hsl(var(--foreground)/0.24),0_12px_40px_rgba(0,0,0,0.42)]"
            : "border-border",
        )}
      >
        {data.storyboards.length > 0 ? (
          <ScrollArea className="h-105 ">
            <div className="flex flex-col gap-2">
              {data.storyboards.map((storyboard, index) => {
                const selected = selectedStoryboardIds.includes(storyboard.id);
                const disabled =
                  !selected && selectedStoryboardIds.length >= MAX_SELECTED_STORYBOARDS;
                const storyboardName =
                  storyboard.name.trim() ||
                  t("storyboardList.itemLabel", {
                    index: index + 1,
                  });

                return (
                  <div
                    key={storyboard.id}
                    role="button"
                    tabIndex={disabled ? -1 : 0}
                    aria-pressed={selected}
                    aria-disabled={disabled}
                    onClick={() => toggleSelectedStoryboard(storyboard.id, disabled)}
                    onKeyDown={(event) =>
                      handleStoryboardKeyDown(event, storyboard.id, disabled)
                    }
                    className={cn(
                      "group relative w-full cursor-pointer overflow-hidden rounded-xl border bg-muted text-left transition-colors",
                      selected
                        ? "border-primary bg-primary/10 "
                        : "border-border hover:bg-accent",
                      disabled && "cursor-not-allowed opacity-45 hover:border-border",
                    )}
                  >
                    <div className="mb-1 flex items-center gap-2">
                      <span
                        className={cn(
                          "text-xs font-medium px-2 py-0.5 rounded-br-xl",
                          selected
                            ? "bg-primary text-primary-foreground"
                            : "bg-card text-muted-foreground group-hover:bg-muted-foreground/20",
                        )}
                      >
                        {storyboardName}
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-3 h-15  text-xs leading-4 text-muted-foreground">
                      {storyboard.description}
                    </p>
                    <div className="nodrag absolute bottom-1.5 right-1.5 z-10 flex items-center gap-1 rounded-full border border-border bg-card/95 p-0.5 opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label={t("storyboardList.add")}
                        className="size-6 rounded-full text-muted-foreground hover:text-foreground"
                        onClick={(event) => {
                          event.stopPropagation();
                          addStoryboard(data.episodeId, storyboard.id);
                        }}
                      >
                        <Plus className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        disabled={index === 0}
                        aria-label={t("storyboardList.moveUp", { name: storyboardName })}
                        className="size-6 rounded-full text-muted-foreground hover:text-foreground"
                        onClick={(event) => {
                          event.stopPropagation();
                          moveStoryboard(storyboard.id, -1);
                        }}
                      >
                        <ChevronUp className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        disabled={index === data.storyboards.length - 1}
                        aria-label={t("storyboardList.moveDown", { name: storyboardName })}
                        className="size-6 rounded-full text-muted-foreground hover:text-foreground"
                        onClick={(event) => {
                          event.stopPropagation();
                          moveStoryboard(storyboard.id, 1);
                        }}
                      >
                        <ChevronDown className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label={t("storyboardList.delete", { name: storyboardName })}
                        className="size-6 rounded-full text-destructive hover:text-destructive"
                        onClick={(event) => {
                          event.stopPropagation();
                          setPendingDeleteId(storyboard.id);
                        }}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        ) : (
          <div className="flex h-45 flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-border text-xs text-muted-foreground">
            <span>{t("storyboardList.empty")}</span>
            <Button type="button" size="sm" variant="outline" className="bg-transparent">
              {t("storyboardList.parse")}
            </Button>
          </div>
        )}
      </section>
      <Handle type="source" position={Position.Right} className="bg-primary!" />
      <Dialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("storyboardList.confirmDeleteTitle")}</DialogTitle>
            <DialogDescription>
              {t("storyboardList.confirmDeleteDescription", {
                name: pendingDeleteName,
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                {t("storyboardList.cancel")}
              </Button>
            </DialogClose>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                if (pendingDeleteId) deleteStoryboard(pendingDeleteId);
                setPendingDeleteId(null);
              }}
            >
              {t("storyboardList.confirmDelete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
