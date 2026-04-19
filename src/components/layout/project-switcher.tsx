"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Folder, ChevronDown, Check, Pencil } from "lucide-react";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getProjects, getProjectDetail, updateProject } from "@/lib/actions/canvas";
import { useProjectStore } from "@/lib/store/use-projects";
import { useChatStore } from "@/lib/store/use-chat";
import { Project } from "@/lib/types/project.types";
import { toast } from "sonner";
import {
  CanvasProjectFormFields,
  canvasDialogFooterGlass,
  normalizeAspectRatioId,
  normalizeResolutionId,
  type AspectRatioId,
  type ResolutionId,
} from "@/components/layout/canvas-project-form-fields";
import { cn } from "@/lib/utils/index";

export function ProjectSwitcher() {
  const t = useTranslations("header");
  const tCommon = useTranslations("common");
  const { currentProject, setCurrentProject, projects, setProjects } = useProjectStore();
  const isChatting = useChatStore((state) => state.isChatting);
  const [pendingProject, setPendingProject] = useState<Project | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [aspectRatio, setAspectRatio] = useState<AspectRatioId>("smart");
  const [resolution, setResolution] = useState<ResolutionId>("1080");
  const [style, setStyle] = useState("");
  const [saveLoading, setSaveLoading] = useState(false);

  useEffect(() => {
    if (!editOpen || !currentProject) {
      return;
    }
    let cancelled = false;
    void (async () => {
      const detail = await getProjectDetail(currentProject.id);
      if (cancelled) {
        return;
      }
      if (!detail) {
        setEditName(currentProject.name);
        setAspectRatio("smart");
        setResolution("1080");
        setStyle("");
        return;
      }
      setEditName(detail.name);
      setAspectRatio(normalizeAspectRatioId(detail.aspectRatio));
      setResolution(normalizeResolutionId(detail.resolution));
      setStyle(detail.style);
    })();
    return () => {
      cancelled = true;
    };
  }, [editOpen, currentProject]);

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

  const handleSaveCanvas = async () => {
    if (!currentProject || !editName.trim()) return;
    setSaveLoading(true);
    try {
      const result = await updateProject(currentProject.id, {
        name: editName.trim(),
        aspectRatio,
        resolution,
        style,
      });
      if (result.success) {
        const updated: Project = {
          ...currentProject,
          name: result.name,
          updatedAt: Date.now(),
        };
        setCurrentProject(updated);
        setProjects(projects.map((p) => (p.id === updated.id ? updated : p)));
        toast.success(t("renameSuccess"));
        setEditOpen(false);
      } else {
        toast.error(t("renameFailed"));
      }
    } catch {
      toast.error(t("renameFailed"));
    } finally {
      setSaveLoading(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-1 border-r pr-2 mr-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <div
              role="button"
              tabIndex={0}
              className={cn(
                "flex h-8 max-w-[min(100%,14rem)] cursor-pointer items-center gap-1 rounded-md px-2 text-sm outline-none",
                "hover:bg-accent hover:text-accent-foreground",
                "focus-visible:ring-2 focus-visible:ring-ring/50",
              )}
            >
              <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate text-left font-medium">
                {currentProject ? currentProject.name : t("switchProject")}
              </span>
              {currentProject ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex shrink-0 rounded-md p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setEditOpen(true);
                      }}
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      <span className="sr-only">{t("editProject")}</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{t("editProject")}</p>
                  </TooltipContent>
                </Tooltip>
              ) : null}
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            </div>
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

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="flex max-h-[80vh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-[560px]">
          <div className="shrink-0 space-y-2 px-4 pt-4 pr-12 pb-2">
            <DialogHeader>
              <DialogTitle>{t("editProjectTitle")}</DialogTitle>
              <DialogDescription>{t("editProjectDesc")}</DialogDescription>
            </DialogHeader>
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4">
            <CanvasProjectFormFields
              nameInputId="edit-canvas-name"
              name={editName}
              onNameChange={setEditName}
              aspectRatio={aspectRatio}
              onAspectRatioChange={setAspectRatio}
              resolution={resolution}
              onResolutionChange={setResolution}
              style={style}
              onStyleChange={setStyle}
              scrollAreaClassName="h-full max-h-full min-h-0 flex-1"
            />
          </div>
          <DialogFooter
            className={cn(
              "mx-0! mb-0! shrink-0 gap-2 rounded-none border-t sm:gap-0",
              canvasDialogFooterGlass,
            )}
          >
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saveLoading}>
              {t("cancel")}
            </Button>
            <Button onClick={handleSaveCanvas} disabled={!editName.trim() || saveLoading}>
              {saveLoading ? tCommon("saving") : tCommon("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
