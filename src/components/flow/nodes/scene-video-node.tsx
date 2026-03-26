import { memo, useState } from "react";
import { Handle, Position } from "@xyflow/react";
import { SceneVideoNodeData } from "@/lib/types/flow.types";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Upload, Save, ChevronDown, ChevronUp, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface SceneVideoNodeProps {
  data: SceneVideoNodeData;
}

const SceneVideoNode = ({ data }: SceneVideoNodeProps) => {
  const tFlow = useTranslations("flow.sceneVideoNode");
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="flex flex-col gap-2 w-100 h-100 relative group/node">
      {/* Header */}
      <div className="flex items-center gap-2 px-1">
        <span className="text-sm font-semibold text-foreground">{tFlow("title")}</span>
      </div>

      {/* Main Container */}
      <div className="flex flex-col bg-card border border-border rounded-xl shadow-sm overflow-hidden h-full">
        {/* Main Video/Image Area */}
        <div className="relative w-full  h-full bg-muted flex items-center justify-center group p-4">
          {data.videos && data.videos.length > 0 ? (
            <div className="w-full h-full grid grid-cols-2 gap-4 ">
              {data.videos.map((video) => (
                <div
                  key={video.id}
                  className={cn(
                    "aspect-square relative rounded-lg overflow-hidden border-2 cursor-pointer transition-all",
                    video.selected
                      ? "border-primary shadow-[0_0_0_2px_rgba(0,163,255,0.3)]"
                      : "border-transparent hover:border-border",
                  )}
                  onClick={() => data.onVideoSelect?.(video.id)}
                >
                  <img src={video.url} alt={video.id} className="w-full h-full object-cover " />
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

          {/* Bottom Right: Expand Toggle */}
          <div className="absolute bottom-3 right-3">
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1.5 bg-black/40 hover:bg-black/60 text-white/80 hover:text-white rounded-md transition-colors flex items-center justify-center"
            >
              {data.isExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Expanded Settings Area (Absolute positioned to exceed node width) */}
        {expanded && (
          <div className="absolute top-[calc(100%+8px)]  w-200 flex flex-col gap-4 p-4 bg-card border border-border rounded-xl shadow-xl z-50">
            {/* Row 1: Reference Images */}
            <div className="flex gap-3">
              {["single", "grid", "first", "last"].map((type, index) => {
                const refImg = data.referenceImages?.[index];
                return (
                  <div key={index} className="flex flex-col gap-1 w-[100px]">
                    <div className="aspect-square bg-muted/50 rounded-md border border-border border-dashed flex flex-col items-center justify-center text-muted-foreground hover:bg-muted transition-colors cursor-pointer relative overflow-hidden">
                      {refImg?.url ? (
                        <img src={refImg.url} alt={type} className="w-full h-full object-cover" />
                      ) : (
                        <>
                          <span className="text-[10px] mb-1">
                            {tFlow(`refTypes.${type}` as any)}
                          </span>
                          <div className="flex items-center gap-1 text-xs">{tFlow("img")}</div>
                        </>
                      )}
                    </div>
                    {/* Small dropdown or button below the ref image */}
                    <Select defaultValue="default">
                      <SelectTrigger className="h-6 text-[10px] px-2 py-0">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="default" className="text-[10px]">
                          默认
                        </SelectItem>
                        <SelectItem value="style" className="text-[10px]">
                          风格
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                );
              })}

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="h-8 text-xs bg-muted/50 border-transparent hover:border-border px-3 font-normal text-muted-foreground"
                  >
                    {data.ratio ? data.ratio : tFlow("ratioAndResolution")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-3" align="start">
                  <div className="grid grid-cols-5 gap-2">
                    {["1:1", "4:3", "3:4", "16:9", "9:16"].map((r) => (
                      <Button
                        key={r}
                        variant={data.ratio === r ? "default" : "outline"}
                        className="h-8 text-xs px-0"
                        onClick={() => data.onRatioChange?.(r)}
                      >
                        {r}
                      </Button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>

              <Select value={data.skillId || "Seedance 1.5 P"} onValueChange={data.onSkillChange}>
                <SelectTrigger className="h-8 text-xs flex-1 bg-muted/50 border-transparent hover:border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Seedance 1.5 P">Seedance 1.5 P</SelectItem>
                  <SelectItem value="Runway Gen-2">Runway Gen-2</SelectItem>
                  <SelectItem value="Sora">Sora</SelectItem>
                </SelectContent>
              </Select>

              <Button
                onClick={data.onGenerate}
                className="h-8 bg-primary hover:bg-primary/80  px-5 rounded-md text-xs font-medium"
              >
                {tFlow("generate")}
              </Button>
            </div>

            {/* Row 2: Controls */}
            <div className="flex items-center gap-2"></div>

            {/* Row 3: Prompt Textarea */}
            <Textarea
              className="min-h-[80px] text-sm resize-none bg-muted/30 border-transparent hover:border-border focus-visible:ring-1 focus-visible:border-border p-3 text-muted-foreground"
              placeholder={tFlow("promptPlaceholder")}
              value={data.prompt}
              onChange={(e) => data.onPromptChange?.(e.target.value)}
            />
          </div>
        )}
      </div>

      {/* Connection Handles */}
      <Handle
        type="target"
        position={Position.Left}
        className="w-6! h-6! flex items-center justify-center bg-background! border border-border! hover:bg-primary/80! transition-colors group-hover/node"
      >
        <Plus className="size-4 m-auto text-muted-foreground group-hover/node:text-white!" />
      </Handle>
      <Handle
        type="source"
        id="main"
        position={Position.Right}
        className="w-6! h-6! flex items-center justify-center bg-background! border border-border! hover:bg-primary/80! transition-colors group-hover/node"
      >
        <Plus className="size-4 m-auto text-muted-foreground group-hover/node:text-white!" />
      </Handle>
    </div>
  );
};

export default memo(SceneVideoNode);
