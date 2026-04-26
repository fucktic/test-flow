"use client";

import "@xyflow/react/dist/style.css";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
  type NodeTypes,
} from "@xyflow/react";
import { useTranslations } from "next-intl";
import {
  ChatWindow,
  type ChatWindowModelOption,
  type ChatWindowReferenceImage,
} from "@/components/canvas/chat-window";
import { StoryboardImageNode } from "@/components/canvas/nodes/storyboard-image-node";
import { StoryboardListNode } from "@/components/canvas/nodes/storyboard-list-node";
import { StoryboardVideoNode } from "@/components/canvas/nodes/storyboard-video-node";
import { useSilentAgentCommand } from "@/components/canvas/use-silent-agent-command";
import type { AppConfig } from "@/lib/config-schema";
import { flowStateSchema, type FlowState } from "@/lib/flow-schema";
import { fetchProjectCanvasData, saveProjectFlow, saveProjectSelectedModel } from "@/lib/project-api";
import { useCanvasStore } from "@/store/use-canvas-store";

const FLOW_SAVE_DELAY_MS = 500;
const EMPTY_CONFIG: AppConfig = {
  imageBeds: [],
  imageModels: [],
  videoModels: [],
};

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
  const { fitView } = useReactFlow();
  const workspaceRef = useRef<HTMLDivElement>(null);
  const { execute: executeSilentAgentCommand } = useSilentAgentCommand();
  const [chatWindowPosition, setChatWindowPosition] = useState<{ left: number; top: number } | null>(
    null,
  );
  const [config, setConfig] = useState<AppConfig>(EMPTY_CONFIG);
  const [selectedImageModelId, setSelectedImageModelId] = useState("");
  const [selectedVideoModelId, setSelectedVideoModelId] = useState("");
  const {
    currentCanvasData,
    currentProject,
    edges,
    nodes,
    onConnect,
    onEdgesChange,
    onNodesChange,
    clearSelectedMediaGridItem,
    selectedEpisodeIds,
    selectedMediaGridItem,
    setProjectCanvasDataBatch,
  } = useCanvasStore();
  const activeEpisodeIds = useMemo(() => {
    const availableEpisodeIds = new Set(currentProject?.episodes.map((episode) => episode.id) ?? []);
    const visibleEpisodeIds = selectedEpisodeIds.filter((episodeId) =>
      availableEpisodeIds.has(episodeId),
    );

    return visibleEpisodeIds.length > 0
      ? visibleEpisodeIds
      : currentProject?.episodes.slice(0, 1).map((episode) => episode.id) ?? [];
  }, [currentProject?.episodes, selectedEpisodeIds]);
  const modelOptions = useMemo<ChatWindowModelOption[]>(() => {
    const models =
      selectedMediaGridItem?.item.type === "video" ? config.videoModels : config.imageModels;

    return models.map((model) => ({
      id: model.id,
      name: model.name,
    }));
  }, [config.imageModels, config.videoModels, selectedMediaGridItem?.item.type]);
  const preferredModelId =
    selectedMediaGridItem?.item.type === "video" ? selectedVideoModelId : selectedImageModelId;
  const selectedModelId = modelOptions.some((model) => model.id === preferredModelId)
    ? preferredModelId
    : modelOptions[0]?.id ?? "";
  const selectedImageModel = config.imageModels.find((model) => model.id === selectedModelId);
  const selectedVideoModel = config.videoModels.find((model) => model.id === selectedModelId);
  const selectedProjectModel =
    selectedMediaGridItem?.item.type === "video" ? selectedVideoModel : selectedImageModel;
  const commandStatus =
    selectedMediaGridItem?.item.status === "loading" ||
    selectedMediaGridItem?.item.status === "error" ||
    selectedMediaGridItem?.item.status === "success"
      ? selectedMediaGridItem.item.status
      : undefined;
  const commandStatusLabel = commandStatus ? t(`mediaGrid.${commandStatus}`) : undefined;
  const requiresFirstLastFrame =
    selectedMediaGridItem?.item.type === "video" &&
    selectedVideoModel?.videoReferenceMode === "first-last-frame";
  const imageFallbackLabel = useCallback(
    (index: number) => t("chatWindow.imageFallback", { index }),
    [t],
  );
  const referenceImages = useMemo<ChatWindowReferenceImage[]>(() => {
    if (!selectedMediaGridItem || !currentCanvasData) return [];

    const storyboard = currentCanvasData.data.storyboards.find(
      (item) => item.id === selectedMediaGridItem.sceneId,
    );
    if (!storyboard) return [];

    return storyboard.images.flatMap((imageId, index) => {
      const image = currentCanvasData.data.images.find((item) => item.id === imageId);
      if (!image) return [];

      return [
        {
          id: image.id,
          label: image.name.trim() || imageFallbackLabel(index + 1),
          name: image.name.trim() || imageFallbackLabel(index + 1),
          url: image.url,
        },
      ];
    });
  }, [currentCanvasData, imageFallbackLabel, selectedMediaGridItem]);
  const mediaMentionImages = selectedMediaGridItem?.item.type === "video" ? referenceImages : [];
  const handleModelChange =
    selectedMediaGridItem?.item.type === "video" ? setSelectedVideoModelId : setSelectedImageModelId;
  const saveSelectedProjectModel = useCallback(async () => {
    if (!currentProject || !selectedProjectModel || !selectedMediaGridItem) return false;

    if (selectedMediaGridItem.item.type === "video") {
      if (!selectedVideoModel) return false;

      await saveProjectSelectedModel(currentProject.id, {
        apiKey: selectedVideoModel.apiKey,
        example: selectedVideoModel.example,
        id: selectedVideoModel.id,
        name: selectedVideoModel.name,
        type: "video",
        videoReferenceMode: selectedVideoModel.videoReferenceMode,
      });

      return true;
    }

    await saveProjectSelectedModel(currentProject.id, {
      apiKey: selectedProjectModel.apiKey,
      example: selectedProjectModel.example,
      id: selectedProjectModel.id,
      name: selectedProjectModel.name,
      type: "image",
    });

    return true;
  }, [currentProject, selectedMediaGridItem, selectedProjectModel, selectedVideoModel]);
  const nodeTypes = useMemo<NodeTypes>(
    () => ({
      "storyboard-list-node": StoryboardListNode,
      "storyboard-image-node": StoryboardImageNode,
      "storyboard-video-node": StoryboardVideoNode,
    }),
    [],
  );

  const updateChatWindowPosition = useCallback(() => {
    const workspaceElement = workspaceRef.current;
    if (!selectedMediaGridItem || !workspaceElement) {
      setChatWindowPosition(null);
      return;
    }

    const selectedGridElement = workspaceElement.querySelector(
      "[data-selected-media-grid-item='true']",
    );
    const workspaceRect = workspaceElement.getBoundingClientRect();
    const anchorRect =
      selectedGridElement instanceof Element
        ? selectedGridElement.getBoundingClientRect()
        : selectedMediaGridItem.anchorRect;
    const preferredLeft = anchorRect.left - workspaceRect.left + anchorRect.width + 12;
    const preferredTop = anchorRect.top - workspaceRect.top + anchorRect.height / 2;
    const maxTop = Math.max(116, workspaceRect.height - 116);

    setChatWindowPosition({
      left: Math.max(16, preferredLeft),
      top: Math.min(Math.max(116, preferredTop), maxTop),
    });
  }, [selectedMediaGridItem]);

  useEffect(() => {
    updateChatWindowPosition();
  }, [updateChatWindowPosition]);

  useEffect(() => {
    if (!selectedMediaGridItem) return;

    window.addEventListener("resize", updateChatWindowPosition);

    return () => {
      window.removeEventListener("resize", updateChatWindowPosition);
    };
  }, [selectedMediaGridItem, updateChatWindowPosition]);

  useEffect(() => {
    if (!selectedMediaGridItem) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const isSelectedGridClick = Boolean(target.closest("[data-selected-media-grid-item='true']"));
      const isChatWindowClick = Boolean(target.closest("[data-canvas-chat-window='true']"));
      const isChatSelectClick = Boolean(target.closest("[data-slot='select-content']"));

      if (isSelectedGridClick || isChatWindowClick || isChatSelectClick) return;
      clearSelectedMediaGridItem();
    };

    document.addEventListener("pointerdown", handlePointerDown, true);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, [clearSelectedMediaGridItem, selectedMediaGridItem]);

  useEffect(() => {
    let active = true;

    const loadConfig = async () => {
      try {
        const response = await fetch("/api/config");
        if (!response.ok) return;

        const payload = (await response.json()) as { config?: AppConfig };
        if (active && payload.config) setConfig(payload.config);
      } catch {
        // The model selector can stay empty until settings are available.
      }
    };

    void loadConfig();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    const loadCanvasData = async () => {
      if (!currentProject || activeEpisodeIds.length === 0) return;

      try {
        const episodeEntries = await Promise.all(
          activeEpisodeIds.map(async (episodeId) => [
            episodeId,
            await fetchProjectCanvasData(currentProject.id, episodeId),
          ] as const),
        );
        if (!active) return;
        setProjectCanvasDataBatch(currentProject.id, Object.fromEntries(episodeEntries));
      } catch {
        // Keep the existing canvas visible if project files are temporarily unavailable.
      }
    };

    void loadCanvasData();

    return () => {
      active = false;
    };
  }, [
    activeEpisodeIds,
    currentProject,
    setProjectCanvasDataBatch,
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

  useEffect(() => {
    if (!currentProject || nodes.length === 0) return;

    window.requestAnimationFrame(() => {
      void fitView({ duration: 240, padding: 0.18 });
    });
  }, [currentProject, fitView, nodes]);

  return (
    <div
      ref={workspaceRef}
      className="relative h-full overflow-visible rounded-xl border border-white/10 bg-black/30"
    >
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
        onMove={updateChatWindowPosition}
        onNodesChange={onNodesChange}
        onPaneClick={clearSelectedMediaGridItem}
      >

        <MiniMap
          pannable
          zoomable
        />
        <Controls />
        <Background />
      </ReactFlow>

      {chatWindowPosition ? (
        <div
          data-canvas-chat-window="true"
          className="absolute z-20 w-[min(640px,calc(100%-32px))] -translate-y-1/2"
          style={{
            left: chatWindowPosition.left,
            top: chatWindowPosition.top,
          }}
        >
          <ChatWindow
            commandStatus={commandStatus}
            commandStatusLabel={commandStatusLabel}
            projectId={currentProject?.id ?? ""}
            emptyModelLabel={t("chatWindow.emptyModel")}
            placeholder={t("chatWindow.placeholder")}
            inputLabel={t("chatWindow.inputLabel")}
            addAttachmentLabel={t("chatWindow.addAttachment")}
            attachmentFallbackLabel={(index) => t("chatWindow.imageFallback", { index })}
            attachmentListLabel={t("chatWindow.attachmentList")}
            removeAttachmentLabel={t("chatWindow.removeAttachment")}
            firstFrameLabel={t("chatWindow.firstFrame")}
            lastFrameLabel={t("chatWindow.lastFrame")}
            promptPairSeparator={t("chatWindow.promptPairSeparator")}
            modelSelectLabel={t("chatWindow.modelSelect")}
            modelOptions={modelOptions}
            mediaMentionImages={mediaMentionImages}
            referenceImages={referenceImages}
            requiresFirstLastFrame={requiresFirstLastFrame}
            selectedModelId={selectedModelId}
            sendLabel={t("chatWindow.send")}
            showVideoOptions={selectedMediaGridItem?.item.type === "video"}
            videoDurationLabel={t("chatWindow.videoDuration")}
            videoDurationUnitLabel={t("chatWindow.videoDurationUnit")}
            videoShotLabel={t("chatWindow.videoShot")}
            videoShotLabels={{
              static: t("chatWindow.videoShots.static"),
              "push-in": t("chatWindow.videoShots.pushIn"),
              "pull-out": t("chatWindow.videoShots.pullOut"),
              pan: t("chatWindow.videoShots.pan"),
              tilt: t("chatWindow.videoShots.tilt"),
              tracking: t("chatWindow.videoShots.tracking"),
              orbit: t("chatWindow.videoShots.orbit"),
              handheld: t("chatWindow.videoShots.handheld"),
            }}
            onModelChange={handleModelChange}
            onSubmit={(payload) => {
              if (!selectedMediaGridItem) return;

              void (async () => {
                try {
                  const saved = await saveSelectedProjectModel();
                  if (!saved) return;

                  await executeSilentAgentCommand(payload, {
                    mediaId: selectedMediaGridItem.item.id,
                    mediaName: selectedMediaGridItem.item.name,
                    mediaType: selectedMediaGridItem.item.type,
                    scope: "canvas-grid",
                  });
                } catch {
                  // The agent run depends on the project model config being current.
                }
              })();
            }}
          />
        </div>
      ) : null}
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
