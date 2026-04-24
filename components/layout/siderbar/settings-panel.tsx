"use client";

import { useEffect, useMemo, useState } from "react";
import { Eye, EyeOff, ImageIcon, Link2, Plus, Trash2, Video } from "lucide-react";
import { useTranslations } from "next-intl";
import { useForm, useWatch } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type {
  AppConfig,
  ImageBedConfig,
  ImageModelConfig,
  VideoModelConfig,
  VideoReferenceMode,
} from "@/lib/config-schema";

type ConfigSection = "image" | "video" | "imageBed";

type SettingsFormValues = {
  name: string;
  apiKey: string;
  example: string;
  videoReferenceMode: VideoReferenceMode;
  isDefault: boolean;
};

type ConfigItem = ImageModelConfig | VideoModelConfig | ImageBedConfig;

type FeedbackKey =
  | "modelManager.feedback.loadError"
  | "modelManager.feedback.saveError"
  | "modelManager.feedback.saved"
  | "";

const EMPTY_CONFIG: AppConfig = {
  imageModels: [],
  videoModels: [],
  imageBeds: [],
};

const EMPTY_FORM_VALUES: SettingsFormValues = {
  name: "",
  apiKey: "",
  example: "",
  videoReferenceMode: "all-purpose",
  isDefault: true,
};

const CONFIG_SECTIONS: ConfigSection[] = ["image", "video", "imageBed"];

const VIDEO_REFERENCE_MODES: VideoReferenceMode[] = ["all-purpose", "first-last-frame"];

function getSectionIcon(section: ConfigSection) {
  if (section === "image") return ImageIcon;
  if (section === "video") return Video;
  return Link2;
}

function createConfigId(section: ConfigSection) {
  return `${section}-${crypto.randomUUID()}`;
}

function maskApiKey(apiKey: string) {
  return apiKey.length > 6 ? `${apiKey.slice(0, 3)}••••${apiKey.slice(-3)}` : "••••••";
}

function hasVideoReferenceMode(item: ConfigItem): item is VideoModelConfig {
  return "videoReferenceMode" in item;
}

function hasDefaultFlag(item: ConfigItem): item is ImageBedConfig {
  return "isDefault" in item;
}

function toFormValues(section: ConfigSection, item?: ConfigItem): SettingsFormValues {
  if (!item) {
    return {
      ...EMPTY_FORM_VALUES,
      isDefault: section === "imageBed",
    };
  }

  return {
    name: item.name,
    apiKey: item.apiKey,
    example: item.example,
    videoReferenceMode: hasVideoReferenceMode(item) ? item.videoReferenceMode : "all-purpose",
    isDefault: hasDefaultFlag(item) ? item.isDefault : section === "imageBed",
  };
}

function getSectionItems(config: AppConfig, section: ConfigSection): ConfigItem[] {
  if (section === "image") return config.imageModels;
  if (section === "video") return config.videoModels;
  return config.imageBeds;
}

function normalizeImageBeds(imageBeds: ImageBedConfig[]) {
  if (imageBeds.length === 0) return imageBeds;
  if (imageBeds.some((imageBed) => imageBed.isDefault)) return imageBeds;

  return imageBeds.map((imageBed, index) => ({
    ...imageBed,
    isDefault: index === 0,
  }));
}

