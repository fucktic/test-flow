import { ArrowRight, Image as ImageIcon, Sparkles, Video, type LucideIcon } from "lucide-react";

/** 常用语预设：插入正文为固定英文；labelKey 对应 messages `chat` 命名空间 */
export const CHAT_PRESET_PHRASES: ReadonlyArray<{
  labelKey:
    | "phrasePresetNext"
    | "phrasePresetGenPrompt"
    | "phrasePresetGenImage"
    | "phrasePresetGenVideo";
  insertText: string;
  Icon: LucideIcon;
}> = [
  { labelKey: "phrasePresetNext", insertText: "Next step", Icon: ArrowRight },
  {
    labelKey: "phrasePresetGenPrompt",
    insertText: "Generate the prompt for this shot",
    Icon: Sparkles,
  },
  {
    labelKey: "phrasePresetGenImage",
    insertText: "Generate a new image for this shot based on the prompt",
    Icon: ImageIcon,
  },
  {
    labelKey: "phrasePresetGenVideo",
    insertText: "Generate a new video for this shot based on the prompt",
    Icon: Video,
  },
];
