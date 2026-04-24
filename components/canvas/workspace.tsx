"use client";

import "@xyflow/react/dist/style.css";

import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
} from "@xyflow/react";
import { useCanvasStore } from "@/store/use-canvas-store";

function CanvasWorkspaceInner() {
  const {  edges, nodes, onConnect, onEdgesChange, onNodesChange } =
    useCanvasStore();

  return (
    <div className="relative h-full  overflow-hidden rounded-3xl border border-white/10 bg-black/30">
      
      <ReactFlow
        fitView
        colorMode="dark"
        edges={edges}
        nodes={nodes}
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
