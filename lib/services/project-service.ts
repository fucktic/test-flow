"use server";

import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { parseScriptMD } from "@/lib/script-parser";
import { flowStateSchema, type FlowState } from "@/lib/flow-schema";
import type {
  ProjectAssetItem,
  ProjectAssets,
  ProjectDetail,
  ProjectEpisode,
  ProjectConfig,
  ProjectImageAsset,
  ProjectListItem,
  ProjectSelectedModelInfo,
  ProjectStoryboard,
  ProjectVideoAsset,
} from "@/lib/project-types";

const PROJECT_ROOT = process.cwd();
const PROJECTS_DIR = path.resolve(PROJECT_ROOT, "projects");
const CURRENT_PROJECT_PATH = path.resolve(PROJECTS_DIR, "currentProject.json");
const PROJECT_COMMAND_FILE_NAME = "command.json";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TEMP_FILE_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.[a-z0-9]{1,12}$/i;
const COMMAND_STATUS_VALUES = new Set(["loading", "error", "success"]);

export type ProjectTempImage = {
  id: string;
  label: string;
  name: string;
  fileName: string;
  type: string;
  url: string;
};

type ProjectTempImageInput = {
  buffer: Buffer;
  contentType: string;
  name: string;
};

export type ProjectCommandStatus = "loading" | "error" | "success";

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

function readProjectVideoAssets(value: unknown): ProjectVideoAsset[] {
  const videoRecords = Array.isArray(value) ? value : [value];

  return videoRecords.flatMap((videoAsset) => {
    if (!isRecord(videoAsset)) return [];

    const id = readString(videoAsset.id);
    if (!id) return [];

    return [
      {
        id,
        name: readString(videoAsset.name),
        source: readString(videoAsset.source),
        prompt: readString(videoAsset.prompt),
        url: readString(videoAsset.url),
        poster: readString(videoAsset.poster),
        duration: readString(videoAsset.duration),
        status: readString(videoAsset.status),
      },
    ];
  });
}

function readProjectStoryboards(value: unknown): ProjectStoryboard[] {
  const storyboardRecords = Array.isArray(value) ? value : [value];

  return storyboardRecords.flatMap((storyboard) => {
    if (!isRecord(storyboard)) return [];

    const id = readString(storyboard.id);
    if (!id) return [];

    return [
      {
        id,
        name: readString(storyboard.name),
        description: readString(storyboard.description),
        prompt: readString(storyboard.prompt),
        images: readStringArray(storyboard.images),
        videos: readStringArray(storyboard.videos),
        selectedVideo: readString(storyboard.selectedVideo),
      },
    ];
  });
}

function readFlowState(value: unknown): FlowState {
  const parsedFlow = flowStateSchema.safeParse(value);
  if (parsedFlow.success) return parsedFlow.data;

  return { nodes: [], edges: [] };
}