export function SettingsPanel() {
  const t = useTranslations("Settings");
  const [activeSection, setActiveSection] = useState<ConfigSection>("image");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [config, setConfig] = useState<AppConfig>(EMPTY_CONFIG);
  const [feedbackKey, setFeedbackKey] = useState<FeedbackKey>("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isApiKeyVisible, setIsApiKeyVisible] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const form = useForm<SettingsFormValues>({
    defaultValues: EMPTY_FORM_VALUES,
    mode: "onChange",
  });
  const watchedValues = useWatch({ control: form.control });

  const activeItems = useMemo(
    () => getSectionItems(config, activeSection),
    [activeSection, config],
  );
  const selectedItem = activeItems.find((item) => item.id === selectedId);
  const isCreateMode = selectedId === null;
  const canSave =
    Boolean(watchedValues.name?.trim()) &&
    Boolean(watchedValues.apiKey?.trim()) &&
    Boolean(watchedValues.example?.trim()) &&
    !isSaving;

  useEffect(() => {
    let isMounted = true;

    const loadConfig = async () => {
      try {
        const response = await fetch("/api/config");
        if (!response.ok) throw new Error("CONFIG_LOAD_FAILED");

        const payload = (await response.json()) as { config: AppConfig };
        if (!isMounted) return;

        setConfig(payload.config);
        setFeedbackKey("");
      } catch {
        if (isMounted) setFeedbackKey("modelManager.feedback.loadError");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    void loadConfig();

    return () => {
      isMounted = false;
    };
  }, []);

  const persistConfig = async (nextConfig: AppConfig) => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: nextConfig }),
      });
      if (!response.ok) throw new Error("CONFIG_SAVE_FAILED");

      const payload = (await response.json()) as { config: AppConfig };
      setConfig(payload.config);
      setFeedbackKey("modelManager.feedback.saved");
      return true;
    } catch {
      setFeedbackKey("modelManager.feedback.saveError");
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = (section: ConfigSection, item?: ConfigItem) => {
    form.reset(toFormValues(section, item));
    setFeedbackKey("");
  };

  const selectSection = (section: ConfigSection) => {
    setActiveSection(section);
    setSelectedId(null);
    resetForm(section);
    setDeleteConfirmId(null);
  };

  const selectItem = (item: ConfigItem | null) => {
    setSelectedId(item?.id ?? null);
    resetForm(activeSection, item ?? undefined);
    setDeleteConfirmId(null);
  };

  const buildNextConfig = (id: string, values: SettingsFormValues): AppConfig => {
    const name = values.name.trim();
    const apiKey = values.apiKey.trim();
    const example = values.example.trim();

    if (activeSection === "image") {
      const record: ImageModelConfig = { id, name, apiKey, example };
      const imageModels = isCreateMode
        ? [record, ...config.imageModels]
        : config.imageModels.map((model) => (model.id === id ? record : model));

      return { ...config, imageModels };
    }

    if (activeSection === "video") {
      const record: VideoModelConfig = {
        id,
        name,
        apiKey,
        example,
        videoReferenceMode: values.videoReferenceMode,
      };
      const videoModels = isCreateMode
        ? [record, ...config.videoModels]
        : config.videoModels.map((model) => (model.id === id ? record : model));

      return { ...config, videoModels };
    }

    const record: ImageBedConfig = {
      id,
      name,
      apiKey,
      example,
      isDefault: values.isDefault,
    };
    const imageBeds = isCreateMode
      ? [record, ...config.imageBeds]
      : config.imageBeds.map((imageBed) => (imageBed.id === id ? record : imageBed));
    const normalizedImageBeds = normalizeImageBeds(
      imageBeds.map((imageBed) => ({
        ...imageBed,
        isDefault: record.isDefault && imageBed.id !== record.id ? false : imageBed.isDefault,
      })),
    );

    return { ...config, imageBeds: normalizedImageBeds };
  };

  const handleSubmit = async (values: SettingsFormValues) => {
    const id = selectedId ?? createConfigId(activeSection);
    const saved = await persistConfig(buildNextConfig(id, values));
    if (!saved) return;

    setSelectedId(null);
    resetForm(activeSection);
    setDeleteConfirmId(null);
  };

  const handleInvalidSubmit = () => {
    setFeedbackKey("modelManager.feedback.saveError");
  };

  const handleRemove = async (itemId: string) => {
    if (deleteConfirmId !== itemId) {
      setDeleteConfirmId(itemId);
      return;
    }

    const nextConfig: AppConfig = {
      imageModels:
        activeSection === "image"
          ? config.imageModels.filter((model) => model.id !== itemId)
          : config.imageModels,
      videoModels:
        activeSection === "video"
          ? config.videoModels.filter((model) => model.id !== itemId)
          : config.videoModels,
      imageBeds:
        activeSection === "imageBed"
          ? normalizeImageBeds(config.imageBeds.filter((imageBed) => imageBed.id !== itemId))
          : config.imageBeds,
    };

    const saved = await persistConfig(nextConfig);
    if (!saved) return;

    setSelectedId(null);
    resetForm(activeSection);
    setDeleteConfirmId(null);
  };

  const handleDefaultImageBedChange = async (itemId: string, checked: boolean) => {
    if (activeSection !== "imageBed" || !checked) return;

    const imageBeds = config.imageBeds.map((imageBed) => ({
      ...imageBed,
      isDefault: imageBed.id === itemId,
    }));
    const saved = await persistConfig({ ...config, imageBeds });
    if (!saved) return;

    if (selectedId !== null) {
      form.setValue("isDefault", selectedId === itemId, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  };

  return (
    <div className="grid min-h-[560px] gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="flex min-h-0 flex-col rounded-lg border bg-background">
        <div className="border-b p-3">
          <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
            {CONFIG_SECTIONS.map((section) => {
              const Icon = getSectionIcon(section);
              return (
                <Button
                  key={section}
                  type="button"
                  variant={activeSection === section ? "default" : "ghost"}
                  size="sm"
                  onClick={() => selectSection(section)}
                  className={cn(
                    "h-8 rounded-md px-2",
                    activeSection !== section && "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="size-4" />
                  {t(`modelManager.sections.${section}`)}
                </Button>
              );
            })}
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-2 p-3">
          <Button
            type="button"
            variant={isCreateMode ? "default" : "secondary"}
            onClick={() => selectItem(null)}
            className="h-10 justify-start"
          >
            <Plus className="size-4" />
            {t("modelManager.actions.new")}
          </Button>

          <div className="flex items-center justify-between px-1">
            <h4 className="text-xs font-medium text-muted-foreground">
              {t("modelManager.list.title", { type: t(`modelManager.sections.${activeSection}`) })}
            </h4>
            <span className="text-xs text-muted-foreground">
              {t("modelManager.list.count", { count: activeItems.length })}
            </span>
          </div>

          {isLoading ? (
            <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed bg-muted/30 px-3 py-6 text-center">
              <p className="text-xs text-muted-foreground">{t("modelManager.feedback.loading")}</p>
            </div>
          ) : activeItems.length === 0 ? (
            <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed bg-muted/30 px-3 py-6 text-center">
              <p className="text-xs text-muted-foreground">{t("modelManager.list.empty")}</p>
            </div>
          ) : (
            <ScrollArea className="min-h-0 flex-1">
              <div className="grid gap-2">
                {activeItems.map((item) => {
                  const Icon = getSectionIcon(activeSection);
                  const isSelected = selectedId === item.id;
                  const isConfirmingDelete = deleteConfirmId === item.id;
                  return (
                    <div
                      key={item.id}
                      className={cn(
                        "flex items-start gap-2 rounded-lg border bg-background p-2",
                        isSelected && "border-primary",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => selectItem(item)}
                        className="flex min-w-0 flex-1 items-start gap-2 text-left"
                      >
                        <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                          <Icon className="size-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p className="truncate text-sm font-medium">{item.name}</p>
                            {hasDefaultFlag(item) && item.isDefault ? (
                              <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
                                {t("modelManager.form.default")}
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {maskApiKey(item.apiKey)}
                          </p>
                        </div>
                      </button>
                      {hasDefaultFlag(item) ? (
                        <Checkbox
                          checked={item.isDefault}
                          onCheckedChange={(checked) =>
                            void handleDefaultImageBedChange(item.id, checked === true)
                          }
                          aria-label={t("modelManager.actions.setDefault")}
                          className="mt-2"
                        />
                      ) : null}
                      <Button
                        type="button"
                        variant={isConfirmingDelete ? "destructive" : "ghost"}
                        size={isConfirmingDelete ? "xs" : "icon-sm"}
                        onClick={() => void handleRemove(item.id)}
                        aria-label={
                          isConfirmingDelete
                            ? t("modelManager.actions.confirmRemove")
                            : t("modelManager.actions.remove")
                        }
                        className={cn(
                          "shrink-0",
                          !isConfirmingDelete && "text-muted-foreground hover:text-destructive",
                        )}
                      >
                        {isConfirmingDelete ? (
                          t("modelManager.actions.confirmRemove")
                        ) : (
                          <Trash2 className="size-4" />
                        )}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </div>
      </aside>

      <Form {...form}>
        <form
          className="flex min-h-0 flex-col rounded-lg border bg-background"
          onSubmit={form.handleSubmit(handleSubmit, handleInvalidSubmit)}
        >
          <div className="grid flex-1 content-start gap-4 p-4">
            <FormField
              control={form.control}
              name="name"
              rules={{ required: t("modelManager.validation.nameRequired") }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">
                    {activeSection === "imageBed"
                      ? t("modelManager.form.imageBedName")
                      : t("modelManager.form.name")}
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder={
                        activeSection === "imageBed"
                          ? t("modelManager.form.imageBedNamePlaceholder")
                          : t("modelManager.form.namePlaceholder")
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="apiKey"
              rules={{ required: t("modelManager.validation.apiKeyRequired") }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">{t("modelManager.form.apiKey")}</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        {...field}
                        type={isApiKeyVisible ? "text" : "password"}
                        placeholder={t("modelManager.form.apiKeyPlaceholder")}
                        className="pr-9"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setIsApiKeyVisible((current) => !current)}
                        aria-label={
                          isApiKeyVisible
                            ? t("modelManager.actions.hideApiKey")
                            : t("modelManager.actions.showApiKey")
                        }
                        className="absolute top-1/2 right-1 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {isApiKeyVisible ? (
                          <EyeOff className="size-4" />
                        ) : (
                          <Eye className="size-4" />
                        )}
                      </Button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {activeSection === "video" && (
              <FormField
                control={form.control}
                name="videoReferenceMode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">
                      {t("modelManager.form.videoReferenceMode")}
                    </FormLabel>
                    <FormControl>
                      <div className="grid grid-cols-2 gap-2">
                        {VIDEO_REFERENCE_MODES.map((mode) => (
                          <Button
                            key={mode}
                            type="button"
                            variant={field.value === mode ? "default" : "secondary"}
                            size="sm"
                            onClick={() => field.onChange(mode)}
                            className={cn(
                              "h-8",
                              field.value !== mode && "text-muted-foreground hover:text-foreground",
                            )}
                          >
                            {t(`modelManager.videoReferenceModes.${mode}`)}
                          </Button>
                        ))}
                      </div>
                    </FormControl>
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="example"
              rules={{ required: t("modelManager.validation.exampleRequired") }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">{t("modelManager.form.example")}</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder={
                        activeSection === "imageBed"
                          ? t("modelManager.form.imageBedExamplePlaceholder")
                          : t("modelManager.form.examplePlaceholder")
                      }
                      className="min-h-28 resize-none"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {feedbackKey && (
              <p
                className={cn(
                  "text-xs",
                  feedbackKey === "modelManager.feedback.saved"
                    ? "text-muted-foreground"
                    : "text-destructive",
                )}
              >
                {t(feedbackKey)}
              </p>
            )}

            {!isCreateMode && selectedItem ? (
              <p className="text-xs text-muted-foreground">
                {t("modelManager.form.editing", { name: selectedItem.name })}
              </p>
            ) : null}
          </div>

          <div className="mt-auto flex justify-end border-t px-4 py-3">
            <Button type="submit" size="sm" disabled={!canSave}>
              {isSaving ? t("modelManager.actions.saving") : t("modelManager.actions.save")}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
