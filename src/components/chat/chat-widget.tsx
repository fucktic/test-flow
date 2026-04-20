"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useChatStore } from "@/lib/store/use-chat";
import { useProjectStore } from "@/lib/store/use-projects";
import { useFlowStore } from "@/lib/store/use-flow";
import { useAgent } from "@/lib/hooks/use-agent";
import { AgentManagerModal } from "./agent-manager-modal";
import { ChatInput } from "./chat-input";
import { MessageContent } from "./message-content";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Minus, User, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { UploadedFile } from "./chat-upload";
import { useUpload } from "@/lib/hooks/use-upload";
import { getSkillFolders } from "@/lib/actions/canvas";

import { useWidgetDragResize } from "./hooks/use-widget-drag-resize";
import { useCurrentSelection } from "./hooks/use-current-selection";
import { useChatEditor } from "./hooks/use-chat-editor";
import { getAgentStreamKind, resolveAgentCommand } from "./utils/resolve-agent-command";
import {
  normalizeAgentStreamPreview,
  splitPlainAgentOutput,
} from "./utils/split-agent-plain-output";
import {
  extractCodexThreadIdFromStdout,
  parseCodexStdoutComplete,
} from "./utils/parse-codex-jsonl-stream";
const SELECTED_NODE_TYPES = [
  // 分镜视频节点
  "sceneVideoNode",
  // 资产item节点
  "assetItem",
  // 分镜图片节点
  "sceneImageNode",
];

const FIXED_SYSTEM_PROMPT_TEMPLATE =
  "[System Instruction] " +
  "Skills are located at {projectRoot}/skills/. Before responding, you must proactively run 'ls' to list all subdirectories under {projectRoot}/skills/, " +
  "read each subdirectory's SKILL.md (and related files), identify the best-matching skill for the user's intent, and execute it directly. " +
  "Never ask the user for a skill folder name. " +
  "All file reads and writes must be performed exclusively within {projectRoot}/projects/{projectId}/. Never create or modify files outside this directory. " +
  "Never generate any files inside the skills/ directory.";

