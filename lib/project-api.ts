import type { FlowState } from "@/lib/flow-schema";
import type {
  ProjectConfig,
  ProjectDetail,
  ProjectImageAsset,
  ProjectListItem,
  ProjectSelectedModelInfo,
  ProjectStoryboard,
  ProjectVideoAsset,
} from "@/lib/project-types";

type ProjectsResponse = {
  projects?: ProjectListItem[];
};

type ProjectResponse = {
  project?: ProjectDetail;
};

type ProjectImagesResponse = {
  image?: ProjectImageAsset;
  images?: ProjectImageAsset[];
  project?: ProjectDetail;
};

type ProjectVideosResponse = {
  video?: ProjectVideoAsset;
  videos?: ProjectVideoAsset[];
};

const inFlightGetRequests = new Map<string, Promise<unknown>>();

export type ProjectTempImage = {
  id: string;
  label: string;
  name: string;
  fileName: string;
  type: string;
  url: string;
};

export type ProjectCanvasData = {
  flow: FlowState;
  storyboards: ProjectStoryboard[];
  images: ProjectImageAsset[];
  videos: ProjectVideoAsset[];
};

export type ProjectCommandStatus = "loading" | "error" | "success";

async function readJsonResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error("PROJECT_REQUEST_FAILED");
  }

  return (await response.json()) as T;
}

async function fetchJsonOnce<T>(url: string): Promise<T> {
  const cachedRequest = inFlightGetRequests.get(url) as Promise<T> | undefined;
  if (cachedRequest) return cachedRequest;

  const request = fetch(url, {
      cache: "no-store",
    })
    .then((response) => readJsonResponse<T>(response))
    .finally(() => {
      inFlightGetRequests.delete(url);
    });

  inFlightGetRequests.set(url, request);
  return request;
}

export async function fetchProjects(): Promise<ProjectListItem[]> {
  const data = await fetchJsonOnce<ProjectsResponse>("/api/projects");

  return Array.isArray(data.projects) ? data.projects : [];
}

export async function fetchProject(projectId: string): Promise<ProjectDetail> {
  const data = await fetchJsonOnce<ProjectResponse>(
    `/api/projects/${encodeURIComponent(projectId)}`,
  );

  if (!data.project) {
    throw new Error("PROJECT_NOT_FOUND");
  }

  return data.project;
}

export async function fetchProjectImages(projectId: string): Promise<ProjectImageAsset[]> {
  const data = await fetchJsonOnce<ProjectImagesResponse>(
    `/api/projects/${encodeURIComponent(projectId)}/images`,
  );

  return Array.isArray(data.images) ? data.images : [];
}

export async function fetchProjectCanvasData(
  projectId: string,
  episodeId: string,
): Promise<ProjectCanvasData> {
  return fetchJsonOnce<ProjectCanvasData>(
    `/api/projects/${encodeURIComponent(projectId)}/flow?episodeId=${encodeURIComponent(episodeId)}`,
  );
}

export async function saveProjectFlow(projectId: string, flow: FlowState): Promise<FlowState> {
  const data = await readJsonResponse<{ flow?: FlowState }>(
    await fetch(`/api/projects/${encodeURIComponent(projectId)}/flow`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(flow),
    }),
  );

  if (!data.flow) {
    throw new Error("PROJECT_FLOW_SAVE_FAILED");
  }

  return data.flow;
}

export async function saveProjectSelectedModel(
  projectId: string,
  selectedModel: Omit<ProjectSelectedModelInfo, "selectedAt">,
): Promise<ProjectConfig> {
  const data = await readJsonResponse<{ config?: ProjectConfig }>(
    await fetch(`/api/projects/${encodeURIComponent(projectId)}/config`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ selectedModel }),
    }),
  );

  if (!data.config) {
    throw new Error("PROJECT_CONFIG_SAVE_FAILED");
  }

  return data.config;
}

export async function saveProjectCommandStatus(
  projectId: string,
  gridId: string,
  status: ProjectCommandStatus,
): Promise<void> {
  await readJsonResponse<{ commands?: Record<string, ProjectCommandStatus> }>(
    await fetch(`/api/projects/${encodeURIComponent(projectId)}/command`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ gridId, status }),
    }),
  );
}

export async function fetchProjectCommands(
  projectId: string,
): Promise<Record<string, ProjectCommandStatus>> {
  const data = await fetchJsonOnce<{ commands?: Record<string, ProjectCommandStatus> }>(
    `/api/projects/${encodeURIComponent(projectId)}/command`,
  );

  return data.commands ?? {};
}

export async function clearProjectCommands(projectId: string): Promise<void> {
  await readJsonResponse<{ ok?: boolean }>(
    await fetch(`/api/projects/${encodeURIComponent(projectId)}/command`, {
      method: "DELETE",
    }),
  );
}

export function queueClearProjectCommands(projectId: string) {
  const url = `/api/projects/${encodeURIComponent(projectId)}/command`;
  if (typeof navigator !== "undefined" && navigator.sendBeacon) {
    navigator.sendBeacon(url, new Blob([], { type: "text/plain" }));
    return;
  }

  void fetch(url, {
    keepalive: true,
    method: "DELETE",
  }).catch(() => {
    // Page unload cleanup is best-effort and will retry on the next explicit switch.
  });
}

export async function deleteProjectImage(
  projectId: string,
  imageId: string,
): Promise<ProjectImageAsset[]> {
  const data = await readJsonResponse<ProjectImagesResponse>(
    await fetch(
      `/api/projects/${encodeURIComponent(projectId)}/images?imageId=${encodeURIComponent(imageId)}`,
      {
        method: "DELETE",
        cache: "no-store",
      },
    ),
  );

  return Array.isArray(data.images) ? data.images : [];
}

