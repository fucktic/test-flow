"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useCanvasStore } from "@/store/use-canvas-store";

const MAX_SELECTED_EPISODES = 3;

export function EpisodesPanel() {
  const t = useTranslations("Sidebar");
  const currentProject = useCanvasStore((state) => state.currentProject);
  const episodes = useMemo(() => currentProject?.episodes ?? [], [currentProject?.episodes]);
  const availableEpisodeIds = useMemo(
    () => new Set(episodes.map((episode) => episode.id)),
    [episodes],
  );
  const [selectedEpisodeIds, setSelectedEpisodeIds] = useState<string[]>([]);
  const visibleSelectedEpisodeIds = selectedEpisodeIds.filter((episodeId) =>
    availableEpisodeIds.has(episodeId),
  );

  const handleEpisodeToggle = (episodeId: string) => {
    setSelectedEpisodeIds((currentIds) => {
      const availableSelectedIds = currentIds.filter((selectedEpisodeId) =>
        availableEpisodeIds.has(selectedEpisodeId),
      );

      if (availableSelectedIds.includes(episodeId)) {
        return availableSelectedIds.filter((selectedEpisodeId) => selectedEpisodeId !== episodeId);
      }

      // Keep selection bounded so downstream episode workflows receive a predictable set.
      if (availableSelectedIds.length >= MAX_SELECTED_EPISODES) {
        return availableSelectedIds;
      }

      return [...availableSelectedIds, episodeId];
    });
  };

  return (
    <div className="flex  flex-col gap-3 p-3 w-[260px]">
      

      {currentProject ? (
        episodes.length > 0 ? (
          <ScrollArea className="max-h-[320px] ">
            <div className="flex flex-col gap-1">
              {episodes.map((episode) => {
                const selected = visibleSelectedEpisodeIds.includes(episode.id);
                const selectionLocked =
                  !selected && visibleSelectedEpisodeIds.length >= MAX_SELECTED_EPISODES;

                return (
                  <Button
                    key={episode.id}
                    type="button"
                    variant="ghost"
                    aria-pressed={selected}
                    aria-disabled={selectionLocked}
                    onClick={() => {
                      if (!selectionLocked) {
                        handleEpisodeToggle(episode.id);
                      }
                    }}
                    className={cn(
                      "h-auto w-full justify-start whitespace-normal rounded-md px-2 py-2 text-left  transition-colors",
                      selected
                        ? "border-primary/40 bg-primary/10 text-white hover:bg-primary/15"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground",
                      selectionLocked &&
                        "cursor-not-allowed opacity-50 hover:bg-transparent hover:text-muted-foreground",
                    )}
                  >
                    <span className="line-clamp-2 w-full">{episode.name}</span>
                  </Button>
                );
              })}
            </div>
          </ScrollArea>
        ) : (
          <p className="rounded-md border border-dashed border-border px-3 py-4 text-xs text-muted-foreground">
            {t("episodePanel.empty")}
          </p>
        )
      ) : (
        <p className="rounded-md border border-dashed border-border px-3 py-4 text-xs text-muted-foreground">
          {t("episodePanel.noCurrentProject")}
        </p>
      )}
    </div>
  );
}
