"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  CheckCircle2,
  ImageIcon,
  Info,
  ListTree,
  Loader2,
  Plus,
  Search,
  Trash2,
  WandSparkles,
} from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";

import { AssetCreateDialog } from "@/components/assets/asset-create-dialog";
import { ChatWindow, type ChatWindowModelOption } from "@/components/canvas/chat-window";
import { useSilentAgentCommand } from "@/components/canvas/use-silent-agent-command";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { fetchConfigCached } from "@/lib/client-data-cache";
import type { AppConfig } from "@/lib/config-schema";
import {
  deleteProjectImage,
  fetchProject,
  fetchProjectImages,
  saveProjectSelectedModel,
} from "@/lib/project-api";
import type { ProjectAssets, ProjectImageAsset } from "@/lib/project-types";
import type { ProjectDetail } from "@/lib/project-types";
import { cn } from "@/lib/utils";
import { useCanvasStore } from "@/store/use-canvas-store";
import { useLayoutStore, type AssetLoadingAction } from "@/store/use-layout-store";

import { AssetDetailCard } from "./components/asset-detail-card";

type AssetTabKey = "all" | "character" | "scene" | "prop" | "voice" | "video";
type AssetCategoryKey = Exclude<AssetTabKey, "all">;
type ConfirmAction = "parse" | "generate" | "clear" | null;

const ASSET_TYPE_TOKENS: Record<AssetCategoryKey, string[]> = {
  character: ["character", "角色"],
  scene: ["scene", "场景"],
  prop: ["prop", "道具"],
  voice: ["voice", "音色"],
  video: ["video", "视频", "分镜"],
};

const ASSET_GRID_COLUMNS = 5;
const ASSET_DETAIL_SPAN = 3;
const ASSET_DETAIL_CLOSE_SELECTOR =
  "[data-asset-detail-card], [data-asset-detail-trigger], [data-asset-chat-window], [data-slot='select-content']";
const EMPTY_CONFIG: AppConfig = {
  imageBeds: [],
  imageModels: [],
  videoModels: [],
};
const ASSET_SYNC_POLL_INTERVAL_MS = 5000;

function matchesAssetTab(asset: ProjectImageAsset, activeTab: AssetTabKey) {
  if (activeTab === "all") return true;

  const normalizedType = asset.type.toLowerCase();
  return ASSET_TYPE_TOKENS[activeTab].some((token) => normalizedType.includes(token));
}

function getAssetChildIds(projectAssets: ProjectAssets | undefined, assetId: string) {
  if (!projectAssets) return [];

  const assetGroups = Object.values(projectAssets);
  const matchedAsset = assetGroups.flat().find((assetItem) => assetItem.id === assetId);
  return matchedAsset?.children ?? [];
}

function getProjectSyncSignature(project: ProjectDetail) {
  return JSON.stringify({
    assets: project.assets,
    assetsParsed: project.assetsParsed,
    description: project.description,
    episodes: project.episodes,
    id: project.id,
    name: project.name,
  });
}

