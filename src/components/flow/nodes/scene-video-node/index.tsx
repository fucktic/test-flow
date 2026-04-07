import { memo, useState, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import { Handle, Position } from "@xyflow/react";
import { SceneVideoNodeData } from "@/lib/types/flow.types";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Upload, Save, Maximize2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MediaPreviewModal } from "@/components/common/media-preview-modal";
import { getNodeWrapperClassName } from "../utils";
import { useFlowStore } from "@/lib/store/use-flow";
import { useProjectStore } from "@/lib/store/use-projects";
import { VideoDeleteDialog } from "./components/video-delete-dialog";

interface SceneVideoNodeProps {
  id: string;
  data: SceneVideoNodeData;
  selected?: boolean;
}

const SceneVideoNode = ({ id, data, selected }: SceneVideoNodeProps) => {
  const tFlow = useTranslations("flow.sceneVideoNode");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const updateNodeData = useFlowStore((state) => state.updateNodeData);
  const currentProject = useProjectStore((state) => state.currentProject);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentProject) return;

    try {
      if (!file.type.startsWith("video/")) {
        console.error("Only video files are allowed");
        return;
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "video");
      formData.append("id", data.id || "S-x");

      const res = await fetch(`/api/projects/${currentProject.id}/upload`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Upload failed");

      const { url } = await res.json();

      // 提取视频首帧作为封面
      const video = document.createElement("video");
      video.src = url;
      video.crossOrigin = "anonymous";
      video.muted = true;
      video.playsInline = true;

      video.onloadeddata = () => {
        // 定位到第一帧
        video.currentTime = 0.1; // 使用 0.1s 避免某些视频第一帧为空白
      };

      video.onseeked = async () => {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          // 获取 base64 用于回退或直接转换为 blob
          const base64Url = canvas.toDataURL("image/jpeg", 0.8);
          let finalPosterUrl = base64Url;

          try {
            // 将 base64 转换为 blob 并作为封面上传到服务器保存至文件夹
            const fetchRes = await fetch(base64Url);
            const blob = await fetchRes.blob();
            const posterFile = new File([blob], `${uuidv4()}.jpg`, {
              type: "image/jpeg",
            });

            const posterFormData = new FormData();
            posterFormData.append("file", posterFile);
            posterFormData.append("type", "image");
            posterFormData.append("id", data.id || "S-x");

            const uploadRes = await fetch(`/api/projects/${currentProject.id}/upload`, {
              method: "POST",
              body: posterFormData,
            });

            if (uploadRes.ok) {
              const uploadData = await uploadRes.json();
              finalPosterUrl = uploadData.url;
            } else {
              console.error("Failed to upload poster, falling back to base64");
            }
          } catch (error) {
            console.error("Error uploading poster:", error);
          }

          const newVideo = {
            id: uuidv4(),
            url: url,
            poster: finalPosterUrl,
            selected: true,
          };
          const existingVideos = data.videos
            ? data.videos.map((v) => ({ ...v, selected: false }))
            : [];
          updateNodeData(id, {
            videos: [...existingVideos, newVideo],
          });
        }
      };
    } catch (error) {
      console.error("Failed to upload video:", error);
    }
    e.target.value = ""; // 重置 input 状态
  };

  const handleDeleteVideo = () => {
    if (!deleteId) return;

    if (data.videos && data.videos.length > 0) {
      const newVideos = data.videos.filter((v) => v.id !== deleteId);
      // Ensure one video is selected if the selected one was deleted
      if (newVideos.length > 0 && !newVideos.some((v) => v.selected)) {
        newVideos[0].selected = true;
      }
      updateNodeData(id, { videos: newVideos });
    }

    setDeleteOpen(false);
    setDeleteId(null);
  };

  const previewItems =
    data.videos?.map((v) => {
      const isVideo = v.url.match(/\.(mp4|webm|mov)$/i) || v.url.startsWith("data:video/");
      return {
        id: v.id,
        url: v.url,
        type: (isVideo ? "video" : "image") as "image" | "video",
        poster: v.poster,
      };
    }) || [];

  return (
    <div className="flex flex-col gap-2 w-100 h-100 relative group/node">
      {/* Header */}
      <div className="flex items-center gap-2 px-1">
        <span className="text-sm font-semibold text-foreground">{tFlow("title")}</span>
        <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-sm font-medium">
          {data.id}
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
                  {video.poster ? (
                    <img
                      src={video.poster}
                      alt={video.id}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : video.url.match(/\.(mp4|webm|mov)$/i) ||
                    video.url.startsWith("data:video/") ? (
                    <video
                      src={video.url}
                      className="w-full h-full object-cover"
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
                  {video.selected && (
                    <div className="absolute inset-0 border-2 border-primary rounded-lg pointer-events-none z-10" />
                  )}
                  {/* Hover Actions */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/video:opacity-100 transition-opacity z-20">
                    <Button
                      variant="secondary"
                      size="icon"
                      className="h-10 w-10 bg-black/40 hover:bg-black/60 text-white/80 hover:text-white rounded-md"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewIndex(index);
                        setPreviewOpen(true);
                      }}
                    >
                      <Maximize2 className="w-5 h-5" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute -top-1 -right-1 h-8 w-8 bg-muted hover:bg-destructive text-destructive/80 hover:text-white rounded-none rounded-bl-xl"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteId(video.id);
                        setDeleteOpen(true);
                      }}
                    >
                      <Trash2 className="w-4 h-4 " />
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
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="video/*"
              onChange={handleFileChange}
            />
            <button
              onClick={() => {
                fileInputRef.current?.click();
                data.onUploadCustom?.();
              }}
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
        id="in"
        position={Position.Left}
        className="w-4! h-4! flex items-center justify-center bg-background border border-border hover:bg-primary/80 transition-colors group-hover/node z-10"
      ></Handle>

      <MediaPreviewModal
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        items={previewItems}
        initialIndex={previewIndex}
      />

      <VideoDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={handleDeleteVideo}
        onCancel={() => setDeleteOpen(false)}
      />
    </div>
  );
};

export default memo(SceneVideoNode);
