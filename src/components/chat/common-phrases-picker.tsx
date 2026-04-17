"use client";

import { useCallback, useEffect, useState, useTransition, type MouseEvent } from "react";
import type { Editor } from "@tiptap/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useLocale, useMessages, useTranslations } from "next-intl";
import {
  ArrowRight,
  Bookmark,
  BookText,
  Image as ImageIcon,
  Info,
  Sparkles,
  Trash2,
  Video,
} from "lucide-react";

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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  deleteCustomPhraseAction,
  fetchCustomPhrases,
  saveCustomPhraseAction,
} from "@/lib/actions/common-phrases";
import type { CustomCommonPhrase } from "@/lib/types/common-phrases.types";
import { cn } from "@/lib/utils/index";

const PRESET_KEYS = [
  { labelKey: "phrasePresetNext", insertKey: "phrasePresetNextInsert", Icon: ArrowRight },
  { labelKey: "phrasePresetGenPrompt", insertKey: "phrasePresetGenPromptInsert", Icon: Sparkles },
  { labelKey: "phrasePresetGenImage", insertKey: "phrasePresetGenImageInsert", Icon: ImageIcon },
  { labelKey: "phrasePresetGenVideo", insertKey: "phrasePresetGenVideoInsert", Icon: Video },
] as const;

/** 避免 t() 在部分环境下对新增 key 抛 MISSING_MESSAGE，优先从 messages 读取 */
const PHRASE_DETAIL_ARIA_FALLBACK: Record<string, string> = {
  zh: "悬停查看完整内容",
  en: "Hover to view full text",
  "zh-TW": "懸停查看完整內容",
  ja: "ホバーで全文を表示",
  ru: "Наведите курсор для полного текста",
  vi: "Di chuột để xem toàn bộ nội dung",
};

function usePhraseDetailAriaLabel(): string {
  const locale = useLocale();
  const messages = useMessages();
  const chat = (messages as { chat?: Record<string, string> }).chat;
  const fromFile = chat?.phraseDetailAriaLabel?.trim();
  if (fromFile) return fromFile;
  return PHRASE_DETAIL_ARIA_FALLBACK[locale] ?? PHRASE_DETAIL_ARIA_FALLBACK.zh;
}

function PhraseDetailHint({ detailText, ariaLabel }: { detailText: string; ariaLabel: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={ariaLabel}
          onClick={(e) => e.stopPropagation()}
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="left" className="max-w-[min(18rem,calc(100vw-2rem))]">
        <p className="text-xs leading-relaxed whitespace-pre-wrap wrap-break-word">{detailText}</p>
      </TooltipContent>
    </Tooltip>
  );
}

/** 在输入框末尾追加常用语并立即发送 */
function appendPhraseToEndAndSend(editor: Editor | null, text: string, onSend: () => void) {
  if (!editor) return;
  editor.chain().focus("end").insertContent(text).run();
  queueMicrotask(() => onSend());
}

type CommonPhrasesPickerProps = {
  editor: Editor | null;
  onSend: () => void;
  /** 与发送按钮一致：执行中或未选智能体时禁用 */
  disabled?: boolean;
};

