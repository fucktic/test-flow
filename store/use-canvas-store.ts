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
import type { ProjectCanvasData } from "@/lib/project-api";
import type { ProjectDetail, ProjectListItem } from "@/lib/project-types";
import type { ProjectImageAsset, ProjectStoryboard, ProjectVideoAsset } from "@/lib/project-types";

const MAX_SELECTED_STORYBOARDS = 3;

export type MediaItem = {
  id: string;
  name: string;
  url: string;
  poster: string;
  type: "image" | "video";
  status: string;
};

export type StoryboardListNodeData = Record<string, unknown> & {
  episodeId: string;
  episodeName: string;
  storyboards: ProjectStoryboard[];
};

export type StoryboardMediaNodeData = Record<string, unknown> & {
  sceneId: string;
  title: string;
  prompt: string;
  items: MediaItem[];
  mediaType: "image" | "video";
  selected: boolean;
};

export type SelectedMediaGridItem = {
  nodeId: string;
  sceneId: string;
  item: MediaItem;
  anchorRect: {
    height: number;
    left: number;
    top: number;
    width: number;
  };
};

type CanvasNodeData = Record<string, unknown>;
type CanvasNode = Node<CanvasNodeData>;
type CanvasEdge = Edge;
type CurrentCanvasData = {
  projectId: string;
  episodeId: string;
  data: ProjectCanvasData;
};

type CanvasState = {
  currentProject: ProjectDetail | null;
  projects: ProjectListItem[];
  currentCanvasData: CurrentCanvasData | null;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  selectedEpisodeIds: string[];
  selectedStoryboardIds: string[];
  selectedMediaGridItem: SelectedMediaGridItem | null;
  addNode: (label: string) => void;
  addStoryboard: (episodeId: string) => void;
  clearSelectedMediaGridItem: () => void;
  clearCurrentProject: () => void;
  deleteStoryboard: (storyboardId: string) => void;
  moveStoryboard: (storyboardId: string, direction: -1 | 1) => void;
  selectMediaGridItem: (selection: SelectedMediaGridItem) => void;
  setProjectCanvasData: (projectId: string, episodeId: string, data: ProjectCanvasData) => void;
  setCurrentProject: (project: ProjectDetail) => void;
  setProjects: (projects: ProjectListItem[]) => void;
  setSelectedEpisodeIds: (episodeIds: string[]) => void;
  toggleStoryboardSelection: (storyboardId: string) => void;
  onConnect: (connection: Connection) => void;
  onEdgesChange: (changes: EdgeChange<CanvasEdge>[]) => void;
  onNodesChange: (changes: NodeChange<CanvasNode>[]) => void;
  reset: () => void;
};

const readString = (value: unknown): string => (typeof value === "string" ? value : "");

const toNode = (node: (typeof initialFlowState.nodes)[number]): CanvasNode => ({
  ...node,
  data: node.data ?? {},
  type: node.type ?? "default",
});

const toEdge = (edge: (typeof initialFlowState.edges)[number]): CanvasEdge => edge;

const buildInitialState = () => ({
  nodes: initialFlowState.nodes.map(toNode),
  edges: initialFlowState.edges.map(toEdge),
});

// Storyboard mutations stay in the canvas store so node data remains serializable.
const rebuildStoryboardCanvasState = (
  canvasData: CurrentCanvasData,
  selectedStoryboardIds: string[],
  episodeName: string,
) =>
  buildStoryboardCanvas(
    canvasData.episodeId,
    episodeName,
    canvasData.data,
    selectedStoryboardIds,
  );

const resolveNodePosition = (
  data: ProjectCanvasData,
  nodeType: string,
  sceneId: string,
  nodeId: string,
  fallback: { x: number; y: number },
) => {
  const node = data.flow.nodes.find((flowNode) => {
    if (flowNode.id === nodeId) return true;
    if (flowNode.type !== nodeType || !flowNode.data) return false;
    const nodeSceneId = readString(flowNode.data.sceneId) || readString(flowNode.data.id);
    return nodeSceneId === sceneId;
  });

  return node?.position ?? fallback;
};

