import { cn } from "@/lib/utils";

/**
 * 提取所有节点的通用外层容器样式，统一 hover 和选中（selected）效果
 */
export function getNodeWrapperClassName(selected?: boolean, className?: string) {
  return cn(
    "bg-card border rounded-xl shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md hover:border-primary/50",
    selected ? "border-primary! shadow-lg! ring-1 ring-primary/20" : "border-border",
    className,
  );
}
