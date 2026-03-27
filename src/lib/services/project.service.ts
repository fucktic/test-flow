import fs from "fs/promises";
import path from "path";

export async function saveFlow(projectId: string, data: any) {
  const dir = path.join(process.cwd(), "projects", projectId);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, "flow.json"), JSON.stringify(data, null, 2), "utf-8");
}

export async function loadFlow(projectId: string) {
  const filePath = path.join(process.cwd(), "projects", projectId, "flow.json");
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

// 服务端获取当前项目 ID
export async function getCurrentProject() {
  const currentFilePath = path.join(process.cwd(), "projects", ".current-project.json");
  try {
    const content = await fs.readFile(currentFilePath, "utf-8");
    const data = JSON.parse(content);
    return data.projectId || null;
  } catch {
    return null;
  }
}

// 服务端保存当前项目 ID
export async function setCurrentProject(projectId: string) {
  const projectsDir = path.join(process.cwd(), "projects");
  await fs.mkdir(projectsDir, { recursive: true });
  const currentFilePath = path.join(projectsDir, ".current-project.json");
  await fs.writeFile(
    currentFilePath,
    JSON.stringify({ projectId, updatedAt: Date.now() }, null, 2),
    "utf-8",
  );
}
