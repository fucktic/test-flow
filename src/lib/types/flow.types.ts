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
  activeEpisodeId?: string;
  onEpisodeCheck?: (id: string, checked: boolean) => void;
  onEpisodeSelect?: (id: string) => void;
}

export interface SceneItem {
  id: string;
  name: string;
  content: string;
  selected?: boolean;
}

export interface SceneNodeData {
  title: string;
  subtitle?: string;
  scenes: SceneItem[];
  onSceneSelect?: (id: string) => void;
  onSceneEdit?: (id: string) => void;
  onSceneChange?: (id: string, content: string) => void;
  onSceneDelete?: (id: string) => void;
  onSceneAdd?: (index: number) => void;
}

export interface ReferenceImage {
  id: string;
  url?: string;
}

export interface SceneImageNodeData {
  sceneId: string;
  imageUrl?: string;
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
  sceneId: string;
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
  url?: string;
  poster?: string;
  duration?: string; // e.g., 10s
  status: "generated" | "pending";
}

export interface VideoPreviewNodeData {
  episodeId: string; // e.g., EP_002
  progress: {
    current: number;
    total: number;
  };
  vid: string; // e.g., VID_20260312
  items: VideoPreviewItem[];
  onRefresh?: () => void;
  onDownload?: () => void;
  onPostEdit?: () => void;
}
