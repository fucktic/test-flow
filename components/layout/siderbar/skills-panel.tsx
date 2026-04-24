"use client";

import { useEffect, useRef, useState, type ChangeEvent, type InputHTMLAttributes } from "react";
import { Folder, Trash2, Upload } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { SkillFolder } from "@/lib/services/skill-service";

type DirectoryFile = File & {
  webkitRelativePath?: string;
};

type DirectoryInputProps = InputHTMLAttributes<HTMLInputElement> & {
  webkitdirectory?: string;
  directory?: string;
};

type FeedbackKey =
  | "Skills.feedback.loadError"
  | "Skills.feedback.uploadError"
  | "Skills.feedback.deleteError"
  | "Skills.feedback.uploadSuccess"
  | "";

const DIRECTORY_INPUT_PROPS: DirectoryInputProps = {
  webkitdirectory: "",
  directory: "",
};

export function SkillsPanel() {
  const t = useTranslations();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [skills, setSkills] = useState<SkillFolder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState<string | null>(null);
  const [feedbackKey, setFeedbackKey] = useState<FeedbackKey>("");

  const loadSkills = async () => {
    try {
      const response = await fetch("/api/skills");
      if (!response.ok) throw new Error("SKILL_LOAD_FAILED");
      const payload = (await response.json()) as { skills: SkillFolder[] };

      setSkills(payload.skills);
      setFeedbackKey("");
    } catch {
      setFeedbackKey("Skills.feedback.loadError");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    void fetch("/api/skills")
      .then((response) => {
        if (!response.ok) throw new Error("SKILL_LOAD_FAILED");
        return response.json() as Promise<{ skills: SkillFolder[] }>;
      })
      .then((payload) => {
        if (!isMounted) return;
        setSkills(payload.skills);
        setFeedbackKey("");
      })
      .catch(() => {
        if (isMounted) setFeedbackKey("Skills.feedback.loadError");
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? []) as DirectoryFile[];
    if (selectedFiles.length === 0) return;

    const formData = new FormData();
    selectedFiles.forEach((file) => {
      formData.append("files", file);
      formData.append("paths", file.webkitRelativePath || file.name);
    });

    setIsUploading(true);
    setDeleteConfirmName(null);
    try {
      const response = await fetch("/api/skills", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) throw new Error("SKILL_UPLOAD_FAILED");

      setFeedbackKey("Skills.feedback.uploadSuccess");
      await loadSkills();
    } catch {
      setFeedbackKey("Skills.feedback.uploadError");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (name: string) => {
    if (deleteConfirmName !== name) {
      setDeleteConfirmName(name);
      return;
    }

    try {
      const response = await fetch("/api/skills", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) throw new Error("SKILL_DELETE_FAILED");

      setDeleteConfirmName(null);
      await loadSkills();
    } catch {
      setFeedbackKey("Skills.feedback.deleteError");
    }
  };

  return (
    <div className="flex min-h-[420px] flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">{t("Skills.title")}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{t("Skills.description")}</p>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="shrink-0"
        >
          <Upload className="size-4" />
          {isUploading ? t("Skills.actions.uploading") : t("Skills.actions.upload")}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(event) => void handleUpload(event)}
          {...DIRECTORY_INPUT_PROPS}
        />
      </div>

      {feedbackKey ? (
        <p
          className={cn(
            "text-xs",
            feedbackKey === "Skills.feedback.uploadSuccess"
              ? "text-muted-foreground"
              : "text-destructive",
          )}
        >
          {t(feedbackKey)}
        </p>
      ) : null}

      <ScrollArea className="min-h-0 flex-1">
        {isLoading ? (
          <div className="rounded-lg border border-dashed bg-muted/30 px-3 py-8 text-center">
            <p className="text-xs text-muted-foreground">{t("Skills.feedback.loading")}</p>
          </div>
        ) : skills.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-muted/30 px-3 py-8 text-center">
            <p className="text-xs text-muted-foreground">{t("Skills.empty")}</p>
          </div>
        ) : (
          <div className="grid gap-2">
            {skills.map((skill) => {
              const isConfirmingDelete = deleteConfirmName === skill.name;
              return (
                <div
                  key={skill.name}
                  className="flex items-center gap-3 rounded-lg border bg-background p-3"
                >
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <Folder className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{skill.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("Skills.fileCount", { count: skill.fileCount })}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant={isConfirmingDelete ? "destructive" : "ghost"}
                    size={isConfirmingDelete ? "xs" : "icon-sm"}
                    onClick={() => void handleDelete(skill.name)}
                    aria-label={
                      isConfirmingDelete
                        ? t("Skills.actions.confirmDelete")
                        : t("Skills.actions.delete")
                    }
                    className={cn(
                      "shrink-0",
                      !isConfirmingDelete && "text-muted-foreground hover:text-destructive",
                    )}
                  >
                    {isConfirmingDelete ? (
                      t("Skills.actions.confirmDelete")
                    ) : (
                      <Trash2 className="size-4" />
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
