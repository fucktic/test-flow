/** 与样本「## 四、分集剧本」等结构对齐的校验与粗解析 */

export function validateScreenplayMarkdown(content: string): boolean {
  const c = content.trim();
  if (!c) return false;
  return c.includes("分集剧本") && c.includes("分集") && c.includes("场次");
}

export function firstNonEmptyLineTitle(markdown: string): string {
  for (const line of markdown.split(/\r?\n/)) {
    const t = line.trim();
    if (t) return t.replace(/^#+\s*/, "").trim();
  }
  return "";
}

export type ScreenplaySceneLine = { line: string };

export type ScreenplayEpisodeSegment = {
  label: string;
  scenes: ScreenplaySceneLine[];
};

/** 从正文粗提取「分集 / 场次」结构，供写入 project.json */
export function extractEpisodeSegments(markdown: string): ScreenplayEpisodeSegment[] {
  const idx = markdown.indexOf("分集剧本");
  const body = idx >= 0 ? markdown.slice(idx) : markdown;
  const lines = body.split(/\r?\n/);
  const segments: ScreenplayEpisodeSegment[] = [];
  let currentLabel = "剧本";
  let currentScenes: string[] = [];

  const flush = () => {
    if (currentScenes.length > 0) {
      segments.push({
        label: currentLabel,
        scenes: currentScenes.map((line) => ({ line })),
      });
      currentScenes = [];
    }
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const heading = line.replace(/^#+\s*/, "").trim();
    if (/第.+集/.test(heading)) {
      flush();
      currentLabel = heading;
      continue;
    }
    if (line.includes("场次")) {
      currentScenes.push(line);
    }
  }
  flush();
  return segments;
}
