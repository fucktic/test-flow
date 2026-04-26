"use client";

import { useEffect } from "react";
import { fetchCurrentProject, fetchProjectCommands, fetchProjects, updateCurrentProject } from "@/lib/project-api";
import { useCanvasStore } from "@/store/use-canvas-store";

export function ProjectBootstrap() {
  const clearCurrentProject = useCanvasStore((state) => state.clearCurrentProject);
  const setCommandStatuses = useCanvasStore((state) => state.setCommandStatuses);
  const setCurrentProject = useCanvasStore((state) => state.setCurrentProject);
  const setProjects = useCanvasStore((state) => state.setProjects);

  useEffect(() => {
    let active = true;

    const loadInitialProject = async () => {
      try {
        const projects = await fetchProjects();
        if (!active) return;

        setProjects(projects);

        const currentProject = await fetchCurrentProject();
        const selectedProject = projects.find((project) => project.id === currentProject?.id) ?? projects[0];

        if (!selectedProject) {
          clearCurrentProject();
          return;
        }

        const project = currentProject?.id === selectedProject.id
          ? currentProject
          : await updateCurrentProject(selectedProject.id);
        if (!active) return;

        setCurrentProject(project);
        const commands = await fetchProjectCommands(project.id).catch(() => ({}));
        if (active) setCommandStatuses(commands);
      } catch {
        clearCurrentProject();
      }
    };

    void loadInitialProject();

    return () => {
      active = false;
    };
  }, [clearCurrentProject, setCommandStatuses, setCurrentProject, setProjects]);

  return null;
}
