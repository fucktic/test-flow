"use server";

import fs from "fs/promises";
import path from "path";
import { generateId } from "@/lib/utils/uuid";

export async function uploadSkillFiles(formData: FormData) {
  const skillsDir = path.join(process.cwd(), "skills");

  const files = formData.getAll("files") as File[];
  const paths = formData.getAll("paths") as string[];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const relativePath = paths[i];

    // 规范化路径并确保最终路径仍在 skillsDir 内，防止路径穿越攻击
    const normalizedPath = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, "");
    const fullPath = path.resolve(skillsDir, normalizedPath);

    if (!fullPath.startsWith(skillsDir + path.sep) && fullPath !== skillsDir) {
      throw new Error(`Invalid file path: ${relativePath}`);
    }

    // 确保目录存在
    await fs.mkdir(path.dirname(fullPath), { recursive: true });

    // 写入文件
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await fs.writeFile(fullPath, buffer);
  }

  return { success: true };
}

export async function getSkillFolders() {
  try {
    const skillsDir = path.join(process.cwd(), "skills");
    await fs.mkdir(skillsDir, { recursive: true });
    const entries = await fs.readdir(skillsDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
      .map((entry) => entry.name);
  } catch (error) {
    console.error("Failed to read skills directory:", error);
    return [];
  }
}

export async function deleteSkillFolder(name: string) {
  try {
    const skillsDir = path.join(process.cwd(), "skills");
    // 安全路径校验，防止路径穿越
    const normalizedName = path.normalize(name).replace(/^(\.\.(\/|\\|$))+/, "");
    const folderPath = path.resolve(skillsDir, normalizedName);

    if (!folderPath.startsWith(skillsDir + path.sep)) {
      return { success: false, error: "Invalid folder name" };
    }

    await fs.rm(folderPath, { recursive: true, force: true });
    return { success: true };
  } catch (error) {
    console.error("Failed to delete skill folder:", error);
    return { success: false, error: "Failed to delete skill folder" };
  }
}

export async function getProjects() {
  try {
    const projectsDir = path.join(process.cwd(), "projects");
    await fs.mkdir(projectsDir, { recursive: true });
    const entries = await fs.readdir(projectsDir, { withFileTypes: true });

    const projects = [];
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith(".")) {
        const id = entry.name;
        const projectInfoPath = path.join(projectsDir, id, "project.json");
        try {
          const projectInfoContent = await fs.readFile(projectInfoPath, "utf-8");
          const projectInfo = JSON.parse(projectInfoContent);
          projects.push({
            id,
            name: projectInfo.name || id,
          });
        } catch {
          // Fallback to flow.json if project.json doesn't exist for backwards compatibility
          const flowPath = path.join(projectsDir, id, "flow.json");
          try {
            const flowContent = await fs.readFile(flowPath, "utf-8");
            const flowData = JSON.parse(flowContent);
            projects.push({
              id,
              name: flowData.name || id,
            });
          } catch {
            projects.push({ id, name: id });
          }
        }
      }
    }
    return projects;
  } catch (error) {
    console.error("Failed to get projects:", error);
    return [];
  }
}

export type NewCanvasOptions = {
  aspectRatio?: string;
  resolution?: string;
  style?: string;
};

function resolveProjectDir(projectId: string): string | null {
  const projectsRoot = path.resolve(process.cwd(), "projects");
  const dir = path.resolve(projectsRoot, projectId);
  if (!dir.startsWith(projectsRoot + path.sep)) {
    return null;
  }
  return dir;
}

export async function renameProject(projectId: string, newName: string) {
  const trimmed = newName.trim();
  if (!trimmed) {
    return { success: false as const, error: "Invalid name" };
  }
  const projectDir = resolveProjectDir(projectId);
  if (!projectDir) {
    return { success: false as const, error: "Invalid project" };
  }
  try {
    await fs.access(projectDir);
  } catch {
    return { success: false as const, error: "Project not found" };
  }
  try {
    const projectJsonPath = path.join(projectDir, "project.json");
    const projectInfo = JSON.parse(await fs.readFile(projectJsonPath, "utf-8"));
    projectInfo.name = trimmed;
    projectInfo.updatedAt = Date.now();
    await fs.writeFile(projectJsonPath, JSON.stringify(projectInfo, null, 2), "utf-8");

    const flowJsonPath = path.join(projectDir, "flow.json");
    try {
      const flowContent = await fs.readFile(flowJsonPath, "utf-8");
      const flowData = JSON.parse(flowContent);
      flowData.name = trimmed;
      await fs.writeFile(flowJsonPath, JSON.stringify(flowData, null, 2), "utf-8");
    } catch {
      // flow.json optional
    }
    return { success: true as const, name: trimmed };
  } catch (error) {
    console.error("Failed to rename project:", error);
    return { success: false as const, error: "Failed to rename" };
  }
}

