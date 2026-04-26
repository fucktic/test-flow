"use client";

import { useMemo, useRef, useState } from "react";
import { mergeAttributes, Node as TiptapNode } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { ArrowUp, Clapperboard, ImagePlus, Plus, Sparkles, Timer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { uploadProjectTempImages, type ProjectTempImage } from "@/lib/project-api";
import { cn } from "@/lib/utils";

export type ChatWindowReferenceImage = {
  id: string;
  label: string;
  name: string;
  url: string;
};

type ChatWindowAttachment = ProjectTempImage | ChatWindowReferenceImage;

export type ChatWindowVideoOptions = {
  durationSeconds?: number;
  shotType?: string;
};

export type ChatWindowSubmitPayload = {
  attachments: ChatWindowAttachment[];
  html: string;
  text: string;
  videoOptions?: ChatWindowVideoOptions;
};

export type ChatWindowModelOption = {
  id: string;
  name: string;
};

export type ChatWindowCommandStatus = "error" | "loading" | "success";

type MentionRange = {
  from: number;
  to: number;
};

const VIDEO_DURATION_MAX = 15;
const VIDEO_SHOT_TYPES = [
  "static",
  "push-in",
  "pull-out",
  "pan",
  "tilt",
  "tracking",
  "orbit",
  "handheld",
] as const;
const VIDEO_DURATION_OPTIONS = Array.from({ length: VIDEO_DURATION_MAX }, (_, index) => index + 1);

const ChatInlineTag = TiptapNode.create({
  name: "chatInlineTag",
  group: "inline",
  inline: true,
  atom: true,
  selectable: false,
  addAttributes() {
    return {
      label: {
        default: "",
      },
      kind: {
        default: "default",
      },
    };
  },
  parseHTML() {
    return [
      {
        tag: "span[data-chat-inline-tag]",
      },
    ];
  },
  renderHTML({ HTMLAttributes, node }) {
    const kindClass =
      node.attrs.kind === "shot"
        ? "bg-primary/20 text-primary"
        : node.attrs.kind === "duration"
          ? "bg-accent text-accent-foreground"
          : node.attrs.kind === "mention"
            ? "bg-secondary text-secondary-foreground"
            : "bg-muted text-muted-foreground";

    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-chat-inline-tag": "true",
        class: cn(
          "mx-0.5 inline-flex items-center rounded-3xl p-2 text-xs font-medium leading-none",
          kindClass,
        ),
        contenteditable: "false",
      }),
      node.attrs.label,
    ];
  },
  renderText({ node }) {
    return node.attrs.label;
  },
});

type ChatWindowProps = {
  className?: string;
  commandStatus?: ChatWindowCommandStatus;
  commandStatusLabel?: string;
  projectId: string;
  emptyModelLabel: string;
  placeholder: string;
  inputLabel: string;
  addAttachmentLabel: string;
  attachmentFallbackLabel: (index: number) => string;
  attachmentListLabel: string;
  removeAttachmentLabel: string;
  firstFrameLabel: string;
  lastFrameLabel: string;
  promptPairSeparator: string;
  modelSelectLabel: string;
  modelOptions: ChatWindowModelOption[];
  mediaMentionImages: ChatWindowReferenceImage[];
  referenceImages: ChatWindowReferenceImage[];
  requiresFirstLastFrame: boolean;
  selectedModelId: string;
  sendLabel: string;
  showVideoOptions: boolean;
  videoDurationLabel: string;
  videoDurationUnitLabel: string;
  videoShotLabel: string;
  videoShotLabels: Record<(typeof VIDEO_SHOT_TYPES)[number], string>;
  onModelChange: (modelId: string) => void;
  onSubmit?: (payload: ChatWindowSubmitPayload) => void;
};

