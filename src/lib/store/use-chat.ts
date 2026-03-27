import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { Agent } from "@/lib/types/agent.types";

// 聊天消息类型定义
export interface ChatMessage {
  id: string;
  role: "user" | "agent";
  content: string;
  timestamp: number;
}

// 聊天状态管理接口
interface ChatState {
  isMinimized: boolean; // 是否最小化
  position: { x: number; y: number }; // 悬浮窗位置
  agents: Agent[]; // 智能体列表
  selectedAgentId: string | null; // 当前选中的智能体
  messages: ChatMessage[]; // 聊天记录
  isAgentModalOpen: boolean; // 智能体管理弹窗是否打开
  isChatOpen: boolean; // 聊天窗口是否打开（目前不可关闭，仅为保留字段）
  size: { width: number; height: number }; // 悬浮窗尺寸

  // Actions
  setIsMinimized: (minimized: boolean) => void;
  setPosition: (x: number, y: number) => void;
  setAgents: (agents: Agent[]) => void;
  setSelectedAgentId: (id: string | null) => void;
  addMessage: (message: Omit<ChatMessage, "id" | "timestamp">) => string; // 返回生成的 id
  updateMessage: (id: string, updater: (msg: ChatMessage) => void) => void;
  clearMessages: () => void;
  setAgentModalOpen: (open: boolean) => void;
  fetchAgents: () => Promise<void>; // 获取智能体列表
  saveAgents: (agents: Agent[]) => Promise<void>; // 保存智能体列表
  setSize: (width: number, height: number) => void;
}

export const useChatStore = create<ChatState>()(
  immer((set, _get) => ({
    isMinimized: true,
    position: { x: -1, y: 80 }, // 使用 x: -1 作为未初始化的标记，用于渲染时计算右上方位置
    agents: [],
    selectedAgentId: null,
    messages: [],
    isAgentModalOpen: false,
    isChatOpen: true,
    size: { width: 400, height: 600 },

    setIsMinimized: (minimized) =>
      set((state) => {
        state.isMinimized = minimized;
      }),

    setPosition: (x, y) =>
      set((state) => {
        state.position = { x, y };
      }),

    setAgents: (agents) =>
      set((state) => {
        state.agents = agents;
      }),

    setSelectedAgentId: (id) =>
      set((state) => {
        state.selectedAgentId = id;
        if (id) {
          try {
            localStorage.setItem("selectedAgentId", id);
          } catch {
            // ignore
          }
        } else {
          try {
            localStorage.removeItem("selectedAgentId");
          } catch {
            // ignore
          }
        }
      }),

    addMessage: (msg) => {
      const id = crypto.randomUUID();
      set((state) => {
        state.messages.push({
          ...msg,
          id,
          timestamp: Date.now(),
        });
      });
      return id;
    },

    updateMessage: (id, updater) =>
      set((state) => {
        const message = state.messages.find((m) => m.id === id);
        if (message) {
          updater(message);
        }
      }),

    clearMessages: () =>
      set((state) => {
        state.messages = [];
      }),

    setAgentModalOpen: (open) =>
      set((state) => {
        state.isAgentModalOpen = open;
      }),

    fetchAgents: async () => {
      try {
        const res = await fetch("/api/agents/manage");
        if (res.ok) {
          const agents: Agent[] = await res.json();
          set((state) => {
            state.agents = agents;
            try {
              const savedId = localStorage.getItem("selectedAgentId");
              if (savedId && agents.some((a) => a.id === savedId)) {
                state.selectedAgentId = savedId;
              }

              const savedSize = localStorage.getItem("chatWidgetSize");
              if (savedSize) {
                const parsedSize = JSON.parse(savedSize);
                if (
                  parsedSize &&
                  typeof parsedSize.width === "number" &&
                  typeof parsedSize.height === "number"
                ) {
                  state.size = parsedSize;
                }
              }
            } catch {
              // ignore
            }
          });
        }
      } catch (error) {
        console.error("Failed to fetch agents", error);
      }
    },

    saveAgents: async (agents) => {
      try {
        const res = await fetch("/api/agents/manage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(agents),
        });
        if (res.ok) {
          set((state) => {
            state.agents = agents;
            if (state.selectedAgentId && !agents.find((a) => a.id === state.selectedAgentId)) {
              state.selectedAgentId = null;
            }
          });
        }
      } catch (error) {
        console.error("Failed to save agents", error);
      }
    },

    setSize: (width, height) =>
      set((state) => {
        state.size = { width, height };
        try {
          localStorage.setItem("chatWidgetSize", JSON.stringify({ width, height }));
        } catch {
          // ignore
        }
      }),
  })),
);
