"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bot, X } from "lucide-react";
import { Dialog } from "radix-ui";
import { useLocale, useTranslations } from "next-intl";
import { v4 as createUuid } from "uuid";
import { Button } from "@/components/ui/button";
import type { AgentRecord } from "@/lib/agent-schema";
import type { AppConfig } from "@/lib/config-schema";
import { cn } from "@/lib/utils";
import { useAgentStore } from "@/store/use-agent-store";
import { useCanvasStore } from "@/store/use-canvas-store";
import {
  GlobalChatComposer,
  type GlobalChatAttachment,
} from "./global-chat-composer";
import {
  extractAgentSessionId,
  normalizeAgentStreamPreview,
  parseAgentOutput,
} from "./parse-agent-output";
import {
  getGlobalAgentStreamKind,
  resolveGlobalAgentCommand,
  type AgentStreamKind,
} from "./resolve-agent-command";
import { buildFeatureUserPrompt } from "@/lib/chat-prompts";
import { fetchAgentsCached, fetchConfigCached } from "@/lib/client-data-cache";
import { useLayoutStore } from "@/store/use-layout-store";

type GlobalChatDrawerProps = {
  open: boolean;
  onClose: () => void;
};

type GlobalChatMessage = {
  id: string;
  process?: string;
  role: "agent" | "assistant" | "user";
  text: string;
};

type CommandKey = "agent" | "clear" | "help" | "models" | "project";

type CommandResult =
  | {
      action: "append";
      text: string;
    }
  | {
      action: "clear";
    };

const EMPTY_CONFIG: AppConfig = {
  imageBeds: [],
  imageModels: [],
  videoModels: [],
};

const AUTO_HELLO_PROMPT = "hello";
const COMMAND_KEYS: CommandKey[] = ["help", "clear", "project", "agent", "models"];
const autoHelloContextKeys = new Set<string>();

const createMessageId = () => {
  return createUuid();
};

const buildAgentContextKey = (agentId: string, projectId: string) => {
  return `${agentId}:${projectId}`;
};

const getSessionIdForAgent = (streamKind: AgentStreamKind, contextKey: string) => {
  if (streamKind === "generic") return undefined;
  return useAgentStore.getState().getAgentSession(contextKey);
};

const persistSessionIdForAgent = (
  streamKind: AgentStreamKind,
  contextKey: string,
  stdout: string,
) => {
  const sessionId = extractAgentSessionId(streamKind, stdout);
  if (!sessionId) return;

  useAgentStore.getState().setAgentSession(contextKey, sessionId);
};

function AgentGlyph({ agent }: { agent?: AgentRecord }) {
  const icon = agent?.icon.trim() ?? "";

  if (icon.startsWith("http://") || icon.startsWith("https://")) {
    return (
      <span
        className="block size-full rounded-full bg-cover bg-center"
        style={{ backgroundImage: `url(${icon})` }}
        aria-hidden="true"
      />
    );
  }

  if (icon) {
    return <span className="text-sm leading-none">{icon}</span>;
  }

  if (agent?.name.trim()) {
    return <span className="text-xs font-semibold leading-none">{agent.name.trim().slice(0, 1)}</span>;
  }

  return <Bot className="size-4" />;
}

