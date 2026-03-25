import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { VideoPreviewNodeData } from "@/lib/types/flow.types";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { RefreshCcw, Download, ExternalLink } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

interface VideoPreviewNodeProps {
  data: VideoPreviewNodeData;
}

const VideoPreviewNode = ({ data }: VideoPreviewNodeProps) => {
  const tFlow = useTranslations("flow.videoPreviewNode");

  const progressPercent =
    data.progress.total > 0 ? (data.progress.current / data.progress.total) * 100 : 0;

  return (
    <div className="flex flex-col gap-2 w-200 h-200">
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
            <div className="px-3 py-1.5 bg-muted/50 rounded-md text-xs font-mono text-muted-foreground">
              {data.vid}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={data.onDownload}
            >
              <Download className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 bg-muted/50 border-transparent hover:border-border text-xs"
              onClick={data.onPostEdit}
            >
              <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
              {tFlow("postEdit")}
            </Button>
          </div>
        </div>

        {/* Progress Bar */}
        <Progress value={progressPercent} className="h-1.5" />

        {/* Grid Content */}
        <ScrollArea className="h-full w-full pr-4">
          <div className="grid grid-cols-5 gap-4">
            {data.items.map((item) => (
              <div
                key={item.id}
                className={cn(
                  "relative aspect-square rounded-lg overflow-hidden border border-border/50",
                  item.status === "pending" ? "bg-muted/30" : "bg-black",
                )}
              >
                {/* Top Left ID Badge */}
                <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-black/60 backdrop-blur-sm text-white/90 rounded text-[10px] font-medium z-10">
                  {item.id}
                </div>

                {item.status === "generated" && item.url ? (
                  <>
                    <img src={item.url} alt={item.id} className="w-full h-full object-cover" />
                    {/* Bottom Right Duration Badge */}
                    {item.duration && (
                      <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/60 backdrop-blur-sm text-white/90 rounded text-[10px] font-medium z-10">
                        {item.duration}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
                    {tFlow("pending")}
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Target Handle */}
      <Handle
        type="target"
        position={Position.Left}
        className={cn(
          "w-4 h-4 border-2 border-background transition-colors",
          "bg-muted-foreground/30 hover:bg-primary",
        )}
      />
    </div>
  );
};

export default memo(VideoPreviewNode);
