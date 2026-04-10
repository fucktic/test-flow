"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Import, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { uploadSkillFiles, getSkillFolders, deleteSkillFolder } from "@/lib/actions/canvas";
import { toast } from "sonner";

export function ImportSkillButton({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const t = useTranslations("common");
  const [open, setOpen] = useState(defaultOpen);
  const [uploading, setUploading] = useState(false);
  const [skills, setSkills] = useState<string[]>([]);
  const [loadingSkills, setLoadingSkills] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchSkills = async () => {
    setLoadingSkills(true);
    try {
      const folders = await getSkillFolders();
      setSkills(folders);
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingSkills(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchSkills();
    }
  }, [open]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const relativePath = file.webkitRelativePath || file.name;
        formData.append("files", file);
        formData.append("paths", relativePath);
      }

      const result = await uploadSkillFiles(formData);
      if (result.success) {
        toast.success(t("uploadSuccess"));
        await fetchSkills();
      } else {
        toast.error(t("uploadFailed"));
      }
    } catch (error) {
      console.error(error);
      toast.error(t("uploadFailed"));
    } finally {
      setUploading(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  };

  const handleDelete = async (name: string) => {
    try {
      const result = await deleteSkillFolder(name);
      if (result.success) {
        toast.success(t("deleteSuccess"));
        await fetchSkills();
      } else {
        toast.error(t("deleteFailed"));
      }
    } catch {
      toast.error(t("deleteFailed"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          className="h-8 gap-2 px-2 text-muted-foreground hover:text-foreground"
        >
          <Import className="h-4 w-4" />
          <span>Skills</span>
        </Button>
      </DialogTrigger>

      <DialogContent
        className="sm:max-w-[425px]"
        onInteractOutside={(e) => {
          if (defaultOpen && skills.length === 0) {
            e.preventDefault();
          }
        }}
        onEscapeKeyDown={(e) => {
          if (defaultOpen && skills.length === 0) {
            e.preventDefault();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>{t("skillsTitle")}</DialogTitle>
          <DialogDescription>{t("skillsDesc")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-4">
          <div className="flex justify-between items-center">
            <h4 className="text-sm font-medium">Skills List</h4>
            <input
              type="file"
              ref={inputRef}
              className="hidden"
              // @ts-expect-error webkitdirectory is a non-standard attribute but widely supported
              webkitdirectory="true"
              directory="true"
              onChange={handleUpload}
            />
            <Button
              size="sm"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="text-foreground"
            >
              {uploading ? t("creating") : t("uploadSkillBtn")}
            </Button>
          </div>

          <ScrollArea className="h-[200px] w-full rounded-md border p-4">
            {loadingSkills ? (
              <div className="text-center text-sm text-muted-foreground py-4">Loading...</div>
            ) : skills.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-4">{t("noSkills")}</div>
            ) : (
              <div className="flex flex-col gap-2">
                {skills.map((skill) => (
                  <div
                    key={skill}
                    className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50"
                  >
                    <span className="text-sm font-medium truncate max-w-[250px]" title={skill}>
                      {skill}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleDelete(skill)}
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">{t("delete")}</span>
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
