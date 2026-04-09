"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useChatStore } from "@/lib/store/use-chat";
import { useProjectStore } from "@/lib/store/use-projects";
import { useFlowStore } from "@/lib/store/use-flow";
import { useAgent } from "@/lib/hooks/use-agent";
import { AgentManagerModal } from "./agent-manager-modal";
import { ChatInput } from "./chat-input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Minus, User, ArrowDownRight, ArrowDownLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { UploadedFile } from "./chat-upload";
import { useUpload } from "@/lib/hooks/use-upload";

import { useWidgetDragResize } from "./hooks/use-widget-drag-resize";
import { useCurrentSelection } from "./hooks/use-current-selection";
import { useChatEditor } from "./hooks/use-chat-editor";

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

  // 消息更新或展开时自动滚动到底部
  useEffect(() => {
    if (!isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isMinimized]);

  // 处理发送消息
  const handleSend = useCallback(async () => {
    if (!input.trim() && uploadedFiles.length === 0) return;
    if (!selectedAgentId) {
      toast.error(t("selectAgentPrompt"));
      return;
    }

    // 提取带有 @uuidtype 格式的输入文本
    const getTransformedInput = () => {
      if (!editor) return input;
      const doc = editor.getJSON();
      let result = "";

      const traverse = (node: any) => {
        if (node.type === "text") {
          result += node.text;
        } else if (node.type === "assetMention") {
          const { id, assetType } = node.attrs;
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

    if (currentSelection) {
      const selectedNodeIds = currentSelection.id;
      const prompt = t("selectedNodesPrompt", { id: selectedNodeIds });
      finalTransformedInput += (finalTransformedInput ? "\n" : "") + prompt;
    }

    let displayInput = input.trim() ? input : t("sentAttachment");
    if (currentSelection) {
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

      // 构建包含 skills 文件夹上下文的命令提示
      // 添加系统提示：强制让 opencode 主动寻找技能，而不是依赖用户提供确切文件夹名
      const idContext = currentProject
        ? t("selectedProjectIdContext", { id: currentProject.id })
        : "";

      const systemPrompt = `${t("systemPromptContext")}${idContext}`;

      const commandText = t("latestCommandContext", {
        systemPrompt,
        command: currentInputForCommand,
      });

      // 如果是 opencode，需要使用 run 子命令
      const agentCmd = agent.endpoint || agent.name;

      // 使用单引号包裹，并转义内部的单引号以防 shell 注入
      const safeCommandText = commandText.replace(/'/g, "'\"'\"'");
      // 如果对话框中没有聊天记录（即这是第一条消息），则不加 --continue
      const isFirstMessage = messages.length === 0;
      const continueArg = isFirstMessage ? "" : "--continue ";
      const cmdArgs =
        agentCmd.trim() === "opencode"
          ? `run ${continueArg}'${safeCommandText}'`
          : `'${safeCommandText}'`;

      // 先添加一条空的 agent 消息，并拿到 id
      const agentMsgId = addMessage({
        role: "agent",
        content: "...",
      });

      const result = await runCommand(agentCmd, cmdArgs, "", (chunk) => {
        // 每次收到流式输出，追加到消息内容中
        updateMessage(agentMsgId, (msg) => {
          if (msg.content === "...") {
            msg.content = chunk;
          } else {
            msg.content += chunk;
          }
        });
      });

      // 最终确保显示完整的结果
      updateMessage(agentMsgId, (msg) => {
        if (!result.stdout && !result.stderr && msg.content === "...") {
          msg.content = t("executionCompleteNoOutput");
        }
      });
    } catch (error: any) {
      if (error.name === "AbortError") return; // 忽略中断错误

      // 如果有 agentMsgId，说明已经在流式输出了，我们就在当前消息追加错误
      // 如果没有，或者流根本没启动，我们就新建一条消息
      addMessage({
        role: "agent",
        content: t("executionFailedMessage", { message: error.message || t("unknownError") }),
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

  // 最小化状态：仅显示圆形图标按钮
  if (isMinimized) {
    return (
      <>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  "fixed top-20 right-5 z-50 flex items-center justify-center bg-background border border-primary shadow-lg cursor-pointer hover:bg-muted/50 transition-colors w-14 h-14 rounded-full",
                  isExecuting && "shadow-primary/20",
                )}
                onClick={() => {
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

        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Messages Area */}
          {/* 使用 min-h-0 限制 flex 子元素高度，确保 ScrollArea 正常出现滚动条 */}
          <ScrollArea className="flex-1 min-h-0 bg-muted/10">
            <div className="space-y-5 p-4">
              {messages.map((msg) => {
                const isUser = msg.role === "user";
                return (
                  <div
                    key={msg.id}
                    className={cn("flex gap-3 text-sm", isUser ? "flex-row-reverse" : "flex-row")}
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
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      )}
                    </div>
                    <div
                      className={cn(
                        "px-4 py-2.5 max-w-[75%] min-w-0 whitespace-pre-wrap wrap-break-word leading-relaxed",
                        isUser ? "rounded-tr-sm" : "rounded-tl-sm text-foreground/90",
                      )}
                    >
                      {msg.content}
                    </div>
                  </div>
                );
              })}
              {isExecuting && (
                <div className="flex gap-3 text-sm flex-row">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm overflow-hidden bg-muted border border-border/50 text-muted-foreground">
                    {currentAgent?.icon ? (
                      <img
                        src={currentAgent.icon}
                        alt="agent"
                        className="w-full h-full object-cover"
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
          className="absolute bottom-0 right-0 w-5 h-5 cursor-se-resize flex items-end justify-end p-1 text-muted-foreground/50 hover:text-muted-foreground transition-colors z-50"
          onMouseDown={(e) => handleResizeMouseDown(e, "se")}
        >
          <ArrowDownRight className="w-4 h-4" />
        </div>

        {/* 调整大小手柄 (左下) */}
        <div
          className="absolute bottom-0 left-0 w-5 h-5 cursor-sw-resize flex items-end justify-start p-1 text-muted-foreground/50 hover:text-muted-foreground transition-colors z-50"
          onMouseDown={(e) => handleResizeMouseDown(e, "sw")}
        >
          <ArrowDownLeft className="w-4 h-4" />
        </div>
      </div>

      <AgentManagerModal />
    </>
  );
}
