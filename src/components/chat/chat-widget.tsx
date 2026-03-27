"use client";

import { useEffect, useRef, useState, MouseEvent as ReactMouseEvent } from "react";
import { useTranslations } from "next-intl";
import { useChatStore } from "@/lib/store/use-chat";
import { useProjectStore } from "@/lib/store/use-projects";
import { useAgent } from "@/lib/hooks/use-agent";
import { AgentManagerModal } from "./agent-manager-modal";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectSeparator,
} from "@/components/ui/select";
import { Minus, Settings, Send, User, Sparkles, Orbit, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function ChatWidget() {
  const t = useTranslations("chat");
  const {
    isMinimized,
    position,
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
  } = useChatStore();

  const [input, setInput] = useState("");
  const dragRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [hasMoved, setHasMoved] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { runCommand, isExecuting } = useAgent();

  // 初始化加载智能体列表
  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  // 默认右上方位置初始化
  useEffect(() => {
    if (position.x === -1) {
      setPosition(window.innerWidth - 340, 80);
    }
  }, [position.x, setPosition]);

  // 消息更新或展开时自动滚动到底部
  useEffect(() => {
    if (!isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isMinimized]);

  // 处理拖拽开始
  const handleMouseDown = (e: ReactMouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button, input, select, textarea")) return;
    setIsDragging(true);
    setHasMoved(false);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  // 处理拖拽过程
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      setHasMoved(true);
      let newX = e.clientX - dragOffset.x;
      let newY = e.clientY - dragOffset.y;

      const width = isMinimized ? 56 : 320; // 56 = w-14, 320 = w-80
      const height = isMinimized ? 56 : 600;

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
  }, [isDragging, dragOffset, setPosition, isMinimized]);

  // 处理发送消息
  const handleSend = async () => {
    if (!input.trim() || isExecuting) return;
    if (!selectedAgentId) {
      toast.error(t("selectAgentPrompt"));
      return;
    }

    const currentInput = input;
    addMessage({ role: "user", content: currentInput });
    setInput("");

    const agent = agents.find((a) => a.id === selectedAgentId);
    if (!agent) return;

    try {
      // 构建包含 skills 文件夹上下文的命令提示
      // 添加系统提示：强制让 opencode 主动寻找技能，而不是依赖用户提供确切文件夹名
      const currentProject = useProjectStore.getState().currentProject;
      const projectIdContext = currentProject ? `\n当前选中的项目ID为: ${currentProject.id}。` : "";

      const systemPrompt = `【系统指令】你当前所在的目录为项目根目录，包含 projects 和 skills 文件夹。技能存放在 skills/ 目录下。在回答用户之前，请务必主动使用 ls 查看 skills/ 下的所有子目录，并读取各个子目录中的 SKILL.md 或相关文件来匹配用户的意图。请自行找到最匹配的技能并执行，绝对不要要求用户提供具体的技能文件夹名！在读写项目文件时，请直接访问根目录下的 projects/ 文件夹，不要在 skills/ 目录下新建 projects 文件夹！注意：任何 skill 生成节点时，必须先生成 episode-node 节点（需包含标题、核心情节点、情绪节奏、主要角色等核心字段，具体参考 skills/episode-plan/SKILL.md 第22行及相关定义）。${projectIdContext}\n`;

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
  };

  // 如果未初始化完成位置，先不渲染以防闪烁
  if (position.x === -1) return null;

  // 最小化状态：仅显示圆形图标按钮
  if (isMinimized) {
    return (
      <>
        <div
          className={cn(
            "fixed z-50 flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-xl cursor-grab active:cursor-grabbing hover:shadow-2xl transition-shadow",
            isDragging && "opacity-90",
          )}
          style={{ left: `${position.x}px`, top: `${position.y}px` }}
          onMouseDown={handleMouseDown}
          onClick={() => {
            // 如果只是点击而没有拖拽，则展开面板
            if (!hasMoved) setIsMinimized(false);
          }}
          title={t("maximize")}
        >
          <Orbit className="w-7 h-7" />
        </div>
        <AgentManagerModal />
      </>
    );
  }

  // 展开状态
  return (
    <>
      <div
        ref={dragRef}
        className={cn(
          "fixed z-50 flex flex-col w-200 h-150 bg-background/95 backdrop-blur-xl border border-border/50 rounded-2xl shadow-2xl overflow-hidden",
          isDragging ? "opacity-90" : "opacity-100",
        )}
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          // 移除位置相关的 CSS transition 保证拖拽完全跟随鼠标
        }}
      >
        {/* Header (Draggable) */}
        <div
          className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border-b cursor-grab active:cursor-grabbing"
          onMouseDown={handleMouseDown}
        >
          <div className="flex items-center gap-2 font-semibold text-sm select-none text-foreground/90">
            <div className="p-1.5 bg-primary/10 rounded-md text-primary">
              <Sparkles className="w-4 h-4" />
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
                const agent = !isUser ? agents.find((a) => a.id === selectedAgentId) : null;
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
                      ) : agent?.icon ? (
                        <img
                          src={agent.icon}
                          alt={agent.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <Orbit className="w-4 h-4" />
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
                    {agents.find((a) => a.id === selectedAgentId)?.icon ? (
                      <img
                        src={agents.find((a) => a.id === selectedAgentId)?.icon}
                        alt="agent"
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <Orbit className="w-4 h-4 animate-spin" />
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
          <div className="p-3 border-t bg-background/80 backdrop-blur-sm">
            <div className="bg-muted/30 p-2 rounded-xl border border-border/50 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 transition-all flex flex-col gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={t("inputPlaceholder")}
                className="w-full h-20  resize-none border-0 bg-transparent focus-visible:ring-0 p-1 text-sm"
              />

              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 max-w-40">
                  <Select
                    value={selectedAgentId || ""}
                    onValueChange={(val) => {
                      if (val === "manage_agents_action") {
                        setAgentModalOpen(true);
                        return;
                      }
                      setSelectedAgentId(val);
                    }}
                  >
                    <SelectTrigger className="w-full h-8 text-xs bg-background/50 border-muted-foreground/20 hover:bg-background/80 transition-colors">
                      <SelectValue placeholder={t("selectAgentPrompt")}>
                        {selectedAgentId && agents.find((a) => a.id === selectedAgentId) ? (
                          <div className="flex items-center gap-2">
                            {agents.find((a) => a.id === selectedAgentId)?.icon ? (
                              <img
                                src={agents.find((a) => a.id === selectedAgentId)?.icon}
                                alt="icon"
                                className="w-4 h-4 rounded-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <Orbit className="w-4 h-4" />
                            )}
                            <span className="truncate">
                              {agents.find((a) => a.id === selectedAgentId)?.name}
                            </span>
                          </div>
                        ) : (
                          t("selectAgentPrompt")
                        )}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {agents.length === 0 ? (
                        <div className="p-2 text-sm text-center text-muted-foreground">
                          {t("noAgentFound")}
                        </div>
                      ) : (
                        agents.map((agent) => (
                          <SelectItem
                            key={agent.id}
                            value={agent.id}
                            className="text-xs w-full pr-8"
                          >
                            <div className="flex items-center justify-between w-full">
                              <div className="flex items-center gap-2">
                                {agent.icon ? (
                                  <img
                                    src={agent.icon}
                                    alt={agent.name}
                                    className="w-4 h-4 rounded-full object-cover"
                                    loading="lazy"
                                  />
                                ) : (
                                  <div className="w-4 h-4 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[10px] font-bold">
                                    {agent.name.charAt(0).toUpperCase()}
                                  </div>
                                )}
                                {agent.name}
                              </div>
                              {agent.endpoint && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Info className="w-3.5 h-3.5 text-muted-foreground hover:text-primary cursor-help ml-2 shrink-0" />
                                    </TooltipTrigger>
                                    <TooltipContent side="right">
                                      <p className="text-xs font-mono">{agent.endpoint}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                            </div>
                          </SelectItem>
                        ))
                      )}
                      <SelectSeparator />
                      <SelectItem
                        value="manage_agents_action"
                        className="text-primary text-xs font-medium cursor-pointer flex items-center justify-center py-2"
                      >
                        <div className="flex items-center gap-2">
                          <Settings className="w-3.5 h-3.5" />
                          {t("manageAgents")}
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  size="icon"
                  className="w-8 h-8 shrink-0 rounded-lg bg-primary hover:bg-primary/90 shadow-sm transition-transform active:scale-95 disabled:opacity-50"
                  onClick={handleSend}
                  disabled={!input.trim() || !selectedAgentId || isExecuting}
                >
                  <Send className={cn("w-3.5 h-3.5", isExecuting && "animate-pulse")} />
                </Button>
              </div>
            </div>

            <div className="text-[10px] text-muted-foreground/60 text-center mt-2 font-medium">
              Press Enter to send, Shift + Enter for new line
            </div>
          </div>
        </div>
      </div>

      <AgentManagerModal />
    </>
  );
}
