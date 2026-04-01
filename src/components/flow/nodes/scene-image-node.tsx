import { memo, useState, useRef } from "react";
import { Handle, Position } from "@xyflow/react";
import { SceneImageNodeData } from "@/lib/types/flow.types";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Upload, Save, Maximize2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { MediaPreviewModal } from "@/components/common/media-preview-modal";
import { getNodeWrapperClassName } from "./utils";
import { useFlowStore } from "@/lib/store/use-flow";

interface SceneImageNodeProps {
  id: string;
  data: SceneImageNodeData;
  selected?: boolean;
}

const SceneImageNode = ({ id, data, selected }: SceneImageNodeProps) => {
  const tFlow = useTranslations("flow.sceneImageNode");
  const tCommon = useTranslations("common");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const updateNodeData = useFlowStore((state) => state.updateNodeData);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 读取用户选择的文件并转为 base64 格式，更新到节点数据中
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        const newImage = { id: "custom-" + Date.now(), url: reader.result };
        const existingImages = data.images ? [...data.images] : [];
        updateNodeData(id, {
          images: [...existingImages, newImage],
          imageUrl: reader.result,
        });
      }
    };
    reader.readAsDataURL(file);
    e.target.value = ""; // 重置 input 状态，允许重复上传同一个文件
  };

  const handleDeleteImage = () => {
    if (!deleteId) return;

    if (data.images && data.images.length > 0) {
      const newImages = data.images.filter((img) => img.id !== deleteId);
      const deletedImg = data.images.find((img) => img.id === deleteId);
      const newImageUrl =
        data.imageUrl === deletedImg?.url ? newImages[0]?.url || undefined : data.imageUrl;
      updateNodeData(id, { images: newImages, imageUrl: newImageUrl });
    } else if (data.imageUrl && (deleteId === data.sceneId || deleteId === "image")) {
      updateNodeData(id, { imageUrl: undefined });
    }

    setDeleteOpen(false);
    setDeleteId(null);
  };

  const previewItems = data.images
    ? data.images.map((img) => ({ id: img.id, url: img.url, type: "image" as const }))
    : data.imageUrl
      ? [{ id: data.sceneId || "image", url: data.imageUrl, type: "image" as const }]
      : [];

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
        {/* Main Image Area */}
        <div className="relative w-full h-full bg-muted flex items-center justify-center group p-4">
          {previewItems.length > 0 ? (
            <div className="w-full h-full grid grid-cols-2 gap-4">
              {previewItems.map((img, index) => (
                <div
                  key={img.id}
                  className={cn(
                    "aspect-square relative rounded-lg overflow-hidden border-2 cursor-pointer transition-all group/image",
                    img.url === data.imageUrl
                      ? "border-primary shadow-[0_0_0_2px_rgba(0,163,255,0.3)]"
                      : "border-transparent hover:border-border",
                  )}
                  onClick={() => {
                    // Update main imageUrl when clicking an image in the grid
                    updateNodeData(id, { imageUrl: img.url });
                  }}
                >
                  <img
                    src={img.url}
                    alt={img.id}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/image:opacity-100 transition-opacity z-20">
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
                        setDeleteId(img.id);
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
              {tFlow("img")}
            </span>
          )}

          {/* Bottom Left: Upload & Save to Asset */}
          <div className="absolute bottom-3 left-3 flex items-center gap-3">
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*"
              onChange={handleFileChange}
            />
            <button
              onClick={() => {
                fileInputRef.current?.click();
                data.onUploadCustom?.();
              }}
              className="p-1.5 bg-black/40 hover:bg-black/60 text-white/80 hover:text-white rounded-md transition-colors"
              title="Upload Custom Image"
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
      <Handle
        type="source"
        id="main"
        position={Position.Right}
        className="w-4! h-4! flex items-center justify-center bg-background border border-border hover:bg-primary/80 transition-colors group-hover/node z-10"
      ></Handle>

      <MediaPreviewModal
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        items={previewItems}
        initialIndex={previewIndex}
      />

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tFlow("deleteConfirmTitle")}</DialogTitle>
          </DialogHeader>
          <div className="py-4 text-sm text-muted-foreground">
            {tFlow("deleteConfirmDescription")}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              {tCommon("cancel")}
            </Button>
            <Button variant="destructive" onClick={handleDeleteImage}>
              {tCommon("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default memo(SceneImageNode);
