"use client";

import { Fragment, useState } from "react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { createNewCanvas, saveProjectEpisodes } from "@/lib/actions/canvas";
import { useProjectStore } from "@/lib/store/use-projects";
import { toast } from "sonner";
import {
  CanvasProjectFormFields,
  ScreenplayParsingOverlay,
  canvasDialogFooterGlass,
  type AspectRatioId,
  type ResolutionId,
  type ScreenplayDraft,
} from "@/components/layout/canvas-project-form-fields";
import { cn } from "@/lib/utils/index";
import { withMinDuration } from "@/lib/utils/async";
import { ScreenplayMarkdownPreview } from "@/components/layout/screenplay-markdown-preview";

export function NewProjectButton() {
  const tHeader = useTranslations("header");
  const tCommon = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [aspectRatio, setAspectRatio] = useState<AspectRatioId>("smart");
  const [resolution, setResolution] = useState<ResolutionId>("1080");
  const [style, setStyle] = useState("");
  const [loading, setLoading] = useState(false);
  const [parsingOpen, setParsingOpen] = useState(false);
  const [screenplayDrafts, setScreenplayDrafts] = useState<ScreenplayDraft[]>([]);
  const [scriptViewerOpen, setScriptViewerOpen] = useState(false);
  const [scriptViewerTitle, setScriptViewerTitle] = useState("");
  const [scriptViewerBody, setScriptViewerBody] = useState("");

  const { addProject, setCurrentProject } = useProjectStore();

  const openLocalScriptViewer = (fileName: string) => {
    const d = screenplayDrafts.find((x) => x.name === fileName);
    setScriptViewerTitle(fileName);
    setScriptViewerBody(d?.content ?? "");
    setScriptViewerOpen(true);
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    setParsingOpen(true);
    try {
      await withMinDuration(5000, async () => {
        const result = await createNewCanvas(name.trim(), {
          aspectRatio,
          resolution,
          style,
        });
        if (!result.success || !result.id) {
          throw new Error("create");
        }
        if (screenplayDrafts.length > 0) {
          const save = await saveProjectEpisodes(
            result.id,
            screenplayDrafts.map((d) => ({ name: d.name, content: d.content })),
          );
          if (!save.success) {
            throw new Error(save.error ?? "episodes");
          }
        }
        toast.success("Created successfully");
        setOpen(false);
        setName("");
        setAspectRatio("smart");
        setResolution("1080");
        setStyle("");
        setScreenplayDrafts([]);

        const newProject = {
          id: result.id,
          name: result.name || name.trim(),
          createdAt: Date.now(),
          updatedAt: Date.now(),
          resourcePath: `/projects/${result.id}`,
        };

        addProject(newProject);
        setCurrentProject(newProject);
      });
    } catch {
      toast.error("Failed to create");
    } finally {
      setParsingOpen(false);
      setLoading(false);
    }
  };

  return (
    <Fragment>
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
              screenplay={{
                mode: "create",
                drafts: screenplayDrafts,
                onDraftsChange: setScreenplayDrafts,
                onSuggestCanvasName: (title) => setName((n) => (n.trim() ? n : title)),
                onRequestViewScreenplay: openLocalScriptViewer,
              }}
            />
          </div>
          <DialogFooter
            className={cn(
              "mx-0! mb-0! shrink-0 gap-2 rounded-none border-t sm:gap-0",
              canvasDialogFooterGlass,
            )}
          >
            <Button onClick={handleCreate} disabled={!name.trim() || loading}>
              {loading ? tCommon("creating") : tCommon("confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ScreenplayParsingOverlay open={parsingOpen} message={tCommon("screenplayParsingOverlay")} />

      <Dialog open={scriptViewerOpen} onOpenChange={setScriptViewerOpen}>
        <DialogContent className="flex max-h-[92vh] w-[calc(100vw-2rem)] flex-col gap-3 overflow-hidden p-4 sm:max-w-2xl">
          <DialogHeader className="shrink-0 space-y-1 pr-8 text-left">
            <DialogTitle>{tCommon("screenplayViewerTitle")}</DialogTitle>
            <DialogDescription className="line-clamp-2 break-all sm:wrap-break-words">
              {scriptViewerTitle}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[min(60vh,520px)] w-full rounded-lg border border-border/60 bg-muted/30">
            <div className="p-3">
              <ScreenplayMarkdownPreview markdown={scriptViewerBody} className="text-[13px]" />
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </Fragment>
  );
}
