"use client";

import type * as React from "react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Eye, FileText, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AspectRatioSelector,
  ASPECT_RATIO_IDS,
  type AspectRatioId,
} from "@/components/layout/aspect-ratio-selector";
import { cn } from "@/lib/utils/index";
import { firstNonEmptyLineTitle, validateScreenplayMarkdown } from "@/lib/screenplay/screenplay";
import { ScreenplayMarkdownPreview } from "@/components/layout/screenplay-markdown-preview";

export type { AspectRatioId } from "@/components/layout/aspect-ratio-selector";

/** 与画布新建/编辑弹窗底部栏的毛玻璃样式一致时可复用 */
export const canvasDialogFooterGlass =
  "border-border/40 bg-background/75 shadow-[0_-10px_40px_-8px_rgba(0,0,0,0.08)] backdrop-blur-md supports-backdrop-filter:bg-background/55 dark:bg-background/40 dark:supports-backdrop-filter:bg-background/30";

export const RESOLUTION_IDS = ["720", "1080", "2k", "4k"] as const;
export type ResolutionId = (typeof RESOLUTION_IDS)[number];

export function normalizeAspectRatioId(raw: string | undefined): AspectRatioId {
  if (raw && ASPECT_RATIO_IDS.includes(raw as AspectRatioId)) {
    return raw as AspectRatioId;
  }
  return "smart";
}

export function normalizeResolutionId(raw: string | undefined): ResolutionId {
  if (raw && RESOLUTION_IDS.includes(raw as ResolutionId)) {
    return raw as ResolutionId;
  }
  return "1080";
}

export type ScreenplayDraft = {
  id: string;
  name: string;
  content: string;
};

