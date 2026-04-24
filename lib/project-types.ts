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
