"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale } from "next-intl";
import type { ChatWindowSubmitPayload } from "@/components/canvas/chat-window";
import { extractAgentSessionId } from "@/components/layout/global-chat-drawer/parse-agent-output";
import {
  getGlobalAgentStreamKind,
  resolveGlobalAgentCommand,
  type AgentStreamKind,
} from "@/components/layout/global-chat-drawer/resolve-agent-command";
import type { AgentRecord } from "@/lib/agent-schema";
import {
  buildFeatureUserPrompt,
  type ChatFeatureSkill,
} from "@/lib/chat-prompts";
import { fetchAgentsCached } from "@/lib/client-data-cache";
import { saveProjectCommandStatus } from "@/lib/project-api";
import { useAgentStore } from "@/store/use-agent-store";
import { useCanvasStore } from "@/store/use-canvas-store";
import { useLayoutStore, type SidebarLoadingKey } from "@/store/use-layout-store";

type SilentAgentContext = {
  mediaId?: string;
  mediaName?: string;
  mediaType?: string;
  scope: "asset-grid" | "canvas-grid" | "storyboard-list";
  featureSkill: ChatFeatureSkill;
};

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
    buildFeatureUserPrompt({
      featureSkill: params.context.featureSkill,
      userText: params.payload.text,
    }),
  ]
    .filter(Boolean)
    .join("\n");
}

function getSidebarLoadingKey(context: SilentAgentContext): SidebarLoadingKey {
  if (context.scope === "asset-grid") return "assets";
  return "episodes";
}

function logAgentStreamSend(params: {
  args: string[];
  context: SilentAgentContext;
  executable: string;
  finalCommandText: string;
  isFirstContextMessage: boolean;
  projectId: string;
}) {
  console.log("[agent-stream:send]", {
    args: params.args,
    context: params.context,
    cliCommand: [params.executable, ...params.args],
    executable: params.executable,
    isFirstContextMessage: params.isFirstContextMessage,
    message: params.finalCommandText,
    projectId: params.projectId,
  });
}

function logAgentStreamReceive(featureSkill: ChatFeatureSkill, chunk: string) {
  console.log("[agent-stream:receive]", {
    chunk,
    featureSkill,
  });
}

function buildSilentAgentContextKey(params: {
  agentId: string;
  featureSkill: ChatFeatureSkill;
  projectId: string;
  scope: SilentAgentContext["scope"];
}) {
  return `${params.agentId}:${params.projectId}:${params.scope}:${params.featureSkill}`;
}

function getSessionIdForSilentAgent(streamKind: AgentStreamKind, contextKey: string) {
  if (streamKind === "generic") return undefined;
  return useAgentStore.getState().getAgentSession(contextKey);
}

function persistSilentAgentSessionId(
  streamKind: AgentStreamKind,
  contextKey: string,
  stdout: string,
) {
  const sessionId = extractAgentSessionId(streamKind, stdout);
  if (!sessionId) return;
  useAgentStore.getState().setAgentSession(contextKey, sessionId);
}

export function useSilentAgentCommand() {
  const locale = useLocale();
  const currentProject = useCanvasStore((state) => state.currentProject);
  const setCommandStatus = useCanvasStore((state) => state.setCommandStatus);
  const finishSidebarLoading = useLayoutStore((state) => state.finishSidebarLoading);
  const startSidebarLoading = useLayoutStore((state) => state.startSidebarLoading);
  const selectedAgentId = useAgentStore((state) => state.selectedAgentId);
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const lastContextKeyRef = useRef<string | null>(null);
  const selectedAgent = useMemo(
    () => agents.find((agent) => agent.id === selectedAgentId),
    [agents, selectedAgentId],
  );

  useEffect(() => {
    let active = true;

    async function loadAgents() {
      try {
        const payload = await fetchAgentsCached();
        if (active) setAgents(payload);
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
      if (!selectedAgent || !currentProject || isExecuting) return;

      const contextKey = buildSilentAgentContextKey({
        agentId: selectedAgent.id,
        featureSkill: context.featureSkill,
        projectId: currentProject.id,
        scope: context.scope,
      });
      const streamKind = getGlobalAgentStreamKind(selectedAgent);
      const storedSessionId = getSessionIdForSilentAgent(streamKind, contextKey);
      const sessionId =
        storedSessionId ?? (streamKind === "openclaw" ? contextKey : undefined);
      const isFirstContextMessage = !sessionId && lastContextKeyRef.current !== contextKey;

      const commandText = buildInlineGridCommand({
        context,
        payload,
        projectId: currentProject.id,
      });
      const executionInstruction =
        "This request comes from a UI-triggered command. Execute the requested work directly and do not format a chat reply.";
      const finalCommandText = isFirstContextMessage
        ? `${executionInstruction}\nCurrent selected project ID is: ${currentProject.id}.\n[Latest Command]\nUser: ${commandText}`
        : `Current selected project ID is: ${currentProject.id}.\n[Latest Command]\nUser: ${commandText}`;
      const resolvedCommand = resolveGlobalAgentCommand(selectedAgent, finalCommandText, {
        isFirstMessage: isFirstContextMessage,
        sessionId,
      });

      logAgentStreamSend({
        args: resolvedCommand.args,
        context,
        executable: resolvedCommand.executable,
        finalCommandText,
        isFirstContextMessage,
        projectId: currentProject.id,
      });
      lastContextKeyRef.current = contextKey;
      const sidebarLoadingKey = getSidebarLoadingKey(context);
      setIsExecuting(true);
      startSidebarLoading(sidebarLoadingKey);

      try {
        if (context.mediaId) {
          setCommandStatus(context.mediaId, "loading");
          await saveProjectCommandStatus(currentProject.id, context.mediaId, "loading");
        }

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
          if (context.mediaId) {
            setCommandStatus(context.mediaId, "error");
            await saveProjectCommandStatus(currentProject.id, context.mediaId, "error");
          }
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let stdout = "";
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            if (chunk) {
              stdout += chunk;
              logAgentStreamReceive(context.featureSkill, chunk);
            }
          }

          const tailChunk = decoder.decode();
          if (tailChunk) {
            stdout += tailChunk;
            logAgentStreamReceive(context.featureSkill, tailChunk);
          }
        } finally {
          reader.releaseLock();
        }

        persistSilentAgentSessionId(resolvedCommand.streamKind, contextKey, stdout);

        if (context.mediaId) {
          setCommandStatus(context.mediaId, "success");
          await saveProjectCommandStatus(currentProject.id, context.mediaId, "success");
        }
      } catch {
        if (context.mediaId) {
          setCommandStatus(context.mediaId, "error");
          await saveProjectCommandStatus(currentProject.id, context.mediaId, "error").catch(() => {
            // command.json status is best-effort and should not surface inline UI errors.
          });
        }
        // Inline grid chat intentionally does not render execution output.
      } finally {
        setIsExecuting(false);
        finishSidebarLoading(sidebarLoadingKey);
      }
    },
    [
      currentProject,
      finishSidebarLoading,
      isExecuting,
      locale,
      selectedAgent,
      setCommandStatus,
      startSidebarLoading,
    ],
  );

  return {
    execute,
    isExecuting,
  };
}
