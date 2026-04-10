import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface MediaItem {
  id: string;
  url: string;
  type: "image" | "video";
  poster?: string;
}

interface MediaPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: MediaItem[];
  initialIndex?: number;
}

export function MediaPreviewModal({
  open,
  onOpenChange,
  items,
  initialIndex = 0,
}: MediaPreviewModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [timestamp, setTimestamp] = useState(Date.now());

  useEffect(() => {
    if (open) {
      setCurrentIndex(initialIndex >= 0 && initialIndex < items.length ? initialIndex : 0);
      setTimestamp(Date.now());
    }
  }, [open, initialIndex, items.length]);

  if (!items || items.length === 0) return null;

  const currentItem = items[currentIndex];

  const handlePrevious = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : items.length - 1));
    setTimestamp(Date.now());
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev < items.length - 1 ? prev + 1 : 0));
    setTimestamp(Date.now());
  };

  const getUrlWithTimestamp = (url?: string) => {
    if (!url) return url;
    // 如果是 data 或 blob 开头的本地对象 URL，则不添加时间戳
    if (url.startsWith("data:") || url.startsWith("blob:")) return url;

    // 添加时间戳参数以绕过浏览器缓存，确保能实时加载被修改后的最新文件
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}t=${timestamp}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[80vw]! w-[90vw] h-[80vh] bg-transparent! border-none ring-0! flex flex-col items-center justify-center overflow-hidden shadow-none p-0"
        showCloseButton={false}
      >
        {/* 为屏幕阅读器提供不可见的标题，解决可访问性警告 */}
        <DialogTitle className="sr-only">Media Preview</DialogTitle>
        <Button
          variant="secondary"
          size="icon"
          className="absolute top-2 right-2 md:top-4 md:right-4 z-50 bg-black/60 hover:bg-destructive text-white hover:text-white rounded-full w-12 h-12 shadow-2xl border-2 border-white/30 transition-all"
          onClick={() => onOpenChange(false)}
        >
          <X className="w-7 h-7" />
        </Button>

        {items.length > 1 && (
          <>
            <Button
              variant="secondary"
              size="icon"
              className="absolute left-4 top-1/2 -translate-y-1/2 z-50 bg-black/50 hover:bg-black/80 text-white rounded-full w-12 h-12 shadow-lg border border-white/20"
              onClick={handlePrevious}
            >
              <ChevronLeft className="w-8 h-8" />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              className="absolute right-4 top-1/2 -translate-y-1/2 z-50 bg-black/50 hover:bg-black/80 text-white rounded-full w-12 h-12 shadow-lg border border-white/20"
              onClick={handleNext}
            >
              <ChevronRight className="w-8 h-8" />
            </Button>
          </>
        )}

        <div className="relative w-full h-full flex items-center justify-center">
          {currentItem.type === "video" || currentItem.url.endsWith(".mp4") ? (
            <video
              src={getUrlWithTimestamp(currentItem.url)}
              poster={getUrlWithTimestamp(currentItem.poster)}
              controls
              autoPlay
              className="w-full h-full object-contain rounded-md shadow-2xl"
            />
          ) : (
            <img
              src={getUrlWithTimestamp(currentItem.url)}
              alt={currentItem.id}
              className="w-full h-full object-contain rounded-md shadow-2xl"
            />
          )}
        </div>

        {items.length > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/50 text-white/90 rounded-full text-sm font-medium backdrop-blur-sm border border-white/20">
            {currentIndex + 1} / {items.length}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
