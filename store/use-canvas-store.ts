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
import { v4 as createUuid } from "uuid";
import {create} from "zustand";
import {initialFlowState} from "@/lib/flow-schema";
import type { ProjectCanvasData, ProjectCommandStatus } from "@/lib/project-api";
import type { ProjectDetail, ProjectListItem } from "@/lib/project-types";
import type { ProjectImageAsset, ProjectStoryboard, ProjectVideoAsset } from "@/lib/project-types";

const MAX_SELECTED_STORYBOARDS = 3;
const STORYBOARD_LIST_MAX_HEIGHT = 420;
const EPISODE_NODE_VERTICAL_GAP = STORYBOARD_LIST_MAX_HEIGHT + 100;
const STORYBOARD_NODE_VERTICAL_GAP = 360;

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
  selectedVideoId?: string;
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
type CanvasDataByEpisode = Record<string, CurrentCanvasData>;

type CanvasState = {
  commandStatuses: Record<string, ProjectCommandStatus>;
  currentProject: ProjectDetail | null;
  projects: ProjectListItem[];
  currentCanvasData: CurrentCanvasData | null;
  currentCanvasDataByEpisode: CanvasDataByEpisode;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  selectedEpisodeIds: string[];
  selectedStoryboardIds: string[];
  selectedMediaGridItem: SelectedMediaGridItem | null;
  addImageToStoryboard: (storyboardId: string, image: ProjectImageAsset) => void;
  addVideoToStoryboard: (storyboardId: string, video: ProjectVideoAsset) => void;
  removeMediaFromStoryboard: (
    storyboardId: string,
    mediaId: string,
    mediaType: "image" | "video",
  ) => void;
  setStoryboardSelectedVideo: (storyboardId: string, videoId: string) => void;
  updateImageAsset: (image: ProjectImageAsset) => void;
  updateVideoAsset: (video: ProjectVideoAsset) => void;
  addNode: (label: string) => void;
  addStoryboard: (episodeId: string, afterStoryboardId?: string) => void;
  clearSelectedMediaGridItem: () => void;
  clearCurrentProject: () => void;
  deleteStoryboard: (storyboardId: string) => void;
  moveStoryboard: (storyboardId: string, direction: -1 | 1) => void;
  selectMediaGridItem: (selection: SelectedMediaGridItem) => void;
  setCommandStatus: (gridId: string, status: ProjectCommandStatus) => void;
  setCommandStatuses: (statuses: Record<string, ProjectCommandStatus>) => void;
  setProjectCanvasData: (projectId: string, episodeId: string, data: ProjectCanvasData) => void;
  setProjectCanvasDataBatch: (
    projectId: string,
    dataByEpisode: Record<string, ProjectCanvasData>,
  ) => void;
  setCurrentProject: (project: ProjectDetail) => void;
  setProjects: (projects: ProjectListItem[]) => void;
  setSelectedEpisodeIds: (episodeIds: string[]) => void;
  toggleStoryboardSelection: (storyboardId: string) => void;
  onConnect: (connection: Connection) => void;
  onEdgesChange: (changes: EdgeChange<CanvasEdge>[]) => void;
  onNodesChange: (changes: NodeChange<CanvasNode>[]) => void;
  reset: () => void;
};

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
  commandStatuses: Record<string, ProjectCommandStatus>,
) =>
  buildStoryboardCanvas(
    canvasData.episodeId,
    episodeName,
    canvasData.data,
    selectedStoryboardIds,
    commandStatuses,
  );

const findMediaItems = (
  ids: string[],
  assets: Array<ProjectImageAsset | ProjectVideoAsset>,
  mediaType: "image" | "video",
  commandStatuses: Record<string, ProjectCommandStatus>,
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
        status: commandStatuses[asset.id] ?? ("status" in asset ? asset.status : ""),
      },
    ];
  });

const getStoryboardDisplayName = (storyboard: ProjectStoryboard, index: number) =>
  storyboard.name.trim() || `S${index + 1}`;

