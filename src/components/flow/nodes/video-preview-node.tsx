import { memo, useCallback, useState } from "react";
import { Handle, Position } from "@xyflow/react";
import { VideoPreviewNodeData } from "@/lib/types/flow.types";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { RefreshCcw, Download, Plus, Maximize2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { MediaPreviewModal, MediaItem } from "@/components/common/media-preview-modal";
import { toast } from "sonner";

interface VideoPreviewNodeProps {
  data: VideoPreviewNodeData;
}

const VideoPreviewNode = ({ data }: VideoPreviewNodeProps) => {
  const tFlow = useTranslations("flow.videoPreviewNode");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);

  const progressPercent =
    data.progress.total > 0 ? (data.progress.current / data.progress.total) * 100 : 0;

  const previewItems: MediaItem[] = data.items
    .filter((item) => item.status === "generated" && item.url)
    .map((item) => ({
      id: item.id,
      url: item.url!,
      type: item.url?.endsWith(".mp4") ? "video" : "image",
      poster: item.poster,
    }));

  const handleDownload = useCallback(async () => {
    try {
      if (previewItems.length === 0) {
        toast.warning(tFlow("noVideosToDownload") || "暂无视频可下载");
        return;
      }

      // @ts-ignore: File System Access API
      const dirHandle = await window.showDirectoryPicker({
        mode: "readwrite",
      });

      let successCount = 0;
      for (const item of previewItems) {
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
  }, [previewItems, tFlow]);

  return (
    <div className="flex flex-col gap-2 w-160 h-160 relative group/node">
      {/* Header */}
      <div className="flex items-center gap-2 px-1">
        <span className="text-lg font-semibold text-foreground">
          {tFlow("title")} {data.episodeId}
        </span>
      </div>

      {/* Main Container */}
      <div className="flex-1 flex flex-col bg-card border border-border rounded-xl shadow-sm p-4 gap-4">
        {/* Top Control Bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              className="h-8 bg-muted/50 border-transparent hover:border-border text-xs"
              onClick={data.onRefresh}
            >
              <RefreshCcw className="w-3.5 h-3.5 mr-1.5" />
              {tFlow("refresh")}
            </Button>
            <div className="text-sm text-muted-foreground">
              {tFlow("progress")}: {data.progress.current}/{data.progress.total}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-md text-xs font-mono text-muted-foreground hover:bg-muted active:bg-muted/70 cursor-pointer"
                    onClick={handleDownload}
                  >
                    <div>{data.vid}</div>
                    <Download className="w-4 h-4" />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{tFlow("downloadAll")}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {/* Progress Bar */}
        <Progress value={progressPercent} className="h-1.5" />

        {/* Grid Content */}
        <ScrollArea className="h-full w-full pr-4">
          <div className="grid grid-cols-5 gap-4">
            {data.items.map((item) => {
              const generatedIndex = previewItems.findIndex((p) => p.id === item.id);

              return (
                <div
                  key={item.id}
                  className={cn(
                    "relative aspect-square rounded-lg overflow-hidden border border-border/50 group/preview",
                    item.status === "pending" ? "bg-muted/30" : "bg-black",
                  )}
                >
                  {/* Top Left ID Badge */}
                  <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-black/60 backdrop-blur-sm text-white/90 rounded text-[10px] font-medium z-10">
                    {item.id}
                  </div>

                  {item.status === "generated" && item.url ? (
                    <>
                      {item.url.endsWith(".mp4") ? (
                        <video
                          src={item.url}
                          poster={item.poster}
                          className="w-full h-full object-cover"
                          controls
                          muted
                          playsInline
                        />
                      ) : (
                        <img
                          src={item.url}
                          alt={item.id}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      )}
                      {/* Bottom Right Duration Badge */}
                      {item.duration && (
                        <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/60 backdrop-blur-sm text-white/90 rounded text-[10px] font-medium z-10">
                          {item.duration}
                        </div>
                      )}

                      <div className="absolute top-2 right-2 opacity-0 group-hover/preview:opacity-100 transition-opacity z-20">
                        <Button
                          variant="secondary"
                          size="icon"
                          className="h-7 w-7 bg-black/40 hover:bg-black/60 text-white/80 hover:text-white rounded-md"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (generatedIndex !== -1) {
                              setPreviewIndex(generatedIndex);
                              setPreviewOpen(true);
                            }
                          }}
                        >
                          <Maximize2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
                      {tFlow("pending")}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      {/* Connection Handles */}
      <Handle
        type="target"
        position={Position.Left}
        className="w-6! h-6! flex items-center justify-center bg-background! border border-border! hover:bg-primary/80! transition-colors group-hover/node"
      >
        <Plus className="size-4 m-auto text-muted-foreground group-hover/node:text-white!" />
      </Handle>

      <MediaPreviewModal
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        items={previewItems}
        initialIndex={previewIndex}
      />
    </div>
  );
};

export default memo(VideoPreviewNode);