function readProjectConfig(value: unknown): ProjectConfig {
  return isRecord(value) ? (value as ProjectConfig) : {};
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

function getProjectTempDir(projectId: string) {
  const tempDir = path.resolve(getProjectDir(projectId), "temp");
  assertSafeProjectPath(tempDir);
  return tempDir;
}

function getProjectCommandPath(projectId: string) {
  const commandPath = path.resolve(getProjectDir(projectId), PROJECT_COMMAND_FILE_NAME);
  assertSafeProjectPath(commandPath);
  return commandPath;
}

function readProjectCommandEntries(value: unknown): Record<string, ProjectCommandStatus> {
  if (!isRecord(value)) return {};

  return Object.entries(value).reduce<Record<string, ProjectCommandStatus>>(
    (entries, [gridId, status]) => {
      if (!gridId || typeof status !== "string" || !COMMAND_STATUS_VALUES.has(status)) {
        return entries;
      }

      entries[gridId] = status as ProjectCommandStatus;
      return entries;
    },
    {},
  );
}

function getImageExtension(contentType: string, fileName: string) {
  const normalizedContentType = contentType.toLowerCase();
  if (normalizedContentType === "image/png") return "png";
  if (normalizedContentType === "image/jpeg" || normalizedContentType === "image/jpg") return "jpg";
  if (normalizedContentType === "image/webp") return "webp";
  if (normalizedContentType === "image/gif") return "gif";

  const extension = path.extname(fileName).replace(".", "").toLowerCase();
  if (["png", "jpg", "jpeg", "webp", "gif"].includes(extension)) return extension;

  throw new Error("Unsupported image type.");
}

function getSafeFileExtension(fileName: string) {
  const extension = path.extname(fileName).replace(".", "").toLowerCase();
  if (/^[a-z0-9]{1,12}$/.test(extension)) return extension;
  return "bin";
}

function getTempFileContentType(fileName: string) {
  const extension = path.extname(fileName).replace(".", "").toLowerCase();
  if (extension === "png") return "image/png";
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "webp") return "image/webp";
  if (extension === "gif") return "image/gif";
  return "application/octet-stream";
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

export async function saveProjectCommandStatus(params: {
  gridId: string;
  projectId: string;
  status: ProjectCommandStatus;
}): Promise<
  { success: true; commands: Record<string, ProjectCommandStatus> } | { success: false; error: string }
> {
  try {
    const commandPath = getProjectCommandPath(params.projectId);
    const currentCommands = await readFile(commandPath, "utf8")
      .then((content) => readProjectCommandEntries(JSON.parse(content)))
      .catch(() => ({}));
    const nextCommands = {
      ...currentCommands,
      [params.gridId]: params.status,
    };

    // command.json only stores serializable grid status and is recreated safely inside the project folder.
    await writeFile(commandPath, JSON.stringify(nextCommands, null, 2), "utf8");

    return { success: true, commands: nextCommands };
  } catch (err) {
    if (err instanceof Error) {
      return { success: false, error: err.message };
    }
    return { success: false, error: "未知错误" };
  }
}

export async function getProjectCommands(
  projectId: string,
): Promise<
  { success: true; commands: Record<string, ProjectCommandStatus> } | { success: false; error: string }
> {
  try {
    const commandPath = getProjectCommandPath(projectId);
    const commands = await readFile(commandPath, "utf8")
      .then((content) => readProjectCommandEntries(JSON.parse(content)))
      .catch(() => ({}));

    return { success: true, commands };
  } catch (err) {
    if (err instanceof Error) {
      return { success: false, error: err.message };
    }
    return { success: false, error: "未知错误" };
  }
}

export async function clearProjectCommands(
  projectId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const commandPath = getProjectCommandPath(projectId);
    await writeFile(commandPath, JSON.stringify({}, null, 2), "utf8");
    return { success: true };
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

export async function getProjectCanvasData(params: {
  projectId: string;
  episodeId: string;
}): Promise<
  | {
      success: true;
      flow: FlowState;
      storyboards: ProjectStoryboard[];
      images: ProjectImageAsset[];
      videos: ProjectVideoAsset[];
    }
  | { success: false; error: string }
> {
  try {
    const projectDir = getProjectDir(params.projectId);
    const flowJsonPath = path.resolve(projectDir, "flow.json");
    const projectStoryboardPath = path.resolve(projectDir, `${params.projectId}.json`);
    const episodeStoryboardPath = path.resolve(projectDir, "episode", `${params.episodeId}.json`);
    const imagesJsonPath = path.resolve(projectDir, "images", "images.json");
    const videosJsonPath = path.resolve(projectDir, "videos", "videos.json");

    [
      flowJsonPath,
      projectStoryboardPath,
      episodeStoryboardPath,
      imagesJsonPath,
      videosJsonPath,
    ].forEach(assertSafeProjectPath);

    const flow = await readFile(flowJsonPath, "utf8")
      .then((content) => readFlowState(JSON.parse(content)))
      .catch(() => ({ nodes: [], edges: [] }));

    const storyboardContent = await readFile(episodeStoryboardPath, "utf8").catch(async () =>
      readFile(projectStoryboardPath, "utf8"),
    );
    const storyboards = readProjectStoryboards(JSON.parse(storyboardContent));

    const images = await readFile(imagesJsonPath, "utf8")
      .then((content) => readProjectImageAssets(JSON.parse(content)))
      .catch(() => []);
    const videos = await readFile(videosJsonPath, "utf8")
      .then((content) => readProjectVideoAssets(JSON.parse(content)))
      .catch(() => []);

    return { success: true, flow, storyboards, images, videos };
  } catch (err) {
    if (err instanceof Error) {
      return { success: false, error: err.message };
    }
    return { success: false, error: "未知错误" };
  }
}

export async function saveProjectFlow(params: {
  projectId: string;
  flow: FlowState;
}): Promise<{ success: true; flow: FlowState } | { success: false; error: string }> {
  try {
    const projectDir = getProjectDir(params.projectId);
    const flowJsonPath = path.resolve(projectDir, "flow.json");
    assertSafeProjectPath(flowJsonPath);

    const flow = flowStateSchema.parse(params.flow);
    await writeFile(flowJsonPath, JSON.stringify(flow, null, 2), "utf8");

    return { success: true, flow };
  } catch (err) {
    if (err instanceof Error) {
      return { success: false, error: err.message };
    }
    return { success: false, error: "未知错误" };
  }
}

export async function getProjectConfig(
  projectId: string,
): Promise<{ success: true; config: ProjectConfig } | { success: false; error: string }> {
  try {
    const configJsonPath = path.resolve(getProjectDir(projectId), "config.json");
    assertSafeProjectPath(configJsonPath);

    const config = await readFile(configJsonPath, "utf8")
      .then((content) => readProjectConfig(JSON.parse(content)))
      .catch((): ProjectConfig => ({}));

    return { success: true, config };
  } catch (err) {
    if (err instanceof Error) {
      return { success: false, error: err.message };
    }
    return { success: false, error: "未知错误" };
  }
}

export async function saveProjectSelectedModel(params: {
  model: ProjectSelectedModelInfo;
  projectId: string;
}): Promise<{ success: true; config: ProjectConfig } | { success: false; error: string }> {
  try {
    const configJsonPath = path.resolve(getProjectDir(params.projectId), "config.json");
    assertSafeProjectPath(configJsonPath);

    const currentConfig = await readFile(configJsonPath, "utf8")
      .then((content) => readProjectConfig(JSON.parse(content)))
      .catch((): ProjectConfig => ({}));
    const selectedModels = {
      ...(currentConfig.selectedModels ?? {}),
      [params.model.type]: params.model,
    };
    const nextConfig: ProjectConfig = {
      ...currentConfig,
      selectedModel: params.model,
      selectedModels,
    };

    await writeFile(configJsonPath, JSON.stringify(nextConfig, null, 2), "utf8");

    return { success: true, config: nextConfig };
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

export async function saveProjectTempImages(params: {
  projectId: string;
  images: ProjectTempImageInput[];
}): Promise<{ success: true; images: ProjectTempImage[] } | { success: false; error: string }> {
  try {
    const tempDir = getProjectTempDir(params.projectId);
    await mkdir(tempDir, { recursive: true });

    const images = await Promise.all(
      params.images.map(async (image, index) => {
        const id = randomUUID();
        const extension = getImageExtension(image.contentType, image.name);
        const fileName = `${id}.${extension}`;
        const filePath = path.resolve(tempDir, fileName);
        assertSafeProjectPath(filePath);
        await writeFile(filePath, image.buffer);

        return {
          id,
          label: `图片${index + 1}`,
          name: image.name,
          fileName,
          type: image.contentType,
          url: `/api/projects/${encodeURIComponent(params.projectId)}/temp/${encodeURIComponent(fileName)}`,
        };
      }),
    );

    return { success: true, images };
  } catch (err) {
    if (err instanceof Error) {
      return { success: false, error: err.message };
    }
    return { success: false, error: "未知错误" };
  }
}

export async function saveProjectTempFiles(params: {
  projectId: string;
  files: ProjectTempImageInput[];
}): Promise<{ success: true; images: ProjectTempImage[] } | { success: false; error: string }> {
  try {
    const tempDir = getProjectTempDir(params.projectId);
    await mkdir(tempDir, { recursive: true });

    const images = await Promise.all(
      params.files.map(async (file, index) => {
        const id = randomUUID();
        const extension = file.contentType.startsWith("image/")
          ? getImageExtension(file.contentType, file.name)
          : getSafeFileExtension(file.name);
        const fileName = `${id}.${extension}`;
        const filePath = path.resolve(tempDir, fileName);
        assertSafeProjectPath(filePath);
        await writeFile(filePath, file.buffer);

        return {
          id,
          label: file.contentType.startsWith("image/") ? `图片${index + 1}` : `文件${index + 1}`,
          name: file.name,
          fileName,
          type: file.contentType || "application/octet-stream",
          url: `/api/projects/${encodeURIComponent(params.projectId)}/temp/${encodeURIComponent(fileName)}`,
        };
      }),
    );

    return { success: true, images };
  } catch (err) {
    if (err instanceof Error) {
      return { success: false, error: err.message };
    }
    return { success: false, error: "未知错误" };
  }
}

export async function readProjectTempImage(params: {
  projectId: string;
  fileName: string;
}): Promise<
  { success: true; buffer: Buffer; contentType: string } | { success: false; error: string }
> {
  try {
    if (!TEMP_FILE_PATTERN.test(params.fileName)) {
      return { success: false, error: "INVALID_TEMP_FILE_NAME" };
    }

    const filePath = path.resolve(getProjectTempDir(params.projectId), params.fileName);
    assertSafeProjectPath(filePath);
    const buffer = await readFile(filePath);

    return {
      success: true,
      buffer,
      contentType: getTempFileContentType(params.fileName),
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
