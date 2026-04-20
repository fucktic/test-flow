/**
 * 解析 `codex exec --json` 的 JSONL stdout，分离「过程类 item」与最终 `agent_message` 文本；并提取 thread_id（用于 resume）。
 * @see https://developers.openai.com/codex/noninteractive
 */

export interface CodexStreamChunk {
  /** 最终展示给用户的助手正文 */
  final: string;
  /** 工具调用、推理等过程信息，折叠展示 */
  process: string;
}

function formatCodexProcessItem(item: {
  type?: string;
  text?: string;
  name?: string;
  command?: string;
  [key: string]: unknown;
}): string {
  const ty = item.type ?? "item";
  if (typeof item.text === "string" && item.text.trim()) {
    return `**${ty}**\n${item.text.trim()}\n\n`;
  }
  const bits: string[] = [`**${ty}**`];
  if (typeof item.name === "string") bits.push(item.name);
  if (typeof item.command === "string") bits.push(item.command);
  if (bits.length > 1) return `${bits.join(" — ")}\n\n`;
  try {
    const s = JSON.stringify(item);
    return s.length > 800 ? `${s.slice(0, 800)}…\n\n` : `${s}\n\n`;
  } catch {
    return "";
  }
}

export class CodexJsonlStreamParser {
  private lineBuffer = "";
  threadId: string | null = null;

  private processLine(line: string): CodexStreamChunk {
    const trimmed = line.trim();
    if (!trimmed) return { final: "", process: "" };
    try {
      const ev = JSON.parse(trimmed) as {
        type?: string;
        thread_id?: string;
        item?: {
          type?: string;
          text?: string;
          name?: string;
          command?: string;
          [key: string]: unknown;
        };
      };
      if (ev.type === "thread.started" && typeof ev.thread_id === "string") {
        this.threadId = ev.thread_id;
      }
      if (ev.type === "item.completed" && ev.item) {
        const it = ev.item;
        if (it.type === "agent_message" && typeof it.text === "string") {
          return { final: it.text, process: "" };
        }
        const p = formatCodexProcessItem(it);
        return p ? { final: "", process: p } : { final: "", process: "" };
      }
    } catch {
      // 非 JSON 行忽略
    }
    return { final: "", process: "" };
  }

  /** 处理流式 chunk，返回本段中可拼接到 UI 的文本 */
  push(chunk: string): CodexStreamChunk {
    this.lineBuffer += chunk;
    const lines = this.lineBuffer.split("\n");
    this.lineBuffer = lines.pop() ?? "";
    let final = "";
    let process = "";
    for (const line of lines) {
      const part = this.processLine(line);
      final += part.final;
      process += part.process;
    }
    return { final, process };
  }

  /** 流结束时处理缓冲区中最后一行（可能不完整则忽略） */
  flush(): CodexStreamChunk {
    const rest = this.lineBuffer;
    this.lineBuffer = "";
    if (!rest.trim()) return { final: "", process: "" };
    return this.processLine(rest);
  }
}

/** 通话结束后对完整 stdout 一次性解析（流式期间不拆分 final / process） */
export function parseCodexStdoutComplete(
  stdout: string,
): CodexStreamChunk & { threadId: string | null } {
  const parser = new CodexJsonlStreamParser();
  const a = parser.push(stdout);
  const b = parser.flush();
  return {
    final: a.final + b.final,
    process: a.process + b.process,
    threadId: parser.threadId,
  };
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