const resolveNodePositionById = (
  data: ProjectCanvasData,
  nodeId: string,
  fallback: { x: number; y: number },
) => data.flow.nodes.find((flowNode) => flowNode.id === nodeId)?.position ?? fallback;

const findMediaItems = (
  ids: string[],
  assets: Array<ProjectImageAsset | ProjectVideoAsset>,
  mediaType: "image" | "video",
): MediaItem[] =>
  ids.flatMap((id) => {
    const asset = assets.find((item) => item.id === id);
    if (!asset) return [];

    return [
      {
        id: asset.id,
        name: asset.name,
        url: asset.url,
        poster: "poster" in asset ? asset.poster : "",
        type: mediaType,
        status: "status" in asset ? asset.status : "",
      },
    ];
  });

const getStoryboardDisplayName = (storyboard: ProjectStoryboard, index: number) =>
  storyboard.name.trim() || `S${index + 1}`;

const buildStoryboardCanvas = (
  episodeId: string,
  episodeName: string,
  data: ProjectCanvasData,
  selectedStoryboardIds: string[],
) => {
  const availableStoryboardIds = new Set(data.storyboards.map((storyboard) => storyboard.id));
  const visibleSelectedIds = selectedStoryboardIds.filter((id) => availableStoryboardIds.has(id));
  const selectedIds = visibleSelectedIds;
  const selectedStoryboards =
    selectedIds.length > 0
      ? data.storyboards.filter((storyboard) => selectedIds.includes(storyboard.id))
      : [];
  const sceneNode = data.flow.nodes.find((node) => node.type === "sceneNode");
  const listNodeId = `storyboard-list-${episodeId}`;
  const listPosition = resolveNodePositionById(
    data,
    listNodeId,
    sceneNode?.position ?? { x: 80, y: 80 },
  );
  const nodes: CanvasNode[] = [
    {
      id: listNodeId,
      type: "storyboard-list-node",
      position: listPosition,
      data: {
        episodeId,
        episodeName,
        storyboards: data.storyboards,
      } satisfies StoryboardListNodeData,
    },
  ];
  const edges: CanvasEdge[] = [];

  selectedStoryboards.forEach((storyboard, index) => {
    const imageNodeId = `storyboard-image-${storyboard.id}`;
    const videoNodeId = `storyboard-video-${storyboard.id}`;
    const storyboardIndex = data.storyboards.findIndex((item) => item.id === storyboard.id);
    const storyboardName = getStoryboardDisplayName(
      storyboard,
      storyboardIndex >= 0 ? storyboardIndex : index,
    );
    const laneY = listPosition.y + index * 420;

    nodes.push(
      {
        id: imageNodeId,
        type: "storyboard-image-node",
        position: resolveNodePosition(data, "sceneImageNode", storyboard.id, imageNodeId, {
          x: listPosition.x + 320,
          y: laneY,
        }),
        data: {
          sceneId: storyboard.id,
          title: storyboardName,
          prompt: storyboard.prompt || storyboard.description,
          mediaType: "image",
          selected: selectedIds.includes(storyboard.id),
          items: findMediaItems(storyboard.images, data.images, "image"),
        } satisfies StoryboardMediaNodeData,
      },
      {
        id: videoNodeId,
        type: "storyboard-video-node",
        position: resolveNodePosition(data, "sceneVideoNode", storyboard.id, videoNodeId, {
          x: listPosition.x + 640,
          y: laneY,
        }),
        data: {
          sceneId: storyboard.id,
          title: storyboardName,
          prompt: storyboard.prompt || storyboard.description,
          mediaType: "video",
          selected: selectedIds.includes(storyboard.id),
          items: findMediaItems(storyboard.videos, data.videos, "video"),
        } satisfies StoryboardMediaNodeData,
      },
    );

    edges.push(
      {
        id: `edge-${listNodeId}-${imageNodeId}`,
        source: listNodeId,
        target: imageNodeId,
        animated: true,
      },
      {
        id: `edge-${imageNodeId}-${videoNodeId}`,
        source: imageNodeId,
        target: videoNodeId,
        animated: true,
      },
    );
  });

  return { nodes, edges, selectedStoryboardIds: selectedIds };
};

