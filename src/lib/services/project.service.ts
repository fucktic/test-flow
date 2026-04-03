import fs from "fs/promises";
import path from "path";

export async function saveFlow(id: string, data: any) {
  const dir = path.join(process.cwd(), "projects", id);
  await fs.mkdir(dir, { recursive: true });

  let jsonString = JSON.stringify(data, null, 2);
  const prefix = `/api/projects/${id}`;
  // 转义正则特殊字符
  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // 匹配类似 "/api/projects/123/episode/" 或 \"/api/projects/123/assets/\" 的情况
  const writePattern = new RegExp(`(["']|\\\\\\")${escapedPrefix}\\/(episode|assets)\\/`, "g");
  // 替换为 "/episode/" 或 \"/assets/\"
  jsonString = jsonString.replace(writePattern, "$1/$2/");

  await fs.writeFile(path.join(dir, "flow.json"), jsonString, "utf-8");
}

export async function loadFlow(id: string) {
  const filePath = path.join(process.cwd(), "projects", id, "flow.json");
  try {
    let content = await fs.readFile(filePath, "utf-8");

    // 匹配类似 "/episode/" 或 \"/assets/\" 的情况
    const readPattern = /(["']|\\")\/(episode|assets)\//g;
    // 替换为 "/api/projects/123/episode/" 或 \"/api/projects/123/assets/\"
    content = content.replace(readPattern, `$1/api/projects/${id}/$2/`);

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
    return data.id || data.projectId || null;
  } catch {
    return null;
  }
}

// 服务端保存当前项目 ID
export async function setCurrentProject(id: string) {
  const projectsDir = path.join(process.cwd(), "projects");
  await fs.mkdir(projectsDir, { recursive: true });
  const currentFilePath = path.join(projectsDir, ".current-project.json");
  await fs.writeFile(
    currentFilePath,
    JSON.stringify({ id, updatedAt: Date.now() }, null, 2),
    "utf-8",
  );
}
