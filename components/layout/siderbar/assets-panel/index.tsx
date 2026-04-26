"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { ImageIcon, Info, ListTree, Plus, Search, Trash2, WandSparkles } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";

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
import { deleteProjectImage, fetchProjectImages } from "@/lib/project-api";
import type { ProjectAssets, ProjectImageAsset } from "@/lib/project-types";
import { cn } from "@/lib/utils";
import { useCanvasStore } from "@/store/use-canvas-store";

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
const ASSET_DETAIL_CLOSE_SELECTOR = "[data-asset-detail-card], [data-asset-detail-trigger]";

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

export function AssetsPanel() {
  const t = useTranslations("Sidebar");
  const currentProject = useCanvasStore((state) => state.currentProject);
  const [activeTab, setActiveTab] = useState<AssetTabKey>("all");
  const [searchValue, setSearchValue] = useState("");
  const [projectImages, setProjectImages] = useState<ProjectImageAsset[]>([]);
  const [loadingImages, setLoadingImages] = useState(false);
  const [failedImageIds, setFailedImageIds] = useState<Set<string>>(() => new Set());
  const [deletingAsset, setDeletingAsset] = useState<ProjectImageAsset | null>(null);
  const [deletingImage, setDeletingImage] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const tabs: { key: AssetTabKey; label: string }[] = [
    { key: "all", label: t("assetTabs.all") },
    { key: "character", label: t("assetTabs.character") },
    { key: "scene", label: t("assetTabs.scene") },
    { key: "prop", label: t("assetTabs.prop") },
    { key: "voice", label: t("assetTabs.voice") },
    { key: "video", label: t("assetTabs.video") },
  ];

  useEffect(() => {
    let ignoreResult = false;

    async function loadProjectImages(projectId: string | null) {
      setLoadingImages(true);
      try {
        const nextProjectImages = projectId ? await fetchProjectImages(projectId) : [];
        if (!ignoreResult) {
          setProjectImages(nextProjectImages);
          setFailedImageIds(new Set());
        }
      } catch {
        if (!ignoreResult) {
          setProjectImages([]);
          setFailedImageIds(new Set());
        }
      } finally {
        if (!ignoreResult) {
          setLoadingImages(false);
        }
      }
    }

    void loadProjectImages(currentProject?.id ?? null);

    return () => {
      ignoreResult = true;
    };
  }, [currentProject?.id]);

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
                onClick={() => setConfirmAction("parse")}
                className="size-8 shrink-0 text-muted-foreground hover:text-foreground"
              >
                <ListTree className="size-4" />
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
                onClick={() => setConfirmAction("generate")}
                className="size-8 shrink-0 text-muted-foreground hover:text-foreground"
              >
                <WandSparkles className="size-4" />
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
                  <p className="text-xs text-muted-foreground">{t("assetPanel.notParsed")}</p>
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2 border-dashed"
                    onClick={() => setConfirmAction("parse")}
                  >
                    <ListTree className="size-4" />
                    {t("assetPanel.parseAll")}
                  </Button>
                </div>
              ) : (
                <ScrollArea className="h-[392px] pr-2">
                  <div className="grid grid-cols-5 gap-2">
                    {/* The add tile stays first so asset creation is reachable in every tab. */}
                    <Button
                      type="button"
                      variant="outline"
                      className="flex aspect-square h-auto flex-col gap-1 border-dashed text-muted-foreground"
                    >
                      <Plus className="size-4" />
                      <span className="text-xs">{t("assetPanel.addAsset")}</span>
                    </Button>

                    {visibleAssets.map((asset, assetIndex) => {
                      const gridIndex = assetIndex + 1;
                      const gridColumn = gridIndex % ASSET_GRID_COLUMNS;
                      const canShowDetailToRight =
                        gridColumn <= ASSET_GRID_COLUMNS - ASSET_DETAIL_SPAN - 1;
                      const detailColumnClass = canShowDetailToRight
                        ? "col-span-3"
                        : "col-start-2 col-span-4";

                      return (
                        <Fragment key={asset.id}>
                          <div className="group relative overflow-hidden rounded-lg cursor-pointer ">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  data-asset-detail-trigger
                                  type="button"
                                  variant="ghost"
                                  size="icon-xs"
                                  aria-label={t("assetPanel.deleteAsset")}
                                  onClick={() => setDeletingAsset(asset)}
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
                                  onClick={() =>
                                    setSelectedAssetId((currentAssetId) =>
                                      currentAssetId === asset.id ? null : asset.id,
                                    )
                                  }
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
                                  <ImageIcon className="size-6" />
                                  {asset.url ? null : (
                                    <span className="text-xs">{t("assetPanel.imagePending")}</span>
                                  )}
                                </div>
                              )}
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
              onClick={() => setConfirmAction(null)}
            >
              {t(confirmActionButtonKey)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
