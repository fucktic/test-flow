"use client";

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
  MouseEvent as ReactMouseEvent,
} from "react";
import { useTranslations } from "next-intl";
import { useChatStore } from "@/lib/store/use-chat";
import { useProjectStore } from "@/lib/store/use-projects";
import { useFlowStore } from "@/lib/store/use-flow";
import { useAgent } from "@/lib/hooks/use-agent";
import { AgentManagerModal } from "./agent-manager-modal";
import { ChatInput } from "./chat-input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Minus, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useEditor, ReactRenderer } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import tippy, { Instance as TippyInstance } from "tippy.js";
import {
  AssetMention,
  MentionList,
} from "@/components/flow/nodes/scene-node/components/scene-edit-dialog";
import { UploadedFile } from "./chat-upload";

const MINIMIZED_SIZE = 56; // w-14/h-14 (14 * 4px = 56px)
const MARGIN = 20;

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
    setSize,
    fetchAgents,
    setSelectedAgentId,
    setAgentModalOpen,
    addMessage,
    updateMessage,
  } = useChatStore();

  const [input, setInput] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const dragInfoRef = useRef({ hasMoved: false, startX: 0, startY: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const resizeInfoRef = useRef({ startX: 0, startY: 0, startWidth: 0, startHeight: 0 });
  const [isResizing, setIsResizing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { runCommand, isExecuting } = useAgent();
  const currentProject = useProjectStore((state) => state.currentProject);
  const { initFlow } = useFlowStore();

  const handleSendRef = useRef<(() => void) | null>(null);

  const currentAgent = agents.find((a) => a.id === selectedAgentId);

  useEffect(() => {
    handleSendRef.current = handleSend;
  });

  const prevIsExecutingRef = useRef(isExecuting);

  const nodes = useFlowStore((state) => state.nodes);

  const allAssets = useMemo(() => {
    const assetNodes = nodes.filter((n) => n.type === "assetNode" || n.type === "asset-node");
    const list: any[] = [];
    assetNodes.forEach((n) => {
      const assetsData = n.data.assets as any;
      if (assetsData) {
        Object.keys(assetsData).forEach((cat) => {
          if (Array.isArray(assetsData[cat])) {
            list.push(...assetsData[cat].map((a: any) => ({ ...a, category: cat })));
          }
        });
      }
    });
    return list;
  }, [nodes]);

  const mentionItems = useMemo(() => {
    let imageIndex = 1;
    let fileIndex = 1;
    const fileItems = uploadedFiles.map((f) => {
      const isImage = f.type === "image";
      const name = isImage ? `图片${imageIndex++}` : `文件${fileIndex++}`;
      return {
        id: f.id,
        name,
        category: f.type,
        url: f.previewUrl || f.file.name,
      };
    });
    return [...allAssets, ...fileItems];
  }, [allAssets, uploadedFiles]);

  const mentionItemsRef = useRef(mentionItems);
  useEffect(() => {
    mentionItemsRef.current = mentionItems;
  }, [mentionItems]);

  // 定时刷新画布或在执行结束时刷新
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

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false,
      }),
      Placeholder.configure({
        placeholder: t("inputPlaceholder"),
      }),
      AssetMention.configure({
        HTMLAttributes: {
          class: "asset-mention",
        },
        suggestion: {
          char: "@",
          // 使用自定义的匹配逻辑，完全覆盖默认规则，支持任何字符后直接触发 @
          findSuggestionMatch: ({ char, $position }: any) => {
            const text = $position.nodeBefore?.isText && $position.nodeBefore.text;
            if (!text) return null;

            const escapedChar = char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            // 匹配文本末尾的 @ 及其后的非空白字符
            const regexp = new RegExp(`${escapedChar}([^\\s${escapedChar}]*)$`);
            const match = regexp.exec(text);

            if (!match) return null;

            const textFrom = $position.pos - text.length;
            const from = textFrom + match.index;
            const to = from + match[0].length;

            return {
              range: { from, to },
              query: match[1],
              text: match[0],
            };
          },
          items: ({ query }: { query: string }) => {
            const list = mentionItemsRef.current
              .filter((item) =>
                (item.name || "").toLowerCase().includes((query || "").toLowerCase()),
              )
              .sort((a, b) => {
                const typeA = a.category || a.type || "";
                const typeB = b.category || b.type || "";
                if (typeA !== typeB) {
                  return typeA.localeCompare(typeB);
                }
                return (a.name || "").localeCompare(b.name || "");
              })
              .slice(0, 10);
            return list;
          },
          render: () => {
            let component: any;
            let popup: TippyInstance<any>[];

            return {
              onStart: (props: any) => {
                component = new ReactRenderer(MentionList, {
                  props,
                  editor: props.editor,
                });

                if (!props.clientRect) {
                  return;
                }

                requestAnimationFrame(() => {
                  popup = tippy("body", {
                    getReferenceClientRect: props.clientRect,
                    appendTo: () => document.body,
                    content: component.element,
                    showOnCreate: true,
                    interactive: true,
                    trigger: "manual",
                    placement: "bottom-start",
                    zIndex: 99999,
                    allowHTML: true,
                    arrow: false,
                    offset: [0, 8],
                    theme: "asset-mention",
                  });
                });
              },
              onUpdate(props: any) {
                component?.updateProps(props);

                if (!props.clientRect) {
                  return;
                }

                requestAnimationFrame(() => {
                  popup?.[0]?.setProps({
                    getReferenceClientRect: props.clientRect,
                  });
                });
              },
              onKeyDown(props: any) {
                if (props.event.key === "Escape") {
                  popup?.[0]?.hide();
                  return true;
                }
                return component?.ref?.onKeyDown(props) || false;
              },
              onExit() {
                requestAnimationFrame(() => {
                  if (popup?.[0] && !popup[0].state.isDestroyed) {
                    popup[0].destroy();
                  }
                  component?.destroy();
                });
              },
            };
          },
        },
      }),
    ],
    content: input,
    onUpdate: ({ editor }) => {
      setInput(editor.getText());
    },
    editorProps: {
      attributes: {
        class:
          "w-full h-20 overflow-y-auto resize-none border-0 bg-transparent focus-visible:ring-0 p-1 text-sm outline-none",
      },
      handleKeyDown: (view, event) => {
        // 如果当前有提及下拉框正在显示，不触发发送消息逻辑
        // Tiptap 的 Mention 插件会在文档中插入一个特殊的类，但更稳妥的方式是
        // 检查是否有 popup 存在且可见，这里我们通过检查 DOM 中的 tippy 元素来判断
        const isMentionPopupVisible = document.querySelector(
          '.tippy-box[data-theme="asset-mention"]',
        );

        if (event.key === "Enter" && !event.shiftKey && !isMentionPopupVisible) {
          event.preventDefault();
          handleSendRef.current?.();
          return true;
        }
        return false;
      },
    },
  });

  // 初始化加载智能体列表
  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  // 组件挂载时设置初始位置
  useEffect(() => {
    if (position.x === -1) {
      // 初始化到右上角，但为了动画效果或者初始默认位置，依然计算一个合理的值
      setPosition(window.innerWidth - size.width - MARGIN, 80);
    }
  }, [position.x, setPosition, size.width]);

  // 消息更新或展开时自动滚动到底部
  useEffect(() => {
    if (!isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isMinimized]);

  // 处理拖拽开始
  const handleMouseDown = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      if ((e.target as HTMLElement).closest("button, input, select, textarea")) return;
      setIsDragging(true);
      dragInfoRef.current = { hasMoved: false, startX: e.clientX, startY: e.clientY };
      setDragOffset({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      });
    },
    [position.x, position.y],
  );

  // 处理调整大小开始
  const handleResizeMouseDown = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      e.stopPropagation(); // 阻止事件冒泡到拖拽逻辑
      setIsResizing(true);
      resizeInfoRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startWidth: size.width,
        startHeight: size.height,
      };
    },
    [size.width, size.height],
  );

  // 处理拖拽过程
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;

      if (!dragInfoRef.current.hasMoved) {
        if (
          Math.abs(e.clientX - dragInfoRef.current.startX) > 3 ||
          Math.abs(e.clientY - dragInfoRef.current.startY) > 3
        ) {
          dragInfoRef.current.hasMoved = true;
        } else {
          return;
        }
      }

      let newX = e.clientX - dragOffset.x;
      let newY = e.clientY - dragOffset.y;

      const width = isMinimized ? MINIMIZED_SIZE : size.width;
      const height = isMinimized ? MINIMIZED_SIZE : size.height;

      // 限制拖拽范围在屏幕内
      newX = Math.max(0, Math.min(window.innerWidth - width, newX));
      newY = Math.max(0, Math.min(window.innerHeight - height, newY));

      setPosition(newX, newY);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, dragOffset, setPosition, isMinimized, size]);

  // 处理调整大小过程
  useEffect(() => {
    const handleResizeMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const deltaX = e.clientX - resizeInfoRef.current.startX;
      const deltaY = e.clientY - resizeInfoRef.current.startY;

      let newWidth = resizeInfoRef.current.startWidth + deltaX;
      let newHeight = resizeInfoRef.current.startHeight + deltaY;

      // 限制宽高
      newWidth = Math.max(400, Math.min(800, newWidth));
      // 高度最大为画布高度（屏幕高度减去一定的边距，比如上下各留 MARGIN）
      const maxHeight = window.innerHeight - MARGIN * 2;
      newHeight = Math.max(500, Math.min(maxHeight, newHeight));

      setSize(newWidth, newHeight);
    };

    const handleResizeMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      window.addEventListener("mousemove", handleResizeMouseMove);
      window.addEventListener("mouseup", handleResizeMouseUp);
      // 可以在调整大小时禁用 body 的文本选择
      document.body.style.userSelect = "none";
    } else {
      document.body.style.userSelect = "";
    }

    return () => {
      window.removeEventListener("mousemove", handleResizeMouseMove);
      window.removeEventListener("mouseup", handleResizeMouseUp);
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSize]);

  // 处理发送消息
  const handleSend = useCallback(async () => {
    if (!input.trim()) return;
    if (!selectedAgentId) {
      toast.error(t("selectAgentPrompt"));
      return;
    }

    const currentInput = input;
    addMessage({ role: "user", content: currentInput });
    setInput("");
    editor?.commands.clearContent();

    const agent = currentAgent;
    if (!agent) return;

    try {
      // 构建包含 skills 文件夹上下文的命令提示
      // 添加系统提示：强制让 opencode 主动寻找技能，而不是依赖用户提供确切文件夹名
      const idContext = currentProject ? `\n当前选中的项目ID为: ${currentProject.id}。` : "";
      const systemPrompt = `【系统指令】你当前所在的目录为项目根目录，包含 projects 和 skills 文件夹。技能存放在 skills/ 目录下。在回答用户之前，请务必主动使用 ls 查看 skills/ 下的所有子目录，并读取各个子目录中的 SKILL.md 或相关文件来匹配用户的意图。请自行找到最匹配的技能并执行，绝对不要要求用户提供具体的技能文件夹名！在读写项目文件时，请直接访问根目录下的 projects/ 文件夹，不要在 skills/ 目录下新建 projects 文件夹！注意：任何 skill 生成节点时，必须先生成 episode-node 节点（需包含标题、核心情节点、情绪节奏、主要角色等核心字段，具体参考 skills/episode-plan/SKILL.md 第22行及相关定义）。${idContext}\n`;

      const commandText = `${systemPrompt}\n【最新指令】\nUser: ${currentInput}`;

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
          msg.content = "执行完成 (无输出)";
        }
      });
    } catch (error: any) {
      if (error.name === "AbortError") return; // 忽略中断错误

      // 如果有 agentMsgId，说明已经在流式输出了，我们就在当前消息追加错误
      // 如果没有，或者流根本没启动，我们就新建一条消息
      addMessage({
        role: "agent",
        content: `执行失败: ${error.message || "未知错误"}`,
      });
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
                <div className="relative">
                  <img
                    src="/mantur-logo.svg"
                    className={cn(
                      "w-8 select-none pointer-events-none relative z-10",
                      isExecuting && "animate-pulse",
                    )}
                    style={{ objectFit: "contain" }}
                  />
                  {isExecuting && (
                    <div className="absolute inset-0 bg-primary/20 blur-md rounded-full animate-ping z-0" />
                  )}
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
        }}
      >
        {/* Header (Draggable) */}
        <div
          className="flex items-center justify-between px-4 py-3 bg-linear-to-r from-indigo-500/10 to-purple-500/10 border-b cursor-grab active:cursor-grabbing"
          onMouseDown={handleMouseDown}
        >
          <div className="flex items-center gap-2 font-semibold text-sm select-none text-foreground/90">
            <div className="p-1.5 bg-primary/10 rounded-md text-primary relative">
              <img
                src="/mantur-logo.svg"
                className={cn(
                  "w-6 select-none pointer-events-none relative z-10",
                  isExecuting && "animate-pulse",
                )}
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
                        "px-4 py-2.5  max-w-[75%] whitespace-pre-wrap wrap-break-words leading-relaxed ",
                        isUser ? " rounded-tr-sm" : "rounded-tl-sm text-foreground/90",
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
          />
        </div>

        {/* 调整大小手柄 */}
        <div
          className="absolute bottom-0 right-0 w-5 h-5 cursor-se-resize flex items-end justify-end p-1 text-muted-foreground/50 hover:text-muted-foreground transition-colors z-50"
          onMouseDown={handleResizeMouseDown}
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M9 1L9 9L1 9"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>

      <AgentManagerModal />
    </>
  );
}