export function ChatWidget() {
  const t = useTranslations("chat");
  const {
    isMinimized,
    position,
    size,
    agents,
    selectedAgentId,
    messages,
    setIsMinimized,
    setPosition,
    fetchAgents,
    setSelectedAgentId,
    setAgentModalOpen,
    addMessage,
    updateMessage,
    setIsChatting,
  } = useChatStore();

  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { runCommand, stopCommand, isExecuting } = useAgent();
  const currentProject = useProjectStore((state) => state.currentProject);
  const { uploadFiles } = useUpload();
  const { initFlow } = useFlowStore();

  const handleSendRef = useRef<(() => void) | null>(null);

  // 记录上一次发送消息时的项目和智能体，用于判断是否需要携带系统提示
  const lastSentProjectIdRef = useRef<string | null | undefined>(undefined);
  const lastSentAgentIdRef = useRef<string | null | undefined>(undefined);

  // hermes 会话 ID（从输出中解析，随 agent/project 切换而重置）
  const hermesSessionIdRef = useRef<string | null>(null);
  const hermesContextKeyRef = useRef<string | null>(null);

  // codex thread_id（用于 exec resume，随 agent/project 切换而重置）
  const codexSessionIdRef = useRef<string | null>(null);
  const codexContextKeyRef = useRef<string | null>(null);

  /** 非 Codex / Codex：流式期间完整原始输出，结束后一次性拆分 */
  const plainStreamAccumRef = useRef("");

  const currentAgent = agents.find((a) => a.id === selectedAgentId);

  // 定时刷新画布或在执行结束时刷新
  const prevIsExecutingRef = useRef(isExecuting);
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    const refreshCanvas = async () => {
      if (!currentProject?.id) return;
      try {
        const res = await fetch(`/api/projects/${currentProject.id}/flow`);
        if (!res.ok) return;
        const data = await res.json();
        if (data && data.nodes && data.edges) {
          initFlow(data.nodes, data.edges);

          // Clear modified nodes after merging when execution stops
          if (!isExecuting) {
            useFlowStore.getState().setModifiedNodesDuringChat(new Map());
          }
        }
      } catch (err) {
        console.error("Failed to refresh canvas:", err);
      }
    };

    if (isExecuting) {
      intervalId = setInterval(refreshCanvas, 30000);
    } else if (prevIsExecutingRef.current) {
      // 仅当从 true 变为 false 时刷新
      refreshCanvas();
    }

    prevIsExecutingRef.current = isExecuting;

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isExecuting, currentProject?.id, initFlow]);

  // 监听窗口关闭、刷新，如果执行中则拦截提示
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isExecuting) {
        e.preventDefault();
        e.returnValue = t("skillInProgressWarning");
        return t("skillInProgressWarning");
      }
    };

    if (isExecuting) {
      window.addEventListener("beforeunload", handleBeforeUnload);
    }

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isExecuting, t]);

  const { isDragging, handleMouseDown, handleResizeMouseDown, MARGIN } = useWidgetDragResize();

  const { allAssets, mentionItemsRef, currentSelection, currentSelectionRef } =
    useCurrentSelection(uploadedFiles);

  const { setNodes, setEdges } = useFlowStore();

  const handleClearSelection = useCallback(() => {
    setNodes((nodes) => nodes.map((n) => ({ ...n, selected: false })));
    setEdges((edges) => edges.map((e) => ({ ...e, selected: false })));
  }, [setNodes, setEdges]);

  const { editor, input, setInput } = useChatEditor({
    mentionItemsRef,
    currentSelectionRef,
    currentSelection,
    allAssets,
    handleSendRef,
  });

  useEffect(() => {
    handleSendRef.current = handleSend;
  });

  // Listen for external stop command (e.g. from project switcher)
  useEffect(() => {
    const handleExternalStop = () => {
      if (isExecuting) {
        stopCommand();
        setIsChatting(false);
      }
    };
    window.addEventListener("stop-chat-command", handleExternalStop);
    return () => {
      window.removeEventListener("stop-chat-command", handleExternalStop);
    };
  }, [isExecuting, stopCommand, setIsChatting]);

  // 初始化加载智能体列表
  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  /** 最小化时单行预览：取最后一条消息的 agent 过程/正文或用户输入 */
  const minimizedPreviewLine = useMemo(() => {
    if (messages.length === 0) return "";
    const last = messages[messages.length - 1]!;
    let raw = "";
    if (last.role === "agent") {
      const proc = (last.agentProcess || "").trim();
      const body = (last.content || "").trim();
      raw = proc || body;
    } else {
      raw = (last.content || "").trim();
    }
    if (!raw) return "";
    const oneLine = raw.replace(/\s+/g, " ").trim();
    return oneLine.length > 140 ? `${oneLine.slice(0, 137)}…` : oneLine;
  }, [messages]);

  // 消息更新、执行中或展开时自动滚动到底部
  useEffect(() => {
    if (isMinimized) return;
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({
        behavior: isExecuting ? "auto" : "smooth",
      });
    });
  }, [messages, isMinimized, isExecuting]);

  // 处理发送消息
  const handleSend = useCallback(async () => {
    const textSnapshot = editor ? editor.getText().trim() : input.trim();
    if (!textSnapshot && uploadedFiles.length === 0) return;
    if (!selectedAgentId) {
      toast.error(t("selectAgentPrompt"));
      return;
    }

    // 提取带有 @uuidtype 格式的输入文本
    const getTransformedInput = () => {
      if (!editor) return input;
      const doc = editor.getJSON();
      let result = "";

      interface EditorNode {
        type?: string;
        text?: string;
        attrs?: Record<string, string>;
        content?: EditorNode[];
      }

      const traverse = (node: EditorNode) => {
        if (node.type === "text") {
          result += node.text ?? "";
        } else if (node.type === "assetMention") {
          const id = node.attrs?.id ?? "";
          const assetType = node.attrs?.assetType ?? "";
          if (assetType === "props" || assetType === "scene" || assetType === "storyboard") {
            result += `@${id}props`;
          } else {
            const suffix = ["image", "file", "temp"].includes(assetType) ? "temp" : assetType;
            result += `@${id}${suffix}`;
          }
        } else if (node.content) {
          node.content.forEach(traverse);
        }

        if (node.type === "paragraph") {
          result += "\n";
        }
      };

      if (doc.content) {
        doc.content.forEach(traverse);
      }

      return result.replace(/\n+$/, "").trim();
    };

    const transformedInput = getTransformedInput();
    let finalTransformedInput = transformedInput;

    // 追加未在文本中@的临时文件
    uploadedFiles.forEach((f) => {
      const token = `@${f.id}temp`;
      if (!finalTransformedInput.includes(token)) {
        finalTransformedInput += (finalTransformedInput ? " " : "") + token;
      }
    });

    if (currentSelection && SELECTED_NODE_TYPES.includes(currentSelection.type)) {
      const selectedNodeIds = currentSelection.id;
      const prompt = t("selectedNodesPrompt", { id: selectedNodeIds });
      finalTransformedInput += (finalTransformedInput ? "\n" : "") + prompt;
    }

    const plainForDisplay = editor ? editor.getText().trim() : input.trim();
    let displayInput = plainForDisplay ? (editor ? editor.getText() : input) : t("sentAttachment");
    if (currentSelection && SELECTED_NODE_TYPES.includes(currentSelection.type)) {
      displayInput = `${t("onlyModifyNodePrefix", { title: currentSelection.title })}\n${displayInput}`;
    }

    const currentInputForCommand = finalTransformedInput || t("sentAttachment");

    addMessage({ role: "user", content: displayInput });
    setInput("");
    editor?.commands.clearContent();

    const agent = currentAgent;
    if (!agent) return;

    setIsChatting(true); // 开始聊天，暂停自动保存

    const files = uploadedFiles;
    setUploadedFiles([]);

    // 上传文件到 temp 文件夹
    try {
      if (files.length > 0) {
        if (!currentProject) {
          toast.error(t("selectProjectToUpload"));
          return;
        }

        try {
          const filesToUpload = files.map((f) => ({ id: f.id, file: f.file }));
          await uploadFiles(filesToUpload, currentProject.id);
        } catch (err: any) {
          toast.error(t("uploadFailedMessage", { message: err.message }));
          return; // 终止发送
        }
      }

      // 仅在项目或智能体切换后的第一条消息时携带系统提示
      const currentProjectId = currentProject?.id ?? null;
      const isContextSwitched =
        lastSentProjectIdRef.current === undefined ||
        lastSentProjectIdRef.current !== currentProjectId ||
        lastSentAgentIdRef.current !== selectedAgentId;

      const idContext = currentProject
        ? `\nCurrent selected project ID is: ${currentProject.id}.`
        : "";
      const projectRootPlaceholder = "{{PROJECT_ROOT}}";
      const projectIdValue = currentProject?.id ?? "";

      let commandText: string;
      if (isContextSwitched) {
        const systemPrompt = FIXED_SYSTEM_PROMPT_TEMPLATE.replaceAll(
          "{projectRoot}",
          projectRootPlaceholder,
        ).replaceAll("{projectId}", projectIdValue);
        commandText = `${systemPrompt}${idContext}\n[Latest Command]\nUser: ${currentInputForCommand}`;
      } else {
        commandText = `${idContext}\n[Latest Command]\nUser: ${currentInputForCommand}`;
      }

      const normalizedAgentCmd = (agent.endpoint || agent.name || "").trim().toLowerCase();
      const isHermesAgent = normalizedAgentCmd.includes("hermes");
      const streamKind = getAgentStreamKind(agent);
      const isCodexAgent = streamKind === "codex";

      // hermes 使用自身的 session ID，切换 agent 或项目时重置
      const hermesContextKey = `${selectedAgentId}:${currentProject?.id}`;
      if (isHermesAgent && hermesContextKeyRef.current !== hermesContextKey) {
        hermesSessionIdRef.current = null;
        hermesContextKeyRef.current = hermesContextKey;
      }

      // codex 使用 CLI 返回的 thread_id，切换 agent 或项目时重置
      const codexContextKey = `${selectedAgentId}:${currentProject?.id}`;
      if (isCodexAgent && codexContextKeyRef.current !== codexContextKey) {
        codexSessionIdRef.current = null;
        codexContextKeyRef.current = codexContextKey;
      }

      const { executable, args } = resolveAgentCommand(agent, commandText, {
        isFirstMessage: messages.length === 0,
        sessionId: isHermesAgent
          ? (hermesSessionIdRef.current ?? undefined)
          : isCodexAgent
            ? (codexSessionIdRef.current ?? undefined)
            : currentProject?.id,
      });

      // 记录本次发送时的项目和智能体，后续消息不再携带系统提示
      lastSentProjectIdRef.current = currentProjectId;
      lastSentAgentIdRef.current = selectedAgentId;

      // 先添加一条空的 agent 消息，并拿到 id
      const agentMsgId = addMessage({
        role: "agent",
        content: "",
      });

      plainStreamAccumRef.current = "";

      const result = await runCommand(executable, args, "", (chunk) => {
        plainStreamAccumRef.current += chunk;
        const preview = normalizeAgentStreamPreview(plainStreamAccumRef.current);
        updateMessage(agentMsgId, (msg) => {
          msg.agentProcess = preview || undefined;
          msg.content = "";
        });
      });

      if (isCodexAgent) {
        const parsed = parseCodexStdoutComplete(result.stdout);
        const ft = parsed.final.trim();
        updateMessage(agentMsgId, (msg) => {
          msg.agentProcess = parsed.process || undefined;
          msg.content = ft || t("executionCompleteNoOutput");
        });
        const tid = parsed.threadId ?? extractCodexThreadIdFromStdout(result.stdout);
        if (tid) {
          codexSessionIdRef.current = tid;
        }
      } else {
        const { final, process } = splitPlainAgentOutput(streamKind, result.stdout);
        updateMessage(agentMsgId, (msg) => {
          msg.agentProcess = process || undefined;
          const ft = final.trim();
          if (ft) {
            msg.content = ft;
          } else if (!msg.content.trim()) {
            msg.content = t("executionCompleteNoOutput");
          }
        });
      }

      // 从 hermes 输出中提取 session ID，用于后续对话恢复
      if (isHermesAgent && result.stdout) {
        const sessionMatch =
          result.stdout.match(/--?-?resume\s+(\S+)/) ||
          result.stdout.match(/Session:\s+(\S+)\s+Duration:/);
        if (sessionMatch?.[1]) {
          hermesSessionIdRef.current = sessionMatch[1];
        }
      }

      // 最终确保显示完整的结果
      updateMessage(agentMsgId, (msg) => {
        if (!result.stdout && !result.stderr && !msg.content.trim()) {
          msg.content = t("executionCompleteNoOutput");
        }
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return; // 忽略中断错误

      const message = error instanceof Error ? error.message : t("unknownError");
      addMessage({
        role: "agent",
        content: t("executionFailedMessage", { message }),
      });
    } finally {
      setIsChatting(false); // 聊天结束，恢复状态
    }
  }, [
    input,
    isExecuting,
    selectedAgentId,
    t,
    addMessage,
    editor,
    currentAgent,
    messages.length,
    runCommand,
    updateMessage,
    uploadedFiles,
    currentProject,
    uploadFiles,
    setInput,
  ]);

  // 如果未初始化完成位置，先不渲染以防闪烁
  if (position.x === -1) return null;

  // 最小化状态：一行预览 + 圆形图标按钮
  if (isMinimized) {
    const showMinimizedStrip = messages.length > 0 || isExecuting;
    return (
      <>
        <TooltipProvider>
          <div className="fixed top-20 right-5 z-50 flex max-w-[min(92vw,280px)] flex-col items-end gap-1.5">
            {showMinimizedStrip ? (
              <div
                className="w-full min-h-[1.35rem] rounded-lg border border-border/50 bg-background/95 px-2.5 py-1 text-[11px] leading-snug text-muted-foreground shadow-sm truncate"
                title={minimizedPreviewLine || undefined}
              >
                {minimizedPreviewLine || (isExecuting ? "…" : "\u00a0")}
              </div>
            ) : null}
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className={cn(
                    "flex items-center justify-center bg-background border border-primary shadow-lg cursor-pointer hover:bg-muted/50 transition-colors w-14 h-14 rounded-full shrink-0",
                    isExecuting && "shadow-primary/20",
                  )}
                  onClick={async () => {
                    // 如果没有选中项目，弹出提示窗口并阻止展开
                    if (!currentProject) {
                      toast.error(t("noProjectSelectedPrompt"));
                      return;
                    }

                    // 如果没有读到skills文件（文件夹），弹出提示窗口并阻止展开
                    const skills = await getSkillFolders();
                    if (!skills || skills.length === 0) {
                      toast.error(t("noSkillsPrompt"));
                      return;
                    }

                    let newX = position.x;

                    // 首次展开或判断到右边框的距离是否小于对话框宽度，如果是，则向左平移
                    if (position.x === -1 || position.x + size.width > window.innerWidth - MARGIN) {
                      newX = Math.max(MARGIN, window.innerWidth - size.width - MARGIN);
                    }

                    if (newX !== position.x) {
                      setPosition(newX, position.y);
                    }

                    setIsMinimized(false);
                  }}
                >
                  <div className="relative flex items-center justify-center w-full h-full">
                    {isExecuting && (
                      <>
                        <div className="absolute inset-0 border-2 border-primary/20 rounded-full z-0" />
                        <div
                          className="absolute inset-0 animate-spin z-0"
                          style={{ animationDuration: "2s" }}
                        >
                          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-primary rounded-full shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
                        </div>
                      </>
                    )}
                    <img
                      src="/mantur-logo.svg"
                      className="w-8 select-none pointer-events-none relative z-10"
                      style={{
                        objectFit: "contain",
                      }}
                    />
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent side="left">
                <p>{t("chatWithAgent")}</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
        <AgentManagerModal />
      </>
    );
  }

  // 展开状态
  return (
    <>
      <div
        className={cn(
          "fixed z-50 flex flex-col bg-background/95 backdrop-blur-xl border border-border/50 rounded-2xl shadow-2xl overflow-hidden transition-opacity",
          isDragging ? "opacity-90" : "opacity-100",
        )}
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          width: `${size.width}px`,
          height: `${size.height}px`,
          maxHeight: "100vh",
        }}
      >
        {/* Header (Draggable) */}
        <div
          className="flex items-center justify-between px-4 py-3 bg-linear-to-r from-indigo-500/10 to-purple-500/10 border-b cursor-grab active:cursor-grabbing"
          onMouseDown={handleMouseDown}
        >
          <div className="flex items-center gap-2 font-semibold text-sm select-none text-foreground/90">
            <div className="w-8 h-8 bg-primary/10 rounded-full text-primary relative flex items-center justify-center">
              {isExecuting && (
                <>
                  <div className="absolute inset-0 border-[1.5px] border-primary/20 rounded-full z-0" />
                  <div
                    className="absolute inset-0 animate-spin z-0"
                    style={{ animationDuration: "2s" }}
                  >
                    <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-primary rounded-full shadow-[0_0_6px_rgba(59,130,246,0.8)]" />
                  </div>
                </>
              )}
              <img
                src="/mantur-logo.svg"
                className="w-5 select-none pointer-events-none relative z-10"
                style={{ objectFit: "contain" }}
              />
            </div>
            {t("title")}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="w-7 h-7 rounded-full hover:bg-background/50"
            onClick={() => setIsMinimized(true)}
            title={t("minimize")}
          >
            <Minus className="w-4 h-4 text-muted-foreground" />
          </Button>
        </div>

        <div className="flex flex-col flex-1 overflow-hidden w-full">
          {/* Messages Area */}
          {/* 使用 min-h-0 限制 flex 子元素高度，确保 ScrollArea 正常出现滚动条 */}
          <ScrollArea className="flex-1 min-h-0 bg-muted/10 w-full">
            <div className="space-y-5 p-4 w-full overflow-x-hidden">
              {messages.map((msg) => {
                const isUser = msg.role === "user";
                return (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex w-full gap-3 text-sm",
                      isUser ? "flex-row-reverse" : "flex-row",
                    )}
                  >
                    <div
                      className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm overflow-hidden",
                        isUser
                          ? "bg-primary/10 text-primary"
                          : "bg-muted border border-border/50 text-muted-foreground",
                      )}
                    >
                      {isUser ? (
                        <User className="w-4 h-4" />
                      ) : (
                        <img
                          src={"/mantur-logo.svg"}
                          alt={"mantur-logo"}
                          className="w-4 h-4 object-cover"
                          loading="lazy"
                        />
                      )}
                    </div>
                    <div
                      className={cn(
                        "px-4 py-2.5 max-w-[75%] min-w-0 overflow-hidden text-sm",
                        isUser
                          ? "rounded-tr-sm bg-primary/10 rounded-2xl"
                          : "rounded-tl-sm text-foreground/90",
                      )}
                    >
                      <MessageContent
                        content={msg.content}
                        isUser={isUser}
                        allAssets={allAssets}
                        agentProcess={!isUser ? msg.agentProcess : undefined}
                      />
                    </div>
                  </div>
                );
              })}
              {isExecuting && (
                <div className="flex w-full gap-3 text-sm flex-row">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm overflow-hidden bg-muted border border-border/50 text-muted-foreground">
                    {currentAgent?.icon ? (
                      <img
                        src={currentAgent.icon}
                        alt="agent"
                        className="w-4 h-4 object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <img src={"/mantur-logo.svg"} className="w-4 h-4 animate-spin" />
                    )}
                  </div>
                  <div className="px-4 py-2.5 rounded-2xl w-[75%]   rounded-tl-sm text-foreground/90 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" />
                    <span
                      className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce"
                      style={{ animationDelay: "150ms" }}
                    />
                    <span
                      className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce"
                      style={{ animationDelay: "300ms" }}
                    />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} className="h-1" />
            </div>
          </ScrollArea>

          {/* Input Area */}
          <div className="flex flex-col bg-background relative z-10  shadow-[0_-4px_10px_-5px_rgba(0,0,0,0.05)]">
            <ChatInput
              editor={editor}
              input={input}
              isExecuting={isExecuting}
              selectedAgentId={selectedAgentId}
              agents={agents}
              currentAgent={currentAgent}
              uploadedFiles={uploadedFiles}
              setUploadedFiles={setUploadedFiles}
              setSelectedAgentId={setSelectedAgentId}
              setAgentModalOpen={setAgentModalOpen}
              onSend={handleSend}
              onStop={stopCommand}
              currentSelection={currentSelection}
              onClearSelection={handleClearSelection}
            />
          </div>
        </div>

        {/* 调整大小手柄 (右下) */}
        <div
          className="absolute bottom-0 right-0 w-6 h-6 cursor-se-resize flex items-end justify-end p-1 text-muted-foreground/50 hover:text-muted-foreground transition-colors z-50"
          onMouseDown={(e) => handleResizeMouseDown(e, "se")}
        >
          <ChevronDown className="size-5 -rotate-45" />
        </div>

        {/* 调整大小手柄 (左下) */}
        <div
          className="absolute bottom-0 left-0 w-6 h-6 cursor-sw-resize flex items-end justify-start p-1 text-muted-foreground/50 hover:text-muted-foreground transition-colors z-50"
          onMouseDown={(e) => handleResizeMouseDown(e, "sw")}
        >
          <ChevronDown className="size-5 rotate-45" />
        </div>
      </div>

      <AgentManagerModal />
    </>
  );
}
