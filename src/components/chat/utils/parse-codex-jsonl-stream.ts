/**
 * 解析 `codex exec --json` 的 JSONL stdout，提取可展示的 agent 文本与 thread_id（用于 resume）。
 * @see https://developers.openai.com/codex/noninteractive
 */
export class CodexJsonlStreamParser {
  private lineBuffer = "";
  threadId: string | null = null;

  private processLine(line: string): string {
    const trimmed = line.trim();
    if (!trimmed) return "";
    try {
      const ev = JSON.parse(trimmed) as {
        type?: string;
        thread_id?: string;
        item?: { type?: string; text?: string };
      };
      if (ev.type === "thread.started" && typeof ev.thread_id === "string") {
        this.threadId = ev.thread_id;
      }
      if (
        ev.type === "item.completed" &&
        ev.item?.type === "agent_message" &&
        typeof ev.item.text === "string"
      ) {
        return ev.item.text;
      }
    } catch {
      // 非 JSON 行忽略
    }
    return "";
  }

  /** 处理流式 chunk，返回本段中可拼接到 UI 的文本 */
  push(chunk: string): string {
    this.lineBuffer += chunk;
    const lines = this.lineBuffer.split("\n");
    this.lineBuffer = lines.pop() ?? "";
    let out = "";
    for (const line of lines) {
      out += this.processLine(line);
    }
    return out;
  }

  /** 流结束时处理缓冲区中最后一行（可能不完整则忽略） */
  flush(): string {
    const rest = this.lineBuffer;
    this.lineBuffer = "";
    if (!rest.trim()) return "";
    return this.processLine(rest);
  }
}

export function extractCodexThreadIdFromStdout(stdout: string): string | null {
  for (const line of stdout.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const ev = JSON.parse(trimmed) as { type?: string; thread_id?: string };
      if (ev.type === "thread.started" && typeof ev.thread_id === "string") {
        return ev.thread_id;
      }
    } catch {
      continue;
    }
  }
  return null;
}
