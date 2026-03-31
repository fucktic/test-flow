import { memo, useState } from "react";
import { AssetNodeData, AssetCategory, AssetItem } from "@/lib/types/flow.types";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Image as ImageIcon, Music, Maximize2 } from "lucide-react";
import { MediaPreviewModal, MediaItem } from "@/components/common/media-preview-modal";
import { getNodeWrapperClassName } from "./utils";

interface AssetNodeProps {
  data: AssetNodeData;
  selected?: boolean;
}

const AssetNode = ({ data, selected }: AssetNodeProps) => {
  const tFlow = useTranslations("flow.assetNode");
  const [activeTab, setActiveTab] = useState<AssetCategory>(data.activeTab || "characters");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);

  const tabs: { id: AssetCategory; label: string }[] = [
    { id: "characters", label: tFlow("characters") || "角色" },
    { id: "scenes", label: tFlow("scenes") || "场景" },
    { id: "props", label: tFlow("props") || "道具" },
    { id: "audio", label: tFlow("audio") || "音频" },
  ];

  const currentAssets = data.assets?.[activeTab] || [];

  // Convert current assets to MediaItem format for preview
  const previewItems: MediaItem[] = currentAssets
    .filter((item: AssetItem) => item.type === "image" || item.type === "video")
    .map((item: AssetItem) => ({
      id: item.id,
      url: item.url,
      type: item.type as "image" | "video",
      poster: item.poster,
    }));

  const handlePreview = (index: number) => {
    const item = currentAssets[index];
    if (item.type === "image" || item.type === "video") {
      const pIndex = previewItems.findIndex((p: MediaItem) => p.id === item.id);
      if (pIndex !== -1) {
        setPreviewIndex(pIndex);
        setPreviewOpen(true);
      }
    } else if (item.type === "audio") {
      // Simple audio play logic
      const audio = new Audio(item.url);
      audio.play().catch((e) => console.error("Audio play failed", e));
    }
  };

  return (
    <div className="flex flex-col gap-2 w-lg h-160 relative group/node">
      {/* Header */}
      <div className="flex items-center gap-2 px-1">
        <span className="text-lg font-semibold text-foreground">
          {tFlow("title") || "项目资产"}
        </span>
      </div>

      {/* Main Container */}
      <div className={getNodeWrapperClassName(selected, "flex-1 flex flex-col p-4 gap-4")}>
        {/* Tabs */}
        <div className="flex items-center gap-2 pb-2 border-b border-border/50">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={cn(
                "px-4 py-1.5 text-sm font-medium transition-colors rounded-md",
                activeTab === tab.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted",
              )}
              onClick={() => {
                setActiveTab(tab.id);
                if (data.onTabChange) {
                  data.onTabChange(tab.id);
                }
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <ScrollArea className="h-full w-full pr-4">
          {currentAssets.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-2 mt-20">
              <ImageIcon className="w-8 h-8 opacity-20" />
              <span className="text-sm">{tFlow("empty") || "暂无资产"}</span>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-4">
              {currentAssets.map((item: AssetItem, index: number) => (
                <div
                  key={item.id}
                  className="flex flex-col gap-1 group/asset cursor-pointer"
                  onClick={() => handlePreview(index)}
                >
                  <div className="aspect-square bg-muted rounded-lg overflow-hidden relative border border-border/50 group-hover/asset:border-primary/50 transition-colors">
                    {item.type === "image" || item.type === "video" ? (
                      <img src={item.url} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-secondary/30">
                        <Music className="w-8 h-8 text-primary/50" />
                      </div>
                    )}

                    {/* Hover Overlay */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/asset:opacity-100 transition-opacity flex items-center justify-center">
                      <Maximize2 className="w-6 h-6 text-white" />
                    </div>
                  </div>
                  <span
                    className="text-xs text-center truncate text-muted-foreground group-hover/asset:text-foreground transition-colors"
                    title={item.name}
                  >
                    {item.name}
                  </span>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      <MediaPreviewModal
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        items={previewItems}
        initialIndex={previewIndex}
      />
    </div>
  );
};

export default memo(AssetNode);
