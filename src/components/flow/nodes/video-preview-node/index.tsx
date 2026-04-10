import { memo, useCallback, useState, useMemo } from "react";
import { VideoPreviewNodeData, EpisodeVideoData } from "@/lib/types/flow.types";
import { useTranslations } from "next-intl";
import { Download, Film, Maximize2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { LazyImage } from "@/components/common/lazy-image";
import { MediaPreviewModal, MediaItem } from "@/components/common/media-preview-modal";
import { toast } from "sonner";
import { getNodeWrapperClassName } from "../utils";
import { useProjectStore } from "@/lib/store/use-projects";
import { generateId } from "@/lib/utils/uuid";

interface VideoPreviewNodeProps {
  data: VideoPreviewNodeData;
  selected?: boolean;
}

const VideoPreviewNode = ({ data }: VideoPreviewNodeProps) => {
  const tFlow = useTranslations("flow.videoPreviewNode");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const currentProject = useProjectStore((state) => state.currentProject);

  // Flatten all items across episodes for the preview modal
  const allPreviewItems: MediaItem[] = useMemo(() => {
    return (data.episodes || []).flatMap((ep) =>
      (ep.items || [])
        .filter((item) => item.status === "generated" && item.url)
        .map((item) => ({
          id: item.id,
          url: item.url!,
          type: item.url?.endsWith(".mp4") ? "video" : "image",
          poster: item.poster,
        })),
    );
  }, [data.episodes, currentProject]);

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
        const dirHandle = await (window as any).showDirectoryPicker({
          mode: "readwrite",
        });

        // 获取当前时间格式化字符串，作为时间戳
        const now = new Date();
        const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
        const folderName = `${episode.episodeName}_${timestamp}`;

        // 在用户选择的目录下，创建一个以“分集名称+时间戳”命名的新文件夹
        const episodeDirHandle = await dirHandle.getDirectoryHandle(folderName, { create: true });

        let successCount = 0;
        let index = 1;
        for (const item of episodeItems) {
          if (!item.url) continue;
          try {
            const fetchUrl = item.url;
            const response = await fetch(fetchUrl);
            if (!response.ok) throw new Error(`Failed to fetch ${fetchUrl}`);
            const blob = await response.blob();

            const urlMatch = item.url.match(/\.([a-zA-Z0-9]+)(?:[?#]|$)/);
            const defaultExt = item.type === "video" ? ".mp4" : ".png";
            const ext = urlMatch ? `.${urlMatch[1]}` : defaultExt;

            // 使用序号作为文件名，并结合国际化的分镜前缀 (格式如: 分镜1.mp4 或 Scene 1.mp4)
            const scenePrefix = tFlow("scenePrefix") || "分镜";
            const filename = `${scenePrefix}${index}${ext}`;

            // 将文件保存到刚创建的分集文件夹中
            const fileHandle = await episodeDirHandle.getFileHandle(filename, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(blob);
            await writable.close();
            successCount++;
            index++;
          } catch (err) {
            console.error(`Failed to download item ${item.id}:`, err);
          }
        }

        if (successCount > 0) {
          toast.success(
            tFlow("downloadSuccess", { count: successCount }) || `成功下载 ${successCount} 个文件`,
          );
          if (data.onDownloadEpisode) {
            data.onDownloadEpisode(episode.id);
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
    [tFlow, data, currentProject],
  );

  const getUrlWithTimestamp = (url?: string) => {
    if (!url) return url;
    if (url.startsWith("data:") || url.startsWith("blob:")) return url;
    const timestamp = Date.now();
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}t=${timestamp}`;
  };

  return (
    <div className="flex flex-col gap-2 w-lg relative group/node">
      <div className="text-sm font-semibold text-foreground px-1">{tFlow("title")}</div>
      <div className={getNodeWrapperClassName(false, "flex flex-col h-lg relative")}>
        <ScrollArea className="flex-1 nodrag nowheel overflow-y-auto p-4 [&_[data-slot=scroll-area-viewport]>div]:flex! [&_[data-slot=scroll-area-viewport]>div]:flex-col!">
          <ul className="flex flex-col gap-2 mt-2 w-full max-w-full">
            {(data.episodes || []).map((episode) => (
              <li
                key={generateId()}
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
                        key={generateId()}
                        className="relative aspect-square rounded-lg overflow-hidden border border-border/50 group/preview "
                      >
                        {item.status === "generated" && item.url ? (
                          <>
                            {item.poster ? (
                              <LazyImage
                                src={getUrlWithTimestamp(item.poster)}
                                alt={item.id}
                                className="w-full h-full object-cover"
                              />
                            ) : item.url.match(/\.(mp4|webm|mov)$/i) ||
                              item.url.startsWith("data:video/") ? (
                              <video
                                src={getUrlWithTimestamp(item.url)}
                                className="w-full h-full object-cover"
                                muted
                                playsInline
                              />
                            ) : (
                              <LazyImage
                                src={getUrlWithTimestamp(item.url)}
                                alt={item.id}
                                className="w-full h-full object-cover"
                              />
                            )}
                            {/* 悬浮查看按钮 */}
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/preview:opacity-100 transition-opacity flex items-center justify-center rounded-lg backdrop-blur-[2px]">
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
