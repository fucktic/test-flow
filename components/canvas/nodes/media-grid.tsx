"use client";

import { ImageIcon, Plus, Video } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useCanvasStore, type MediaItem } from "@/store/use-canvas-store";

const MEDIA_GRID_TWO_ROW_HEIGHT = "h-[16.625rem]";
// Keep tile corners modest so ReactFlow zoom does not make thumbnails look over-rounded.
const MEDIA_TILE_RADIUS_CLASS = "rounded-[6px]";

function MediaPreview({
  hasActiveSelection,
  isSelected,
  item,
  onSelect,
  showName,
}: {
  hasActiveSelection: boolean;
  isSelected: boolean;
  item: MediaItem;
  onSelect: (item: MediaItem, anchorRect: DOMRect) => void;
  showName: boolean;
}) {
  const t = useTranslations("Canvas");
  const [failed, setFailed] = useState(false);
  const source = item.type === "video" ? item.poster || item.url : item.url;
  const status = item.status.toLowerCase();
  const isError = failed || status === "error" || status === "failed";

  return (
    <button
      type="button"
      aria-label={t("mediaGrid.select", { name: item.name || item.id })}
      aria-pressed={isSelected}
      data-selected-media-grid-item={isSelected ? "true" : undefined}
      className={`group relative cursor-pointer text-left ${MEDIA_TILE_RADIUS_CLASS}`}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(item, event.currentTarget.getBoundingClientRect());
      }}
    >
      <div
        className={cn(
          "relative flex aspect-square items-center justify-center overflow-hidden border border-border ring-inset transition-colors duration-150 group-hover:border-primary group-hover:ring-1 group-hover:ring-primary",
          MEDIA_TILE_RADIUS_CLASS,
        )}
      >
        {source && !isError ? (
          // Project media URLs are data from the project JSON and remain serializable in flow nodes.
          <Image
            src={source}
            alt={item.name}
            fill
            sizes="108px"
            className="object-cover"
            unoptimized
            onError={() => setFailed(true)}
          />
        ) : (
          <div className="flex flex-col items-center gap-1 text-muted-foreground">
            {item.type === "video" ? <Video className="size-5" /> : <ImageIcon className="size-5" />}
            <span className="text-xs">{isError ? t("mediaGrid.error") : t("mediaGrid.pending")}</span>
          </div>
        )}
        {showName ? (
        <div className="pointer-events-none absolute bottom-0 left-0 z-10 mt-1 flex w-full items-center justify-center px-1 py-0.5 bg-foreground/10">
          <span className="truncate text-[10px]">{item.name || item.id}</span>
        </div>
      ) : null}
        {hasActiveSelection && !isSelected ? (
          <div
            className="pointer-events-none absolute inset-0 z-20 bg-black/55 backdrop-blur-[1px]"
            aria-hidden="true"
          />
        ) : null}
      </div>
      
    </button>
  );
}

function EmptyMediaTile({ label }: { label: string }) {
  return (
    <div className={`overflow-visible ${MEDIA_TILE_RADIUS_CLASS}`}>
      <button
        type="button"
        aria-label={label}
        title={label}
        className={`flex aspect-square h-auto w-full flex-col items-center justify-center gap-1 border border-dashed border-border bg-transparent text-muted-foreground ring-inset transition-colors hover:bg-accent hover:text-primary hover:ring-1 hover:ring-primary ${MEDIA_TILE_RADIUS_CLASS}`}
      >
        <Plus className="size-4" />
        <span className="text-xs">{label}</span>
      </button>
    </div>
  );
}

export function MediaGrid({
  addLabel,
  items,
  nodeId,
  sceneId,
  showItemNames,
}: {
  addLabel: string;
  items: MediaItem[];
  nodeId: string;
  sceneId: string;
  showItemNames: boolean;
}) {
  const selectedMediaGridItem = useCanvasStore((state) => state.selectedMediaGridItem);
  const selectMediaGridItem = useCanvasStore((state) => state.selectMediaGridItem);
  const hasActiveSelection = Boolean(selectedMediaGridItem);

  return (
    <ScrollArea className={`nowheel ${MEDIA_GRID_TWO_ROW_HEIGHT} `}>
      <div className="grid grid-cols-2 gap-2 p-1">
        <EmptyMediaTile label={addLabel} />
        {items.map((item) => (
          <MediaPreview
            key={item.id}
            hasActiveSelection={hasActiveSelection}
            isSelected={selectedMediaGridItem?.nodeId === nodeId && selectedMediaGridItem.item.id === item.id}
            item={item}
            showName={showItemNames}
            onSelect={(selectedItem, anchorRect) => {
              selectMediaGridItem({
                nodeId,
                sceneId,
                item: selectedItem,
                anchorRect: {
                  height: anchorRect.height,
                  left: anchorRect.left,
                  top: anchorRect.top,
                  width: anchorRect.width,
                },
              });
            }}
          />
        ))}
      </div>
    </ScrollArea>
  );
}
