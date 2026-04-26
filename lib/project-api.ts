import type { FlowState } from "@/lib/flow-schema";
import type {
  ProjectDetail,
  ProjectImageAsset,
  ProjectListItem,
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
  images?: ProjectImageAsset[];
};

export type ProjectCanvasData = {
  flow: FlowState;
  storyboards: ProjectStoryboard[];
  images: ProjectImageAsset[];
  videos: ProjectVideoAsset[];
};

async function readJsonResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error("PROJECT_REQUEST_FAILED");
  }

  return (await response.json()) as T;
}

export async function fetchProjects(): Promise<ProjectListItem[]> {
  const data = await readJsonResponse<ProjectsResponse>(
    await fetch("/api/projects", {
      cache: "no-store",
    }),
  );

  return Array.isArray(data.projects) ? data.projects : [];
}

export async function fetchProject(projectId: string): Promise<ProjectDetail> {
  const data = await readJsonResponse<ProjectResponse>(
    await fetch(`/api/projects/${encodeURIComponent(projectId)}`, {
      cache: "no-store",
    }),
  );

  if (!data.project) {
    throw new Error("PROJECT_NOT_FOUND");
  }

  return data.project;
}

export async function fetchProjectImages(projectId: string): Promise<ProjectImageAsset[]> {
  const data = await readJsonResponse<ProjectImagesResponse>(
    await fetch(`/api/projects/${encodeURIComponent(projectId)}/images`, {
      cache: "no-store",
    }),
  );

  return Array.isArray(data.images) ? data.images : [];
}

export async function fetchProjectCanvasData(
  projectId: string,
  episodeId: string,
): Promise<ProjectCanvasData> {
  return readJsonResponse<ProjectCanvasData>(
    await fetch(
      `/api/projects/${encodeURIComponent(projectId)}/flow?episodeId=${encodeURIComponent(episodeId)}`,
      {
        cache: "no-store",
      },
    ),
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

export async function fetchCurrentProject(): Promise<ProjectDetail | null> {
  const data = await readJsonResponse<ProjectResponse>(
    await fetch("/api/projects/current", {
      cache: "no-store",
    }),
  );

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
