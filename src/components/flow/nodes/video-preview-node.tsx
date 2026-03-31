import { memo, useCallback, useState } from "react";
import { VideoPreviewNodeData, EpisodeVideoData } from "@/lib/types/flow.types";
import { useTranslations } from "next-intl";
import { Download, Film, Maximize2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { MediaPreviewModal, MediaItem } from "@/components/common/media-preview-modal";
import { toast } from "sonner";
import { getNodeWrapperClassName } from "./utils";

interface VideoPreviewNodeProps {
  data: VideoPreviewNodeData;
  selected?: boolean;
}

const VideoPreviewNode = ({ data }: VideoPreviewNodeProps) => {
  const tFlow = useTranslations("flow.videoPreviewNode");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);

  // Flatten all items across episodes for the preview modal
  const allPreviewItems: MediaItem[] = (data.episodes || []).flatMap((ep) =>
    (ep.items || [])
      .filter((item) => item.status === "generated" && item.url)
      .map((item) => ({
        id: item.id,
        url: item.url!,
        type: item.url?.endsWith(".mp4") ? "video" : "image",
        poster: item.poster,
      })),
  );

  const handleDownloadEpisode = useCallback(
    async (episode: EpisodeVideoData) => {
      const episodeItems = (episode.items || [])
        .filter((item) => item.status === "generated" && item.url)
        .map((item) => ({
          id: item.id,
          url: item.url!,
          type: item.url?.endsWith(".mp4") ? "video" : "image",
        }));

      if (episodeItems.length === 0) {
        toast.warning(tFlow("noVideosToDownload") || "暂无视频可下载");
        return;
      }

      try {
        // @ts-ignore: File System Access API
        const dirHandle = await window.showDirectoryPicker({
          mode: "readwrite",
        });

        let successCount = 0;
        for (const item of episodeItems) {
          if (!item.url) continue;
          try {
            const response = await fetch(item.url);
            if (!response.ok) throw new Error(`Failed to fetch ${item.url}`);
            const blob = await response.blob();

            let filename = item.url.split("/").pop() || `${item.id}`;
            const defaultExt = item.type === "video" ? ".mp4" : ".png";
            if (!filename.includes(".")) {
              filename += defaultExt;
            }

            const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(blob);
            await writable.close();
            successCount++;
          } catch (err) {
            console.error(`Failed to download item ${item.id}:`, err);
          }
        }

        if (successCount > 0) {
          toast.success(
            tFlow("downloadSuccess", { count: successCount }) || `成功下载 ${successCount} 个文件`,
          );
          if (data.onDownloadEpisode) {
            data.onDownloadEpisode(episode.episodeId);
          }
        } else {
          toast.error(tFlow("downloadFailed") || "下载失败");
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          return; // 用户取消选择目录
        }
        console.error("Directory selection failed:", err);
        toast.error(tFlow("directorySelectionFailed") || "目录选择失败");
      }
    },
    [tFlow, data],
  );

  return (
    <div className="flex flex-col gap-2 w-lg relative group/node">
      <div className="text-sm font-semibold text-foreground px-1">{tFlow("title")}</div>
      <div className={getNodeWrapperClassName(false, "flex flex-col h-lg relative")}>
        <ScrollArea className="flex-1 nodrag nowheel overflow-y-auto p-4 [&_[data-slot=scroll-area-viewport]>div]:flex! [&_[data-slot=scroll-area-viewport]>div]:flex-col!">
          <ul className="flex flex-col gap-2 mt-2 w-full max-w-full">
            {(data.episodes || []).map((episode) => (
              <li
                key={episode.episodeId}
                className="flex flex-col group w-full gap-3 relative overflow-hidden mb-4 border-b border-border/50 pb-4 last:border-0 last:pb-0 last:mb-0"
              >
                <div className="flex items-center justify-between w-full gap-2">
                  <div
                    className="text-sm transition-colors flex-1 overflow-hidden text-foreground flex items-center"
                    title={episode.episodeName}
                  >
                    <div className="truncate font-medium">{episode.episodeName}</div>
                  </div>
                  <div className="flex items-center h-full shrink-0 gap-x-2">
                    <div className="text-xs text-muted-foreground   w-fit px-2 py-1 ">
                      {episode.selectedVideos} / {episode.totalScenes}
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-3 text-xs hover:bg-background border border-border/50"
                      onClick={() => handleDownloadEpisode(episode)}
                    >
                      <Download className="w-3.5 h-3.5 mr-1.5" />
                      {tFlow("downloadEpisode") || "分集下载"}
                    </Button>
                  </div>
                </div>

                {/* 视频宫格内容 */}
                <ScrollArea className="h-48 w-full pr-3 shrink-0 overflow-y-auto">
                  <div className="grid grid-cols-3 gap-2 pb-2">
                    {(episode.items || []).map((item) => (
                      <div
                        key={item.id}
                        className="relative aspect-square rounded-lg overflow-hidden border border-border/50 group/preview bg-black"
                      >
                        {/* 左上角 ID 徽章 */}
                        <div className="absolute top-1.5 left-1.5 px-1 py-0.5 bg-black/60 backdrop-blur-sm text-white/90 rounded text-[9px] font-medium z-10">
                          {item.id}
                        </div>

                        {item.status === "generated" && item.url ? (
                          <>
                            <img
                              src={item.poster || item.url}
                              alt={item.id}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                            {/* 悬浮查看按钮 */}
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/preview:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                              <Button
                                variant="secondary"
                                size="icon"
                                className="w-8 h-8 rounded-full shadow-lg"
                                onClick={() => {
                                  const index = allPreviewItems.findIndex((p) => p.id === item.id);
                                  if (index !== -1) {
                                    setPreviewIndex(index);
                                    setPreviewOpen(true);
                                  }
                                }}
                              >
                                <Maximize2 className="w-4 h-4" />
                              </Button>
                            </div>
                            {/* 右下角时长徽章 */}
                            {item.duration && (
                              <div className="absolute bottom-1.5 right-1.5 px-1 py-0.5 bg-black/60 backdrop-blur-sm text-white/90 rounded text-[9px] font-medium z-10">
                                {item.duration}
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs bg-muted/30">
                            {tFlow("pending")}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </li>
            ))}
          </ul>

          {(!data.episodes || data.episodes.length === 0) && (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
              <Film className="w-8 h-8 opacity-20 mb-2" />
              <span className="text-sm">暂无选中的分集视频</span>
            </div>
          )}
        </ScrollArea>
      </div>

      <MediaPreviewModal
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        items={allPreviewItems}
        initialIndex={previewIndex}
      />
    </div>
  );
};

export default memo(VideoPreviewNode);