export async function createProjectImage(
  projectId: string,
  params: {
    category: string;
    file?: File | null;
    name: string;
    parentId?: string;
    prompt: string;
    source: string;
  },
): Promise<{ image: ProjectImageAsset; images: ProjectImageAsset[]; project?: ProjectDetail }> {
  const formData = new FormData();
  formData.append("category", params.category);
  formData.append("name", params.name);
  formData.append("prompt", params.prompt);
  formData.append("source", params.source);
  if (params.parentId) formData.append("parentId", params.parentId);
  if (params.file) formData.append("file", params.file);

  const data = await readJsonResponse<ProjectImagesResponse>(
    await fetch(`/api/projects/${encodeURIComponent(projectId)}/images`, {
      method: "POST",
      body: formData,
    }),
  );

  if (!data.image) {
    throw new Error("PROJECT_IMAGE_CREATE_FAILED");
  }

  return {
    image: data.image,
    images: Array.isArray(data.images) ? data.images : [data.image],
    project: data.project,
  };
}

export async function updateProjectImageFile(
  projectId: string,
  imageId: string,
  file: File,
): Promise<{ image: ProjectImageAsset; images: ProjectImageAsset[] }> {
  const formData = new FormData();
  formData.append("imageId", imageId);
  formData.append("file", file);

  const data = await readJsonResponse<ProjectImagesResponse>(
    await fetch(`/api/projects/${encodeURIComponent(projectId)}/images`, {
      method: "PUT",
      body: formData,
    }),
  );

  if (!data.image) {
    throw new Error("PROJECT_IMAGE_UPDATE_FAILED");
  }

  return {
    image: data.image,
    images: Array.isArray(data.images) ? data.images : [data.image],
  };
}

export async function addProjectImageToAssets(
  projectId: string,
  params: {
    category: string;
    imageId: string;
    parentId?: string;
  },
): Promise<ProjectDetail> {
  const data = await readJsonResponse<ProjectImagesResponse>(
    await fetch(`/api/projects/${encodeURIComponent(projectId)}/images`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
    }),
  );

  if (!data.project) {
    throw new Error("PROJECT_IMAGE_ASSET_SAVE_FAILED");
  }

  return data.project;
}

export async function createProjectVideo(
  projectId: string,
  params: {
    name: string;
    prompt: string;
    source: string;
  },
): Promise<{ video: ProjectVideoAsset; videos: ProjectVideoAsset[] }> {
  const data = await readJsonResponse<ProjectVideosResponse>(
    await fetch(`/api/projects/${encodeURIComponent(projectId)}/videos`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
    }),
  );

  if (!data.video) {
    throw new Error("PROJECT_VIDEO_CREATE_FAILED");
  }

  return {
    video: data.video,
    videos: Array.isArray(data.videos) ? data.videos : [data.video],
  };
}

export async function updateProjectVideoFile(
  projectId: string,
  videoId: string,
  file: File,
): Promise<{ video: ProjectVideoAsset; videos: ProjectVideoAsset[] }> {
  const formData = new FormData();
  formData.append("videoId", videoId);
  formData.append("file", file);

  const data = await readJsonResponse<ProjectVideosResponse>(
    await fetch(`/api/projects/${encodeURIComponent(projectId)}/videos`, {
      method: "PUT",
      body: formData,
    }),
  );

  if (!data.video) {
    throw new Error("PROJECT_VIDEO_UPDATE_FAILED");
  }

  return {
    video: data.video,
    videos: Array.isArray(data.videos) ? data.videos : [data.video],
  };
}

export async function deleteProjectVideo(
  projectId: string,
  videoId: string,
): Promise<ProjectVideoAsset[]> {
  const data = await readJsonResponse<ProjectVideosResponse>(
    await fetch(
      `/api/projects/${encodeURIComponent(projectId)}/videos?videoId=${encodeURIComponent(videoId)}`,
      {
        method: "DELETE",
        cache: "no-store",
      },
    ),
  );

  return Array.isArray(data.videos) ? data.videos : [];
}

export async function mergeProjectVideos(projectId: string, videoIds: string[]): Promise<ProjectVideoAsset> {
  const data = await readJsonResponse<ProjectVideosResponse>(
    await fetch(`/api/projects/${encodeURIComponent(projectId)}/videos/merge`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ videoIds }),
    }),
  );

  if (!data.video) {
    throw new Error("PROJECT_VIDEO_MERGE_FAILED");
  }

  return data.video;
}

export async function uploadProjectTempImages(
  projectId: string,
  files: File[],
): Promise<ProjectTempImage[]> {
  const formData = new FormData();
  files.forEach((file) => {
    formData.append("files", file);
  });

  const data = await readJsonResponse<{ images?: ProjectTempImage[] }>(
    await fetch(`/api/projects/${encodeURIComponent(projectId)}/temp`, {
      method: "POST",
      body: formData,
    }),
  );

  return Array.isArray(data.images) ? data.images : [];
}

export async function fetchCurrentProject(): Promise<ProjectDetail | null> {
  const data = await fetchJsonOnce<ProjectResponse>("/api/projects/current");

  return data.project ?? null;
}

export async function updateCurrentProject(projectId: string): Promise<ProjectDetail> {
  const data = await readJsonResponse<ProjectResponse>(
    await fetch("/api/projects/current", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ projectId }),
    }),
  );

  if (!data.project) {
    throw new Error("PROJECT_NOT_FOUND");
  }

  return data.project;
}

export async function deleteCurrentProject() {
  await readJsonResponse<{ ok?: boolean }>(
    await fetch("/api/projects/current", {
      method: "DELETE",
    }),
  );
}
