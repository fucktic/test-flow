"use client";

import { useState, useEffect } from "react";
import { ReactFlow, Background, Controls, MiniMap } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useFlowStore } from "../../lib/store/use-flow";
import { TextNode } from "./nodes/command-node";
import { SkillNode } from "./nodes/result-node";
import { EpisodeNode } from "./nodes/episode-node";
import { SceneNode } from "./nodes/scene-node";
import SceneImageNode from "./nodes/scene-image-node";
import SceneVideoNode from "./nodes/scene-video-node";
import VideoPreviewNode from "./nodes/video-preview-node";
import { useTheme } from "next-themes";

const nodeTypes = {
  textNode: TextNode,
  skillNode: SkillNode,
  episodeNode: EpisodeNode,
  sceneNode: SceneNode,
  sceneImageNode: SceneImageNode,
  sceneVideoNode: SceneVideoNode,
  videoPreviewNode: VideoPreviewNode,
};

export const FlowCanvas = () => {
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect } = useFlowStore();
  const [isMounted, setIsMounted] = useState(false);
  const { theme, systemTheme } = useTheme();

  useEffect(() => {
    setIsMounted(true);
  }, []);

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
