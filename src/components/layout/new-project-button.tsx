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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createNewCanvas } from "@/lib/actions/canvas";
import { useProjectStore } from "@/lib/store/use-projects";
import { toast } from "sonner";

export function NewProjectButton() {
  const tHeader = useTranslations("header");
  const tCommon = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const { addProject, setCurrentProject } = useProjectStore();

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      const result = await createNewCanvas(name);
      if (result.success && result.id) {
        toast.success("Created successfully");
        setOpen(false);
        setName("");

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

      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{tCommon("newCanvasTitle")}</DialogTitle>
          <DialogDescription>{tCommon("newCanvasDesc")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              {tCommon("canvasNameLabel")}
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={tCommon("canvasNamePlaceholder")}
              className="col-span-3"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleCreate();
                }
              }}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            {tCommon("cancel")}
          </Button>
          <Button onClick={handleCreate} disabled={!name.trim() || loading}>
            {loading ? tCommon("creating") : tCommon("confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
