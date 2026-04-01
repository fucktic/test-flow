import { memo, useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { AssetNodeData, AssetCategory, AssetItem } from "@/lib/types/flow.types";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Image as ImageIcon, Music, Maximize2, Pencil, Plus, Trash2 } from "lucide-react";
import { MediaPreviewModal, MediaItem } from "@/components/common/media-preview-modal";
import { FileUpload } from "@/components/common/file-upload";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getNodeWrapperClassName } from "./utils";

interface AssetNodeProps {
  data: AssetNodeData;
  selected?: boolean;
}

const AssetNode = ({ data, selected }: AssetNodeProps) => {
  const tFlow = useTranslations("flow.assetNode");
  const tCommon = useTranslations("common");
  const [activeTab, setActiveTab] = useState<AssetCategory>(data.activeTab || "characters");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
  const [deleteAssetId, setDeleteAssetId] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState("");

  const formSchema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(1, tFlow("nameRequired")),
        category: z.enum(["characters", "scenes", "props", "audio"]),
        description: z.string(),
      }),
    [tFlow],
  );

  type FormValues = z.infer<typeof formSchema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      category: activeTab,
      description: "",
    },
  });

  const assetCategory = form.watch("category");

  const [uploadedFileUrl, setUploadedFileUrl] = useState("");
  const [uploadedMediaType, setUploadedMediaType] = useState<AssetItem["type"] | undefined>(
    undefined,
  );
  const [uploadError, setUploadError] = useState("");

  const tabs: { id: AssetCategory; label: string }[] = [
    { id: "characters", label: tFlow("characters") },
    { id: "scenes", label: tFlow("scenes") },
    { id: "props", label: tFlow("props") },
    { id: "audio", label: tFlow("audio") },
  ];

  const currentAssets = data.assets?.[activeTab] || [];
  const deleteAsset = useMemo(
    () => currentAssets.find((item) => item.id === deleteAssetId),
    [currentAssets, deleteAssetId],
  );
  const isEditMode = editingAssetId !== null;

  const previewItems: MediaItem[] = currentAssets
    .filter((item: AssetItem) => (item.type === "image" || item.type === "video") && !!item.url)
    .map((item: AssetItem) => ({
      id: item.id,
      url: item.url,
      type: item.type as "image" | "video",
      poster: item.poster,
    }));

  const handlePreview = (index: number) => {
    const item = currentAssets[index];
    if (item.type === "image" || item.type === "video") {
      const pIndex = previewItems.findIndex((p: MediaItem) => p.id === item.id);
      if (pIndex !== -1) {
        setPreviewIndex(pIndex);
        setPreviewOpen(true);
      }
    } else if (item.type === "audio") {
      if (!item.url) return;
      const audio = new Audio(item.url);
      audio.play().catch((e) => console.error(e));
    }
  };

  const getAcceptMime = (category: AssetCategory) => {
    return category === "audio" ? "audio/*" : "image/*";
  };

  const readFileAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          resolve(reader.result);
        } else {
          reject(new Error());
        }
      };
      reader.onerror = () => reject(new Error());
      reader.readAsDataURL(file);
    });

  const handleFileUpload = async (file: File) => {
    const isAudioCategory = assetCategory === "audio";
    const isAudioFile = file.type.startsWith("audio/");
    const isImageFile = file.type.startsWith("image/");
    if ((isAudioCategory && !isAudioFile) || (!isAudioCategory && !isImageFile)) {
      setUploadError(
        isAudioCategory ? tFlow("uploadOnlyAudioError") : tFlow("uploadOnlyImageError"),
      );
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setUploadedFileName(file.name);
      setUploadedFileUrl(dataUrl);
      setUploadedMediaType(isAudioFile ? "audio" : "image");
      setUploadError("");
    } catch {
      setUploadError(tFlow("uploadReadError"));
    }
  };

  const handleSaveAsset = form.handleSubmit((values: FormValues) => {
    if (editingAssetId) {
      data.onAssetUpdate?.(activeTab, editingAssetId, {
        name: values.name,
        category: values.category,
        description: values.description,
        fileUrl: uploadedFileUrl || undefined,
        mediaType: uploadedMediaType,
      });
    } else {
      data.onAssetAdd?.(activeTab, {
        name: values.name,
        category: values.category,
        description: values.description,
        fileUrl: uploadedFileUrl || undefined,
        mediaType: uploadedMediaType,
      });
    }
    setFormDialogOpen(false);
    setActiveTab(values.category);
    data.onTabChange?.(values.category);
    setEditingAssetId(null);
    form.reset();
    setUploadedFileName("");
    setUploadedFileUrl("");
    setUploadedMediaType(undefined);
    setUploadError("");
  });

  const openCreateDialog = () => {
    setEditingAssetId(null);
    form.reset({
      name: "",
      category: activeTab,
      description: "",
    });
    setUploadedFileName("");
    setUploadedFileUrl("");
    setUploadedMediaType(undefined);
    setUploadError("");
    setFormDialogOpen(true);
  };

  const openEditDialog = (item: AssetItem) => {
    setEditingAssetId(item.id);
    form.reset({
      name: item.name,
      category: activeTab,
      description: item.description || "",
    });
    setUploadedFileName("");
    setUploadedFileUrl(item.url || "");
    setUploadedMediaType(item.type);
    setUploadError("");
    setFormDialogOpen(true);
  };

  const openDeleteDialog = (item: AssetItem) => {
    setDeleteAssetId(item.id);
    setDeleteOpen(true);
  };

  const handleDeleteAsset = () => {
    if (!deleteAsset) {
      return;
    }
    data.onAssetDelete?.(deleteAsset.id);
    setDeleteAssetId(null);
    setDeleteOpen(false);
  };

  return (
    <div className="flex flex-col gap-2 w-lg h-160 relative group/node">
      <div className="flex items-center gap-2 px-1">
        <span className="text-lg font-semibold text-foreground">{tFlow("title")}</span>
      </div>

      <div className={getNodeWrapperClassName(selected, "flex-1 flex flex-col p-4 gap-4")}>
        <div className="flex items-center gap-2 pb-2 border-b border-border/50">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={cn(
                "px-4 py-1.5 text-sm font-medium transition-colors rounded-md",
                activeTab === tab.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted",
              )}
              onClick={() => {
                setActiveTab(tab.id);
                data.onAssetSelect?.(undefined);
                if (data.onTabChange) {
                  data.onTabChange(tab.id);
                }
              }}
            >
              {tab.label}
            </button>
          ))}
          <div className="flex-1"></div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" onClick={openCreateDialog}>
                <Plus className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{tFlow("tooltipAdd")}</TooltipContent>
          </Tooltip>
        </div>

        <ScrollArea className="h-full w-full pr-4">
          {currentAssets.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-2 mt-20">
              <ImageIcon className="w-8 h-8 opacity-20" />
              <span className="text-sm">{tFlow("empty")}</span>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-4">
              {currentAssets.map((item: AssetItem, index: number) => (
                <div
                  key={item.id}
                  className="flex flex-col gap-1 group/asset cursor-pointer"
                  onClick={() => data.onAssetSelect?.(item.id)}
                  onDoubleClick={() => handlePreview(index)}
                >
                  <div
                    className={cn(
                      "aspect-square bg-muted rounded-lg overflow-hidden relative border transition-colors",
                      data.selectedAssetId === item.id
                        ? "border-primary ring-1 ring-primary/40"
                        : "border-border/50 group-hover/asset:border-primary/50",
                    )}
                  >
                    {(item.type === "image" || item.type === "video") && item.url ? (
                      <img src={item.url} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-secondary/30">
                        <Music className="w-8 h-8 text-primary/50" />
                      </div>
                    )}

                    {(item.type === "image" || item.type === "video") && item.url && (
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/asset:opacity-100 transition-opacity flex items-center justify-center space-x-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              className="h-7 w-7 rounded-md bg-black/50 text-white flex items-center justify-center hover:bg-black/70"
                              onClick={(event) => {
                                event.stopPropagation();
                                handlePreview(index);
                              }}
                            >
                              <Maximize2 className="w-4 h-4" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>{tFlow("tooltipPreview")}</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              className="h-7 w-7 rounded-md bg-background/90 border border-border/60 text-foreground flex items-center justify-center hover:bg-background"
                              onClick={(event) => {
                                event.stopPropagation();
                                openEditDialog(item);
                              }}
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>{tFlow("tooltipEdit")}</TooltipContent>
                        </Tooltip>
                      </div>
                    )}
                    <div className="absolute -top-1 -right-1 flex items-center gap-1 opacity-0 group-hover/asset:opacity-100 transition-opacity">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            className="h-7 w-7 rounded-bl-xl bg-background/90 border border-border/60 text-destructive flex items-center justify-center hover:bg-background"
                            onClick={(event) => {
                              event.stopPropagation();
                              openDeleteDialog(item);
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>{tFlow("tooltipDelete")}</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                  <span
                    className="text-xs text-center truncate text-muted-foreground group-hover/asset:text-foreground transition-colors"
                    title={item.name}
                  >
                    {item.name}
                  </span>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      <Dialog
        aria-describedby
        open={formDialogOpen}
        onOpenChange={(open) => {
          setFormDialogOpen(open);
          if (!open) {
            setEditingAssetId(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isEditMode ? tFlow("editTitle") : tFlow("createTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>{tFlow("nameLabel")}</Label>
              <Input {...form.register("name")} />
              {form.formState.errors.name && (
                <div className="text-xs text-destructive">{form.formState.errors.name.message}</div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>{tFlow("categoryLabel")}</Label>
              <Controller
                control={form.control}
                name="category"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(value) => {
                      field.onChange(value);
                      setUploadError("");
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {tabs.map((tab) => (
                        <SelectItem value={tab.id}>{tFlow(tab.label)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{tFlow("descriptionLabel")}</Label>
              <Textarea {...form.register("description")} />
            </div>
            <div className="space-y-1.5">
              <Label>{tFlow("uploadLabel")}</Label>
              <FileUpload
                accept={getAcceptMime(assetCategory)}
                onFileSelect={(file) => void handleFileUpload(file)}
                fileUrl={uploadedFileUrl}
                fileName={uploadedFileName}
                mediaType={uploadedMediaType}
                onClear={() => {
                  setUploadedFileUrl("");
                  setUploadedFileName("");
                  setUploadedMediaType(undefined);
                }}
                hint={tFlow("uploadHint")}
                subHint={assetCategory === "audio" ? tFlow("typeAudio") : tFlow("typeImage")}
                error={uploadError}
                replaceText={tFlow("replaceFile")}
                clearText={tFlow("clearFile")}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setFormDialogOpen(false);
                setEditingAssetId(null);
              }}
            >
              {tFlow("cancel")}
            </Button>
            <Button onClick={handleSaveAsset} disabled={!form.watch("name")?.trim()}>
              {isEditMode ? tFlow("save") : tFlow("create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open) {
            setDeleteAssetId(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{tFlow("deleteConfirmTitle")}</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-muted-foreground">
            {deleteAsset
              ? tFlow("deleteConfirmDescriptionWithName", { name: deleteAsset.name })
              : tFlow("deleteConfirmDescription")}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              {tCommon("cancel")}
            </Button>
            <Button variant="destructive" onClick={handleDeleteAsset}>
              {tCommon("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MediaPreviewModal
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        items={previewItems}
        initialIndex={previewIndex}
      />
    </div>
  );
};

export default memo(AssetNode);