const resolveNodePosition = (
  data: ProjectCanvasData,
  nodeId: string,
  fallback: { x: number; y: number },
) => data.flow.nodes.find((flowNode) => flowNode.id === nodeId)?.position ?? fallback;

const updateFlowFromCanvasNodes = (
  canvasDataByEpisode: CanvasDataByEpisode,
  nodes: CanvasNode[],
): CanvasDataByEpisode => {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));

  return Object.fromEntries(
    Object.entries(canvasDataByEpisode).map(([episodeId, canvasData]) => {
      const allowedNodeIds = new Set([
        `storyboard-list-${episodeId}`,
        ...canvasData.data.storyboards.flatMap((storyboard) => [
          `storyboard-image-${storyboard.id}`,
          `storyboard-video-${storyboard.id}`,
        ]),
      ]);
      const nextFlowNodes = Array.from(allowedNodeIds).flatMap((nodeId) => {
        const node = nodeById.get(nodeId);
        if (!node) return [];

        return [
          {
            id: node.id,
            type: node.type,
            position: node.position,
            hidden: node.hidden,
          },
        ];
      });

      return [
        episodeId,
        {
          ...canvasData,
          data: {
            ...canvasData.data,
            flow: {
              nodes: nextFlowNodes,
              edges: canvasData.data.flow.edges,
            },
          },
        },
      ];
    }),
  );
};