export function AssetsPanel() {
  const t = useTranslations("Sidebar");
  const tCanvas = useTranslations("Canvas");
  const { execute: executeSilentAgentCommand } = useSilentAgentCommand();
  const currentProject = useCanvasStore((state) => state.currentProject);
  const currentProjectRef = useRef<ProjectDetail | null>(currentProject);
  const setCurrentProject = useCanvasStore((state) => state.setCurrentProject);
  const commandStatuses = useCanvasStore((state) => state.commandStatuses);
  const assetLoadingAction = useLayoutStore((state) => state.assetLoadingAction);
  const assetCommandLoading = useLayoutStore((state) => state.sidebarLoading.assets > 0);
  const assetLoadingVersion = useLayoutStore((state) => state.sidebarLoadingVersion.assets);
  const setAssetLoadingAction = useLayoutStore((state) => state.setAssetLoadingAction);
  const [activeTab, setActiveTab] = useState<AssetTabKey>("all");
  const [searchValue, setSearchValue] = useState("");
  const [config, setConfig] = useState<AppConfig>(EMPTY_CONFIG);
  const [projectImages, setProjectImages] = useState<ProjectImageAsset[]>([]);
  const [loadingImages, setLoadingImages] = useState(false);
  const [failedImageIds, setFailedImageIds] = useState<Set<string>>(() => new Set());
  const [deletingAsset, setDeletingAsset] = useState<ProjectImageAsset | null>(null);
  const [deletingImage, setDeletingImage] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [selectedChatAssetId, setSelectedChatAssetId] = useState<string | null>(null);
  const [assetChatPosition, setAssetChatPosition] = useState<{ left: number; top: number } | null>(
    null,
  );
  const [selectedImageModelId, setSelectedImageModelId] = useState("");
  const tabs: { key: AssetTabKey; label: string }[] = [
    { key: "all", label: t("assetTabs.all") },
    { key: "character", label: t("assetTabs.character") },
    { key: "scene", label: t("assetTabs.scene") },
    { key: "prop", label: t("assetTabs.prop") },
    { key: "voice", label: t("assetTabs.voice") },
    { key: "video", label: t("assetTabs.video") },
  ];

  useEffect(() => {
    currentProjectRef.current = currentProject;
  }, [currentProject]);

  const syncAssetData = useCallback(
    async (
      projectId: string,
      showLoading: boolean,
      loadingAction: AssetLoadingAction = null,
    ) => {
      if (showLoading) setLoadingImages(true);

      try {
        const shouldSyncProject = loadingAction !== "generate";
        const shouldSyncImages = loadingAction !== "parse";
        const [project, nextProjectImages] = await Promise.all([
          shouldSyncProject ? fetchProject(projectId) : Promise.resolve(null),
          shouldSyncImages ? fetchProjectImages(projectId) : Promise.resolve(null),
        ]);

        if (
          project &&
          (
            !currentProjectRef.current ||
            getProjectSyncSignature(currentProjectRef.current) !== getProjectSyncSignature(project)
          )
        ) {
          currentProjectRef.current = project;
          setCurrentProject(project);
        }
        if (nextProjectImages) {
          setProjectImages(nextProjectImages);
          setFailedImageIds(new Set());
        }
      } catch {
        if (showLoading) {
          setProjectImages([]);
          setFailedImageIds(new Set());
        }
      } finally {
        if (showLoading) setLoadingImages(false);
      }
    },
    [setCurrentProject],
  );

  useEffect(() => {
    let ignoreResult = false;

    async function loadProjectImages(projectId: string | null) {
      if (!projectId) {
        setProjectImages([]);
        setFailedImageIds(new Set());
        return;
      }

      if (!ignoreResult) await syncAssetData(projectId, true);
    }

    void loadProjectImages(currentProject?.id ?? null);

    return () => {
      ignoreResult = true;
    };
  }, [currentProject?.id, syncAssetData]);

  useEffect(() => {
    if (!currentProject?.id || !assetCommandLoading) return;

    let active = true;
    let timeoutId: number | null = null;
    const syncNow = async () => {
      if (!active) return;

      await syncAssetData(currentProject.id, false, assetLoadingAction);

      if (active) {
        timeoutId = window.setTimeout(() => {
          void syncNow();
        }, ASSET_SYNC_POLL_INTERVAL_MS);
      }
    };

    void syncNow();

    return () => {
      active = false;
      if (timeoutId !== null) window.clearTimeout(timeoutId);
    };
  }, [
    assetCommandLoading,
    assetLoadingAction,
    assetLoadingVersion,
    currentProject?.id,
    syncAssetData,
  ]);

  useEffect(() => {
    let active = true;

    async function loadConfig() {
      try {
        const payload = await fetchConfigCached();
        if (active && payload) setConfig(payload);
      } catch {
        // Keep the asset chat available even if settings are temporarily unavailable.
      }
    }

    void loadConfig();

    return () => {
      active = false;
    };
  }, []);

  const visibleAssets = useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase();
    return projectImages.filter(
      (asset) =>
        matchesAssetTab(asset, activeTab) &&
        (normalizedSearch
          ? `${asset.id} ${asset.name} ${asset.type} ${asset.prompt} ${asset.source}`
              .toLowerCase()
              .includes(normalizedSearch)
          : true),
    );
  }, [activeTab, projectImages, searchValue]);
  const selectedAsset = useMemo(
    () => visibleAssets.find((asset) => asset.id === selectedAssetId) ?? null,
    [selectedAssetId, visibleAssets],
  );
  const selectedChatAsset = useMemo(
    () => visibleAssets.find((asset) => asset.id === selectedChatAssetId) ?? null,
    [selectedChatAssetId, visibleAssets],
  );
  const imageModelOptions = useMemo<ChatWindowModelOption[]>(
    () =>
      config.imageModels.map((model) => ({
        id: model.id,
        name: model.name,
      })),
    [config.imageModels],
  );
  const selectedModelId = imageModelOptions.some((model) => model.id === selectedImageModelId)
    ? selectedImageModelId
    : imageModelOptions[0]?.id ?? "";
  const selectedImageModel = config.imageModels.find((model) => model.id === selectedModelId);
  const selectedChatCommandStatus = selectedChatAsset ? commandStatuses[selectedChatAsset.id] : undefined;
  const selectedChatCommandStatusLabel = selectedChatCommandStatus
    ? tCanvas(`mediaGrid.${selectedChatCommandStatus}`)
    : undefined;
  const selectedAssetChildren = useMemo(() => {
    if (!selectedAsset) return [];

    const childIds = new Set(getAssetChildIds(currentProject?.assets, selectedAsset.id));
    return projectImages.filter((asset) => childIds.has(asset.id));
  }, [currentProject?.assets, projectImages, selectedAsset]);
  const assetsParsed = currentProject?.assetsParsed ?? false;

  useEffect(() => {
    if (!selectedAssetId) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Element)) {
        setSelectedAssetId(null);
        return;
      }

      if (!target.closest(ASSET_DETAIL_CLOSE_SELECTOR)) {
        setSelectedAssetId(null);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [selectedAssetId]);

  useEffect(() => {
    if (!selectedChatAssetId) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Element)) {
        setSelectedChatAssetId(null);
        setAssetChatPosition(null);
        return;
      }

      const isSelectedAssetTile = Boolean(
        target.closest(`[data-asset-chat-trigger="${selectedChatAssetId}"]`),
      );
      const isChatWindow = Boolean(target.closest("[data-asset-chat-window]"));
      const isSelectContent = Boolean(target.closest("[data-slot='select-content']"));

      if (isSelectedAssetTile || isChatWindow || isSelectContent) return;
      setSelectedChatAssetId(null);
      setAssetChatPosition(null);
    }

    document.addEventListener("pointerdown", handlePointerDown, true);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, [selectedChatAssetId]);

  const handleDeleteAsset = async () => {
    if (!currentProject || !deletingAsset) return;

    setDeletingImage(true);
    try {
      const nextProjectImages = await deleteProjectImage(currentProject.id, deletingAsset.id);
      setProjectImages(nextProjectImages);
      setFailedImageIds((currentFailedIds) => {
        const nextFailedIds = new Set(currentFailedIds);
        nextFailedIds.delete(deletingAsset.id);
        return nextFailedIds;
      });
      if (selectedAssetId === deletingAsset.id) {
        setSelectedAssetId(null);
      }
      if (selectedChatAssetId === deletingAsset.id) {
        setSelectedChatAssetId(null);
        setAssetChatPosition(null);
      }
      setDeletingAsset(null);
    } catch {
      setDeletingAsset(null);
    } finally {
      setDeletingImage(false);
    }
  };
  const handleImageError = (assetId: string) => {
    setFailedImageIds((currentFailedIds) => new Set(currentFailedIds).add(assetId));
  };
  const executeAssetPanelAction = async (action: Exclude<ConfirmAction, "clear" | null>) => {
    if (!currentProject) return;

    setAssetLoadingAction(action);

    if (action === "generate" && selectedImageModel) {
      await saveProjectSelectedModel(currentProject.id, {
        apiKey: selectedImageModel.apiKey,
        example: selectedImageModel.example,
        id: selectedImageModel.id,
        name: selectedImageModel.name,
        type: "image",
      });
    }

    await executeSilentAgentCommand(
      {
        attachments: [],
        html: "",
        text:
          action === "parse"
            ? "Parse reusable production assets from the current project script and flow."
            : "Generate production asset images for the current filtered asset set.",
      },
      {
        featureSkill: action === "parse" ? "asset-parse" : "asset-generate",
        scope: "asset-grid",
      },
    );
  };
  const openAssetChat = (assetId: string, anchorElement: HTMLElement) => {
    const anchorRect = anchorElement.getBoundingClientRect();

    setSelectedChatAssetId(assetId);
    setAssetChatPosition({
      left: anchorRect.right + 12,
      top: Math.max(120, anchorRect.top + anchorRect.height / 2),
    });
  };
  const confirmActionTitleKey = confirmAction
    ? `assetPanel.actions.${confirmAction}.title`
    : "assetPanel.actions.parse.title";
  const confirmActionDescriptionKey = confirmAction
    ? `assetPanel.actions.${confirmAction}.description`
    : "assetPanel.actions.parse.description";
  const confirmActionButtonKey = confirmAction
    ? `assetPanel.actions.${confirmAction}.confirm`
    : "assetPanel.actions.parse.confirm";

  return (
    <TooltipProvider delayDuration={200}>
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as AssetTabKey)}
        className="w-120 gap-0"
      >
        <div className="border-b px-3 py-2">
          <TabsList className="grid h-auto w-full grid-cols-6 gap-1 p-1">
            {tabs.map((tab) => (
              <TabsTrigger
                key={tab.key}
                value={tab.key}
                className="h-7 justify-center px-1 text-center text-xs transition-all duration-150 data-active:scale-[1.02]"
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <div className="flex items-center gap-2 border-b px-3 py-2">
          <Search className="size-4 text-muted-foreground" />
          <Input
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder={t("assetPanel.searchPlaceholder")}
            className="h-8 min-w-0 flex-1 border-0 bg-muted/50 px-2 text-xs focus-visible:ring-1"
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t("assetPanel.parseAll")}
                disabled={assetCommandLoading}
                onClick={() => setConfirmAction("parse")}
                className="size-8 shrink-0 text-muted-foreground hover:text-foreground"
              >
                {assetLoadingAction === "parse" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ListTree className="size-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">{t("assetPanel.parseAll")}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t("assetPanel.generateAsset")}
                disabled={assetCommandLoading}
                onClick={() => setConfirmAction("generate")}
                className="size-8 shrink-0 text-muted-foreground hover:text-foreground"
              >
                {assetLoadingAction === "generate" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <WandSparkles className="size-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">{t("assetPanel.generateAsset")}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t("assetPanel.clearAssets")}
                onClick={() => setConfirmAction("clear")}
                className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">{t("assetPanel.clearAssets")}</TooltipContent>
          </Tooltip>
        </div>

        {tabs.map((tab) => (
          <TabsContent key={tab.key} value={tab.key} className="m-0">
            <div className="p-3">
              {!currentProject ? (
                <div className="rounded-md border border-dashed border-border px-3 py-8 text-center text-xs text-muted-foreground">
                  {t("assetPanel.noCurrentProject")}
                </div>
              ) : loadingImages ? (
                <div className="rounded-md border border-dashed border-border px-3 py-8 text-center text-xs text-muted-foreground">
                  {t("assetPanel.loading")}
                </div>
              ) : !assetsParsed ? (
                <div className="flex h-98 flex-col items-center justify-center gap-3 rounded-md border border-dashed border-border px-3 text-center">
                  {assetCommandLoading ? (
                    <div className="flex flex-col items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="size-5 animate-spin text-primary" />
                      <span>{t("assetPanel.parsing")}</span>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">{t("assetPanel.notParsed")}</p>
                  )}
                  {!assetCommandLoading ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-2 border-dashed"
                      onClick={() => setConfirmAction("parse")}
                    >
                      <ListTree className="size-4" />
                      {t("assetPanel.parseAll")}
                    </Button>
                  ) : null}
                </div>
              ) : (
                <ScrollArea className="h-[392px] pr-2">
                  <div className="grid grid-cols-5 gap-2">
                    {/* The add tile stays first so asset creation is reachable in every tab. */}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setCreateDialogOpen(true)}
                      className="flex aspect-square h-auto flex-col gap-1 border-dashed text-muted-foreground"
                    >
                      <Plus className="size-4" />
                      <span className="text-xs">{t("assetPanel.addAsset")}</span>
                    </Button>

                    {visibleAssets.map((asset, assetIndex) => {
                      const gridIndex = assetIndex + 1;
                      const commandStatus = commandStatuses[asset.id];
                      const commandStatusLabel = commandStatus
                        ? tCanvas(`mediaGrid.${commandStatus}`)
                        : "";
                      const gridColumn = gridIndex % ASSET_GRID_COLUMNS;
                      const canShowDetailToRight =
                        gridColumn <= ASSET_GRID_COLUMNS - ASSET_DETAIL_SPAN - 1;
                      const detailColumnClass = canShowDetailToRight
                        ? "col-span-3"
                        : "col-start-2 col-span-4";

                      return (
                        <Fragment key={asset.id}>
                          <div
                            data-asset-chat-trigger={asset.id}
                            className="group relative cursor-pointer overflow-hidden rounded-lg"
                            onClick={(event) => openAssetChat(asset.id, event.currentTarget)}
                          >
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  data-asset-detail-trigger
                                  type="button"
                                  variant="ghost"
                                  size="icon-xs"
                                  aria-label={t("assetPanel.deleteAsset")}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setDeletingAsset(asset);
                                  }}
                                  className="absolute top-1 right-1 z-10 size-6 bg-background/90 text-muted-foreground opacity-0 shadow-sm transition-opacity hover:text-destructive group-hover:opacity-100"
                                >
                                  <Trash2 className="size-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                {t("assetPanel.deleteAsset")}
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-xs"
                                  aria-label={t("assetPanel.detail.open")}
                                  aria-pressed={selectedAssetId === asset.id}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setSelectedAssetId((currentAssetId) =>
                                      currentAssetId === asset.id ? null : asset.id,
                                    );
                                  }}
                                  className="absolute top-1 left-1 z-10 size-6 bg-background/90 text-muted-foreground opacity-0 shadow-sm transition-opacity hover:text-foreground aria-pressed:opacity-100 aria-pressed:text-foreground group-hover:opacity-100"
                                >
                                  <Info className="size-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                {t("assetPanel.detail.open")}
                              </TooltipContent>
                            </Tooltip>
                            <div
                              className={cn(
                                "relative flex aspect-square items-center justify-center overflow-hidden rounded-md border bg-muted/40 transition-colors duration-150",
                                selectedAssetId === asset.id
                                  ? "border-primary"
                                  : "border-border group-hover:border-primary",
                              )}
                            >
                              {asset.url && !failedImageIds.has(asset.id) ? (
                                <Image
                                  src={asset.url}
                                  alt={asset.name || asset.id}
                                  fill
                                  sizes="88px"
                                  className="object-cover"
                                  onError={() => handleImageError(asset.id)}
                                />
                              ) : (
                                <div className="flex flex-col items-center gap-1 text-muted-foreground">
                                  {commandStatus === "loading" ? (
                                    <Loader2 className="size-6 animate-spin" />
                                  ) : (
                                    <ImageIcon className="size-6" />
                                  )}
                                  <span className="text-xs">
                                    {commandStatusLabel || t("assetPanel.imagePending")}
                                  </span>
                                </div>
                              )}
                              {commandStatusLabel && asset.url && !failedImageIds.has(asset.id) ? (
                                <div className="pointer-events-none absolute right-1 top-1 z-10 flex items-center gap-1 rounded-full bg-background/90 px-1.5 py-0.5 text-[10px] text-foreground shadow-sm">
                                  {commandStatus === "loading" ? (
                                    <Loader2 className="size-3 animate-spin" />
                                  ) : commandStatus === "success" ? (
                                    <CheckCircle2 className="size-3 text-emerald-500" />
                                  ) : (
                                    <AlertCircle className="size-3 text-destructive" />
                                  )}
                                  <span>{commandStatusLabel}</span>
                                </div>
                              ) : null}
                              {selectedChatAssetId && selectedChatAssetId !== asset.id ? (
                                <div
                                  className="pointer-events-none absolute inset-0 z-20 bg-background/70 backdrop-blur-[1px]"
                                  aria-hidden="true"
                                />
                              ) : null}
                            </div>
                            <div className="flex min-h-7 items-center px-1.5 py-1">
                              <span className="truncate text-xs">{asset.name || asset.id}</span>
                            </div>
                          </div>
                          {selectedAsset?.id === asset.id ? (
                            <AssetDetailCard
                              asset={selectedAsset}
                              childAssets={selectedAssetChildren}
                              failedImageIds={failedImageIds}
                              onImageError={handleImageError}
                              onClose={() => setSelectedAssetId(null)}
                              className={detailColumnClass}
                            />
                          ) : null}
                        </Fragment>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {typeof document !== "undefined" && selectedChatAsset && assetChatPosition
        ? createPortal(
            <div
              data-asset-chat-window
              className="fixed z-[999] w-[min(640px,calc(100vw-32px))] -translate-y-1/2"
              style={{
                left: assetChatPosition.left,
                top: assetChatPosition.top,
              }}
            >
              <ChatWindow
                commandStatus={selectedChatCommandStatus}
                commandStatusLabel={selectedChatCommandStatusLabel}
                projectId={currentProject?.id ?? ""}
                emptyModelLabel={tCanvas("chatWindow.emptyModel")}
                placeholder={tCanvas("chatWindow.placeholder")}
                inputLabel={tCanvas("chatWindow.inputLabel")}
                addAttachmentLabel={tCanvas("chatWindow.addAttachment")}
                attachmentFallbackLabel={(index) => tCanvas("chatWindow.imageFallback", { index })}
                attachmentListLabel={tCanvas("chatWindow.attachmentList")}
                removeAttachmentLabel={tCanvas("chatWindow.removeAttachment")}
                firstFrameLabel={tCanvas("chatWindow.firstFrame")}
                lastFrameLabel={tCanvas("chatWindow.lastFrame")}
                promptPairSeparator={tCanvas("chatWindow.promptPairSeparator")}
                modelSelectLabel={tCanvas("chatWindow.modelSelect")}
                modelOptions={imageModelOptions}
                mediaMentionImages={[]}
                referenceImages={[]}
                requiresFirstLastFrame={false}
                selectedModelId={selectedModelId}
                sendLabel={tCanvas("chatWindow.send")}
                showVideoOptions={false}
                videoDurationLabel={tCanvas("chatWindow.videoDuration")}
                videoDurationUnitLabel={tCanvas("chatWindow.videoDurationUnit")}
                videoShotLabel={tCanvas("chatWindow.videoShot")}
                videoShotLabels={{
                  static: tCanvas("chatWindow.videoShots.static"),
                  "push-in": tCanvas("chatWindow.videoShots.pushIn"),
                  "pull-out": tCanvas("chatWindow.videoShots.pullOut"),
                  pan: tCanvas("chatWindow.videoShots.pan"),
                  tilt: tCanvas("chatWindow.videoShots.tilt"),
                  tracking: tCanvas("chatWindow.videoShots.tracking"),
                  orbit: tCanvas("chatWindow.videoShots.orbit"),
                handheld: tCanvas("chatWindow.videoShots.handheld"),
              }}
              onModelChange={setSelectedImageModelId}
              onSubmit={(payload) => {
                if (!selectedChatAsset) return;

                void (async () => {
                  if (!currentProject || !selectedImageModel) return;

                  try {
                    await saveProjectSelectedModel(currentProject.id, {
                      apiKey: selectedImageModel.apiKey,
                      example: selectedImageModel.example,
                      id: selectedImageModel.id,
                      name: selectedImageModel.name,
                      type: "image",
                    });

                    await executeSilentAgentCommand(payload, {
                      featureSkill: "node-image-generate",
                      mediaId: selectedChatAsset.id,
                      mediaName: selectedChatAsset.name || selectedChatAsset.id,
                      mediaType: selectedChatAsset.type,
                      scope: "asset-grid",
                    });
                  } catch {
                    // The agent run depends on the project model config being current.
                  }
                })();
              }}
            />
            </div>,
            document.body,
          )
        : null}

      <Dialog open={!!deletingAsset} onOpenChange={(open) => !open && setDeletingAsset(null)}>
        <DialogContent className="w-[min(92vw,420px)]" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{t("assetPanel.deleteConfirmTitle")}</DialogTitle>
            <DialogDescription className="mt-2">
              {t("assetPanel.deleteConfirmDescription", {
                name: deletingAsset?.name || deletingAsset?.id || "",
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary" disabled={deletingImage}>
                {t("assetPanel.cancel")}
              </Button>
            </DialogClose>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteAsset}
              disabled={deletingImage}
            >
              {deletingImage ? t("assetPanel.deleting") : t("assetPanel.confirmDelete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AssetCreateDialog
        images={projectImages}
        onCreated={(_image, images) => {
          setProjectImages(images);
          setFailedImageIds(new Set());
        }}
        onImported={(image) => setSelectedAssetId(image.id)}
        onProjectUpdated={setCurrentProject}
        onOpenChange={setCreateDialogOpen}
        open={createDialogOpen}
        projectAssets={currentProject?.assets}
        projectId={currentProject?.id ?? ""}
      />

      <Dialog
        open={confirmAction !== null}
        onOpenChange={(open) => !open && setConfirmAction(null)}
      >
        <DialogContent className="w-[min(92vw,420px)]" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{t(confirmActionTitleKey)}</DialogTitle>
            <DialogDescription className="mt-2">{t(confirmActionDescriptionKey)}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                {t("assetPanel.cancel")}
              </Button>
            </DialogClose>
            <Button
              type="button"
              variant={confirmAction === "clear" ? "destructive" : "default"}
              disabled={assetCommandLoading}
              onClick={() => {
                const nextAction = confirmAction;
                setConfirmAction(null);
                if (nextAction === "parse" || nextAction === "generate") {
                  void executeAssetPanelAction(nextAction);
                }
              }}
            >
              {assetCommandLoading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              {t(confirmActionButtonKey)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