export function ScreenplayParsingOverlay({ open, message }: { open: boolean; message: string }) {
  return (
    <Dialog open={open}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-xs"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <div className="flex flex-col items-center gap-3 py-2">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-center text-sm">{message}</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** 与 `project.json` 顶层打平字段一致，供保存逻辑对齐 */
export function flattenCanvasProjectFieldsForSave(input: {
  aspectRatio: AspectRatioId;
  resolution: ResolutionId;
  style: string;
}) {
  return {
    aspectRatio: input.aspectRatio,
    resolution: input.resolution,
    style: input.style.trim(),
  };
}

export type CanvasProjectFormFieldsProps = {
  name: string;
  onNameChange: (value: string) => void;
  aspectRatio: AspectRatioId;
  onAspectRatioChange: (value: AspectRatioId) => void;
  resolution: ResolutionId;
  onResolutionChange: (value: ResolutionId) => void;
  style: string;
  onStyleChange: (value: string) => void;
  nameInputId: string;
  onNameKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  /** 滚动区域高度，默认适配弹窗内滚动 */
  scrollAreaClassName?: string;
  /** 剧本 Markdown：新建可上传；编辑仅展示已有文件，不可删除 */
  screenplay?: {
    mode: "create" | "edit";
    drafts: ScreenplayDraft[];
    onDraftsChange: (next: ScreenplayDraft[]) => void;
    existingFileNames?: string[];
    onSuggestCanvasName?: (title: string) => void;
    onRequestViewScreenplay: (fileName: string) => void;
  };
};

export function CanvasProjectFormFields({
  name,
  onNameChange,
  aspectRatio,
  onAspectRatioChange,
  resolution,
  onResolutionChange,
  style,
  onStyleChange,
  nameInputId,
  onNameKeyDown,
  scrollAreaClassName,
  screenplay,
}: CanvasProjectFormFieldsProps) {
  const tCommon = useTranslations("common");
  const [formatInvalidOpen, setFormatInvalidOpen] = useState(false);
  const [sampleOpen, setSampleOpen] = useState(false);
  const [sampleLoading, setSampleLoading] = useState(false);
  const [sampleBody, setSampleBody] = useState("");
  const [sampleError, setSampleError] = useState<string | null>(null);

  const openScreenplaySample = async () => {
    setSampleOpen(true);
    setSampleLoading(true);
    setSampleBody("");
    setSampleError(null);
    try {
      const res = await fetch("/api/screenplay-sample");
      if (!res.ok) {
        throw new Error("not_found");
      }
      setSampleBody(await res.text());
    } catch {
      setSampleError(tCommon("screenplaySampleLoadError"));
    } finally {
      setSampleLoading(false);
    }
  };

  const handleScriptFiles = async (list: FileList | null, inputEl: HTMLInputElement | null) => {
    if (!list?.length || !screenplay || screenplay.mode !== "create") return;
    const hadNone = screenplay.drafts.length === 0;
    const next = [...screenplay.drafts];
    for (const file of Array.from(list)) {
      const lower = file.name.toLowerCase();
      if (!lower.endsWith(".md") && file.type !== "text/markdown") {
        setFormatInvalidOpen(true);
        return;
      }
      const text = await file.text();
      if (!validateScreenplayMarkdown(text)) {
        setFormatInvalidOpen(true);
        return;
      }
      next.push({
        id: crypto.randomUUID(),
        name: file.name,
        content: text,
      });
    }
    screenplay.onDraftsChange(next);
    if (hadNone && next.length > 0) {
      const t0 = firstNonEmptyLineTitle(next[0].content);
      if (t0) screenplay.onSuggestCanvasName?.(t0);
    }
    if (inputEl) inputEl.value = "";
  };

  const ratioLabel = (id: AspectRatioId) => {
    const keys: Record<AspectRatioId, string> = {
      smart: "ratio_smart",
      "21:9": "ratio_21_9",
      "16:9": "ratio_16_9",
      "3:2": "ratio_3_2",
      "4:3": "ratio_4_3",
      "1:1": "ratio_1_1",
      "3:4": "ratio_3_4",
      "2:3": "ratio_2_3",
      "9:16": "ratio_9_16",
    };
    return tCommon(keys[id] as "ratio_smart");
  };

  return (
    <ScrollArea
      className={cn(
        "min-h-0 w-full pr-1",
        scrollAreaClassName !== undefined
          ? scrollAreaClassName
          : "max-h-[min(65vh,560px)] sm:max-h-[min(70vh,600px)]",
      )}
    >
      <div className="grid gap-4 py-2 mx-1 ">
        {screenplay ? (
          <div className="grid gap-2 border-b border-border/50 pb-4">
            <Label className="text-xs font-normal text-muted-foreground">
              {tCommon("screenplayUploadLabel")}
            </Label>
            <p className="text-xs leading-snug text-muted-foreground">
              {tCommon("screenplayUploadHint")}{" "}
              <button
                type="button"
                onClick={() => void openScreenplaySample()}
                className="inline p-0 align-baseline text-[11px] leading-snug text-primary underline underline-offset-2 hover:text-primary/80"
              >
                {tCommon("screenplayViewSample")}
              </button>
            </p>
            {screenplay.mode === "create" ? (
              <>
                <Input
                  type="file"
                  accept=".md,text/markdown"
                  multiple
                  className="cursor-pointer text-xs file:mr-2"
                  onChange={(e) => void handleScriptFiles(e.target.files, e.target)}
                />
                {screenplay.drafts.length > 0 ? (
                  <ul className="grid gap-1.5 text-xs">
                    {screenplay.drafts.map((d) => (
                      <li
                        key={d.id}
                        className="flex items-center justify-between gap-2 rounded-lg bg-muted/50 px-2 py-1.5"
                      >
                        <span className="flex min-w-0 items-center gap-1.5">
                          <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <span className="truncate">{d.name}</span>
                        </span>
                        <span className="flex shrink-0 items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="h-7 w-7"
                            onClick={() => screenplay.onRequestViewScreenplay(d.name)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                            <span className="sr-only">{tCommon("screenplayView")}</span>
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() =>
                              screenplay.onDraftsChange(
                                screenplay.drafts.filter((x) => x.id !== d.id),
                              )
                            }
                          >
                            <X className="h-3.5 w-3.5" />
                            <span className="sr-only">{tCommon("delete")}</span>
                          </Button>
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </>
            ) : null}
            {screenplay.mode === "edit" &&
            screenplay.existingFileNames &&
            screenplay.existingFileNames.length > 0 ? (
              <ul className="grid gap-1.5 text-xs">
                {screenplay.existingFileNames.map((fn) => (
                  <li
                    key={fn}
                    className="flex items-center justify-between gap-2 rounded-lg bg-muted/50 px-2 py-1.5"
                  >
                    <span className="flex min-w-0 items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate">{fn}</span>
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="h-7 w-7 shrink-0"
                      onClick={() => screenplay.onRequestViewScreenplay(fn)}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span className="sr-only">{tCommon("screenplayView")}</span>
                    </Button>
                  </li>
                ))}
              </ul>
            ) : screenplay.mode === "edit" ? (
              <p className="text-xs text-muted-foreground">{tCommon("screenplayNoneSaved")}</p>
            ) : null}
          </div>
        ) : null}

        <div className="grid gap-2">
          <Label htmlFor={nameInputId} className="text-xs font-normal text-muted-foreground">
            {tCommon("canvasNameLabel")}
          </Label>
          <Input
            id={nameInputId}
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            onKeyDown={onNameKeyDown}
            placeholder={tCommon("canvasNamePlaceholder")}
            className="w-full"
          />
        </div>

        <div className="grid gap-2">
          <Label className="text-xs font-normal text-muted-foreground">
            {tCommon("newCanvasAspectRatio")}
          </Label>
          <AspectRatioSelector
            value={aspectRatio}
            onChange={onAspectRatioChange}
            label={ratioLabel}
          />
        </div>

        <div className="grid gap-2">
          <Label className="text-xs font-normal text-muted-foreground">
            {tCommon("newCanvasResolution")}
          </Label>
          <div className="flex flex-wrap gap-1 rounded-xl bg-muted/60 p-2">
            {RESOLUTION_IDS.map((id) => {
              const active = resolution === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onResolutionChange(id)}
                  className={cn(
                    "flex-1 min-w-18 rounded-lg px-2 py-2 text-center text-xs font-medium transition-colors",
                    active ? "bg-background shadow-sm" : "hover:bg-background/60",
                  )}
                >
                  {tCommon(
                    (
                      {
                        "720": "resolution_720",
                        "1080": "resolution_1080",
                        "2k": "resolution_2k",
                        "4k": "resolution_4k",
                      } as const
                    )[id],
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-2">
          <Label
            htmlFor={`${nameInputId}-style`}
            className="text-xs font-normal text-muted-foreground"
          >
            {tCommon("newCanvasStyle")}
          </Label>
          <Input
            id={`${nameInputId}-style`}
            value={style}
            onChange={(e) => onStyleChange(e.target.value)}
            placeholder={tCommon("stylePlaceholder")}
            className="w-full"
          />
        </div>
      </div>

      <Dialog open={formatInvalidOpen} onOpenChange={setFormatInvalidOpen}>
        <DialogContent showCloseButton className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{tCommon("screenplayFormatInvalidTitle")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{tCommon("screenplayFormatInvalidDesc")}</p>
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setFormatInvalidOpen(false);
                void openScreenplaySample();
              }}
            >
              {tCommon("screenplayViewSample")}
            </Button>
            <Button type="button" onClick={() => setFormatInvalidOpen(false)}>
              {tCommon("confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={sampleOpen} onOpenChange={setSampleOpen}>
        <DialogContent className="flex max-h-[92vh] w-[calc(100vw-2rem)] flex-col gap-3 overflow-hidden p-4 sm:max-w-2xl">
          <DialogHeader className="shrink-0 space-y-1 pr-8 text-left">
            <DialogTitle>{tCommon("screenplaySampleTitle")}</DialogTitle>
            <DialogDescription className="break-all sm:break-words">
              {tCommon("screenplaySampleSubtitle")}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[min(60vh,520px)] w-full rounded-lg border border-border/60 bg-muted/30">
            <div className="p-3">
              {sampleLoading ? (
                <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {tCommon("loading")}
                </div>
              ) : sampleError ? (
                <p className="text-sm text-destructive">{sampleError}</p>
              ) : (
                <ScreenplayMarkdownPreview markdown={sampleBody} className="text-[13px]" />
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </ScrollArea>
  );
}