export function CommonPhrasesPicker({
  editor,
  onSend,
  disabled = false,
}: CommonPhrasesPickerProps) {
  const t = useTranslations("chat");
  const phraseDetailAriaLabel = usePhraseDetailAriaLabel();
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [customDialogOpen, setCustomDialogOpen] = useState(false);
  const [customPhrases, setCustomPhrases] = useState<CustomCommonPhrase[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const loadCustom = useCallback(() => {
    startTransition(async () => {
      const list = await fetchCustomPhrases();
      setCustomPhrases(list);
    });
  }, []);

  useEffect(() => {
    if (popoverOpen) {
      loadCustom();
    }
  }, [popoverOpen, loadCustom]);

  const formSchema = z.object({
    name: z
      .string()
      .trim()
      .min(1, { message: t("phraseNameRequired") })
      .max(10, { message: t("phraseNameMax") }),
    content: z
      .string()
      .trim()
      .min(1, { message: t("phraseContentRequired") })
      .max(200, { message: t("phraseContentMax") }),
  });

  type FormValues = z.infer<typeof formSchema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", content: "" },
  });

  const openCustomDialog = () => {
    setPopoverOpen(false);
    setSaveError(null);
    form.reset({ name: "", content: "" });
    setCustomDialogOpen(true);
  };

  const onSubmitCustom = (values: FormValues) => {
    setSaveError(null);
    startTransition(async () => {
      const result = await saveCustomPhraseAction(values);
      if (result.success) {
        setCustomPhrases(result.phrases);
        setCustomDialogOpen(false);
        form.reset({ name: "", content: "" });
      } else {
        setSaveError(t("phraseSaveFailed"));
      }
    });
  };

  const handlePresetPick = (insertKey: (typeof PRESET_KEYS)[number]["insertKey"]) => {
    const text = t(insertKey);
    appendPhraseToEndAndSend(editor, text, onSend);
    setPopoverOpen(false);
  };

  const handleCustomPick = (phrase: CustomCommonPhrase) => {
    appendPhraseToEndAndSend(editor, phrase.content, onSend);
    setPopoverOpen(false);
  };

  const handleDeleteCustom = (e: MouseEvent<HTMLButtonElement>, phrase: CustomCommonPhrase) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm(t("phraseDeleteConfirm"))) {
      return;
    }
    startTransition(async () => {
      const result = await deleteCustomPhraseAction(phrase.id);
      if (result.success) {
        setCustomPhrases(result.phrases);
      }
    });
  };

  return (
    <>
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 rounded-lg text-muted-foreground hover:text-foreground"
                disabled={!editor || disabled}
                aria-label={t("commonPhrases")}
              >
                <BookText className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={6}>
            {t("commonPhrases")}
          </TooltipContent>
        </Tooltip>
        <PopoverContent align="start" className="w-80 p-0">
          <div className="border-b px-3 py-2">
            <p className="text-sm font-medium">{t("commonPhrases")}</p>
            <p className="text-xs text-muted-foreground">{t("presetReadonlyHint")}</p>
          </div>
          <div className="max-h-72 overflow-y-auto p-2">
            <p className="px-1 pb-1 text-xs font-medium text-muted-foreground">
              {t("presetSection")}
            </p>
            <div className="flex flex-col gap-0.5">
              {PRESET_KEYS.map((k) => {
                const Icon = k.Icon;
                return (
                  <div
                    key={k.labelKey}
                    className={cn(
                      "flex w-full items-center gap-0.5 rounded-md",
                      "hover:bg-muted/80 focus-within:ring-2 focus-within:ring-ring",
                    )}
                  >
                    <button
                      type="button"
                      className={cn(
                        "flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left text-sm",
                        "rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      )}
                      onClick={() => handlePresetPick(k.insertKey)}
                    >
                      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="truncate font-medium">{t(k.labelKey)}</span>
                    </button>
                    <PhraseDetailHint
                      detailText={t(k.insertKey)}
                      ariaLabel={phraseDetailAriaLabel}
                    />
                  </div>
                );
              })}
            </div>

            {(customPhrases.length > 0 || isPending) && (
              <>
                <div className="my-2 h-px bg-border" role="separator" />
                <p className="px-1 pb-1 text-xs font-medium text-muted-foreground">
                  {t("customSection")}
                </p>
                <div className="flex flex-col gap-0.5">
                  {customPhrases.map((phrase) => (
                    <div
                      key={phrase.id}
                      className={cn(
                        "flex w-full items-center gap-0.5 rounded-md",
                        "hover:bg-muted/80 focus-within:ring-2 focus-within:ring-ring",
                      )}
                    >
                      <button
                        type="button"
                        className={cn(
                          "flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left text-sm",
                          "rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        )}
                        onClick={() => handleCustomPick(phrase)}
                      >
                        <Bookmark className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                        <span className="truncate font-medium">{phrase.name}</span>
                      </button>
                      <PhraseDetailHint
                        detailText={phrase.content}
                        ariaLabel={phraseDetailAriaLabel}
                      />
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
                            aria-label={t("phraseDeleteAriaLabel")}
                            disabled={isPending || disabled}
                            onClick={(e) => handleDeleteCustom(e, phrase)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="left">{t("phraseDeleteAriaLabel")}</TooltipContent>
                      </Tooltip>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className="my-2 h-px bg-border" role="separator" />
            <Button type="button" variant="secondary" className="w-full" onClick={openCustomDialog}>
              {t("customPhrase")}
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <Dialog open={customDialogOpen} onOpenChange={setCustomDialogOpen}>
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>{t("customPhraseTitle")}</DialogTitle>
          </DialogHeader>
          <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmitCustom)}>
            <div className="grid gap-2">
              <Label htmlFor="common-phrase-name">{t("phraseNameLabel")}</Label>
              <Input
                id="common-phrase-name"
                maxLength={10}
                autoComplete="off"
                disabled={isPending || disabled}
                {...form.register("name")}
              />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="common-phrase-content">{t("phraseContentLabel")}</Label>
              <Textarea
                id="common-phrase-content"
                rows={4}
                maxLength={200}
                disabled={isPending || disabled}
                {...form.register("content")}
              />
              {form.formState.errors.content && (
                <p className="text-xs text-destructive">{form.formState.errors.content.message}</p>
              )}
            </div>
            {saveError && <p className="text-xs text-destructive">{saveError}</p>}
            <DialogFooter className="border-0 bg-transparent p-0 sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCustomDialogOpen(false)}
                disabled={isPending || disabled}
              >
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={isPending || disabled}>
                {t("save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