export function GlobalChatDrawer({ open, onClose }: GlobalChatDrawerProps) {
  const t = useTranslations("Sidebar.globalChat");
  const canvasT = useTranslations("Canvas");
  const locale = useLocale();
  const currentProject = useCanvasStore((state) => state.currentProject);
  const finishSidebarLoading = useLayoutStore((state) => state.finishSidebarLoading);
  const startSidebarLoading = useLayoutStore((state) => state.startSidebarLoading);
  const selectedAgentId = useAgentStore((state) => state.selectedAgentId);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastContextKeyRef = useRef<string | null>(null);
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [config, setConfig] = useState<AppConfig>(EMPTY_CONFIG);
  const [isExecuting, setIsExecuting] = useState(false);
  const [messages, setMessages] = useState<GlobalChatMessage[]>(() => [
    {
      id: createMessageId(),
      role: "assistant",
      text: t("welcome"),
    },
  ]);
  const modelOptions = useMemo(
    () =>
      config.imageModels.map((model) => ({
        id: model.id,
        name: model.name,
      })),
    [config.imageModels],
  );
  const selectedAgent = agents.find((agent) => agent.id === selectedAgentId);

  useEffect(() => {
    let active = true;

    const loadConfig = async () => {
      try {
        const payload = await fetchConfigCached();
        if (active && payload) setConfig(payload);
      } catch {
        // The drawer can still be used for text while model settings load or fail.
      }
    };

    void loadConfig();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    const loadAgents = async () => {
      try {
        const payload = await fetchAgentsCached();
        if (active) setAgents(payload);
      } catch {
        // Agent context is optional for command replies.
      }
    };

    void loadAgents();

    return () => {
      active = false;
    };
  }, []);

  const createAssistantMessage = (text: string): GlobalChatMessage => ({
    id: createMessageId(),
    role: "assistant",
    text,
  });

  const createUserMessage = (text: string): GlobalChatMessage => ({
    id: createMessageId(),
    role: "user",
    text,
  });

  const updateMessage = (messageId: string, text: string, process?: string) => {
    setMessages((currentMessages) =>
      currentMessages.map((message) =>
        message.id === messageId
          ? {
              ...message,
              process,
              text,
            }
          : message,
      ),
    );
  };

  const executeAgentCommand = useCallback(
    async (commandText: string, options?: { silent?: boolean }) => {
      if (!selectedAgent) {
        if (!options?.silent) {
          setMessages((currentMessages) => [
            ...currentMessages,
            createAssistantMessage(t("commandReplies.noAgent")),
          ]);
        }
        return;
      }

      const projectId = currentProject?.id ?? "";
      const contextKey = buildAgentContextKey(selectedAgent.id, projectId);
      const streamKind = getGlobalAgentStreamKind(selectedAgent);
      const storedSessionId = getSessionIdForAgent(streamKind, contextKey);
      const sessionId = storedSessionId ?? (streamKind === "openclaw" && projectId ? contextKey : undefined);
      const isFirstContextMessage =
        !sessionId &&
        !autoHelloContextKeys.has(contextKey) &&
        lastContextKeyRef.current !== contextKey;
      const projectContext = currentProject ? `\nCurrent selected project ID is: ${projectId}.` : "";
      const finalCommandText = options?.silent
        ? commandText
        : `${projectContext}\n[Latest Command]\nUser: ${buildFeatureUserPrompt({
            featureSkill: "general-chat",
            userText: commandText,
          })}`;
      const resolvedCommand = resolveGlobalAgentCommand(selectedAgent, finalCommandText, {
        isFirstMessage: isFirstContextMessage,
        sessionId,
      });
      const abortController = new AbortController();
      const agentMessageId = createMessageId();

      abortControllerRef.current = abortController;
      lastContextKeyRef.current = contextKey;
      setIsExecuting(true);
      startSidebarLoading("chat");
      if (!options?.silent) {
        setMessages((currentMessages) => [
          ...currentMessages,
          {
            id: agentMessageId,
            process: t("commandReplies.executing", { name: selectedAgent.name }),
            role: "agent",
            text: "",
          },
        ]);
      }

      try {
        const response = await fetch("/api/agents/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agentName: resolvedCommand.executable,
            args: resolvedCommand.args,
            locale,
          }),
          signal: abortController.signal,
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(payload.error ?? t("commandReplies.executionFailed"));
        }

        if (!response.body) {
          throw new Error(t("commandReplies.emptyResponse"));
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let stdout = "";

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            stdout += chunk;
            if (!options?.silent) {
              updateMessage(
                agentMessageId,
                "",
                normalizeAgentStreamPreview(stdout) ||
                  t("commandReplies.executing", { name: selectedAgent.name }),
              );
            }
          }

          const tailChunk = decoder.decode();
          if (tailChunk) {
            stdout += tailChunk;
          }
        } finally {
          reader.releaseLock();
        }

        const parsedOutput = parseAgentOutput(resolvedCommand.streamKind, stdout);
        if (parsedOutput.threadId) {
          useAgentStore.getState().setAgentSession(contextKey, parsedOutput.threadId);
        } else {
          persistSessionIdForAgent(resolvedCommand.streamKind, contextKey, stdout);
        }

        if (!options?.silent) {
          updateMessage(
            agentMessageId,
            parsedOutput.final || t("commandReplies.executionCompleteNoOutput"),
            parsedOutput.process || undefined,
          );
        }
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          if (!options?.silent) updateMessage(agentMessageId, t("commandReplies.stopped"));
          return;
        }

        const message = error instanceof Error ? error.message : t("commandReplies.executionFailed");
        if (!options?.silent) {
          updateMessage(agentMessageId, t("commandReplies.executionFailedMessage", { message }));
        }
      } finally {
        abortControllerRef.current = null;
        setIsExecuting(false);
        finishSidebarLoading("chat");
      }
    },
    [currentProject, finishSidebarLoading, locale, selectedAgent, startSidebarLoading, t],
  );

  useEffect(() => {
    if (!selectedAgent || !currentProject || isExecuting) return;

    const contextKey = buildAgentContextKey(selectedAgent.id, currentProject.id);
    if (autoHelloContextKeys.has(contextKey)) return;

    autoHelloContextKeys.add(contextKey);
    let active = true;
    queueMicrotask(() => {
      if (active) void executeAgentCommand(AUTO_HELLO_PROMPT, { silent: true });
    });

    return () => {
      active = false;
    };
  }, [currentProject, executeAgentCommand, isExecuting, selectedAgent]);

  const resolveCommand = (text: string): CommandResult | null => {
    const trimmedText = text.trim();
    if (!trimmedText.startsWith("/")) return null;

    const [rawCommand] = trimmedText.slice(1).split(/\s+/, 1);
    const command = rawCommand.toLowerCase();

    if (command === "clear") {
      return { action: "clear" };
    }

    if (command === "help" || command === "commands" || command === "") {
      return {
        action: "append",
        text: COMMAND_KEYS.map((key) => t(`commands.${key}`)).join("\n"),
      };
    }

    if (command === "project") {
      if (!currentProject) {
        return { action: "append", text: t("commandReplies.noProject") };
      }

      return {
        action: "append",
        text: t("commandReplies.project", {
          name: currentProject.name,
          episodes: currentProject.episodes.length,
          aspectRatio: currentProject.aspectRatio,
          resolution: currentProject.resolution,
        }),
      };
    }

    if (command === "agent") {
      if (!selectedAgent) {
        return { action: "append", text: t("commandReplies.noAgent") };
      }

      return {
        action: "append",
        text: t("commandReplies.agent", {
          name: selectedAgent.name,
          description: selectedAgent.description || t("commandReplies.emptyDescription"),
        }),
      };
    }

    if (command === "models") {
      if (modelOptions.length === 0) {
        return { action: "append", text: t("commandReplies.noModels") };
      }

      return {
        action: "append",
        text: t("commandReplies.models", {
          models: modelOptions.map((model) => model.name).join(t("listSeparator")),
        }),
      };
    }

    return {
      action: "append",
      text: t("commandReplies.unknown", { command: `/${command}` }),
    };
  };

  const handleSubmit = (payload: { attachments: GlobalChatAttachment[]; html: string; text: string }) => {
    if (isExecuting) return;

    const trimmedText = payload.text.trim();
    if (!trimmedText && payload.attachments.length === 0) return;

    const attachmentText = payload.attachments
      .map((attachment) => `@${attachment.id}${attachment.kind === "image" ? "temp" : "file"}`)
      .join(" ");
    const userText = [trimmedText, attachmentText].filter(Boolean).join(" ") || t("attachmentOnly");
    const commandResult = resolveCommand(trimmedText);

    if (commandResult?.action === "clear") {
      setMessages([
        createAssistantMessage(t("commandReplies.cleared")),
      ]);
      return;
    }

    setMessages((currentMessages) => [
      ...currentMessages,
      createUserMessage(userText),
      ...(commandResult ? [createAssistantMessage(commandResult.text)] : []),
    ]);

    if (!commandResult) {
      void executeAgentCommand(userText);
    }
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]" />
        <Dialog.Content
          className={cn(
            "fixed right-0 top-0 z-50 flex h-dvh w-[min(92vw,460px)] flex-col border-l border-border bg-card text-card-foreground shadow-2xl outline-none",
            "data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:animate-in data-[state=open]:slide-in-from-right",
          )}
        >
          <div className="flex h-16 shrink-0 items-center justify-between border-b border-border px-4">
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/15 p-0 text-primary">
                <AgentGlyph agent={selectedAgent} />
              </span>
              <div className="min-w-0">
                <Dialog.Title className="truncate text-sm font-semibold">{t("title")}</Dialog.Title>
                <p className="truncate text-xs text-muted-foreground">{t("subtitle")}</p>
              </div>
            </div>
            <Dialog.Close asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t("close")}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </Button>
            </Dialog.Close>
          </div>

          <div className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {messages.map((message) => (
                <article
                  key={message.id}
                  className={cn(
                    "max-w-[86%] whitespace-pre-line rounded-xl px-3 py-2 text-sm leading-6",
                    message.role === "user"
                      ? "ml-auto bg-primary text-primary-foreground"
                      : "mr-auto bg-secondary text-secondary-foreground",
                  )}
                  aria-label={message.role === "user" ? t("userMessage") : t("assistantMessage")}
                >
                  {message.process ? (
                    <details className="mb-2 rounded-md border border-border/60 bg-background/30 p-2 text-xs text-muted-foreground">
                      <summary className="cursor-pointer">{t("processSummary")}</summary>
                      <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap font-mono text-[11px] leading-5">
                        {message.process}
                      </pre>
                    </details>
                  ) : null}
                  {message.text ? (
                    message.text
                  ) : (
                    <span className="text-muted-foreground">{t("commandReplies.executing", { name: selectedAgent?.name ?? t("title") })}</span>
                  )}
                </article>
              ))}
            </div>

            <div className="shrink-0 border-t border-border bg-background/40 p-3">
              <GlobalChatComposer
                projectId={currentProject?.id ?? ""}
                placeholder={t("placeholder")}
                inputLabel={t("inputLabel")}
                addAttachmentLabel={canvasT("chatWindow.addAttachment")}
                attachmentFallbackLabel={(index) => canvasT("chatWindow.imageFallback", { index })}
                attachmentListLabel={canvasT("chatWindow.attachmentList")}
                removeAttachmentLabel={canvasT("chatWindow.removeAttachment")}
                sendLabel={t("send")}
                onSubmit={handleSubmit}
              />
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
