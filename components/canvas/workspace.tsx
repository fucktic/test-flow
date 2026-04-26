"use client";

import "@xyflow/react/dist/style.css";

import { useEffect, useMemo } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type Node,
  type NodeTypes,
} from "@xyflow/react";
import { useTranslations } from "next-intl";
import { StoryboardImageNode } from "@/components/canvas/nodes/storyboard-image-node";
import { StoryboardListNode } from "@/components/canvas/nodes/storyboard-list-node";
import { StoryboardVideoNode } from "@/components/canvas/nodes/storyboard-video-node";
import { flowStateSchema, type FlowState } from "@/lib/flow-schema";
import { fetchProjectCanvasData, saveProjectFlow } from "@/lib/project-api";
import { useCanvasStore } from "@/store/use-canvas-store";

const FLOW_SAVE_DELAY_MS = 500;

function toSerializableFlow(nodes: Node[], edges: Edge[]): FlowState | null {
  const parsedFlow = flowStateSchema.safeParse({
    nodes: nodes.map((node) => ({
      id: node.id,
      type: node.type,
      position: node.position,
      hidden: node.hidden,
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle ?? undefined,
      targetHandle: edge.targetHandle ?? undefined,
      animated: edge.animated,
      hidden: edge.hidden,
    })),
  });

  return parsedFlow.success ? parsedFlow.data : null;
}

function CanvasWorkspaceInner() {
  const t = useTranslations("Canvas");
  const {
    currentCanvasData,
    currentProject,
    edges,
    nodes,
    onConnect,
    onEdgesChange,
    onNodesChange,
    selectedEpisodeIds,
    setProjectCanvasData,
  } = useCanvasStore();
  const activeEpisodeId = selectedEpisodeIds[0] ?? currentProject?.episodes[0]?.id ?? "";
  const nodeTypes = useMemo<NodeTypes>(
    () => ({
      "storyboard-list-node": StoryboardListNode,
      "storyboard-image-node": StoryboardImageNode,
      "storyboard-video-node": StoryboardVideoNode,
    }),
    [],
  );

  useEffect(() => {
    let active = true;

    const loadCanvasData = async () => {
      if (!currentProject || !activeEpisodeId) return;

      try {
        const data = await fetchProjectCanvasData(currentProject.id, activeEpisodeId);
        if (!active) return;
        setProjectCanvasData(currentProject.id, activeEpisodeId, data);
      } catch {
        // Keep the existing canvas visible if project files are temporarily unavailable.
      }
    };

    void loadCanvasData();

    return () => {
      active = false;
    };
  }, [
    activeEpisodeId,
    currentProject,
    setProjectCanvasData,
  ]);

  useEffect(() => {
    if (!currentCanvasData) return;

    const flow = toSerializableFlow(nodes, edges);
    if (!flow) return;

    const timeoutId = window.setTimeout(() => {
      saveProjectFlow(currentCanvasData.projectId, flow).catch(() => {
        // Auto-save is best-effort; the next canvas change will retry writing flow.json.
      });
    }, FLOW_SAVE_DELAY_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [currentCanvasData, edges, nodes]);

  return (
    <div className="relative h-full overflow-hidden rounded-xl border border-white/10 bg-black/30">
      {!currentProject ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center text-sm text-zinc-400">
          {t("emptyProject")}
        </div>
      ) : null}
      
      <ReactFlow
        fitView
        colorMode="dark"
        edges={edges}
        nodes={nodes}
        nodeTypes={nodeTypes}
        onConnect={onConnect}
        onEdgesChange={onEdgesChange}
        onNodesChange={onNodesChange}
      >

        <MiniMap
          pannable
          zoomable
        />
        <Controls />
        <Background />
      </ReactFlow>
    </div>
  );
}

export function CanvasWorkspace() {
  return (
    <ReactFlowProvider>
      <CanvasWorkspaceInner />
    </ReactFlowProvider>
  );
}
