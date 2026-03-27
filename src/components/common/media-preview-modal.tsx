import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
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

  useEffect(() => {
    if (open) {
      setCurrentIndex(initialIndex >= 0 && initialIndex < items.length ? initialIndex : 0);
    }
  }, [open, initialIndex, items.length]);

  if (!items || items.length === 0) return null;

  const currentItem = items[currentIndex];

  const handlePrevious = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : items.length - 1));
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev < items.length - 1 ? prev + 1 : 0));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[80vw]! w-[90vw] h-[80vh] bg-transparent! border-none ring-0! flex flex-col items-center justify-center overflow-hidden shadow-none p-0"
        showCloseButton={false}
      >
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
              src={currentItem.url}
              poster={currentItem.poster}
              controls
              autoPlay
              className="w-full h-full object-contain rounded-md shadow-2xl"
            />
          ) : (
            <img
              src={currentItem.url}
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
