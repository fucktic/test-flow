import { useState } from "react";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallbackIconClassName?: string;
  fallbackContainerClassName?: string;
}

/**
 * 图片懒加载组件
 * 封装原生 img，添加默认 loading="lazy" 行为
 * 如果图片加载失败，展示 fallback 错误图标
 */
export const LazyImage = ({
  className,
  fallbackIconClassName,
  fallbackContainerClassName,
  alt,
  ...props
}: LazyImageProps) => {
  const [error, setError] = useState(false);

  if (error) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-muted/30 text-muted-foreground",
          className,
          fallbackContainerClassName,
        )}
      >
        <ImageOff className={cn("w-6 h-6 opacity-50", fallbackIconClassName)} />
      </div>
    );
  }

  return (
    <img {...props} alt={alt || "Image"} className={className} onError={() => setError(true)} />
  );
};