export function ChatWindow({
  className,
  commandStatus,
  commandStatusLabel,
  projectId,
  emptyModelLabel,
  placeholder,
  inputLabel,
  addAttachmentLabel,
  attachmentFallbackLabel,
  attachmentListLabel,
  removeAttachmentLabel,
  firstFrameLabel,
  lastFrameLabel,
  promptPairSeparator,
  modelSelectLabel,
  modelOptions,
  mediaMentionImages,
  referenceImages,
  requiresFirstLastFrame,
  selectedModelId,
  sendLabel,
  showVideoOptions,
  videoDurationLabel,
  videoDurationUnitLabel,
  videoShotLabel,
  videoShotLabels,
  onModelChange,
  onSubmit,
}: ChatWindowProps) {
  const [isEmpty, setIsEmpty] = useState(true);
  const [attachments, setAttachments] = useState<ChatWindowAttachment[]>([]);
  const [durationSeconds, setDurationSeconds] = useState<number | null>(null);
  const [shotType, setShotType] = useState<(typeof VIDEO_SHOT_TYPES)[number] | null>(null);
  const [selectedReferenceImageIds, setSelectedReferenceImageIds] = useState<string[]>([]);
  const [mentionRange, setMentionRange] = useState<MentionRange | null>(null);
  const [mentionQuery, setMentionQuery] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectedReferenceImages = useMemo(
    () => referenceImages.filter((image) => selectedReferenceImageIds.includes(image.id)),
    [referenceImages, selectedReferenceImageIds],
  );
  const activeAttachments = requiresFirstLastFrame ? selectedReferenceImages : attachments;
  const mentionSource = mediaMentionImages.length > 0 ? mediaMentionImages : attachments;
  const isCommandLoading = commandStatus === "loading";
  const mentionOptions = useMemo(
    () =>
      mentionSource.filter((attachment) =>
        attachment.label.toLowerCase().includes(mentionQuery.toLowerCase()),
      ),
    [mentionQuery, mentionSource],
  );
  const updateMentionState = (currentEditor: NonNullable<ReturnType<typeof useEditor>>) => {
    const cursorPosition = currentEditor.state.selection.from;
    const textBeforeCursor = currentEditor.state.doc.textBetween(0, cursorPosition, "\n", "\n");
    const mentionMatch = /(?:^|\s)@([^\s@]*)$/.exec(textBeforeCursor);

    if (!mentionMatch || mentionSource.length === 0) {
      setMentionRange(null);
      setMentionQuery("");
      return;
    }

    const query = mentionMatch[1] ?? "";
    setMentionRange({
      from: cursorPosition - query.length - 1,
      to: cursorPosition,
    });
    setMentionQuery(query);
  };
  const editor = useEditor({
    extensions: [
      ChatInlineTag,
      StarterKit.configure({
        bulletList: false,
        codeBlock: false,
        heading: false,
        horizontalRule: false,
        orderedList: false,
      }),
    ],
    editorProps: {
      attributes: {
        "aria-label": inputLabel,
        class:
          "h-36 max-h-36 w-full resize-none overflow-y-auto pr-1 outline-none text-sm leading-6 text-card-foreground caret-primary",
      },
    },
    immediatelyRender: false,
    onUpdate: ({ editor: updatedEditor }) => {
      setIsEmpty(updatedEditor.isEmpty);
      updateMentionState(updatedEditor);
    },
    onSelectionUpdate: ({ editor: updatedEditor }) => {
      updateMentionState(updatedEditor);
    },
  });

  const handleSubmit = () => {
    if (!editor || (editor.isEmpty && activeAttachments.length === 0)) return;

    const textPrefix =
      requiresFirstLastFrame && activeAttachments.length > 0
        ? [
            activeAttachments[0]
              ? `${firstFrameLabel}${promptPairSeparator}${activeAttachments[0].label}`
              : "",
            activeAttachments[1]
              ? `${lastFrameLabel}${promptPairSeparator}${activeAttachments[1].label}`
              : "",
          ]
            .filter(Boolean)
            .join("\n")
        : "";
    const text = [textPrefix, editor.getText()].filter(Boolean).join("\n");

    onSubmit?.({
      attachments: activeAttachments,
      html: editor.getHTML(),
      text,
      videoOptions: showVideoOptions
        ? {
            ...(durationSeconds === null ? {} : { durationSeconds }),
            ...(shotType === null ? {} : { shotType }),
          }
        : undefined,
    });

    // Clear the prompt after a successful local handoff so the composer feels chat-like.
    editor.commands.clearContent();
    setAttachments([]);
    setSelectedReferenceImageIds([]);
    setMentionRange(null);
    setMentionQuery("");
    setIsEmpty(true);
  };

  const handleFilesChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    const imageFiles = files.filter((file) => file.type.startsWith("image/"));
    event.target.value = "";
    if (requiresFirstLastFrame || !projectId || imageFiles.length === 0) return;

    try {
      const uploadedImages = await uploadProjectTempImages(projectId, imageFiles);
      setAttachments((currentAttachments) => [
        ...currentAttachments,
        ...uploadedImages.map((image, index) => ({
          ...image,
          label: attachmentFallbackLabel(currentAttachments.length + index + 1),
        })),
      ]);
    } catch {
      // Temporary upload is best-effort; users can retry from the attachment button.
    }
  };

  const removeAttachment = (attachmentId: string) => {
    setAttachments((currentAttachments) =>
      currentAttachments.filter((attachment) => attachment.id !== attachmentId),
    );
  };

  const toggleReferenceImage = (imageId: string) => {
    setSelectedReferenceImageIds((currentIds) => {
      if (currentIds.includes(imageId)) return currentIds.filter((id) => id !== imageId);
      return [...currentIds, imageId].slice(-2);
    });
  };

  const insertInlineTag = (label: string, kind: "duration" | "mention" | "shot") => {
    if (!editor) return;

    const shouldPrefixSpace = editor.getText().trim().length > 0;
    editor
      .chain()
      .focus()
      .insertContent([
        ...(shouldPrefixSpace
          ? [
              {
                type: "text",
                text: " ",
              },
            ]
          : []),
        {
          type: "chatInlineTag",
          attrs: { kind, label },
        },
        {
          type: "text",
          text: " ",
        },
      ])
      .run();
  };

  const selectShotType = (value: string) => {
    if (!VIDEO_SHOT_TYPES.some((type) => type === value)) return;

    const nextShotType = value as (typeof VIDEO_SHOT_TYPES)[number];
    setShotType(nextShotType);
    insertInlineTag(`${videoShotLabel}${promptPairSeparator}${videoShotLabels[nextShotType]}`, "shot");
  };

  const selectDuration = (value: string) => {
    const numericValue = Number.parseInt(value, 10);
    if (Number.isNaN(numericValue)) return;

    setDurationSeconds(numericValue);
    insertInlineTag(
      `${videoDurationLabel}${promptPairSeparator}${numericValue}${videoDurationUnitLabel}`,
      "duration",
    );
  };

  const insertAttachmentReference = (attachment: ChatWindowAttachment) => {
    if (!editor || !mentionRange) return;

    editor
      .chain()
      .focus()
      .deleteRange(mentionRange)
      .insertContent([
        {
          type: "chatInlineTag",
          attrs: { kind: "mention", label: `@${attachment.label}` },
        },
        {
          type: "text",
          text: " ",
        },
      ])
      .run();
    setMentionRange(null);
    setMentionQuery("");
  };

  return (
    <section
      className={cn(
        "pointer-events-auto flex h-66 w-full max-w-160 flex-col rounded-2xl border border-border bg-card/95 px-4 py-3 text-card-foreground shadow-2xl backdrop-blur",
        className,
      )}
    >
        <div
          className="mb-3 flex min-h-10 max-w-full items-center gap-2 overflow-x-auto pb-1"
          aria-label={attachmentListLabel}
        >
          {requiresFirstLastFrame ? (
            referenceImages.map((image) => {
              const selectedIndex = selectedReferenceImageIds.indexOf(image.id);
              const isSelected = selectedIndex >= 0;

              return (
                <button
                  key={image.id}
                  type="button"
                  className={cn(
                    "relative size-10 shrink-0 overflow-hidden rounded-md border border-border bg-secondary transition-colors hover:border-primary",
                    isSelected ? "border-primary ring-2 ring-primary" : null,
                  )}
                  title={image.name}
                  aria-pressed={isSelected}
                  onClick={() => toggleReferenceImage(image.id)}
                >
                  <span
                    className="block size-full bg-cover bg-center"
                    style={{ backgroundImage: `url(${image.url})` }}
                    aria-hidden="true"
                  />
                  {isSelected ? (
                    <span className="absolute inset-x-0 bottom-0 bg-primary/90 px-0.5 py-0.5 text-[9px] leading-none text-primary-foreground">
                      {selectedIndex === 0 ? firstFrameLabel : lastFrameLabel}
                    </span>
                  ) : null}
                </button>
              );
            })
          ) : (
            <>
              {attachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className="group relative size-10 shrink-0 overflow-hidden rounded-md border border-border bg-secondary"
                  title={attachment.name}
                >
                  <div
                    className="size-full bg-cover bg-center"
                    style={{ backgroundImage: `url(${attachment.url})` }}
                    aria-hidden="true"
                  />
                  <button
                    type="button"
                    className="absolute right-0.5 top-0.5 hidden size-5 items-center justify-center rounded-full bg-background/90 text-foreground shadow-sm group-hover:flex"
                    aria-label={removeAttachmentLabel}
                    onClick={() => removeAttachment(attachment.id)}
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border bg-secondary text-secondary-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                aria-label={addAttachmentLabel}
                disabled={!projectId}
                onClick={() => fileInputRef.current?.click()}
              >
                {attachments.length === 0 ? <ImagePlus className="size-4" /> : <Plus className="size-4" />}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                aria-label={addAttachmentLabel}
                onChange={handleFilesChange}
              />
            </>
          )}
        </div>

        <div className="relative h-36 max-h-36 overflow-hidden">
          {isEmpty ? (
            <div className="pointer-events-none absolute left-0 top-0 text-sm leading-6 text-muted-foreground">
              {placeholder}
            </div>
          ) : null}
          <EditorContent
            editor={editor}
            className="h-36 max-h-36 overflow-hidden [&_.ProseMirror]:h-36 [&_.ProseMirror]:max-h-36 [&_.ProseMirror]:overflow-y-auto [&_.ProseMirror_p]:m-0"
          />
          {mentionRange && mentionOptions.length > 0 ? (
            <div className="absolute left-0 top-7 z-10 max-h-32 min-w-32 overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md">
              {mentionOptions.map((attachment) => (
                <button
                  key={attachment.id}
                  type="button"
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                  onClick={() => insertAttachmentReference(attachment)}
                >
                  <span
                    className="size-5 shrink-0 rounded-sm bg-cover bg-center"
                    style={{ backgroundImage: `url(${attachment.url})` }}
                    aria-hidden="true"
                  />
                  <span className="truncate">{attachment.label}</span>
                </button>
              ))}
            </div>
          ) : null}
         
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-card-foreground">
            <div className="w-56 min-w-56 max-w-56 flex-none">
              <Select
                value={selectedModelId}
                onValueChange={onModelChange}
                disabled={modelOptions.length === 0}
              >
                <SelectTrigger
                  aria-label={modelSelectLabel}
                  className="px-2! h-7 w-full rounded-3xl border-transparent bg-secondary/80! py-0 text-secondary-foreground shadow-none hover:bg-secondary focus-visible:ring-0 dark:bg-secondary/80 dark:hover:bg-secondary [&>svg:last-child]:hidden"
                  style={{
                    maxWidth: "12rem",
                    minWidth: "12rem",
                    width: "12rem",
                  }}
                >
                  <span className="flex min-w-0 flex-1 items-center gap-1.5">
                    <Sparkles className="size-4 shrink-0 text-muted-foreground" />
                    <SelectValue
                      placeholder={emptyModelLabel}
                      className="min-w-0 flex-1 truncate text-left"
                    />
                  </span>
                </SelectTrigger>
                <SelectContent
                  align="start"
                  className="z-60 w-56 p-2"
                  position="popper"
                  side="bottom"
                  sideOffset={6}
                >
                  {modelOptions.map((model) => (
                    <SelectItem key={model.id} value={model.id} className="cursor-pointer">
                      {model.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 text-muted-foreground">
            {commandStatus && commandStatusLabel ? (
              <span
                className={cn(
                  "max-w-20 truncate text-xs",
                  commandStatus === "error"
                    ? "text-destructive"
                    : commandStatus === "success"
                      ? "text-emerald-500"
                      : "text-muted-foreground",
                )}
              >
                {commandStatusLabel}
              </span>
            ) : null}
            {showVideoOptions ? (
              <>
                <Select
                  value={shotType ?? ""}
                  onValueChange={selectShotType}
                >
                  <SelectTrigger
                    aria-label={videoShotLabel}
                    className="h-7 w-20 rounded-3xl border-transparent bg-secondary/80! px-2 py-0 text-secondary-foreground shadow-none hover:bg-secondary focus-visible:ring-0 dark:bg-secondary/80 dark:hover:bg-secondary [&>svg:last-child]:hidden"
                  >
                    <Clapperboard className="size-4 shrink-0 text-muted-foreground" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent
                    align="end"
                    className="z-60 w-72 p-2"
                    position="popper"
                    side="bottom"
                    sideOffset={6}
                  >
                    <div className="grid grid-flow-col grid-rows-2 gap-1">
                      {VIDEO_SHOT_TYPES.map((type) => (
                        <SelectItem
                          key={type}
                          value={type}
                          className={cn(
                            "h-8 min-w-12 cursor-pointer justify-center rounded-md border border-border bg-secondary/80 px-2 py-0 text-center text-xs text-secondary-foreground focus:bg-accent focus:text-accent-foreground [&>span:first-child]:hidden",
                            shotType === type ? "border-primary bg-primary text-primary-foreground focus:bg-primary focus:text-primary-foreground" : null,
                          )}
                        >
                          {videoShotLabels[type]}
                        </SelectItem>
                      ))}
                    </div>
                  </SelectContent>
                </Select>
                <Select
                  value={durationSeconds?.toString() ?? ""}
                  onValueChange={selectDuration}
                >
                  <SelectTrigger
                    aria-label={videoDurationLabel}
                    className="h-7 w-16 rounded-3xl border-transparent bg-secondary/80! px-2 py-0 text-secondary-foreground shadow-none hover:bg-secondary focus-visible:ring-0 dark:bg-secondary/80 dark:hover:bg-secondary [&>svg:last-child]:hidden"
                  >
                    <Timer className="size-4 shrink-0 text-muted-foreground" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent
                    align="end"
                    className="z-60 max-h-52 w-20 p-1"
                    position="popper"
                    side="bottom"
                    sideOffset={6}
                  >
                    {VIDEO_DURATION_OPTIONS.map((seconds) => (
                      <SelectItem key={seconds} value={seconds.toString()} className="cursor-pointer">
                        {seconds}{videoDurationUnitLabel}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            ) : null}
            <Button
              type="button"
              size="icon-sm"
              className="size-8 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
              aria-label={sendLabel}
              disabled={isCommandLoading || !editor || (isEmpty && activeAttachments.length === 0)}
              onClick={handleSubmit}
            >
              <ArrowUp className="size-5" />
            </Button>
          </div>
        </div>
      </section>
  );
}
