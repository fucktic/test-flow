import { memo, useState } from "react";
import { Handle, Position } from "@xyflow/react";
import { SceneImageNodeData } from "@/lib/types/flow.types";
import { useTranslations } from "next-intl";
import { Upload, Save, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MediaPreviewModal } from "@/components/common/media-preview-modal";
import { getNodeWrapperClassName } from "./utils";

interface SceneImageNodeProps {
  data: SceneImageNodeData;
  selected?: boolean;
}

const SceneImageNode = ({ data, selected }: SceneImageNodeProps) => {
  const tFlow = useTranslations("flow.sceneImageNode");
  const [previewOpen, setPreviewOpen] = useState(false);

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
        <div className="relative w-full h-full aspect-4/3 bg-muted flex items-center justify-center group">
          {previewItems.length > 0 ? (
            <>
              <img
                src={previewItems[0].url}
                alt={data.sceneId}
                className="w-full h-full object-cover cursor-pointer"
                loading="lazy"
                onClick={() => setPreviewOpen(true)}
              />
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-8 w-8 bg-black/40 hover:bg-black/60 text-white/80 hover:text-white rounded-md"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPreviewOpen(true);
                  }}
                >
                  <Maximize2 className="w-4 h-4" />
                </Button>
              </div>
            </>
          ) : (
            <span className="text-muted-foreground/50 text-4xl font-bold tracking-widest">
              {tFlow("img")}
            </span>
          )}

          {/* Bottom Left: Upload & Save to Asset */}
          <div className="absolute bottom-3 left-3 flex items-center gap-3">
            <button
              onClick={data.onUploadCustom}
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
      >
        {/* <Plus className="size-4 m-auto text-muted-foreground group-hover/node:text-white" /> */}
      </Handle>
      <Handle
        type="source"
        id="main"
        position={Position.Right}
        className="w-4! h-4! flex items-center justify-center bg-background border border-border hover:bg-primary/80 transition-colors group-hover/node z-10"
      >
        {/* <Plus className="size-4 m-auto text-muted-foreground group-hover/node:text-white" /> */}
      </Handle>

      <MediaPreviewModal open={previewOpen} onOpenChange={setPreviewOpen} items={previewItems} />
    </div>
  );
};

export default memo(SceneImageNode);
