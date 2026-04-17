"use client";

import type * as React from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AspectRatioSelector,
  ASPECT_RATIO_IDS,
  type AspectRatioId,
} from "@/components/layout/aspect-ratio-selector";
import { cn } from "@/lib/utils/index";

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
}: CanvasProjectFormFieldsProps) {
  const tCommon = useTranslations("common");

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
      <div className="grid gap-4 py-2 pr-3">
        <div className="grid grid-cols-4 items-center gap-3">
          <Label htmlFor={nameInputId} className="text-right text-sm">
            {tCommon("canvasNameLabel")}
          </Label>
          <Input
            id={nameInputId}
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            onKeyDown={onNameKeyDown}
            placeholder={tCommon("canvasNamePlaceholder")}
            className="col-span-3"
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
    </ScrollArea>
  );
}
