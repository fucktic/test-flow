import type { AgentRecord } from "@/lib/agent-schema";

export type AgentStreamKind = "claude" | "codex" | "generic" | "hermes" | "openclaw" | "opencode";

type ResolveAgentCommandOptions = {
  isFirstMessage: boolean;
  sessionId?: string;
};

type ResolvedAgentCommand = {
  args: string[];
  executable: string;
  streamKind: AgentStreamKind;
};

export function getGlobalAgentStreamKind(agent: AgentRecord): AgentStreamKind {
  const normalizedCommand = (agent.instructions || agent.name).trim().toLowerCase();

  if (normalizedCommand.includes("opencode")) return "opencode";
  if (normalizedCommand.includes("claude")) return "claude";
  if (normalizedCommand.includes("codex")) return "codex";
  if (normalizedCommand.includes("openclaw")) return "openclaw";
  if (normalizedCommand.includes("hermes")) return "hermes";
  return "generic";
}

export function resolveGlobalAgentCommand(
  agent: AgentRecord,
  commandText: string,
  options: ResolveAgentCommandOptions,
): ResolvedAgentCommand {
  const executable = (agent.instructions || agent.name).trim();
  const streamKind = getGlobalAgentStreamKind(agent);
  const flatText = commandText.replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim();

  if (streamKind === "opencode") {
    const args = ["run", "--format", "json", flatText];
    if (!options.isFirstMessage) args.push("--continue");
    return { args, executable, streamKind };
  }

  if (streamKind === "claude") {
    const args = [
      "-p",
      commandText,
      "--output-format",
      "stream-json",
      "--verbose",
      "--include-partial-messages",
    ];
    if (!options.isFirstMessage) args.push("--continue");
    return { args, executable, streamKind };
  }

  if (streamKind === "codex") {
    const args = ["exec", "--json", "--full-auto"];
    const sessionId = options.sessionId?.trim();

    if (sessionId && !options.isFirstMessage) {
      args.push("resume", sessionId, flatText);
    } else {
      args.push(flatText);
    }

    return { args, executable, streamKind };
  }

  if (streamKind === "openclaw") {
    const args = ["agent", "--json"];
    if (options.sessionId) args.push("--session-id", options.sessionId);
    args.push("--message", flatText);
    return { args, executable, streamKind };
  }

  if (streamKind === "hermes") {
    const args = ["chat", "--quiet", "-q", flatText];
    if (options.sessionId) args.push("--resume", options.sessionId);
    return { args, executable, streamKind };
  }

  return { args: [flatText], executable, streamKind };
}
