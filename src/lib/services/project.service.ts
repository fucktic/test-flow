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
