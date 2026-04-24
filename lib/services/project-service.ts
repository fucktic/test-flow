"use server";

import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { parseScriptMD } from "@/lib/script-parser";
import type {
  ProjectAssetItem,
  ProjectAssets,
  ProjectDetail,
  ProjectEpisode,
  ProjectImageAsset,
  ProjectListItem,
} from "@/lib/project-types";

const PROJECT_ROOT = process.cwd();
const PROJECTS_DIR = path.resolve(PROJECT_ROOT, "projects");
const CURRENT_PROJECT_PATH = path.resolve(PROJECTS_DIR, "currentProject.json");
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

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function readBoolean(value: unknown): boolean {
  return typeof value === "boolean" ? value : false;
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

function readAssetItems(value: unknown): ProjectAssetItem[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((asset) => {
    if (!isRecord(asset)) return [];

    const id = readString(asset.id);
    return id
      ? [
          {
            id,
            children: readStringArray(asset.children),
          },
        ]
      : [];
  });
}

function readAssets(value: unknown): ProjectAssets {
  const assets = isRecord(value) ? value : {};

  return {
    characters: readAssetItems(assets.characters),
    scenes: readAssetItems(assets.scenes),
    props: readAssetItems(assets.props),
    voices: readAssetItems(assets.voices),
    videos: readAssetItems(assets.videos),
  };
}

function readProjectImageAssets(value: unknown): ProjectImageAsset[] {
  const imageRecords = Array.isArray(value) ? value : [value];

  return imageRecords.flatMap((imageAsset) => {
    if (!isRecord(imageAsset)) return [];

    const id = readString(imageAsset.id);
    if (!id) return [];

    return [
      {
        id,
        name: readString(imageAsset.name),
        type: readString(imageAsset.type),
        source: readString(imageAsset.source),
        prompt: readString(imageAsset.prompt),
        url: readString(imageAsset.url),
      },
    ];
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
    assets: readAssets(value.assets),
    assetsParsed: readBoolean(value.assetsParsed),
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

async function writeCurrentProjectDetail(project: ProjectDetail) {
  assertSafeProjectPath(CURRENT_PROJECT_PATH);
  await mkdir(PROJECTS_DIR, { recursive: true });
  await writeFile(CURRENT_PROJECT_PATH, JSON.stringify(project, null, 2), "utf8");
}

async function readCurrentProjectDetail(): Promise<ProjectDetail | null> {
  assertSafeProjectPath(CURRENT_PROJECT_PATH);

  try {
    const content = await readFile(CURRENT_PROJECT_PATH, "utf8");
    const currentProject = toProjectDetail(JSON.parse(content));
    if (!currentProject) return null;

    return readProjectDetail(currentProject.id);
  } catch {
    return null;
  }
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

export async function getCurrentProject(): Promise<
  { success: true; project: ProjectDetail | null } | { success: false; error: string }
> {
  try {
    const project = await readCurrentProjectDetail();
    return { success: true, project };
  } catch (err) {
    if (err instanceof Error) {
      return { success: false, error: err.message };
    }
    return { success: false, error: "未知错误" };
  }
}

export async function setCurrentProject(
  projectId: string,
): Promise<{ success: true; project: ProjectDetail } | { success: false; error: string }> {
  try {
    const project = await readProjectDetail(projectId);
    if (!project) {
      return { success: false, error: "PROJECT_NOT_FOUND" };
    }

    await writeCurrentProjectDetail(project);
    return { success: true, project };
  } catch (err) {
    if (err instanceof Error) {
      return { success: false, error: err.message };
    }
    return { success: false, error: "未知错误" };
  }
}

export async function clearCurrentProject(): Promise<
  { success: true } | { success: false; error: string }
> {
  try {
    assertSafeProjectPath(CURRENT_PROJECT_PATH);
    await rm(CURRENT_PROJECT_PATH, { force: true });
    return { success: true };
  } catch (err) {
    if (err instanceof Error) {
      return { success: false, error: err.message };
    }
    return { success: false, error: "未知错误" };
  }
}

export async function getProject(
  projectId: string,
): Promise<{ success: true; project: ProjectDetail } | { success: false; error: string }> {
  try {
    const project = await readProjectDetail(projectId);
    if (!project) {
      return { success: false, error: "PROJECT_NOT_FOUND" };
    }

    return { success: true, project };
  } catch (err) {
    if (err instanceof Error) {
      return { success: false, error: err.message };
    }
    return { success: false, error: "未知错误" };
  }
}

export async function getProjectImages(
  projectId: string,
): Promise<{ success: true; images: ProjectImageAsset[] } | { success: false; error: string }> {
  try {
    const imagesJsonPath = path.resolve(getProjectDir(projectId), "images", "images.json");
    assertSafeProjectPath(imagesJsonPath);

    try {
      const content = await readFile(imagesJsonPath, "utf8");
      return { success: true, images: readProjectImageAssets(JSON.parse(content)) };
    } catch {
      return { success: true, images: [] };
    }
  } catch (err) {
    if (err instanceof Error) {
      return { success: false, error: err.message };
    }
    return { success: false, error: "未知错误" };
  }
}

export async function deleteProjectImage(params: {
  projectId: string;
  imageId: string;
}): Promise<{ success: true; images: ProjectImageAsset[] } | { success: false; error: string }> {
  try {
    const imagesJsonPath = path.resolve(getProjectDir(params.projectId), "images", "images.json");
    assertSafeProjectPath(imagesJsonPath);

    const content = await readFile(imagesJsonPath, "utf8");
    const images = readProjectImageAssets(JSON.parse(content));
    const nextImages = images.filter((image) => image.id !== params.imageId);

    await writeFile(imagesJsonPath, JSON.stringify(nextImages, null, 2), "utf8");

    return { success: true, images: nextImages };
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
    const currentProject = await readCurrentProjectDetail().catch(() => null);
    if (currentProject?.id === nextProject.id) {
      await writeCurrentProjectDetail(nextProject);
    }

    return { success: true, project: nextProject };
  } catch (err) {
    if (err instanceof Error) {
      return { success: false, error: err.message };
    }
    return { success: false, error: "未知错误" };
  }
}

export async function deleteProject(
  projectId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const currentProject = await readCurrentProjectDetail().catch(() => null);
    const projectDir = getProjectDir(projectId);
    await rm(projectDir, { recursive: true, force: true });
    if (currentProject?.id === projectId) {
      await clearCurrentProject();
    }
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

    await writeFile(path.resolve(projectDir, "script.md"), params.fileContent, "utf8");

    await writeFile(
      path.resolve(projectDir, "project.json"),
      JSON.stringify(
        {
          id: projectId,
          name: params.fileName,
          description: params.description,
          aspectRatio: params.aspectRatio,
          resolution: params.resolution,
          episodes,
          assets: {
            characters: [],
            scenes: [],
            props: [],
            voices: [],
            videos: [],
          },
          assetsParsed: false,
          createdAt: new Date().toISOString(),
        },
        null,
        2,
      ),
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
