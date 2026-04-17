"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createNewCanvas } from "@/lib/actions/canvas";
import { useProjectStore } from "@/lib/store/use-projects";
import { toast } from "sonner";
import {
  CanvasProjectFormFields,
  canvasDialogFooterGlass,
  type AspectRatioId,
  type ResolutionId,
} from "@/components/layout/canvas-project-form-fields";
import { cn } from "@/lib/utils/index";

export function NewProjectButton() {
  const tHeader = useTranslations("header");
  const tCommon = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [aspectRatio, setAspectRatio] = useState<AspectRatioId>("smart");
  const [resolution, setResolution] = useState<ResolutionId>("1080");
  const [style, setStyle] = useState("");
  const [loading, setLoading] = useState(false);

  const { addProject, setCurrentProject } = useProjectStore();

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      const result = await createNewCanvas(name, {
        aspectRatio,
        resolution,
        style,
      });
      if (result.success && result.id) {
        toast.success("Created successfully");
        setOpen(false);
        setName("");
        setAspectRatio("smart");
        setResolution("1080");
        setStyle("");

        const newProject = {
          id: result.id,
          name: result.name || name,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          resourcePath: `/projects/${result.id}`,
        };

        addProject(newProject);
        setCurrentProject(newProject);
      } else {
        toast.error("Failed to create");
      }
    } catch {
      toast.error("Failed to create");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Plus className="h-4 w-4 text-muted-foreground" />
              <span className="sr-only">{tHeader("newProject")}</span>
            </Button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent>
          <p>{tHeader("newProject")}</p>
        </TooltipContent>
      </Tooltip>

      <DialogContent className="flex max-h-[80vh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-[560px]">
        <div className="shrink-0 space-y-2 px-4 pt-4 pr-12 pb-2">
          <DialogHeader>
            <DialogTitle>{tCommon("newCanvasTitle")}</DialogTitle>
            <DialogDescription>{tCommon("newCanvasDesc")}</DialogDescription>
          </DialogHeader>
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4">
          <CanvasProjectFormFields
            nameInputId="new-canvas-name"
            name={name}
            onNameChange={setName}
            aspectRatio={aspectRatio}
            onAspectRatioChange={setAspectRatio}
            resolution={resolution}
            onResolutionChange={setResolution}
            style={style}
            onStyleChange={setStyle}
            scrollAreaClassName="h-full max-h-full min-h-0 flex-1"
            onNameKeyDown={(e) => {
              if (e.key === "Enter") {
                handleCreate();
              }
            }}
          />
        </div>
        <DialogFooter
          className={cn(
            "!mx-0 !mb-0 shrink-0 gap-2 rounded-none border-t sm:gap-0",
            canvasDialogFooterGlass,
          )}
        >
          <Button onClick={handleCreate} disabled={!name.trim() || loading}>
            {loading ? tCommon("creating") : tCommon("confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
