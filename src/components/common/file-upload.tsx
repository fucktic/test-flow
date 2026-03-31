import { useRef, useState } from "react";
import { Upload, Music } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface FileUploadProps {
  accept?: string;
  onFileSelect: (file: File) => void;
  fileUrl?: string;
  fileName?: string;
  mediaType?: "image" | "audio" | "video";
  onClear?: () => void;
  hint?: string;
  subHint?: string;
  error?: string;
  className?: string;
  replaceText?: string;
  clearText?: string;
}

export function FileUpload({
  accept,
  onFileSelect,
  fileUrl,
  fileName,
  mediaType,
  onClear,
  hint,
  subHint,
  error,
  className,
  replaceText = "Replace",
  clearText = "Clear",
}: FileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
    const file = event.dataTransfer.files?.[0];
    if (file) {
      onFileSelect(file);
    }
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
    event.target.value = "";
  };

  return (
    <div className={cn("space-y-2", className)}>
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept={accept}
        onChange={handleChange}
      />
      {fileUrl ? (
        <div className="relative group rounded-lg overflow-hidden border border-border/60 bg-muted/30 aspect-video flex items-center justify-center">
          {mediaType === "image" && (
            <img src={fileUrl} alt={fileName} className="w-full h-full object-contain bg-black/5" />
          )}
          {mediaType === "audio" && (
            <div className="flex flex-col items-center gap-2">
              <Music className="w-8 h-8 text-primary/50" />
              <span className="text-xs text-muted-foreground truncate px-4 max-w-full">
                {fileName}
              </span>
            </div>
          )}
          {mediaType === "video" && <video src={fileUrl} className="w-full h-full object-cover" />}
          {!mediaType && (
            <span className="text-xs text-muted-foreground truncate px-4 max-w-full">
              {fileName}
            </span>
          )}

          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-7 text-xs px-2.5"
              onClick={() => fileInputRef.current?.click()}
            >
              {replaceText}
            </Button>
            {onClear && (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="h-7 text-xs px-2.5"
                onClick={onClear}
              >
                {clearText}
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div
          className={cn(
            "w-full rounded-lg border border-dashed px-3 py-6 flex flex-col items-center justify-center gap-2 transition-colors cursor-pointer",
            isDragOver
              ? "border-primary bg-primary/5"
              : "border-border/60 hover:border-primary/50 hover:bg-muted/30",
          )}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            setIsDragOver(false);
          }}
          onDrop={handleDrop}
        >
          <Upload className="w-5 h-5 text-muted-foreground" />
          {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
          {subHint && <span className="text-[10px] text-muted-foreground/70">{subHint}</span>}
        </div>
      )}
      {error && <div className="text-xs text-destructive">{error}</div>}
    </div>
  );
}
