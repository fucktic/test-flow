"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type AgentStore = {
  selectedAgentId: string;
  setSelectedAgentId: (id: string) => void;
};

export const useAgentStore = create<AgentStore>()(
  persist(
    (set) => ({
      selectedAgentId: "",
      setSelectedAgentId: (id) => set({ selectedAgentId: id }),
    }),
    {
      name: "agent-store",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
