"use client";

import { Film, Pause, Play, Video, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  clearProjectStoryboardSelectedVideo,
  fetchProjectCanvasData,
  type ProjectCanvasData,
} from "@/lib/project-api";
import type { ProjectEpisode, ProjectVideoAsset } from "@/lib/project-types";
import { cn } from "@/lib/utils";
import { useCanvasStore } from "@/store/use-canvas-store";
import { useLayoutStore } from "@/store/use-layout-store";
import { VideoFooterCard } from "./components/video-footer-card";
import { VideoFooterPlayer } from "./components/video-footer-player";

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
const SLIDER_THUMB_SIZE_PIXELS = 12;

function createMissingVideo(videoId: string): ProjectVideoAsset {
  return {
    id: videoId,
    cover: "",
    coverUrl: "",
    duration: "",
    name: videoId,
    poster: "",
    prompt: "",
    source: "",
    status: "",
    url: "",
  };
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
  const activeEpisodeIdFromStore = useCanvasStore((state) => state.activeEpisodeId);
  const selectedEpisodeIds = useCanvasStore((state) => state.selectedEpisodeIds);
  const open = useLayoutStore((state) => state.videoFooterOpen);
  const onClose = useLayoutStore((state) => state.closeVideoFooter);
  const toggleVideoFooter = useLayoutStore((state) => state.toggleVideoFooter);
  const clearStoryboardSelectedVideo = useCanvasStore(
    (state) => state.clearStoryboardSelectedVideo,
  );
  const [canvasDataByEpisode, setCanvasDataByEpisode] = useState<CanvasDataByEpisode>({});
  const [playback, setPlayback] = useState({ playheadSeconds: 0, playing: false });
  const [playerVisible, setPlayerVisible] = useState(false);
  const [pendingDeleteVideo, setPendingDeleteVideo] = useState<SelectedStoryboardVideo | null>(
    null,
  );
  const playerRef = useRef<HTMLVideoElement>(null);
  const selectedEpisodeKey = selectedEpisodeIds.join(",");
  const fallbackEpisodeId = currentProject?.episodes[0]?.id ?? "";
  const currentProjectId = currentProject?.id ?? "";

  useEffect(() => {
    let active = true;
    const episodeIds =
      selectedEpisodeKey.length > 0
        ? selectedEpisodeKey.split(",")
        : fallbackEpisodeId
          ? [fallbackEpisodeId]
          : [];

    const loadAllStoryboardVideos = async () => {
      if (!currentProjectId) {
        setCanvasDataByEpisode({});
        return;
      }

      try {
        const episodeEntries = await Promise.all(
          episodeIds.map(async (episodeId) => [
            episodeId,
            await fetchProjectCanvasData(currentProjectId, episodeId),
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
  }, [currentProjectId, fallbackEpisodeId, selectedEpisodeKey]);

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

  const activeEpisode = useMemo<ActiveEpisode | null>(() => {
    if (!currentProject) return null;

    const activeEpisodeFromStore = currentProject.episodes.find(
      (episode) => episode.id === activeEpisodeIdFromStore,
    );
    if (activeEpisodeFromStore) {
      const canvasData = visibleCanvasDataByEpisode[activeEpisodeFromStore.id];
      return canvasData ? { canvasData, episode: activeEpisodeFromStore } : null;
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
  }, [
    activeEpisodeIdFromStore,
    currentCanvasData,
    currentProject,
    visibleCanvasDataByEpisode,
  ]);

  const selectedVideos = useMemo<SelectedStoryboardVideo[]>(() => {
    if (!activeEpisode) return [];

    return activeEpisode.canvasData.storyboards.flatMap((storyboard, index) => {
      if (!storyboard.selectedVideo) return [];

      const video =
        activeEpisode.canvasData.videos.find((item) => item.id === storyboard.selectedVideo) ??
        createMissingVideo(storyboard.selectedVideo);

      return [
        {
          selected: true,
          storyboardId: storyboard.id,
          storyboardName: storyboard.name.trim() || t("storyboardFallback", { index: index + 1 }),
          video,
        },
      ];
    });
  }, [activeEpisode, t]);
  const timelineVideos = useMemo<TimelineVideo[]>(() => {
    return selectedVideos.reduce<{ elapsedSeconds: number; items: TimelineVideo[] }>(
      (timeline, item) => {
        const durationSeconds = parseVideoDuration(item.video.duration);
        const layoutSeconds = durationSeconds ?? FALLBACK_SEGMENT_SECONDS;

        return {
          elapsedSeconds: timeline.elapsedSeconds + layoutSeconds,
          items: [
            ...timeline.items,
            {
              ...item,
              durationSeconds,
              layoutSeconds,
              startSeconds: timeline.elapsedSeconds,
            },
          ],
        };
      },
      { elapsedSeconds: 0, items: [] },
    ).items;
  }, [selectedVideos]);
  const totalDurationSeconds = timelineVideos.reduce(
    (total, item) => total + item.layoutSeconds,
    0,
  );
  const roundedTotalDurationSeconds = Math.max(0, Math.round(totalDurationSeconds));
  const visiblePlayheadSeconds = Math.min(playback.playheadSeconds, roundedTotalDurationSeconds);
  const remainingSeconds = Math.max(
    0,
    roundedTotalDurationSeconds - Math.round(visiblePlayheadSeconds),
  );
  const playbackDisabled = roundedTotalDurationSeconds <= 0;
  const playbackPlaying = playback.playing && !playbackDisabled;
  const currentTimelineVideo =
    timelineVideos.find(
      (timelineVideo) =>
        visiblePlayheadSeconds >= timelineVideo.startSeconds &&
        visiblePlayheadSeconds < timelineVideo.startSeconds + timelineVideo.layoutSeconds,
    ) ?? timelineVideos.at(-1);
  const currentVideoStartSeconds = currentTimelineVideo?.startSeconds ?? 0;
  const currentVideoOffsetSeconds = Math.max(0, visiblePlayheadSeconds - currentVideoStartSeconds);

  useEffect(() => {
    const player = playerRef.current;
    if (!player || !currentTimelineVideo) return;

    if (
      Number.isFinite(currentVideoOffsetSeconds) &&
      Math.abs(player.currentTime - currentVideoOffsetSeconds) > 0.35
    ) {
      player.currentTime = Math.max(0, currentVideoOffsetSeconds);
    }

    if (playbackPlaying) {
      void player.play().catch(() => {
        setPlayback((currentPlayback) => ({ ...currentPlayback, playing: false }));
      });
      return;
    }

    player.pause();
  }, [
    currentTimelineVideo?.video.id,
    currentVideoOffsetSeconds,
    playbackPlaying,
    currentTimelineVideo,
  ]);

  const handlePlayerTimeUpdate = useCallback(() => {
    const player = playerRef.current;
    if (!player || !currentTimelineVideo) return;

    const nextSeconds = Math.min(
      currentTimelineVideo.startSeconds + player.currentTime,
      roundedTotalDurationSeconds,
    );

    setPlayback((currentPlayback) => ({
      ...currentPlayback,
      playheadSeconds: nextSeconds,
    }));
  }, [currentTimelineVideo, roundedTotalDurationSeconds]);

  const handlePlayerEnded = useCallback(() => {
    if (!currentTimelineVideo) return;

    const currentIndex = timelineVideos.findIndex(
      (timelineVideo) =>
        timelineVideo.storyboardId === currentTimelineVideo.storyboardId &&
        timelineVideo.video.id === currentTimelineVideo.video.id,
    );
    const nextTimelineVideo = timelineVideos[currentIndex + 1];

    setPlayback({
      playheadSeconds: nextTimelineVideo?.startSeconds ?? 0,
      playing: Boolean(nextTimelineVideo),
    });
  }, [currentTimelineVideo, timelineVideos]);

  const handleConfirmDeleteSelectedVideo = () => {
    if (!pendingDeleteVideo || !currentProjectId) return;

    const { storyboardId, video } = pendingDeleteVideo;
    clearStoryboardSelectedVideo(storyboardId, video.id);
    setPendingDeleteVideo(null);
    if (currentTimelineVideo?.video.id === video.id) {
      playerRef.current?.pause();
      setPlayback({ playheadSeconds: 0, playing: false });
      setPlayerVisible(false);
    }

    void clearProjectStoryboardSelectedVideo(currentProjectId, storyboardId, video.id).catch(() => {
      // Local state is already updated; another delete attempt can retry persistence.
    });
  };

  return (
    <>
      {!open ? (
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={t("open")}
                className="fixed bottom-4 left-1/2 z-30 flex size-9 -translate-x-1/2 items-center justify-center rounded-lg border bg-card text-muted-foreground shadow-xl transition-colors hover:bg-accent hover:text-foreground"
                onClick={toggleVideoFooter}
              >
                <Video className="size-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>{t("open")}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : null}
      {open &&
      playerVisible &&
      currentTimelineVideo?.video.url ? (
        <VideoFooterPlayer
          ref={playerRef}
          closeLabel={t("close")}
          onEnded={handlePlayerEnded}
          onClose={() => {
            playerRef.current?.pause();
            setPlayback((currentPlayback) => ({ ...currentPlayback, playing: false }));
            setPlayerVisible(false);
          }}
          onTimeUpdate={handlePlayerTimeUpdate}
          video={currentTimelineVideo.video}
        />
      ) : null}
      <div
        className={cn(
          "relative w-full border-t border-border bg-card/95 text-card-foreground shadow-[0_-18px_50px_rgba(0,0,0,0.34)] backdrop-blur-md",
          open ? "overflow-visible" : "overflow-hidden",
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

        <div className="flex h-50 w-full flex-col px-5 py-3">
          <div className="mb-2 flex shrink-0 items-center gap-2">
            <Film className="size-4 text-primary" />
            <h2 className="max-w-80 truncate text-sm font-semibold">
              {activeEpisode?.episode.name ?? t("emptyTitle")}
            </h2>
            <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
              {t("count", { count: selectedVideos.length })}
            </span>
          </div>

          <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden pb-1">
            {timelineVideos.length > 0 ? (
              <div className="flex h-full min-w-full flex-nowrap items-stretch">
                {timelineVideos.map((timelineVideo) => (
                  <VideoFooterCard
                    key={`${timelineVideo.storyboardId}-${timelineVideo.video.id}`}
                    deleteLabel={t("removeSelectedVideo")}
                    durationLabel={
                      timelineVideo.durationSeconds
                        ? formatTimelineTime(timelineVideo.durationSeconds)
                        : t("unknownDuration")
                    }
                    onDelete={() => setPendingDeleteVideo(timelineVideo)}
                    onSelect={() => {
                      setPlayerVisible(true);
                      setPlayback({
                        playheadSeconds: timelineVideo.startSeconds,
                        playing: false,
                      });
                    }}
                    selected={timelineVideo.selected}
                    storyboardId={timelineVideo.storyboardId}
                    storyboardName={timelineVideo.storyboardName}
                    video={timelineVideo.video}
                    durationWeight={timelineVideo.layoutSeconds}
                  />
                ))}
              </div>
            ) : (
              <div className="flex h-full min-w-full items-center justify-center rounded-md border border-dashed border-border px-4 text-sm text-muted-foreground">
                {t("empty")}
              </div>
            )}
          </div>
          <div
            id="video-footer-total-duration"
            className="mx-auto mt-2 flex h-7 w-full max-w-200 min-w-0 shrink-0 items-center gap-3"
          >
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label={playbackPlaying ? t("pause") : t("play")}
              disabled={playbackDisabled}
              className="shrink-0 rounded-full border border-border bg-background/70"
              onClick={() => {
                setPlayerVisible(true);
                setPlayback((currentPlayback) => ({
                  playheadSeconds:
                    visiblePlayheadSeconds >= roundedTotalDurationSeconds
                      ? 0
                      : currentPlayback.playheadSeconds,
                  playing: !currentPlayback.playing,
                }));
              }}
            >
              {playbackPlaying ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
            </Button>
            <div className="relative flex-1">
              <Slider
                aria-label={t("playbackProgress")}
                className="relative z-2"
                disabled={playbackDisabled}
                max={roundedTotalDurationSeconds || 1}
                min={0}
                step={1}
                value={[visiblePlayheadSeconds]}
                
                onValueChange={(value) => {
                  const nextSeconds = value[0] ?? 0;
                  setPlayback((currentPlayback) => ({
                    playheadSeconds: nextSeconds,
                    playing:
                      nextSeconds >= roundedTotalDurationSeconds ? false : currentPlayback.playing,
                  }));
                }}
              />
              {timelineVideos.slice(1).map((timelineVideo) => {
                const markerPercent =
                  roundedTotalDurationSeconds > 0
                    ? (timelineVideo.startSeconds / roundedTotalDurationSeconds) * 100
                    : 0;
                const markerOffsetPixels =
                  SLIDER_THUMB_SIZE_PIXELS / 2 -
                  (markerPercent / 100) * SLIDER_THUMB_SIZE_PIXELS;

                return (
                  <button
                    key={`${timelineVideo.storyboardId}-${timelineVideo.video.id}-marker`}
                    type="button"
                    aria-label={timelineVideo.storyboardName}
                    className="absolute top-1/2 z-0 h-4 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-muted shadow-sm transition-[height,background-color] hover:h-5 hover:bg-primary disabled:pointer-events-none disabled:opacity-50"
                    disabled={playbackDisabled}
                    style={{ left: `calc(${markerPercent}% + ${markerOffsetPixels}px)` }}
                    onClick={() => {
                      setPlayerVisible(true);
                      setPlayback({
                        playheadSeconds: timelineVideo.startSeconds,
                        playing: true,
                      });
                    }}
                  />
                );
              })}
            </div>
            <span className="w-14 shrink-0 text-right font-mono text-xs text-muted-foreground">
              -{formatTimelineTime(remainingSeconds)}
            </span>
          </div>
        </div>
      </div>
      <Dialog
        open={pendingDeleteVideo !== null}
        onOpenChange={(openDialog) => {
          if (!openDialog) setPendingDeleteVideo(null);
        }}
      >
        <DialogContent className="w-[min(92vw,420px)]" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{t("removeSelectedVideoTitle")}</DialogTitle>
            <DialogDescription className="mt-2">
              {t("removeSelectedVideoDescription", {
                name: pendingDeleteVideo?.video.name || pendingDeleteVideo?.video.id || "",
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setPendingDeleteVideo(null)}>
              {t("cancel")}
            </Button>
            <Button type="button" variant="destructive" onClick={handleConfirmDeleteSelectedVideo}>
              {t("confirmRemove")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
