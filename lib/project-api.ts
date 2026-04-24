import type { ProjectDetail, ProjectListItem } from "@/lib/project-types";

type ProjectsResponse = {
  projects?: ProjectListItem[];
};

type ProjectResponse = {
  project?: ProjectDetail;
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
