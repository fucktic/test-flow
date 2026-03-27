"use client";

import { useState, useEffect } from "react";
import { ReactFlow, Background, Controls, MiniMap } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "@/styles/react-flow.css";
import { useFlowStore } from "../../lib/store/use-flow";
import { TextNode } from "./nodes/command-node";
import { SkillNode } from "./nodes/result-node";
import { EpisodeNode } from "./nodes/episode-node";
import { SceneNode } from "./nodes/scene-node";
import SceneImageNode from "./nodes/scene-image-node";
import SceneVideoNode from "./nodes/scene-video-node";
import VideoPreviewNode from "./nodes/video-preview-node";
import { useTheme } from "next-themes";
import { useProjectStore } from "@/lib/store/use-projects";

const nodeTypes = {
  textNode: TextNode,
  skillNode: SkillNode,
  episodeNode: EpisodeNode,
  sceneNode: SceneNode,
  sceneImageNode: SceneImageNode,
  sceneVideoNode: SceneVideoNode,
  videoPreviewNode: VideoPreviewNode,
  // Add aliases for backward compatibility
  "command-node": TextNode,
  "result-node": SkillNode,
  "episode-node": EpisodeNode,
  "scene-node": SceneNode,
  "scene-image-node": SceneImageNode,
  "scene-video-node": SceneVideoNode,
  "video-preview-node": VideoPreviewNode,
};

export const FlowCanvas = () => {
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, initFlow } = useFlowStore();
  const currentProject = useProjectStore((state) => state.currentProject);
  const [isMounted, setIsMounted] = useState(false);
  const { theme, systemTheme } = useTheme();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Load flow data when project changes
  useEffect(() => {
    if (currentProject?.id) {
      fetch(`/api/projects/${currentProject.id}/flow`)
        .then((res) => {
          if (!res.ok) throw new Error("Not found");
          return res.json();
        })
        .then((data) => {
          if (data && data.nodes && data.edges) {
            initFlow(data.nodes, data.edges);
          }
        })
        .catch(() => {
          // Ignore error, might be a new project without saved flow
        });
    }
  }, [currentProject?.id, initFlow]);

  // Auto-save flow data
  useEffect(() => {
    if (!currentProject?.id || !isMounted) return;

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
  }, [nodes, edges, currentProject?.id, isMounted]);

  if (!isMounted) {
    return null;
  }

  // 决定当前 ReactFlow 应该使用的 colorMode，"system" 时回退到 systemTheme
  const currentTheme = theme === "system" ? systemTheme : theme;
  const colorMode = currentTheme === "dark" ? "dark" : "light";

  return (
    <div className="w-full h-full min-h-150 border-none overflow-hidden bg-background">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        colorMode={colorMode}
        fitView
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
};