const buildStoryboardCanvas = (
  episodeId: string,
  episodeName: string,
  data: ProjectCanvasData,
  selectedStoryboardIds: string[],
  commandStatuses: Record<string, ProjectCommandStatus>,
  listFallbackPosition = { x: 80, y: 80 },
) => {
  const availableStoryboardIds = new Set(data.storyboards.map((storyboard) => storyboard.id));
  const visibleSelectedIds = selectedStoryboardIds.filter((id) => availableStoryboardIds.has(id));
  const selectedIds = visibleSelectedIds;
  const selectedStoryboards =
    selectedIds.length > 0
      ? data.storyboards.filter((storyboard) => selectedIds.includes(storyboard.id))
      : [];
  const listNodeId = `storyboard-list-${episodeId}`;
  const listPosition = resolveNodePosition(data, listNodeId, listFallbackPosition);
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
    const laneY = listPosition.y + index * STORYBOARD_NODE_VERTICAL_GAP;

    nodes.push(
      {
        id: imageNodeId,
        type: "storyboard-image-node",
        position: resolveNodePosition(data, imageNodeId, { x: listPosition.x + 320, y: laneY }),
        data: {
          sceneId: storyboard.id,
          title: storyboardName,
          prompt: storyboard.prompt || storyboard.description,
          mediaType: "image",
          selected: selectedIds.includes(storyboard.id),
          items: findMediaItems(storyboard.images, data.images, "image", commandStatuses),
        } satisfies StoryboardMediaNodeData,
      },
      {
        id: videoNodeId,
        type: "storyboard-video-node",
        position: resolveNodePosition(data, videoNodeId, { x: listPosition.x + 640, y: laneY }),
        data: {
          sceneId: storyboard.id,
          title: storyboardName,
          prompt: storyboard.prompt || storyboard.description,
          mediaType: "video",
          selected: selectedIds.includes(storyboard.id),
          items: findMediaItems(storyboard.videos, data.videos, "video", commandStatuses),
          selectedVideoId: storyboard.selectedVideo,
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

const buildSelectedEpisodesCanvas = (
  project: ProjectDetail | null,
  selectedEpisodeIds: string[],
  canvasDataByEpisode: CanvasDataByEpisode,
  selectedStoryboardIds: string[],
  commandStatuses: Record<string, ProjectCommandStatus>,
) => {
  const projectEpisodeIds = new Set(project?.episodes.map((episode) => episode.id) ?? []);
  const episodeIds = selectedEpisodeIds.filter(
    (episodeId) => projectEpisodeIds.has(episodeId) && canvasDataByEpisode[episodeId],
  );
  const nodes: CanvasNode[] = [];
  const edges: CanvasEdge[] = [];
  const validStoryboardIds = new Set<string>();

  episodeIds.forEach((episodeId, index) => {
    const canvasData = canvasDataByEpisode[episodeId];
    if (!canvasData) return;

    canvasData.data.storyboards.forEach((storyboard) => validStoryboardIds.add(storyboard.id));
    const episodeName = project?.episodes.find((episode) => episode.id === episodeId)?.name ?? "";
    const nextCanvas = buildStoryboardCanvas(
      episodeId,
      episodeName,
      canvasData.data,
      selectedStoryboardIds,
      commandStatuses,
      { x: 80, y: 80 + index * EPISODE_NODE_VERTICAL_GAP },
    );

    nodes.push(...nextCanvas.nodes);
    edges.push(...nextCanvas.edges);
  });

  return {
    currentCanvasData: episodeIds[0] ? canvasDataByEpisode[episodeIds[0]] ?? null : null,
    edges,
    nodes,
    selectedStoryboardIds: selectedStoryboardIds.filter((id) => validStoryboardIds.has(id)),
  };
};

export const useCanvasStore = create<CanvasState>((set) => ({
  commandStatuses: {},
  currentProject: null,
  projects: [],
  currentCanvasData: null,
  currentCanvasDataByEpisode: {},
  selectedEpisodeIds: [],
  selectedStoryboardIds: [],
  selectedMediaGridItem: null,
  ...buildInitialState(),
  clearCurrentProject: () =>
    set({
      commandStatuses: {},
      currentCanvasData: null,
      currentCanvasDataByEpisode: {},
      currentProject: null,
      selectedMediaGridItem: null,
    }),
  clearSelectedMediaGridItem: () => set({ selectedMediaGridItem: null }),
  selectMediaGridItem: (selection) => set({ selectedMediaGridItem: selection }),
  setCurrentProject: (project) =>
    set((state) => ({
      currentProject: project,
      selectedMediaGridItem: null,
      selectedEpisodeIds:
        state.selectedEpisodeIds.length > 0 ? state.selectedEpisodeIds : project.episodes.slice(0, 3).map((episode) => episode.id),
    })),
  setProjects: (projects) => set({ projects }),
  setSelectedEpisodeIds: (episodeIds) =>
    set((state) => {
      const nextCanvas = buildSelectedEpisodesCanvas(
        state.currentProject,
        episodeIds,
        state.currentCanvasDataByEpisode,
        state.selectedStoryboardIds,
        state.commandStatuses,
      );

      return {
        currentCanvasData: nextCanvas.currentCanvasData,
        edges: nextCanvas.nodes.length > 0 ? nextCanvas.edges : state.edges,
        nodes: nextCanvas.nodes.length > 0 ? nextCanvas.nodes : state.nodes,
        selectedEpisodeIds: episodeIds,
        selectedMediaGridItem: null,
        selectedStoryboardIds: nextCanvas.selectedStoryboardIds,
      };
    }),
  setCommandStatus: (gridId, status) =>
    set((state) => {
      const nextStatuses = { ...state.commandStatuses, [gridId]: status };
      const selectedMediaGridItem =
        state.selectedMediaGridItem?.item.id === gridId
          ? {
              ...state.selectedMediaGridItem,
              item: {
                ...state.selectedMediaGridItem.item,
                status,
              },
            }
          : state.selectedMediaGridItem;

      if (!state.currentCanvasData) {
        return {
          commandStatuses: nextStatuses,
          selectedMediaGridItem,
        };
      }

      const nextCanvas = buildSelectedEpisodesCanvas(
        state.currentProject,
        state.selectedEpisodeIds,
        state.currentCanvasDataByEpisode,
        state.selectedStoryboardIds,
        nextStatuses,
      );

      return {
        commandStatuses: nextStatuses,
        edges: nextCanvas.edges,
        nodes: nextCanvas.nodes,
        selectedMediaGridItem,
      };
    }),
  setCommandStatuses: (statuses) =>
    set((state) => {
      if (!state.currentCanvasData) return { commandStatuses: statuses };

      const nextCanvas = buildSelectedEpisodesCanvas(
        state.currentProject,
        state.selectedEpisodeIds,
        state.currentCanvasDataByEpisode,
        state.selectedStoryboardIds,
        statuses,
      );

      return {
        commandStatuses: statuses,
        edges: nextCanvas.edges,
        nodes: nextCanvas.nodes,
        selectedMediaGridItem: null,
      };
    }),
  setProjectCanvasData: (_projectId, episodeId, data) =>
    set((state) => {
      const currentCanvasData = {
        projectId: _projectId,
        episodeId,
        data,
      };
      const nextCanvasDataByEpisode = {
        ...state.currentCanvasDataByEpisode,
        [episodeId]: currentCanvasData,
      };
      const nextCanvas = buildSelectedEpisodesCanvas(
        state.currentProject,
        state.selectedEpisodeIds.includes(episodeId) ? state.selectedEpisodeIds : [episodeId],
        nextCanvasDataByEpisode,
        state.selectedStoryboardIds,
        state.commandStatuses,
      );
      const currentSelection = state.selectedStoryboardIds.join(",");
      const nextSelection = nextCanvas.selectedStoryboardIds.join(",");

      return {
        currentCanvasData: nextCanvas.currentCanvasData ?? currentCanvasData,
        currentCanvasDataByEpisode: nextCanvasDataByEpisode,
        selectedMediaGridItem: null,
        nodes: nextCanvas.nodes,
        edges: nextCanvas.edges,
        selectedStoryboardIds:
          currentSelection === nextSelection ? state.selectedStoryboardIds : nextCanvas.selectedStoryboardIds,
      };
    }),
  setProjectCanvasDataBatch: (projectId, dataByEpisode) =>
    set((state) => {
      const nextCanvasDataByEpisode = Object.fromEntries(
        Object.entries(dataByEpisode).map(([episodeId, data]) => [
          episodeId,
          {
            projectId,
            episodeId,
            data,
          } satisfies CurrentCanvasData,
        ]),
      );
      const nextCanvas = buildSelectedEpisodesCanvas(
        state.currentProject,
        state.selectedEpisodeIds,
        nextCanvasDataByEpisode,
        state.selectedStoryboardIds,
        state.commandStatuses,
      );
      const currentSelection = state.selectedStoryboardIds.join(",");
      const nextSelection = nextCanvas.selectedStoryboardIds.join(",");

      return {
        currentCanvasData: nextCanvas.currentCanvasData,
        currentCanvasDataByEpisode: nextCanvasDataByEpisode,
        edges: nextCanvas.edges,
        nodes: nextCanvas.nodes,
        selectedMediaGridItem: null,
        selectedStoryboardIds:
          currentSelection === nextSelection ? state.selectedStoryboardIds : nextCanvas.selectedStoryboardIds,
      };
    }),
  addImageToStoryboard: (storyboardId, image) =>
    set((state) => {
      if (!state.currentCanvasData) return {};

      const currentImages = state.currentCanvasData.data.images;
      const nextImages = currentImages.some((item) => item.id === image.id)
        ? currentImages.map((item) => (item.id === image.id ? image : item))
        : [image, ...currentImages];
      const nextStoryboards = state.currentCanvasData.data.storyboards.map((storyboard) => {
        if (storyboard.id !== storyboardId || storyboard.images.includes(image.id)) {
          return storyboard;
        }

        return {
          ...storyboard,
          images: [image.id, ...storyboard.images],
        };
      });
      const nextCanvasData: CurrentCanvasData = {
        ...state.currentCanvasData,
        data: {
          ...state.currentCanvasData.data,
          images: nextImages,
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
        state.commandStatuses,
      );

      return {
        currentCanvasData: nextCanvasData,
        nodes: nextCanvas.nodes,
        edges: nextCanvas.edges,
        selectedMediaGridItem: null,
      };
    }),
  updateImageAsset: (image) =>
    set((state) => {
      if (!state.currentCanvasData) return {};

      const nextCanvasData: CurrentCanvasData = {
        ...state.currentCanvasData,
        data: {
          ...state.currentCanvasData.data,
          images: state.currentCanvasData.data.images.map((item) =>
            item.id === image.id ? image : item,
          ),
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
        state.commandStatuses,
      );

      return {
        currentCanvasData: nextCanvasData,
        nodes: nextCanvas.nodes,
        edges: nextCanvas.edges,
      };
    }),
  addVideoToStoryboard: (storyboardId, video) =>
    set((state) => {
      if (!state.currentCanvasData) return {};

      const currentVideos = state.currentCanvasData.data.videos;
      const nextVideos = currentVideos.some((item) => item.id === video.id)
        ? currentVideos.map((item) => (item.id === video.id ? video : item))
        : [video, ...currentVideos];
      const nextStoryboards = state.currentCanvasData.data.storyboards.map((storyboard) => {
        if (storyboard.id !== storyboardId || storyboard.videos.includes(video.id)) {
          return storyboard;
        }

        return {
          ...storyboard,
          videos: [video.id, ...storyboard.videos],
        };
      });
      const nextCanvasData: CurrentCanvasData = {
        ...state.currentCanvasData,
        data: {
          ...state.currentCanvasData.data,
          videos: nextVideos,
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
        state.commandStatuses,
      );

      return {
        currentCanvasData: nextCanvasData,
        nodes: nextCanvas.nodes,
        edges: nextCanvas.edges,
        selectedMediaGridItem: null,
      };
    }),
  updateVideoAsset: (video) =>
    set((state) => {
      if (!state.currentCanvasData) return {};

      const nextCanvasData: CurrentCanvasData = {
        ...state.currentCanvasData,
        data: {
          ...state.currentCanvasData.data,
          videos: state.currentCanvasData.data.videos.map((item) =>
            item.id === video.id ? video : item,
          ),
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
        state.commandStatuses,
      );

      return {
        currentCanvasData: nextCanvasData,
        nodes: nextCanvas.nodes,
        edges: nextCanvas.edges,
      };
    }),
  removeMediaFromStoryboard: (storyboardId, mediaId, mediaType) =>
    set((state) => {
      if (!state.currentCanvasData) return {};

      const nextCanvasData: CurrentCanvasData = {
        ...state.currentCanvasData,
        data: {
          ...state.currentCanvasData.data,
          images:
            mediaType === "image"
              ? state.currentCanvasData.data.images.filter((image) => image.id !== mediaId)
              : state.currentCanvasData.data.images,
          videos:
            mediaType === "video"
              ? state.currentCanvasData.data.videos.filter((video) => video.id !== mediaId)
              : state.currentCanvasData.data.videos,
          storyboards: state.currentCanvasData.data.storyboards.map((storyboard) => {
            if (storyboard.id !== storyboardId) return storyboard;

            return {
              ...storyboard,
              images:
                mediaType === "image"
                  ? storyboard.images.filter((imageId) => imageId !== mediaId)
                  : storyboard.images,
              selectedVideo:
                mediaType === "video" && storyboard.selectedVideo === mediaId
                  ? ""
                  : storyboard.selectedVideo,
              videos:
                mediaType === "video"
                  ? storyboard.videos.filter((videoId) => videoId !== mediaId)
                  : storyboard.videos,
            };
          }),
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
        state.commandStatuses,
      );

      return {
        currentCanvasData: nextCanvasData,
        nodes: nextCanvas.nodes,
        edges: nextCanvas.edges,
        selectedMediaGridItem:
          state.selectedMediaGridItem?.item.id === mediaId ? null : state.selectedMediaGridItem,
      };
    }),
  setStoryboardSelectedVideo: (storyboardId, videoId) =>
    set((state) => {
      const targetEpisodeId = Object.entries(state.currentCanvasDataByEpisode).find(([, canvasData]) =>
        canvasData.data.storyboards.some((storyboard) => storyboard.id === storyboardId),
      )?.[0];
      if (!targetEpisodeId) return {};

      const targetCanvasData = state.currentCanvasDataByEpisode[targetEpisodeId];
      if (!targetCanvasData) return {};

      const nextTargetCanvasData: CurrentCanvasData = {
        ...targetCanvasData,
        data: {
          ...targetCanvasData.data,
          storyboards: targetCanvasData.data.storyboards.map((storyboard) =>
            storyboard.id === storyboardId
              ? {
                  ...storyboard,
                  selectedVideo: videoId,
                }
              : storyboard,
          ),
        },
      };
      const nextCanvasDataByEpisode = {
        ...state.currentCanvasDataByEpisode,
        [targetEpisodeId]: nextTargetCanvasData,
      };
      const nextCanvas = buildSelectedEpisodesCanvas(
        state.currentProject,
        state.selectedEpisodeIds,
        nextCanvasDataByEpisode,
        state.selectedStoryboardIds,
        state.commandStatuses,
      );

      return {
        currentCanvasData: nextCanvas.currentCanvasData,
        currentCanvasDataByEpisode: nextCanvasDataByEpisode,
        nodes: nextCanvas.nodes,
        edges: nextCanvas.edges,
      };
    }),
  toggleStoryboardSelection: (storyboardId) =>
    set((state) => {
      const toCanvasState = (selectedStoryboardIds: string[]) => {
        if (!state.currentCanvasData) return { selectedStoryboardIds };

        const nextCanvas = buildSelectedEpisodesCanvas(
          state.currentProject,
          state.selectedEpisodeIds,
          state.currentCanvasDataByEpisode,
          selectedStoryboardIds,
          state.commandStatuses,
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
  addStoryboard: (episodeId, afterStoryboardId) =>
    set((state) => {
      const episodeCanvasData = state.currentCanvasDataByEpisode[episodeId];
      if (!episodeCanvasData) return {};

      const nextStoryboard: ProjectStoryboard = {
        id: `storyboard-${createUuid()}`,
        name: "",
        description: "",
        prompt: "",
        images: [],
        videos: [],
        selectedVideo: "",
      };
      const insertIndex = afterStoryboardId
        ? episodeCanvasData.data.storyboards.findIndex(
            (storyboard) => storyboard.id === afterStoryboardId,
          )
        : -1;
      const nextStoryboards = [...episodeCanvasData.data.storyboards];

      nextStoryboards.splice(insertIndex >= 0 ? insertIndex + 1 : nextStoryboards.length, 0, nextStoryboard);

      const nextCanvasData: CurrentCanvasData = {
        ...episodeCanvasData,
        data: {
          ...episodeCanvasData.data,
          storyboards: nextStoryboards,
        },
      };
      const nextCanvasDataByEpisode = {
        ...state.currentCanvasDataByEpisode,
        [episodeId]: nextCanvasData,
      };
      const nextCanvas = buildSelectedEpisodesCanvas(
        state.currentProject,
        state.selectedEpisodeIds,
        nextCanvasDataByEpisode,
        state.selectedStoryboardIds,
        state.commandStatuses,
      );

      return {
        currentCanvasData: nextCanvas.currentCanvasData,
        currentCanvasDataByEpisode: nextCanvasDataByEpisode,
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
        state.commandStatuses,
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
        state.commandStatuses,
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
    set((state) => {
      const nextNodes = applyNodeChanges(changes, state.nodes);
      const nextCanvasDataByEpisode = updateFlowFromCanvasNodes(
        state.currentCanvasDataByEpisode,
        nextNodes,
      );
      const currentCanvasData = state.currentCanvasData?.episodeId
        ? nextCanvasDataByEpisode[state.currentCanvasData.episodeId] ?? state.currentCanvasData
        : state.currentCanvasData;

      return {
        currentCanvasData,
        currentCanvasDataByEpisode: nextCanvasDataByEpisode,
        nodes: nextNodes,
      };
    }),
  reset: () => set({ ...buildInitialState(), selectedMediaGridItem: null }),
}));
