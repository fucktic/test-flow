export type ProjectEpisode = {
  id: string;
  name: string;
};

export type ProjectDetail = {
  id: string;
  name: string;
  description: string;
  aspectRatio: string;
  resolution: string;
  episodes: ProjectEpisode[];
  createdAt: string;
};

export type ProjectListItem = ProjectDetail & {
  episodeCount: number;
};