export const useCanvasStore = create<CanvasState>((set) => ({
  currentProject: null,
  projects: [],
  currentCanvasData: null,
  selectedEpisodeIds: [],
  selectedStoryboardIds: [],
  selectedMediaGridItem: null,
  ...buildInitialState(),
  clearCurrentProject: () => set({ currentProject: null, selectedMediaGridItem: null }),
  clearSelectedMediaGridItem: () => set({ selectedMediaGridItem: null }),
  selectMediaGridItem: (selection) => set({ selectedMediaGridItem: selection }),
  setCurrentProject: (project) =>
    set((state) => ({
      currentProject: project,
      selectedMediaGridItem: null,
      selectedEpisodeIds:
        state.selectedEpisodeIds.length > 0 ? state.selectedEpisodeIds : project.episodes.slice(0, 1).map((episode) => episode.id),
    })),
  setProjects: (projects) => set({ projects }),
  setSelectedEpisodeIds: (episodeIds) => set({ selectedEpisodeIds: episodeIds, selectedMediaGridItem: null }),
  setProjectCanvasData: (_projectId, episodeId, data) =>
    set((state) => {
      const episodeName =
        state.currentProject?.episodes.find((episode) => episode.id === episodeId)?.name ?? "";
      const currentCanvasData = {
        projectId: _projectId,
        episodeId,
        data,
      };
      const nextCanvas = buildStoryboardCanvas(
        episodeId,
        episodeName,
        data,
        state.selectedStoryboardIds,
      );
      const currentSelection = state.selectedStoryboardIds.join(",");
      const nextSelection = nextCanvas.selectedStoryboardIds.join(",");

      return {
        currentCanvasData,
        selectedMediaGridItem: null,
        nodes: nextCanvas.nodes,
        edges: nextCanvas.edges,
        selectedStoryboardIds:
          currentSelection === nextSelection ? state.selectedStoryboardIds : nextCanvas.selectedStoryboardIds,
      };
    }),
  toggleStoryboardSelection: (storyboardId) =>
    set((state) => {
      const episodeName =
        state.currentProject?.episodes.find(
          (episode) => episode.id === state.currentCanvasData?.episodeId,
        )?.name ?? "";
      const toCanvasState = (selectedStoryboardIds: string[]) => {
        if (!state.currentCanvasData) return { selectedStoryboardIds };

        const nextCanvas = rebuildStoryboardCanvasState(
          state.currentCanvasData,
          selectedStoryboardIds,
          episodeName,
        );

        return {
          nodes: nextCanvas.nodes,
          edges: nextCanvas.edges,
          selectedStoryboardIds: nextCanvas.selectedStoryboardIds,
        };
      };

      if (state.selectedStoryboardIds.includes(storyboardId)) {
        return {
          ...toCanvasState(state.selectedStoryboardIds.filter((id) => id !== storyboardId)),
          selectedMediaGridItem: null,
        };
      }

      if (state.selectedStoryboardIds.length >= MAX_SELECTED_STORYBOARDS) {
        return {};
      }

      return {
        ...toCanvasState([...state.selectedStoryboardIds, storyboardId]),
        selectedMediaGridItem: null,
      };
    }),
  addStoryboard: (episodeId) =>
    set((state) => {
      if (!state.currentCanvasData || state.currentCanvasData.episodeId !== episodeId) return {};

      const nextStoryboard: ProjectStoryboard = {
        id: `storyboard-${globalThis.crypto?.randomUUID?.() ?? Date.now().toString()}`,
        name: "",
        description: "",
        prompt: "",
        images: [],
        videos: [],
        selectedVideo: "",
      };
      const nextCanvasData: CurrentCanvasData = {
        ...state.currentCanvasData,
        data: {
          ...state.currentCanvasData.data,
          storyboards: [...state.currentCanvasData.data.storyboards, nextStoryboard],
        },
      };
      const episodeName =
        state.currentProject?.episodes.find((episode) => episode.id === episodeId)?.name ?? "";
      const nextCanvas = rebuildStoryboardCanvasState(
        nextCanvasData,
        state.selectedStoryboardIds,
        episodeName,
      );

      return {
        currentCanvasData: nextCanvasData,
        selectedMediaGridItem: null,
        nodes: nextCanvas.nodes,
        edges: nextCanvas.edges,
        selectedStoryboardIds: nextCanvas.selectedStoryboardIds,
      };
    }),
  deleteStoryboard: (storyboardId) =>
    set((state) => {
      if (!state.currentCanvasData) return {};

      const nextStoryboards = state.currentCanvasData.data.storyboards.filter(
        (storyboard) => storyboard.id !== storyboardId,
      );
      if (nextStoryboards.length === state.currentCanvasData.data.storyboards.length) return {};

      const nextCanvasData: CurrentCanvasData = {
        ...state.currentCanvasData,
        data: {
          ...state.currentCanvasData.data,
          storyboards: nextStoryboards,
        },
      };
      const nextSelectedStoryboardIds = state.selectedStoryboardIds.filter(
        (id) => id !== storyboardId,
      );
      const episodeName =
        state.currentProject?.episodes.find(
          (episode) => episode.id === state.currentCanvasData?.episodeId,
        )?.name ?? "";
      const nextCanvas = rebuildStoryboardCanvasState(
        nextCanvasData,
        nextSelectedStoryboardIds,
        episodeName,
      );

      return {
        currentCanvasData: nextCanvasData,
        selectedMediaGridItem: null,
        nodes: nextCanvas.nodes,
        edges: nextCanvas.edges,
        selectedStoryboardIds: nextCanvas.selectedStoryboardIds,
      };
    }),
  moveStoryboard: (storyboardId, direction) =>
    set((state) => {
      if (!state.currentCanvasData) return {};

      const currentIndex = state.currentCanvasData.data.storyboards.findIndex(
        (storyboard) => storyboard.id === storyboardId,
      );
      const nextIndex = currentIndex + direction;
      if (
        currentIndex < 0 ||
        nextIndex < 0 ||
        nextIndex >= state.currentCanvasData.data.storyboards.length
      ) {
        return {};
      }

      const nextStoryboards = [...state.currentCanvasData.data.storyboards];
      const [movedStoryboard] = nextStoryboards.splice(currentIndex, 1);
      if (!movedStoryboard) return {};

      nextStoryboards.splice(nextIndex, 0, movedStoryboard);

      const nextCanvasData: CurrentCanvasData = {
        ...state.currentCanvasData,
        data: {
          ...state.currentCanvasData.data,
          storyboards: nextStoryboards,
        },
      };
      const episodeName =
        state.currentProject?.episodes.find(
          (episode) => episode.id === state.currentCanvasData?.episodeId,
        )?.name ?? "";
      const nextCanvas = rebuildStoryboardCanvasState(
        nextCanvasData,
        state.selectedStoryboardIds,
        episodeName,
      );

      return {
        currentCanvasData: nextCanvasData,
        selectedMediaGridItem: null,
        nodes: nextCanvas.nodes,
        edges: nextCanvas.edges,
        selectedStoryboardIds: nextCanvas.selectedStoryboardIds,
      };
    }),
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
  reset: () => set({ ...buildInitialState(), selectedMediaGridItem: null }),
}));
