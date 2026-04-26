"use client";

import { create } from "zustand";

type LayoutState = {
  videoFooterOpen: boolean;
  closeVideoFooter: () => void;
  toggleVideoFooter: () => void;
};

export const useLayoutStore = create<LayoutState>((set) => ({
  videoFooterOpen: true,
  closeVideoFooter: () => set({ videoFooterOpen: false }),
  toggleVideoFooter: () => set((state) => ({ videoFooterOpen: !state.videoFooterOpen })),
}));