export type ProjectDetailPayload = {
  name: string;
  aspectRatio: string;
  resolution: string;
  style: string;
};

export async function getProjectDetail(projectId: string): Promise<ProjectDetailPayload | null> {
  const projectDir = resolveProjectDir(projectId);
  if (!projectDir) {
    return null;
  }
  try {
    const projectJsonPath = path.join(projectDir, "project.json");
    const raw = await fs.readFile(projectJsonPath, "utf-8");
    const info = JSON.parse(raw) as {
      name?: string;
      aspectRatio?: string;
      resolution?: string;
      style?: string;
      canvasDefaults?: { aspectRatio?: string; resolution?: string; style?: string };
    };
    const cd = info.canvasDefaults;
    return {
      name: info.name?.trim() || projectId,
      aspectRatio:
        typeof info.aspectRatio === "string" ? info.aspectRatio : (cd?.aspectRatio ?? "smart"),
      resolution:
        typeof info.resolution === "string" ? info.resolution : (cd?.resolution ?? "1080"),
      style:
        typeof info.style === "string" ? info.style : typeof cd?.style === "string" ? cd.style : "",
    };
  } catch {
    return null;
  }
}

export async function updateProject(
  projectId: string,
  data: {
    name: string;
    aspectRatio: string;
    resolution: string;
    style: string;
  },
) {
  const trimmed = data.name.trim();
  if (!trimmed) {
    return { success: false as const, error: "Invalid name" };
  }
  const projectDir = resolveProjectDir(projectId);
  if (!projectDir) {
    return { success: false as const, error: "Invalid project" };
  }
  try {
    await fs.access(projectDir);
  } catch {
    return { success: false as const, error: "Project not found" };
  }
  try {
    const projectJsonPath = path.join(projectDir, "project.json");
    const projectInfo = JSON.parse(await fs.readFile(projectJsonPath, "utf-8")) as Record<
      string,
      unknown
    >;
    projectInfo.name = trimmed;
    projectInfo.updatedAt = Date.now();
    projectInfo.aspectRatio = data.aspectRatio ?? "smart";
    projectInfo.resolution = data.resolution ?? "1080";
    projectInfo.style = (data.style ?? "").trim();
    delete projectInfo.canvasDefaults;
    await fs.writeFile(projectJsonPath, JSON.stringify(projectInfo, null, 2), "utf-8");

    const flowJsonPath = path.join(projectDir, "flow.json");
    try {
      const flowContent = await fs.readFile(flowJsonPath, "utf-8");
      const flowData = JSON.parse(flowContent);
      flowData.name = trimmed;
      await fs.writeFile(flowJsonPath, JSON.stringify(flowData, null, 2), "utf-8");
    } catch {
      // flow.json optional
    }
    return { success: true as const, name: trimmed };
  } catch (error) {
    console.error("Failed to update project:", error);
    return { success: false as const, error: "Failed to update" };
  }
}

export async function createNewCanvas(name: string, options?: NewCanvasOptions) {
  try {
    const id = generateId();
    const projectsDir = path.join(process.cwd(), "projects", id);

    // 创建对应的文件夹
    await fs.mkdir(projectsDir, { recursive: true });
    await fs.mkdir(path.join(projectsDir, "assets"), { recursive: true });
    await fs.mkdir(path.join(projectsDir, "episode"), { recursive: true });
    await fs.mkdir(path.join(projectsDir, "episode", "image"), { recursive: true });
    await fs.mkdir(path.join(projectsDir, "episode", "video"), { recursive: true });

    const canvasDefaults =
      options != null
        ? {
            aspectRatio: options.aspectRatio ?? "smart",
            resolution: options.resolution ?? "1080",
            style: (options.style ?? "").trim(),
          }
        : undefined;

    // 创建项目信息文件（画布字段打平在顶层，与 updateProject 一致）
    const projectInfo = {
      id,
      name,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ...(canvasDefaults
        ? {
            aspectRatio: canvasDefaults.aspectRatio,
            resolution: canvasDefaults.resolution,
            style: canvasDefaults.style,
          }
        : {}),
    };
    await fs.writeFile(
      path.join(projectsDir, "project.json"),
      JSON.stringify(projectInfo, null, 2),
      "utf-8",
    );

    // 创建 flow.json 文件
    const initialFlow = {
      id,
      name,
      nodes: [],
      edges: [],
    };

    await fs.writeFile(
      path.join(projectsDir, "flow.json"),
      JSON.stringify(initialFlow, null, 2),
      "utf-8",
    );

    return { success: true, id, name };
  } catch (error) {
    console.error("Failed to create new canvas:", error);
    return { success: false, error: "Failed to create new canvas" };
  }
}
