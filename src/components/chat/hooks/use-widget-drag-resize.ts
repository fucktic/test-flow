import { useState, useRef, useEffect, useCallback, MouseEvent as ReactMouseEvent } from "react";
import { useChatStore } from "@/lib/store/use-chat";

const MINIMIZED_SIZE = 56;
const MARGIN = 20;

export function useWidgetDragResize() {
  const { isMinimized, position, size, setPosition, setSize } = useChatStore();

  const dragInfoRef = useRef({ hasMoved: false, startX: 0, startY: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const resizeInfoRef = useRef({
    direction: "se",
    startX: 0,
    startY: 0,
    startWidth: 0,
    startHeight: 0,
    startLeft: 0,
  });
  const [isResizing, setIsResizing] = useState(false);

  // 组件挂载时设置初始位置
  useEffect(() => {
    if (position.x === -1) {
      setPosition(window.innerWidth - size.width - MARGIN, 80);
    }
  }, [position.x, setPosition, size.width]);

  // 处理拖拽开始
  const handleMouseDown = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      if ((e.target as HTMLElement).closest("button, input, select, textarea")) return;
      setIsDragging(true);
      dragInfoRef.current = { hasMoved: false, startX: e.clientX, startY: e.clientY };
      setDragOffset({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      });
    },
    [position.x, position.y],
  );

  // 处理调整大小开始
  const handleResizeMouseDown = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>, direction: "se" | "sw") => {
      e.stopPropagation(); // 阻止事件冒泡到拖拽逻辑
      setIsResizing(true);
      resizeInfoRef.current = {
        direction,
        startX: e.clientX,
        startY: e.clientY,
        startWidth: size.width,
        startHeight: size.height,
        startLeft: position.x,
      };
    },
    [size.width, size.height, position.x],
  );

  // 处理拖拽过程
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;

      if (!dragInfoRef.current.hasMoved) {
        if (
          Math.abs(e.clientX - dragInfoRef.current.startX) > 3 ||
          Math.abs(e.clientY - dragInfoRef.current.startY) > 3
        ) {
          dragInfoRef.current.hasMoved = true;
        } else {
          return;
        }
      }

      let newX = e.clientX - dragOffset.x;
      let newY = e.clientY - dragOffset.y;

      const width = isMinimized ? MINIMIZED_SIZE : size.width;
      const height = isMinimized ? MINIMIZED_SIZE : size.height;

      // 限制拖拽范围在屏幕内
      newX = Math.max(0, Math.min(window.innerWidth - width, newX));
      newY = Math.max(0, Math.min(window.innerHeight - height, newY));

      setPosition(newX, newY);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, dragOffset, setPosition, isMinimized, size]);

  // 处理调整大小过程
  useEffect(() => {
    const handleResizeMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const deltaX = e.clientX - resizeInfoRef.current.startX;
      const deltaY = e.clientY - resizeInfoRef.current.startY;

      let newWidth = resizeInfoRef.current.startWidth;
      let newHeight = resizeInfoRef.current.startHeight + deltaY;
      let newX = resizeInfoRef.current.startLeft;

      if (resizeInfoRef.current.direction === "se") {
        newWidth += deltaX;
      } else if (resizeInfoRef.current.direction === "sw") {
        newWidth -= deltaX;
        newX += deltaX;
      }

      // 限制宽高
      const minWidth = 400;
      const maxWidth = 800;
      if (newWidth < minWidth) {
        if (resizeInfoRef.current.direction === "sw") {
          newX -= minWidth - newWidth;
        }
        newWidth = minWidth;
      } else if (newWidth > maxWidth) {
        if (resizeInfoRef.current.direction === "sw") {
          newX += newWidth - maxWidth;
        }
        newWidth = maxWidth;
      }

      // 高度最大为画布高度（屏幕高度减去一定的边距，比如上下各留 MARGIN）
      const maxHeight = window.innerHeight - MARGIN * 2;
      newHeight = Math.max(500, Math.min(maxHeight, newHeight));

      setSize(newWidth, newHeight);
      if (resizeInfoRef.current.direction === "sw") {
        setPosition(newX, position.y);
      }
    };

    const handleResizeMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      window.addEventListener("mousemove", handleResizeMouseMove);
      window.addEventListener("mouseup", handleResizeMouseUp);
      // 可以在调整大小时禁用 body 的文本选择
      document.body.style.userSelect = "none";
    } else {
      document.body.style.userSelect = "";
    }

    return () => {
      window.removeEventListener("mousemove", handleResizeMouseMove);
      window.removeEventListener("mouseup", handleResizeMouseUp);
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSize, setPosition, position.y]);

  return {
    isDragging,
    isResizing,
    handleMouseDown,
    handleResizeMouseDown,
    MARGIN,
  };
}
