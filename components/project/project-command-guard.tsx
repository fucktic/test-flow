"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { queueClearProjectCommands } from "@/lib/project-api";
import { useCanvasStore } from "@/store/use-canvas-store";
import { useLayoutStore } from "@/store/use-layout-store";

export function ProjectCommandGuard() {
  const t = useTranslations("Projects");
  const currentProject = useCanvasStore((state) => state.currentProject);
  const resetSidebarLoading = useLayoutStore((state) => state.resetSidebarLoading);
  const currentProjectIdRef = useRef<string | null>(null);
  const previousProjectIdRef = useRef<string | null>(null);

  useEffect(() => {
    const nextProjectId = currentProject?.id ?? null;

    currentProjectIdRef.current = nextProjectId;
    if (previousProjectIdRef.current !== nextProjectId) {
      resetSidebarLoading();
      previousProjectIdRef.current = nextProjectId;
    }
  }, [currentProject?.id, resetSidebarLoading]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!currentProjectIdRef.current) return;

      event.preventDefault();
      event.returnValue = t("commandDataLossConfirm");
    };

    const handlePageHide = () => {
      const projectId = currentProjectIdRef.current;
      resetSidebarLoading();
      if (!projectId) return;

      // Browser unload cleanup has to be queued without awaiting the response.
      queueClearProjectCommands(projectId);
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [resetSidebarLoading, t]);

  return null;
}
