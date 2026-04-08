"use client";

import { useState, useEffect, useRef } from "react";
import { ReactFlow, Background, Controls, MiniMap } from "@xyflow/react";
import { Loader2, RefreshCw } from "lucide-react";
import "@xyflow/react/dist/style.css";
import "@/styles/react-flow.css";
import { useFlowStore } from "../../lib/store/use-flow";

import { EpisodeNode } from "./nodes/episode-node";
import { SceneNode } from "./nodes/scene-node";
import SceneImageNode from "./nodes/scene-image-node";
import SceneVideoNode from "./nodes/scene-video-node";
import VideoPreviewNode from "./nodes/video-preview-node";
import AssetNode from "./nodes/asset-node";
import { useTheme } from "next-themes";
import { useProjectStore } from "@/lib/store/use-projects";
import { useTranslations } from "next-intl";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

const nodeTypes = {
  episodeNode: EpisodeNode,
  sceneNode: SceneNode,
  sceneImageNode: SceneImageNode,
  sceneVideoNode: SceneVideoNode,
  videoPreviewNode: VideoPreviewNode,
  assetNode: AssetNode,
  // Add aliases for backward compatibility

  "episode-node": EpisodeNode,
  "scene-node": SceneNode,
  "scene-image-node": SceneImageNode,
  "scene-video-node": SceneVideoNode,
  "video-preview-node": VideoPreviewNode,
  "asset-node": AssetNode,
};

export const FlowCanvas = () => {
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, initFlow } = useFlowStore();
  const currentProject = useProjectStore((state) => state.currentProject);
  const tCanvas = useTranslations("canvas");
  const [isMounted, setIsMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(true); // 添加画布加载状态
  const loadedProjectIdRef = useRef<string | null>(null);
  const { theme, systemTheme } = useTheme();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // 当项目切换时加载画布数据，并在加载期间显示 loading 过渡
  useEffect(() => {
    if (currentProject?.id) {
      setIsLoading(true);
      fetch(`/api/projects/${currentProject.id}/flow`)
        .then((res) => {
          if (!res.ok) throw new Error("Not found");
          return res.json();
        })
        .then((data) => {
          if (data && data.nodes && data.edges) {
            initFlow(data.nodes, data.edges);
          } else {
            initFlow([], []);
          }
          loadedProjectIdRef.current = currentProject.id;
        })
        .catch(() => {
          // 如果加载失败，清空画布避免显示上一个项目的数据
          initFlow([], []);
          // 同样允许对新项目或出错后的空画布进行保存
          loadedProjectIdRef.current = currentProject.id;
        })
        .finally(() => {
          setIsLoading(false); // 请求结束（成功或失败）后关闭 loading
        });
    } else {
      setIsLoading(false);
    }
  }, [currentProject?.id, initFlow]);

  // Auto-save flow data
  useEffect(() => {
    if (!currentProject?.id || !isMounted || isLoading) return;
    if (currentProject.id !== loadedProjectIdRef.current) return;

    const timer = setTimeout(() => {
      // Clean nodes: remove functions and expanded state
      const cleanNodes = nodes.map((node) => {
        const { isExpanded: _isExpanded, ...restData } = node.data as any;

        // Strip out functions from data
        const cleanData = Object.fromEntries(
          Object.entries(restData).filter(([_, v]) => typeof v !== "function"),
        );

        return { ...node, data: cleanData };
      });

      fetch(`/api/projects/${currentProject.id}/flow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodes: cleanNodes, edges }),
      }).catch((err) => console.error("Failed to save flow:", err));
    }, 1000);

    return () => clearTimeout(timer);
  }, [nodes, edges, currentProject?.id, isMounted, isLoading]);

  if (!isMounted) {
    return null;
  }

  // 决定当前 ReactFlow 应该使用的 colorMode，"system" 时回退到 systemTheme
  const currentTheme = theme === "system" ? systemTheme : theme;
  const colorMode = currentTheme === "dark" ? "dark" : "light";

  const handleReload = () => {
    if (currentProject?.id) {
      setIsLoading(true);
      fetch(`/api/projects/${currentProject.id}/flow`)
        .then((res) => {
          if (!res.ok) throw new Error("Not found");
          return res.json();
        })
        .then((data) => {
          if (data && data.nodes && data.edges) {
            initFlow(data.nodes, data.edges);
          } else {
            initFlow([], []);
          }
          loadedProjectIdRef.current = currentProject.id;
        })
        .catch((err) => {
          console.error("Failed to reload flow:", err);
          initFlow([], []);
          loadedProjectIdRef.current = currentProject.id;
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger className="w-full h-full block">
        <div className="w-full h-full min-h-150 border-none overflow-hidden bg-background relative">
          {isLoading && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm transition-all duration-300">
              <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
              <p className="text-sm text-muted-foreground">{tCanvas("loading")}</p>
            </div>
          )}
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            colorMode={colorMode}
            onNodeContextMenu={(e) => e.stopPropagation()}
            onEdgeContextMenu={(e) => e.stopPropagation()}
            fitView
          >
            <Background />
            <Controls />
            <MiniMap />
          </ReactFlow>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={handleReload} className="cursor-pointer">
          <RefreshCw className="mr-2 h-4 w-4" />
          {tCanvas("reload")}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};
