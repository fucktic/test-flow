import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { Project, Resource } from "../types/project.types";

interface ProjectState {
  currentProject: Project | null;
  projects: Project[];
  resources: Resource[];
  setCurrentProject: (project: Project) => void;
  createProject: (name: string) => void;
  addResource: (resource: Resource) => void;
}

export const useProjectStore = create<ProjectState>()(
  immer((set) => ({
    currentProject: null,
    projects: [],
    resources: [],

    setCurrentProject: (project) => {
      set((state) => {
        state.currentProject = project;
      });
    },

    createProject: (name) => {
      const newProject: Project = {
        id: crypto.randomUUID(),
        name,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        resourcePath: `/projects/${name.replace(/\s+/g, "-").toLowerCase()}`,
      };
      set((state) => {
        state.projects.push(newProject);
        state.currentProject = newProject;
      });
    },

    addResource: (resource) => {
      set((state) => {
        state.resources.push(resource);
      });
    },
  })),
);
