"use client";

import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from "@xyflow/react";
import {create} from "zustand";
import {initialFlowState} from "@/lib/flow-schema";
import type { ProjectListItem } from "@/lib/project-types";

type CanvasNode = Node<{label: string}>;
type CanvasEdge = Edge;

type CanvasState = {
  currentProject: ProjectListItem | null;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  addNode: (label: string) => void;
  setCurrentProject: (project: ProjectListItem) => void;
  onConnect: (connection: Connection) => void;
  onEdgesChange: (changes: EdgeChange<CanvasEdge>[]) => void;
  onNodesChange: (changes: NodeChange<CanvasNode>[]) => void;
  reset: () => void;
};

const toNode = (node: (typeof initialFlowState.nodes)[number]): CanvasNode => ({
  ...node,
  type: "default",
});

const toEdge = (edge: (typeof initialFlowState.edges)[number]): CanvasEdge => edge;

const buildInitialState = () => ({
  nodes: initialFlowState.nodes.map(toNode),
  edges: initialFlowState.edges.map(toEdge),
});

export const useCanvasStore = create<CanvasState>((set) => ({
  currentProject: null,
  ...buildInitialState(),
  setCurrentProject: (project) => set({ currentProject: project }),
  addNode: (label) =>
    set((state) => {
      const nextIndex = state.nodes.length + 1;

      return {
        nodes: [
          ...state.nodes,
          {
            id: `node-${nextIndex}`,
            position: {
              x: 120 + (nextIndex % 3) * 220,
              y: 220 + Math.floor(nextIndex / 3) * 120,
            },
            data: {label},
            type: "default",
          },
        ],
      };
    }),
  onConnect: (connection) =>
    set((state) => ({
      edges: addEdge(
        {
          ...connection,
          id: `edge-${connection.source}-${connection.target}`,
          animated: true,
        },
        state.edges,
      ),
    })),
  onEdgesChange: (changes) =>
    set((state) => ({
      edges: applyEdgeChanges(changes, state.edges),
    })),
  onNodesChange: (changes) =>
    set((state) => ({
      nodes: applyNodeChanges(changes, state.nodes),
    })),
  reset: () => set(buildInitialState()),
}));
