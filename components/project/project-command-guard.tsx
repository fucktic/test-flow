"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { queueClearProjectCommands } from "@/lib/project-api";
import { useCanvasStore } from "@/store/use-canvas-store";

export function ProjectCommandGuard() {
  const t = useTranslations("Projects");
  const currentProject = useCanvasStore((state) => state.currentProject);
  const currentProjectIdRef = useRef<string | null>(null);

  useEffect(() => {
    currentProjectIdRef.current = currentProject?.id ?? null;
  }, [currentProject?.id]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!currentProjectIdRef.current) return;

      event.preventDefault();
      event.returnValue = t("commandDataLossConfirm");
    };

    const handlePageHide = () => {
      const projectId = currentProjectIdRef.current;
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
  }, [t]);

  return null;
}
