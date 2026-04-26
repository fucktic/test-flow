"use client";

import { Film, Video, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { fetchProjectCanvasData, type ProjectCanvasData } from "@/lib/project-api";
import type { ProjectEpisode, ProjectVideoAsset } from "@/lib/project-types";
import { cn } from "@/lib/utils";
import { useCanvasStore } from "@/store/use-canvas-store";
import { useLayoutStore } from "@/store/use-layout-store";

type SelectedStoryboardVideo = {
  selected: boolean;
  storyboardId: string;
  storyboardName: string;
  video: ProjectVideoAsset;
};

type CanvasDataByEpisode = Record<string, ProjectCanvasData>;
type ActiveEpisode = {
  canvasData: ProjectCanvasData;
  episode: ProjectEpisode;
};
type TimelineVideo = SelectedStoryboardVideo & {
  durationSeconds: number | null;
  layoutSeconds: number;
  startSeconds: number;
};

const FALLBACK_SEGMENT_SECONDS = 3;
const PIXELS_PER_SECOND = 28;
const MIN_TIMELINE_SEGMENT_WIDTH = 120;

function createMissingVideo(videoId: string): ProjectVideoAsset {
  return {
    id: videoId,
    duration: "",
    name: videoId,
    poster: "",
    prompt: "",
    source: "",
    status: "",
    url: "",
  };
}

function readNodeSceneId(data: Record<string, unknown>) {
  return typeof data.sceneId === "string" ? data.sceneId : "";
}

function parseVideoDuration(duration: string) {
  const value = duration.trim().toLowerCase();
  if (!value) return null;

  const numericDuration = Number(value.replace(/s$/, ""));
  if (Number.isFinite(numericDuration) && numericDuration > 0) return numericDuration;

  const timeParts = value.split(":").map((part) => Number(part));
  if (
    timeParts.length >= 2 &&
    timeParts.length <= 3 &&
    timeParts.every((part) => Number.isFinite(part) && part >= 0)
  ) {
    return timeParts.reduce((total, part) => total * 60 + part, 0);
  }

  return null;
}

function formatTimelineTime(seconds: number) {
  const roundedSeconds = Math.max(0, Math.round(seconds));
  const hours = Math.floor(roundedSeconds / 3600);
  const minutes = Math.floor((roundedSeconds % 3600) / 60);
  const remainingSeconds = roundedSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

export function VideoFooter() {
  const t = useTranslations("Sidebar.videoFooter");
  const currentProject = useCanvasStore((state) => state.currentProject);
  const currentCanvasData = useCanvasStore((state) => state.currentCanvasData);
  const storeCanvasDataByEpisode = useCanvasStore((state) => state.currentCanvasDataByEpisode);
  const nodes = useCanvasStore((state) => state.nodes);
  const selectedMediaGridItem = useCanvasStore((state) => state.selectedMediaGridItem);
  const open = useLayoutStore((state) => state.videoFooterOpen);
  const onClose = useLayoutStore((state) => state.closeVideoFooter);
  const [canvasDataByEpisode, setCanvasDataByEpisode] = useState<CanvasDataByEpisode>({});

  useEffect(() => {
    let active = true;

    const loadAllStoryboardVideos = async () => {
      if (!currentProject) {
        setCanvasDataByEpisode({});
        return;
      }

      try {
        const episodeEntries = await Promise.all(
          currentProject.episodes.map(async (episode) => [
            episode.id,
            await fetchProjectCanvasData(currentProject.id, episode.id),
          ] as const),
        );

        if (active) setCanvasDataByEpisode(Object.fromEntries(episodeEntries));
      } catch {
        if (active) setCanvasDataByEpisode({});
      }
    };

    void loadAllStoryboardVideos();

    return () => {
      active = false;
    };
  }, [currentProject]);

  const visibleCanvasDataByEpisode = useMemo<CanvasDataByEpisode>(() => {
    const storeData = Object.fromEntries(
      Object.entries(storeCanvasDataByEpisode).map(([episodeId, canvasData]) => [
        episodeId,
        canvasData.data,
      ]),
    );

    // Real-time canvas state wins over disk data so selectedVideo changes appear immediately.
    return {
      ...canvasDataByEpisode,
      ...storeData,
    };
  }, [canvasDataByEpisode, storeCanvasDataByEpisode]);

  const activeStoryboardId = useMemo(() => {
    if (selectedMediaGridItem?.sceneId) return selectedMediaGridItem.sceneId;

    const selectedNode = nodes.find((node) => node.selected && readNodeSceneId(node.data));
    if (selectedNode) return readNodeSceneId(selectedNode.data);

    return currentCanvasData?.data.storyboards[0]?.id ?? "";
  }, [currentCanvasData?.data.storyboards, nodes, selectedMediaGridItem?.sceneId]);

  const activeEpisode = useMemo<ActiveEpisode | null>(() => {
    if (!currentProject) return null;

    const matchedEpisode = currentProject.episodes.find((episode) =>
      visibleCanvasDataByEpisode[episode.id]?.storyboards.some(
        (storyboard) => storyboard.id === activeStoryboardId,
      ),
    );
    if (matchedEpisode) {
      const canvasData = visibleCanvasDataByEpisode[matchedEpisode.id];
      return canvasData ? { canvasData, episode: matchedEpisode } : null;
    }

    if (!currentCanvasData) return null;
    const fallbackEpisode = currentProject.episodes.find(
      (episode) => episode.id === currentCanvasData.episodeId,
    );
    if (!fallbackEpisode) return null;

    return {
      canvasData: currentCanvasData.data,
      episode: fallbackEpisode,
    };
  }, [activeStoryboardId, currentCanvasData, currentProject, visibleCanvasDataByEpisode]);

  const selectedVideos = useMemo<SelectedStoryboardVideo[]>(() => {
    if (!activeEpisode) return [];

    return activeEpisode.canvasData.storyboards.flatMap((storyboard, index) => {
      const videoIds = storyboard.videos.length > 0
        ? storyboard.videos
        : storyboard.selectedVideo
          ? [storyboard.selectedVideo]
          : [];
      if (videoIds.length === 0) return [];

      return videoIds.map((videoId) => {
        const video =
          activeEpisode.canvasData.videos.find((item) => item.id === videoId) ??
          createMissingVideo(videoId);

        return {
          selected: storyboard.selectedVideo === videoId,
          storyboardId: storyboard.id,
          storyboardName: storyboard.name.trim() || t("storyboardFallback", { index: index + 1 }),
          video,
        };
      });
    });
  }, [activeEpisode, t]);
  const timelineVideos = useMemo<TimelineVideo[]>(() => {
    let elapsedSeconds = 0;

    return selectedVideos.map((item) => {
      const durationSeconds = parseVideoDuration(item.video.duration);
      const layoutSeconds = durationSeconds ?? FALLBACK_SEGMENT_SECONDS;
      const timelineItem = {
        ...item,
        durationSeconds,
        layoutSeconds,
        startSeconds: elapsedSeconds,
      };

      elapsedSeconds += layoutSeconds;
      return timelineItem;
    });
  }, [selectedVideos]);
  const totalDurationSeconds = timelineVideos.reduce(
    (total, item) => total + (item.durationSeconds ?? 0),
    0,
  );
  return (
    <div
      className={cn(
        "relative w-full overflow-hidden border-t border-border bg-card/95 text-card-foreground shadow-[0_-18px_50px_rgba(0,0,0,0.34)] backdrop-blur-md",
        !open && "pointer-events-none",
      )}
      style={{
        maxHeight: open ? "12.5rem" : "0rem",
        opacity: open ? 1 : 0,
        transition: "max-height 360ms cubic-bezier(0.22, 1, 0.36, 1), opacity 220ms ease-out",
      }}
      aria-hidden={!open}
    >
      <Button
        type="button"
        size="icon"
        variant="secondary"
        aria-label={t("close")}
        className="absolute top-1 right-2 z-20 rounded-full border border-border bg-card shadow-xl"
        onClick={onClose}
      >
        <X className="size-4" />
      </Button>

      <div className="h-50 w-full px-5 py-4 ">
        <div className="min-w-0">
          <div className="mb-3 flex items-center gap-2">
            <Film className="size-4 text-primary" />
            <h2 className="max-w-80 truncate text-sm font-semibold">
              {activeEpisode?.episode.name ?? t("emptyTitle")}
            </h2>
            <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
              {t("count", { count: selectedVideos.length })}
            </span>
            <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
              {t("totalDuration", { duration: formatTimelineTime(totalDurationSeconds) })}
            </span>
          </div>

          <div className="h-[7.75rem] overflow-x-auto overflow-y-hidden pb-2">
            {timelineVideos.length > 0 ? (
              <div className="flex h-full min-w-full flex-nowrap items-stretch gap-1 border-l border-border">
                {timelineVideos.map(
                  ({
                    durationSeconds,
                    layoutSeconds,
                    selected,
                    startSeconds,
                    storyboardId,
                    storyboardName,
                    video,
                  }) => (
                <article
                  key={`${storyboardId}-${video.id}`}
                  className={cn(
                    "relative h-full shrink-0 overflow-hidden border-y border-r bg-background",
                    selected ? "border-primary" : "border-border",
                  )}
                  style={{
                    width: Math.max(
                      MIN_TIMELINE_SEGMENT_WIDTH,
                      Math.round(layoutSeconds * PIXELS_PER_SECOND),
                    ),
                  }}
                >
                  <div className="flex h-7 items-center justify-between gap-2 border-b border-border px-2 text-[11px] text-muted-foreground">
                    <span>{formatTimelineTime(startSeconds)}</span>
                    <span>
                      {durationSeconds ? formatTimelineTime(durationSeconds) : t("unknownDuration")}
                    </span>
                  </div>
                  <div className="relative h-[4.75rem] bg-muted">
                    <div
                      className={cn(
                        "absolute left-1.5 top-1.5 z-10 max-w-[calc(100%-0.75rem)] rounded-full px-2 py-0.5 text-[11px] font-semibold shadow-sm",
                        selected
                          ? "bg-primary text-primary-foreground"
                          : "bg-background/90 text-foreground",
                      )}
                    >
                      <span className="block truncate">{storyboardName}</span>
                    </div>
                    {video.poster ? (
                      <Image
                        src={video.poster}
                        alt={video.name || storyboardName}
                        fill
                        sizes="160px"
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-muted-foreground">
                        <Video className="size-5" />
                      </div>
                    )}
                  </div>
                  <div className="space-y-1 px-2 py-1">
                    <p className="truncate text-[11px] text-muted-foreground">
                      {video.name || video.id}
                    </p>
                  </div>
                </article>
                  ),
                )}
              </div>
            ) : (
              <div className="flex h-full min-w-full items-center justify-center rounded-md border border-dashed border-border px-4 text-sm text-muted-foreground">
                {t("empty")}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
