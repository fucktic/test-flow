"use server";

import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { parseScriptMD } from "@/lib/script-parser";
import type { ProjectDetail, ProjectEpisode, ProjectListItem } from "@/lib/project-types";

const PROJECT_ROOT = process.cwd();
const PROJECTS_DIR = path.resolve(PROJECT_ROOT, "projects");
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function assertSafeProjectPath(targetPath: string) {
  if (targetPath !== PROJECTS_DIR && !targetPath.startsWith(`${PROJECTS_DIR}${path.sep}`)) {
    throw new Error("Invalid project path.");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function readEpisodeCount(value: unknown): number {
  if (!Array.isArray(value)) return 0;
  return value.filter((episode) => isRecord(episode) && typeof episode.id === "string").length;
}

function readEpisodes(value: unknown): ProjectEpisode[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((episode) => {
    if (!isRecord(episode)) return [];

    const id = readString(episode.id);
    const name = readString(episode.name);
    return id && name ? [{ id, name }] : [];
  });
}

function toProjectDetail(value: unknown): ProjectDetail | null {
  if (!isRecord(value)) return null;

  const id = readString(value.id);
  const name = readString(value.name);
  if (!id || !name) return null;

  return {
    id,
    name,
    description: readString(value.description),
    aspectRatio: readString(value.aspectRatio),
    resolution: readString(value.resolution),
    episodes: readEpisodes(value.episodes),
    createdAt: readString(value.createdAt),
  };
}

function toProjectListItem(value: unknown): ProjectListItem | null {
  const project = toProjectDetail(value);
  if (!project) return null;

  return {
    ...project,
    episodeCount: readEpisodeCount(project.episodes),
  };
}

function getProjectDir(projectId: string) {
  if (!UUID_PATTERN.test(projectId)) {
    throw new Error("Invalid project id.");
  }

  const projectDir = path.resolve(PROJECTS_DIR, projectId);
  assertSafeProjectPath(projectDir);
  return projectDir;
}

async function readProjectDetail(projectId: string): Promise<ProjectDetail | null> {
  const projectJsonPath = path.resolve(getProjectDir(projectId), "project.json");
  assertSafeProjectPath(projectJsonPath);

  const content = await readFile(projectJsonPath, "utf8");
  return toProjectDetail(JSON.parse(content));
}

async function writeProjectDetail(project: ProjectDetail) {
  const projectJsonPath = path.resolve(getProjectDir(project.id), "project.json");
  assertSafeProjectPath(projectJsonPath);
  await writeFile(projectJsonPath, JSON.stringify(project, null, 2), "utf8");
}

export async function listProjects(): Promise<
  { success: true; projects: ProjectListItem[] } | { success: false; error: string }
> {
  try {
    assertSafeProjectPath(PROJECTS_DIR);
    await mkdir(PROJECTS_DIR, { recursive: true });

    const entries = await readdir(PROJECTS_DIR, { withFileTypes: true });
    const projects = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory())
        .map(async (entry) => {
          const projectJsonPath = path.resolve(PROJECTS_DIR, entry.name, "project.json");
          assertSafeProjectPath(projectJsonPath);

          try {
            const content = await readFile(projectJsonPath, "utf8");
            return toProjectListItem(JSON.parse(content));
          } catch {
            return null;
          }
        }),
    );

    return {
      success: true,
      projects: projects
        .filter((project): project is ProjectListItem => project !== null)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    };
  } catch (err) {
    if (err instanceof Error) {
      return { success: false, error: err.message };
    }
    return { success: false, error: "未知错误" };
  }
}

export async function updateProject(params: {
  projectId: string;
  description: string;
  aspectRatio: string;
  resolution: string;
}): Promise<{ success: true; project: ProjectDetail } | { success: false; error: string }> {
  try {
    const project = await readProjectDetail(params.projectId);
    if (!project) {
      return { success: false, error: "PROJECT_NOT_FOUND" };
    }

    const nextProject: ProjectDetail = {
      ...project,
      description: params.description,
      aspectRatio: params.aspectRatio,
      resolution: params.resolution,
    };
    await writeProjectDetail(nextProject);

    return { success: true, project: nextProject };
  } catch (err) {
    if (err instanceof Error) {
      return { success: false, error: err.message };
    }
    return { success: false, error: "未知错误" };
  }
}

export async function deleteProject(projectId: string): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const projectDir = getProjectDir(projectId);
    await rm(projectDir, { recursive: true, force: true });
    return { success: true };
  } catch (err) {
    if (err instanceof Error) {
      return { success: false, error: err.message };
    }
    return { success: false, error: "未知错误" };
  }
}

export async function createProject(params: {
  fileName: string;
  fileContent: string;
  description: string;
  aspectRatio: string;
  resolution: string;
}): Promise<{ success: true; projectId: string } | { success: false; error: string }> {
  try {
    const projectId = randomUUID();
    const projectDir = path.resolve(PROJECTS_DIR, projectId);
    assertSafeProjectPath(projectDir);
    const parsedScript = parseScriptMD(params.fileContent);
    const episodes = parsedScript.episodes.map((episode) => ({
      id: randomUUID(),
      name: episode.name,
    }));

    await mkdir(projectDir, { recursive: true });

    await writeFile(
      path.resolve(projectDir, "script.md"),
      params.fileContent,
      "utf8",
    );

    await writeFile(
      path.resolve(projectDir, "project.json"),
      JSON.stringify({
        id: projectId,
        name: params.fileName,
        description: params.description,
        aspectRatio: params.aspectRatio,
        resolution: params.resolution,
        episodes,
        createdAt: new Date().toISOString(),
      }, null, 2),
      "utf8",
    );

    return { success: true, projectId };
  } catch (err) {
    if (err instanceof Error) {
      return { success: false, error: err.message };
    }
    return { success: false, error: "未知错误" };
  }
}
