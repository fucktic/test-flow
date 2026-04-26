"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale } from "next-intl";
import type { ChatWindowSubmitPayload } from "@/components/canvas/chat-window";
import { resolveGlobalAgentCommand } from "@/components/layout/global-chat-drawer/resolve-agent-command";
import type { AgentRecord } from "@/lib/agent-schema";
import { saveProjectCommandStatus } from "@/lib/project-api";
import { useAgentStore } from "@/store/use-agent-store";
import { useCanvasStore } from "@/store/use-canvas-store";

type SilentAgentContext = {
  mediaId?: string;
  mediaName?: string;
  mediaType?: string;
  scope: "asset-grid" | "canvas-grid";
};

const FIXED_SYSTEM_PROMPT_TEMPLATE =
  "[System Instruction] " +
  "Skills are located at {projectRoot}/skills/. Before responding, list the available skill folders, read the best matching SKILL.md, and execute the matching workflow directly when useful. " +
  "All file reads and writes must stay within {projectRoot}/projects/{projectId}/. Never create or modify files inside the skills/ directory. " +
  "This request comes from an inline grid chat. Execute the requested work directly and do not format a chat reply.";

function formatAttachmentContext(projectId: string, payload: ChatWindowSubmitPayload) {
  return payload.attachments
    .map((attachment, index) => {
      const filePath =
        "fileName" in attachment
          ? `projects/${projectId}/temp/${attachment.fileName}`
          : attachment.url;

      return `${index + 1}. ${attachment.label} (${attachment.name}): ${filePath}`;
    })
    .join("\n");
}

function buildInlineGridCommand(params: {
  context: SilentAgentContext;
  payload: ChatWindowSubmitPayload;
  projectId: string;
}) {
  const attachmentContext = formatAttachmentContext(params.projectId, params.payload);
  const videoOptions = params.payload.videoOptions
    ? Object.entries(params.payload.videoOptions)
        .map(([key, value]) => `${key}: ${value}`)
        .join("\n")
    : "";

  return [
    `[Inline Grid Chat Context]`,
    `Scope: ${params.context.scope}`,
    params.context.mediaId ? `Media ID: ${params.context.mediaId}` : "",
    params.context.mediaName ? `Media Name: ${params.context.mediaName}` : "",
    params.context.mediaType ? `Media Type: ${params.context.mediaType}` : "",
    videoOptions ? `[Video Options]\n${videoOptions}` : "",
    attachmentContext ? `[Attached Files]\n${attachmentContext}` : "",
    `[User Prompt]\n${params.payload.text}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function useSilentAgentCommand() {
  const locale = useLocale();
  const currentProject = useCanvasStore((state) => state.currentProject);
  const setCommandStatus = useCanvasStore((state) => state.setCommandStatus);
  const selectedAgentId = useAgentStore((state) => state.selectedAgentId);
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const codexSessionIdRef = useRef<string | null>(null);
  const lastContextKeyRef = useRef<string | null>(null);
  const selectedAgent = useMemo(
    () => agents.find((agent) => agent.id === selectedAgentId),
    [agents, selectedAgentId],
  );

  useEffect(() => {
    let active = true;

    async function loadAgents() {
      try {
        const response = await fetch("/api/agents");
        if (!response.ok) return;

        const payload = (await response.json()) as { agents?: AgentRecord[] };
        if (active) setAgents(payload.agents ?? []);
      } catch {
        // Inline grid chat silently waits until agents are available.
      }
    }

    void loadAgents();

    return () => {
      active = false;
    };
  }, []);

  const execute = useCallback(
    async (payload: ChatWindowSubmitPayload, context: SilentAgentContext) => {
      if (!selectedAgent || !currentProject || isExecuting || !context.mediaId) return;

      const contextKey = `${selectedAgent.id}:${currentProject.id}:${context.scope}`;
      const isFirstContextMessage = lastContextKeyRef.current !== contextKey;
      if (lastContextKeyRef.current !== contextKey) {
        codexSessionIdRef.current = null;
      }

      const projectRootPlaceholder = "{{PROJECT_ROOT}}";
      const systemPrompt = FIXED_SYSTEM_PROMPT_TEMPLATE.replaceAll(
        "{projectRoot}",
        projectRootPlaceholder,
      ).replaceAll("{projectId}", currentProject.id);
      const commandText = buildInlineGridCommand({
        context,
        payload,
        projectId: currentProject.id,
      });
      const finalCommandText = isFirstContextMessage
        ? `${systemPrompt}\nCurrent selected project ID is: ${currentProject.id}.\n[Latest Command]\nUser: ${commandText}`
        : `Current selected project ID is: ${currentProject.id}.\n[Latest Command]\nUser: ${commandText}`;
      const resolvedCommand = resolveGlobalAgentCommand(selectedAgent, finalCommandText, {
        isFirstMessage: isFirstContextMessage,
        sessionId: codexSessionIdRef.current ?? undefined,
      });

      lastContextKeyRef.current = contextKey;
      setIsExecuting(true);

      try {
        setCommandStatus(context.mediaId, "loading");
        await saveProjectCommandStatus(currentProject.id, context.mediaId, "loading");

        const response = await fetch("/api/agents/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agentName: resolvedCommand.executable,
            args: resolvedCommand.args,
            locale,
          }),
        });

        if (!response.ok || !response.body) {
          setCommandStatus(context.mediaId, "error");
          await saveProjectCommandStatus(currentProject.id, context.mediaId, "error");
          return;
        }

        const reader = response.body.getReader();
        try {
          while (true) {
            const { done } = await reader.read();
            if (done) break;
          }
        } finally {
          reader.releaseLock();
        }

        setCommandStatus(context.mediaId, "success");
        await saveProjectCommandStatus(currentProject.id, context.mediaId, "success");
      } catch {
        setCommandStatus(context.mediaId, "error");
        await saveProjectCommandStatus(currentProject.id, context.mediaId, "error").catch(() => {
          // command.json status is best-effort and should not surface inline UI errors.
        });
        // Inline grid chat intentionally does not render execution output.
      } finally {
        setIsExecuting(false);
      }
    },
    [currentProject, isExecuting, locale, selectedAgent, setCommandStatus],
  );

  return {
    execute,
    isExecuting,
  };
}
