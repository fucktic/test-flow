import { useRef } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Paperclip, X } from "lucide-react";

export interface UploadedFile {
  id: string;
  file: File;
  previewUrl?: string;
  type: "image" | "file";
}

import { v4 as uuidv4 } from "uuid";

interface ChatUploadProps {
  files: UploadedFile[];
  onFilesChange: (files: UploadedFile[]) => void;
}

/**
 * 聊天输入框上传组件（包含上传按钮）
 */
export function ChatUpload({ files, onFilesChange }: ChatUploadProps) {
  const t = useTranslations("chat");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files).map((file) => {
        const isImage = file.type.startsWith("image/");
        return {
          id: uuidv4(),
          file,
          previewUrl: isImage ? URL.createObjectURL(file) : undefined,
          type: isImage ? "image" : "file",
        };
      });
      onFilesChange([...files, ...(newFiles as UploadedFile[])]);
    }
    // 清空 input 值，允许重复选择相同文件
    e.target.value = "";
  };

  return (
    <div className="flex items-center gap-1">
      <input
        type="file"
        accept="image/*,video/*,.md"
        multiple
        className="hidden"
        ref={fileInputRef}
        onChange={handleFileChange}
      />

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="w-8 h-8 text-muted-foreground hover:text-foreground shrink-0"
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">{t("uploadFile")}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

interface UploadedFileListProps {
  files: UploadedFile[];
  onRemove: (id: string) => void;
}

/**
 * 聊天输入框上传文件列表组件
 */
export function UploadedFileList({ files, onRemove }: UploadedFileListProps) {
  if (files.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 mb-2">
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {files.map((file) => (
          <div
            key={file.id}
            className="relative group aspect-square rounded-md overflow-hidden bg-muted/50 border border-border/50 flex flex-col items-center justify-center p-2"
          >
            {file.type === "image" && file.previewUrl ? (
              <img
                src={file.previewUrl}
                alt={file.file.name}
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <>
                <div className="flex-1 flex items-center justify-center w-full">
                  <Paperclip className="w-8 h-8 text-muted-foreground/60" />
                </div>
                <div
                  className="w-full text-[10px] text-center truncate text-muted-foreground mt-1"
                  title={file.file.name}
                >
                  {file.file.name}
                </div>
              </>
            )}
            <button
              onClick={() => onRemove(file.id)}
              className="absolute top-1 right-1 w-5 h-5 bg-black/50 hover:bg-destructive text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-sm z-10"
              aria-label={file.type === "image" ? "Remove image" : "Remove file"}
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
