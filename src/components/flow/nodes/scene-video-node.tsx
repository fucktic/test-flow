import { memo, useState } from "react";
import { Handle, Position } from "@xyflow/react";
import { SceneVideoNodeData } from "@/lib/types/flow.types";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Upload, Save, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MediaPreviewModal, MediaItem } from "@/components/common/media-preview-modal";
import { getNodeWrapperClassName } from "./utils";

interface SceneVideoNodeProps {
  data: SceneVideoNodeData;
  selected?: boolean;
}

const SceneVideoNode = ({ data, selected }: SceneVideoNodeProps) => {
  const tFlow = useTranslations("flow.sceneVideoNode");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);

  const previewItems: MediaItem[] =
    data.videos?.map((v) => ({
      id: v.id,
      url: v.url,
      type: v.url.endsWith(".mp4") ? "video" : "image",
      poster: v.poster,
    })) || [];

  return (
    <div className="flex flex-col gap-2 w-100 h-100 relative group/node">
      {/* Header */}
      <div className="flex items-center gap-2 px-1">
        <span className="text-sm font-semibold text-foreground">{tFlow("title")}</span>
        <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-sm font-medium">
          {data.sceneId}
        </span>
      </div>

      {/* Main Container */}
      <div className={getNodeWrapperClassName(selected, "flex-col h-full")}>
        {/* Main Video/Image Area */}
        <div className="relative w-full  h-full bg-muted flex items-center justify-center group p-4">
          {data.videos && data.videos.length > 0 ? (
            <div className="w-full h-full grid grid-cols-2 gap-4 ">
              {data.videos.map((video, index) => (
                <div
                  key={video.id}
                  className={cn(
                    "aspect-square relative rounded-lg overflow-hidden border-2 cursor-pointer transition-all group/video",
                    video.selected
                      ? "border-primary shadow-[0_0_0_2px_rgba(0,163,255,0.3)]"
                      : "border-transparent hover:border-border",
                  )}
                  onClick={() => data.onVideoSelect?.(video.id)}
                >
                  {video.url.endsWith(".mp4") ? (
                    <video
                      src={video.url}
                      poster={video.poster}
                      className="w-full h-full object-cover"
                      controls
                      muted
                      playsInline
                    />
                  ) : (
                    <img
                      src={video.url}
                      alt={video.id}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  )}
                  <div className="absolute top-2 right-2 opacity-0 group-hover/video:opacity-100 transition-opacity z-20">
                    <Button
                      variant="secondary"
                      size="icon"
                      className="h-8 w-8 bg-black/40 hover:bg-black/60 text-white/80 hover:text-white rounded-md"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewIndex(index);
                        setPreviewOpen(true);
                      }}
                    >
                      <Maximize2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <span className="text-muted-foreground/50 text-4xl font-bold tracking-widest">
              {tFlow("vid")}
            </span>
          )}

          {/* Bottom Left: Upload & Save to Asset */}
          <div className="absolute bottom-3 left-3 flex items-center gap-3">
            <button
              onClick={data.onUploadCustom}
              className="p-1.5 bg-black/40 hover:bg-black/60 text-white/80 hover:text-white rounded-md transition-colors"
              title="Upload Custom"
            >
              <Upload className="w-4 h-4" />
            </button>
            {data.assetPath && (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-black/40 text-white/80 rounded-md text-xs font-mono">
                {data.assetPath}
                <button
                  onClick={data.onSaveAsset}
                  className="ml-1 hover:text-white transition-colors"
                  title="Save to Assets"
                >
                  <Save className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Connection Handles */}
      <Handle
        type="target"
        position={Position.Left}
        className="w-4! h-4! flex items-center justify-center bg-background border border-border hover:bg-primary/80 transition-colors group-hover/node z-10"
      ></Handle>

      <MediaPreviewModal
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        items={previewItems}
        initialIndex={previewIndex}
      />
    </div>
  );
};

export default memo(SceneVideoNode);
