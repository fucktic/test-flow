"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Folder, ChevronDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getProjects } from "@/lib/actions/canvas";
import { useProjectStore } from "@/lib/store/use-projects";
import { useChatStore } from "@/lib/store/use-chat";
import { Project } from "@/lib/types/project.types";

export function ProjectSwitcher() {
  const t = useTranslations("header");
  const { currentProject, setCurrentProject, projects, setProjects } = useProjectStore();
  const isChatting = useChatStore((state) => state.isChatting);
  const [pendingProject, setPendingProject] = useState<Project | null>(null);

  useEffect(() => {
    async function fetchProjects() {
      const projs = await getProjects();

      const formattedProjects: Project[] = projs.map((p) => ({
        id: p.id,
        name: p.name,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        resourcePath: `/projects/${p.id}`,
      }));

      setProjects(formattedProjects);

      // If no project is currently selected but we have projects, select the first one
      if (!useProjectStore.getState().currentProject && formattedProjects.length > 0) {
        let restored = false;
        if (typeof window !== "undefined") {
          const saved = localStorage.getItem("current-project");
          if (saved) {
            try {
              const parsed = JSON.parse(saved);
              const exists = formattedProjects.find((p) => p.id === parsed.id);
              if (exists) {
                setCurrentProject(exists);
                restored = true;
              }
            } catch {
              // ignore parse error
            }
          }
        }

        if (!restored) {
          setCurrentProject(formattedProjects[0]);
        }
      }
    }
    fetchProjects();
  }, [setCurrentProject, setProjects]);

  const handleSelectProject = (project: Project) => {
    if (project.id === currentProject?.id) return;

    if (isChatting) {
      setPendingProject(project);
    } else {
      setCurrentProject(project);
    }
  };

  const confirmSwitch = () => {
    if (pendingProject) {
      window.dispatchEvent(new CustomEvent("stop-chat-command"));
      setCurrentProject(pendingProject);
      setPendingProject(null);
    }
  };

  return (
    <>
      <div className="flex items-center gap-1 border-r pr-2 mr-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 gap-2 px-2 max-w-50">
              <Folder className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm font-medium truncate">
                {currentProject ? currentProject.name : t("switchProject")}
              </span>
              <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-50">
            {projects.length === 0 ? (
              <div className="p-2 text-sm text-muted-foreground text-center">No projects</div>
            ) : (
              projects.map((project) => (
                <DropdownMenuItem
                  key={project.id}
                  onClick={() => handleSelectProject(project)}
                  className="flex items-center justify-between cursor-pointer"
                >
                  <span className="truncate">{project.name}</span>
                  {currentProject?.id === project.id && <Check className="h-4 w-4 ml-2 shrink-0" />}
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={!!pendingProject} onOpenChange={(open) => !open && setPendingProject(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("switchProjectConfirmTitle")}</DialogTitle>
            <DialogDescription>{t("switchProjectConfirmDesc")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingProject(null)}>
              {t("cancel")}
            </Button>
            <Button variant="destructive" onClick={confirmSwitch}>
              {t("confirmSwitch")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
