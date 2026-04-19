import { Agent } from "@/lib/types/agent.types";

/** 与 resolveAgentCommand 分支一致，用于流式回显拆分（过程 / 最终回复） */
export type AgentStreamKind = "opencode" | "claude" | "codex" | "openclaw" | "hermes" | "generic";

export function getAgentStreamKind(agent: Agent): AgentStreamKind {
  const normalizedCmd = (agent.endpoint || agent.name || "").trim().toLowerCase();
  if (normalizedCmd.includes("opencode")) return "opencode";
  if (normalizedCmd.includes("claude")) return "claude";
  if (normalizedCmd.includes("codex")) return "codex";
  if (normalizedCmd.includes("openclaw")) return "openclaw";
  if (normalizedCmd.includes("hermes")) return "hermes";
  return "generic";
}

interface ResolveAgentCommandOptions {
  isFirstMessage: boolean;
  sessionId?: string;
}

export interface ResolvedAgentCommand {
  executable: string;
  args: string[];
}

export const resolveAgentCommand = (
  agent: Agent,
  commandText: string,
  options: ResolveAgentCommandOptions,
): ResolvedAgentCommand => {
  const executable = (agent.endpoint || agent.name || "").trim();
  const normalizedCmd = executable.toLowerCase();

  const flatText = `"${commandText.replace(/\r?\n/g, " ").trim()}"`;

  if (normalizedCmd.includes("opencode")) {
    const args = ["run"];

    args.push(flatText);
    if (!options.isFirstMessage) {
      args.push("--continue");
    }
    return { executable, args };
  }

  if (normalizedCmd.includes("claude")) {
    // prompt 很长时在 Windows cmd.exe 下会被 8191 字符限制截断。
    // 后端（route.ts）会将 -p 后面的正文移走、改由 stdin 传入，规避这个限制。
    const args = ["-p", commandText, "--verbose", "--effort", "high"];
    if (!options.isFirstMessage) {
      args.push("--continue");
    }
    return {
      executable,
      args,
    };
  }

  if (normalizedCmd.includes("codex")) {
    // --json 便于解析 thread_id；续写用 `codex exec resume <id> <prompt>`
    // --full-auto：等价于 workspace-write 沙箱，允许改仓库内文件（默认 exec 多为只读）
    const args = ["exec", "--json", "--full-auto"];
    const sid = options.sessionId?.trim();
    if (sid && !options.isFirstMessage) {
      args.push("resume", sid, flatText);
    } else {
      args.push(flatText);
    }
    return { executable, args };
  }

  if (normalizedCmd.includes("openclaw")) {
    const args = ["agent"];
    if (options.sessionId) {
      args.push("--session-id", options.sessionId);
    }
    args.push("--message", flatText);
    return { executable, args };
  }

  if (normalizedCmd.includes("hermes")) {
    const args = ["chat", "-q", commandText];
    if (options.sessionId) {
      args.push("--resume", options.sessionId);
    }
    return { executable, args };
  }

  return { executable, args: [flatText] };
};
