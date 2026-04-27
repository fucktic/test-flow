export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export type JsonObject = {
  [key: string]: JsonValue;
};

export type ProjectEpisode = {
  id: string;
  name: string;
};

export type ProjectAssetItem = {
  id: string;
  children: string[];
};

export type ProjectImageAsset = {
  id: string;
  name: string;
  type: string;
  source: string;
  prompt: string;
  url: string;
};

export type ProjectVideoAsset = {
  id: string;
  name: string;
  source: string;
  prompt: string;
  url: string;
  cover: string;
  coverUrl: string;
  poster: string;
  duration: string;
  status: string;
};

export type ProjectStoryboard = {
  id: string;
  name: string;
  description: string;
  prompt: string;
  images: string[];
  videos: string[];
  selectedVideo: string;
};

export type ProjectAssets = {
  characters: ProjectAssetItem[];
  scenes: ProjectAssetItem[];
  props: ProjectAssetItem[];
  voices: ProjectAssetItem[];
  videos: ProjectAssetItem[];
};

export type ProjectDetail = {
  id: string;
  name: string;
  description: string;
  aspectRatio: string;
  resolution: string;
  episodes: ProjectEpisode[];
  assets: ProjectAssets;
  assetsParsed: boolean;
  createdAt: string;
};

export type ProjectListItem = Omit<ProjectDetail, "assets"> & {
  episodeCount: number;
};

export type ProjectSelectedModelType = "image" | "video";

export type ProjectSelectedModelInfo = {
  apiKey: string;
  example: string;
  id: string;
  name: string;
  selectedAt: string;
  type: ProjectSelectedModelType;
  videoReferenceMode?: string;
};

export type ProjectConfig = JsonObject & {
  selectedModel?: ProjectSelectedModelInfo;
  selectedModels?: Partial<Record<ProjectSelectedModelType, ProjectSelectedModelInfo>>;
};
