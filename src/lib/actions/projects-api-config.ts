"use server";

import fs from "fs/promises";
import path from "path";
import { defaultClientApiConfig, type ClientApiConfig } from "@/lib/config/client-api-config";

/** 项目根目录下 `projects/config.json`（use server 文件仅允许导出 async，路径常量勿放此文件） */
function configFilePath(): string {
  return path.join(process.cwd(), "projects", "config.json");
}

export async function getProjectsApiConfig(): Promise<ClientApiConfig> {
  const filePath = configFilePath();
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw) as Partial<ClientApiConfig>;
    return {
      ...defaultClientApiConfig,
      ...parsed,
    };
  } catch {
    return { ...defaultClientApiConfig };
  }
}

/** imgbb 选填：留空则保留文件中原有值 */
function mergeImgbb(incoming: string, existing: string): string {
  const t = incoming.trim();
  return t.length > 0 ? t : existing;
}

export type SaveProjectsApiConfigResult =
  | { success: true }
  | { success: false; error: "required" | "write" };

export async function saveProjectsApiConfig(
  config: ClientApiConfig,
): Promise<SaveProjectsApiConfigResult> {
  try {
    const projectsDir = path.join(process.cwd(), "projects");
    await fs.mkdir(projectsDir, { recursive: true });

    const existing = await getProjectsApiConfig();
    const imageModelApiKey = config.imageModelApiKey.trim();
    const imageModelExample = config.imageModelExample.trim();
    const videoModelApiKey = config.videoModelApiKey.trim();
    const videoModelExample = config.videoModelExample.trim();

    if (!imageModelApiKey || !imageModelExample || !videoModelApiKey || !videoModelExample) {
      return { success: false, error: "required" };
    }

    const payload: ClientApiConfig = {
      imageModelApiKey,
      imageModelExample,
      videoModelApiKey,
      videoModelExample,
      imgbbApiKey: mergeImgbb(config.imgbbApiKey ?? "", existing.imgbbApiKey ?? ""),
    };

    await fs.writeFile(configFilePath(), JSON.stringify(payload, null, 2), "utf-8");
    return { success: true };
  } catch (error) {
    console.error("Failed to save projects/config.json:", error);
    return { success: false, error: "write" };
  }
}
