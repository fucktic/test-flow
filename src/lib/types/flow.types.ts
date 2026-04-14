import { Node, Edge } from "@xyflow/react";
import { SkillType } from "./agent.types";

export interface FlowState {
  nodes: Node[];
  edges: Edge[];
  selectedNodeId: string | null;
}

export interface TextNodeData {
  title?: string;
  text: string;
  command: string;
  isExecuting?: boolean;
  result?: string;
  error?: string;
}

export interface SkillNodeData {
  skillId: string;
  skillType: SkillType;
  skillFilePath: string; // 地址
  resourcePath: string; // 资源地址
  status: "idle" | "running" | "success" | "error";
  agent: string;
}

export interface EpisodeItem {
  id: string;
  title: string;
  checked: boolean;
  script?: {
    title?: string;
    timestamp?: string;
    content: string;
  };
}

export interface EpisodeNodeData {
  episodes: EpisodeItem[];
  activeId?: string;
  onEpisodeCheck?: (id: string, checked: boolean) => void;
  onEpisodeSelect?: (id: string) => void;
}

export interface SceneItem {
  id: string;
  name: string;
  content: string;
  prompt?: string;
  selected?: boolean;
}

export interface SceneNodeData {
  title: string;
  subtitle?: string;
  scenes: SceneItem[];
  onSceneSelect?: (id: string) => void;
  onSceneEdit?: (id: string) => void;
  onSceneChange?: (id: string, content: string, name?: string, prompt?: string) => void;
  onSceneDelete?: (id: string) => void;
  onSceneAdd?: (index: number) => void;
}

export interface ReferenceImage {
  id: string;
  url?: string;
}

export interface SceneImageNodeData {
  id?: string;
  sceneId?: string;
  imageUrl?: string;
  images?: { id: string; url: string }[]; // multiple images support
  assetPath?: string;
  isExpanded?: boolean;
  referenceImages?: ReferenceImage[]; // max 3
  outputFormat?: string; // e.g., "9grid", "single", "first", "last"
  ratio?: string; // e.g., "16:9", "1:1", "9:16"
  skillId?: string; // e.g., "gemini-2.5-flat"
  prompt?: string;
  onToggleExpand?: () => void;
  onGenerate?: () => void;
  onSaveAsset?: () => void;
  onUploadCustom?: () => void;
  onReferenceImageChange?: (id: string, url: string) => void;
  onOutputFormatChange?: (format: string) => void;
  onRatioChange?: (ratio: string) => void;
  onSkillChange?: (skillId: string) => void;
  onPromptChange?: (prompt: string) => void;
}

export interface VideoPreview {
  id: string;
  url: string;
  poster?: string;
  selected?: boolean;
}

export interface SceneVideoNodeData {
  id: string;
  videos?: VideoPreview[]; // can have multiple, one can be selected
  assetPath?: string;
  isExpanded?: boolean;
  referenceImages?: ReferenceImage[]; // max 4 (单图, 宫格, 首帧, 尾帧)
  ratio?: string; // e.g., "16:9", "1:1", "9:16"
  skillId?: string; // e.g., "Seedance 1.5 P"
  prompt?: string;
  onToggleExpand?: () => void;
  onGenerate?: () => void;
  onSaveAsset?: () => void;
  onUploadCustom?: () => void;
  onVideoSelect?: (id: string) => void;
  onReferenceImageChange?: (id: string, url: string) => void;
  onRatioChange?: (ratio: string) => void;
  onSkillChange?: (skillId: string) => void;
  onPromptChange?: (prompt: string) => void;
}

export interface VideoPreviewItem {
  id: string; // e.g., S-1
  uuid: string;
  url?: string;
  poster?: string;
  duration?: string; // e.g., 10s
  status: "generated" | "pending";
}

export interface EpisodeVideoData {
  id: string;
  uuid: string;
  episodeName: string;
  totalScenes: number;
  selectedVideos: number;
  vid: string; // e.g., VID_20260312
  items: VideoPreviewItem[];
}

export interface VideoPreviewNodeData {
  episodes: EpisodeVideoData[];
  onRefresh?: () => void;
  onDownloadEpisode?: (id: string) => void;
}

export type AssetCategory = "characters" | "scenes" | "props" | "audio";

export interface AssetItem {
  id: string;
  uuid: string;
  name: string;
  type: "image" | "audio" | "video";
  url: string;
  poster?: string;
  description?: string;
  prompt?: string;
}

export interface AssetNodeData {
  id: string;
  assets: {
    characters: AssetItem[];
    scenes: AssetItem[];
    props: AssetItem[];
    audio: AssetItem[];
  };
  activeTab?: AssetCategory;
  selectedId?: string;
  onTabChange?: (tab: AssetCategory) => void;
  onAssetAdd?: (
    tab: AssetCategory,
    payload: {
      name: string;
      category: AssetCategory;
      description: string;
      fileUrl?: string;
      mediaType?: AssetItem["type"];
      prompt?: string;
    },
  ) => void;
  onAssetUpdate?: (
    tab: AssetCategory,
    id: string,
    payload: {
      name: string;
      category: AssetCategory;
      description: string;
      fileUrl?: string;
      mediaType?: AssetItem["type"];
      prompt?: string;
    },
  ) => void;
  onAssetSelect?: (id?: string) => void;
  onAssetDelete?: (id: string) => void;
}
