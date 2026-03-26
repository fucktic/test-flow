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

    // 确保路径安全，防止跨目录攻击
    const normalizedPath = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, "");
    const fullPath = path.join(skillsDir, normalizedPath);

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
    // 安全路径校验
    const normalizedName = path.normalize(name).replace(/^(\.\.(\/|\\|$))+/, "");
    const folderPath = path.join(skillsDir, normalizedName);

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

export async function createNewCanvas(name: string) {
  try {
    const id = generateId();
    const projectsDir = path.join(process.cwd(), "projects", id);

    // 创建对应的文件夹
    await fs.mkdir(projectsDir, { recursive: true });
    await fs.mkdir(path.join(projectsDir, "assets"), { recursive: true });
    await fs.mkdir(path.join(projectsDir, "episode"), { recursive: true });
    await fs.mkdir(path.join(projectsDir, "episode", "image"), { recursive: true });
    await fs.mkdir(path.join(projectsDir, "episode", "video"), { recursive: true });

    // 创建项目信息文件
    const projectInfo = {
      id,
      name,
      createdAt: Date.now(),
      updatedAt: Date.now(),
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
