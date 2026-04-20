import fs from "fs/promises";
import path from "path";
import type { Edge, Node } from "@xyflow/react";
import {
  bootstrapFlowFromScreenplayMeta,
  mergeScreenplayIntoFlow,
  type ScreenplayEpisodeFileMeta,
} from "@/lib/flow/merge-screenplay-into-flow";

export async function saveFlow(id: string, data: unknown) {
  const dir = path.join(process.cwd(), "projects", id);
  await fs.mkdir(dir, { recursive: true });

  let jsonString = JSON.stringify(data, null, 2);
  const prefix = `/api/projects/${id}`;
  // 转义正则特殊字符
  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // 匹配类似 "/api/projects/123/episode/"、"/api/projects/123/ep-01/" 或 \"/api/projects/123/assets/\" 的情况
  const writePattern = new RegExp(
    `(["']|\\\\\\")${escapedPrefix}\\/(episode|assets|ep-\\d+)\\/`,
    "g",
  );
  // 替换为 "/episode/" 或 \"/assets/\"
  jsonString = jsonString.replace(writePattern, "$1/$2/");

  await fs.writeFile(path.join(dir, "flow.json"), jsonString, "utf-8");
}

async function readProjectEpisodesMeta(
  projectId: string,
): Promise<ScreenplayEpisodeFileMeta[] | undefined> {
  try {
    const raw = await fs.readFile(
      path.join(process.cwd(), "projects", projectId, "project.json"),
      "utf-8",
    );
    const j = JSON.parse(raw) as { episodes?: ScreenplayEpisodeFileMeta[] };
    return Array.isArray(j.episodes) ? j.episodes : undefined;
  } catch {
    return undefined;
  }
}

/** 读取 flow.json 并做 API 路径展开（供内部与 loadFlow 复用） */
export async function readFlowData(id: string) {
  const filePath = path.join(process.cwd(), "projects", id, "flow.json");
  try {
    let content = await fs.readFile(filePath, "utf-8");

    const readPattern = /(["']|\\")\/(episode|assets|ep-\d+)\//g;
    content = content.replace(readPattern, `$1/api/projects/${id}/$2/`);

    return JSON.parse(content) as { nodes: Node[]; edges: Edge[] };
  } catch {
    return null;
  }
}

export async function loadFlow(id: string) {
  const raw = await readFlowData(id);
  if (!raw || !Array.isArray(raw.nodes) || !Array.isArray(raw.edges)) {
    return null;
  }

  const meta = await readProjectEpisodesMeta(id);
  const hasEpisode = raw.nodes.some((n) => n.type === "episodeNode" || n.type === "episode-node");

  if (!hasEpisode && raw.nodes.length === 0 && meta?.length) {
    const boot = bootstrapFlowFromScreenplayMeta(meta);
    if (boot) {
      return boot;
    }
  }

  return mergeScreenplayIntoFlow({ nodes: raw.nodes, edges: raw.edges }, meta, {
    fillEmptyOnly: true,
  });
}

/** 上传剧本或需强制同步分镜列表时：把 project.json 中的场次写入 flow（覆盖已有分镜条目） */
export async function syncFlowScenesFromProject(projectId: string) {
  const raw = await readFlowData(projectId);
  const flow = raw ?? { nodes: [], edges: [] };
  if (!Array.isArray(flow.nodes) || !Array.isArray(flow.edges)) {
    return;
  }

  const meta = await readProjectEpisodesMeta(projectId);
  if (!meta?.length) {
    return;
  }

  const nodes = flow.nodes;
  const hasEpisode = nodes.some((n) => n.type === "episodeNode" || n.type === "episode-node");

  let out: { nodes: Node[]; edges: Edge[] };
  if (!hasEpisode && nodes.length === 0) {
    const boot = bootstrapFlowFromScreenplayMeta(meta);
    if (!boot) return;
    out = boot;
  } else {
    out = mergeScreenplayIntoFlow({ nodes, edges: flow.edges }, meta, { fillEmptyOnly: false });
  }

  await saveFlow(projectId, out);
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
