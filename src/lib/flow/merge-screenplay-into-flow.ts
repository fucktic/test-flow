import type { Edge, Node } from "@xyflow/react";
import { v4 as uuidv4 } from "uuid";
import type { EpisodeNodeData, SceneItem, SceneNodeData } from "@/lib/types/flow.types";

/** 与 project.json 中 `episodes` 条目一致，仅用 segments 做分镜同步 */
export type ScreenplayEpisodeFileMeta = {
  segments?: Array<{
    label: string;
    scenes: Array<{ line: string }>;
  }>;
};

function flattenSegmentGroups(meta: ScreenplayEpisodeFileMeta[]): Array<{
  label: string;
  scenes: Array<{ line: string }>;
}> {
  const out: Array<{ label: string; scenes: Array<{ line: string }> }> = [];
  for (const file of meta) {
    for (const seg of file.segments ?? []) {
      if (seg.scenes?.length) {
        out.push(seg);
      }
    }
  }
  return out;
}

function normalizeKey(s: string): string {
  return s.replace(/\s+/g, "").toLowerCase();
}

function segmentMatchesEpisodeTitle(title: string, label: string): boolean {
  const t = normalizeKey(title);
  const l = normalizeKey(label.replace(/^#+\s*/, ""));
  if (!l) return false;
  if (t.includes(l) || l.includes(t)) return true;
  const afterDi = l.split("第")[1];
  if (afterDi && t.includes(normalizeKey(afterDi.split("集")[0] ?? ""))) {
    return true;
  }
  return false;
}

/** 将分集块分配到剧集节点：优先标题匹配，否则按顺序轮转 */
function assignGroupsToEpisodes(
  episodeTitles: string[],
  groups: Array<{ label: string; scenes: Array<{ line: string }> }>,
): Map<number, Array<{ label: string; scenes: Array<{ line: string }> }>> {
  const map = new Map<number, Array<{ label: string; scenes: Array<{ line: string }> }>>();
  if (!episodeTitles.length || !groups.length) return map;

  groups.forEach((g, gi) => {
    let idx = episodeTitles.findIndex((title) => segmentMatchesEpisodeTitle(title, g.label));
    if (idx < 0) {
      idx = gi % episodeTitles.length;
    }
    const arr = map.get(idx) ?? [];
    arr.push(g);
    map.set(idx, arr);
  });
  return map;
}

function groupsToSceneItems(
  groups: Array<{ label: string; scenes: Array<{ line: string }> }>,
): SceneItem[] {
  const items: SceneItem[] = [];
  let n = 0;
  for (const g of groups) {
    for (const s of g.scenes) {
      n += 1;
      const line = s.line.trim();
      const shortName = line.length > 36 ? `${line.slice(0, 36)}…` : line || `S-${n}`;
      items.push({
        id: uuidv4(),
        name: shortName,
        content: line,
        prompt: line,
        selected: false,
      });
    }
  }
  return items;
}

/**
 * 把 project.json 里解析的场次写入各 `sceneNode` 的 `scenes`（分镜列表）。
 * - fillEmptyOnly: 仅当对应节点 `scenes` 为空时写入（加载 flow 时用）
 * - 否则覆盖（上传剧本后同步）
 */
export function mergeScreenplayIntoFlow(
  flow: { nodes: Node[]; edges: Edge[] },
  episodesMeta: ScreenplayEpisodeFileMeta[] | undefined,
  options: { fillEmptyOnly: boolean },
): { nodes: Node[]; edges: Edge[] } {
  if (!episodesMeta?.length) {
    return flow;
  }

  const episodeNode = flow.nodes.find((n) => n.type === "episodeNode" || n.type === "episode-node");
  if (!episodeNode) {
    return flow;
  }

  const epItems = (episodeNode.data as unknown as EpisodeNodeData).episodes;
  if (!Array.isArray(epItems) || epItems.length === 0) {
    return flow;
  }

  const segmentGroups = flattenSegmentGroups(episodesMeta);
  if (!segmentGroups.length) {
    return flow;
  }

  const titles = epItems.map((e) => e.title);
  const assignment = assignGroupsToEpisodes(titles, segmentGroups);

  const nodes = flow.nodes.map((node) => {
    if (node.type !== "sceneNode" && node.type !== "scene-node") {
      return node;
    }
    if (!node.id.startsWith("scene-")) {
      return node;
    }
    const epId = node.id.slice("scene-".length);
    const epIndex = epItems.findIndex((e) => e.id === epId);
    if (epIndex < 0) {
      return node;
    }

    const groups = assignment.get(epIndex);
    if (!groups?.length) {
      return node;
    }

    const data = node.data as unknown as SceneNodeData;
    const existing = Array.isArray(data.scenes) ? data.scenes : [];
    if (options.fillEmptyOnly && existing.length > 0) {
      return node;
    }

    const newScenes = groupsToSceneItems(groups);
    return {
      ...node,
      data: {
        ...data,
        scenes: newScenes,
      },
    };
  });

  return { ...flow, nodes };
}

const BOOTSTRAP_EPISODE_NODE_ID = "episode-node-root";

/** 尚无画布节点时，根据剧本分集生成剧集节点 + 分镜节点（含场次列表） */
export function bootstrapFlowFromScreenplayMeta(
  episodesMeta: ScreenplayEpisodeFileMeta[],
): { nodes: Node[]; edges: Edge[] } | null {
  const groups = flattenSegmentGroups(episodesMeta);
  if (!groups.length) {
    return null;
  }

  const episodeItems = groups.map((g, i) => ({
    id: `ep-${i}`,
    title: `EP_${String(i + 1).padStart(3, "0")} ${g.label}`.trim(),
    checked: i < 3,
  }));

  const episodeNode: Node = {
    id: BOOTSTRAP_EPISODE_NODE_ID,
    type: "episodeNode",
    position: { x: 80, y: 120 },
    data: {
      episodes: episodeItems,
    },
  };

  const nodes: Node[] = [episodeNode];
  const edges: Edge[] = [];

  groups.forEach((g, i) => {
    const ep = episodeItems[i];
    if (!ep) return;
    const sceneNodeId = `scene-${ep.id}`;
    nodes.push({
      id: sceneNodeId,
      type: "sceneNode",
      position: { x: 480, y: 120 + i * 220 },
      data: {
        title: `分镜列表 EP_${String(i + 1).padStart(3, "0")}`,
        scenes: groupsToSceneItems([g]),
      },
    });
    edges.push({
      id: `e-${BOOTSTRAP_EPISODE_NODE_ID}-${sceneNodeId}`,
      source: BOOTSTRAP_EPISODE_NODE_ID,
      target: sceneNodeId,
      sourceHandle: "main",
      targetHandle: "in",
      animated: true,
      style: { stroke: "#6366f1", strokeWidth: 2 },
    });
  });

  return { nodes, edges };
}
