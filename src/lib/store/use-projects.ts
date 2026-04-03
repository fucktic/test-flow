import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { v4 as uuidv4 } from "uuid";
import { Project, Resource } from "../types/project.types";

interface ProjectState {
  currentProject: Project | null;
  projects: Project[];
  resources: Resource[];
  setProjects: (projects: Project[]) => void;
  setCurrentProject: (project: Project) => void;
  addProject: (project: Project) => void;
  createProject: (name: string) => void;
  addResource: (resource: Resource) => void;
}

export const useProjectStore = create<ProjectState>()(
  immer((set) => ({
    currentProject: null,
    projects: [],
    resources: [],

    setProjects: (projects) => {
      set((state) => {
        state.projects = projects;
      });
    },

    setCurrentProject: (project) => {
      set((state) => {
        state.currentProject = project;
      });
      if (typeof window !== "undefined") {
        localStorage.setItem("current-project", JSON.stringify(project));
        // 同步到服务端，供 API 路由读取
        fetch("/api/projects/current", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: project.id }),
        }).catch((err) => console.error("Failed to sync current project to server:", err));
      }
    },

    addProject: (project) => {
      set((state) => {
        state.projects.push(project);
      });
    },

    createProject: (name) => {
      const newProject: Project = {
        id: uuidv4(),
        name,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        resourcePath: `/projects/${name.replace(/\s+/g, "-").toLowerCase()}`,
      };
      set((state) => {
        state.projects.push(newProject);
        state.currentProject = newProject;
      });
      if (typeof window !== "undefined") {
        localStorage.setItem("current-project", JSON.stringify(newProject));
        // 同步到服务端，供 API 路由读取
        fetch("/api/projects/current", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: newProject.id }),
        }).catch((err) => console.error("Failed to sync new project to server:", err));
      }
    },

    addResource: (resource) => {
      set((state) => {
        state.resources.push(resource);
      });
    },
  })),
);
