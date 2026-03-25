import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import {
  Node,
  Edge,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  Connection,
  NodeChange,
  EdgeChange,
} from "@xyflow/react";

interface FlowState {
  nodes: Node[];
  edges: Edge[];
  selectedNodeId: string | null;
  setNodes: (nodes: Node[] | ((nodes: Node[]) => Node[])) => void;
  setEdges: (edges: Edge[] | ((edges: Edge[]) => Edge[])) => void;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  addNode: (node: Node) => void;
  updateNodeData: (nodeId: string, data: any) => void;
}

export const useFlowStore = create<FlowState>()(
  immer((set) => ({
    nodes: [],
    edges: [],
    selectedNodeId: null,

    setNodes: (update) => {
      set((state) => {
        state.nodes = typeof update === "function" ? update(state.nodes) : update;
      });
    },

    setEdges: (update) => {
      set((state) => {
        state.edges = typeof update === "function" ? update(state.edges) : update;
      });
    },

    onNodesChange: (changes: NodeChange[]) => {
      set((state) => {
        state.nodes = applyNodeChanges(changes, state.nodes);
      });
    },

    onEdgesChange: (changes: EdgeChange[]) => {
      set((state) => {
        state.edges = applyEdgeChanges(changes, state.edges);
      });
    },

    onConnect: (connection: Connection) => {
      set((state) => {
        state.edges = addEdge(connection, state.edges);
      });
    },

    addNode: (node: Node) => {
      set((state) => {
        state.nodes.push(node);
      });
    },

    updateNodeData: (nodeId: string, data: any) => {
      set((state) => {
        const node = state.nodes.find((n) => n.id === nodeId);
        if (node) {
          node.data = { ...node.data, ...data };
        }
      });
    },
  })),
);
