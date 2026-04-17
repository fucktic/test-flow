"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { Settings } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { defaultClientApiConfig, type ClientApiConfig } from "@/lib/config/client-api-config";
import { getProjectsApiConfig, saveProjectsApiConfig } from "@/lib/actions/projects-api-config";
import { canvasDialogFooterGlass } from "@/components/layout/canvas-project-form-fields";
import { cn } from "@/lib/utils/index";
import { toast } from "sonner";

export function HeaderConfigDialog() {
  const t = useTranslations("header");
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" type="button">
              <Settings className="h-4 w-4 text-muted-foreground" />
              <span className="sr-only">{t("configTooltip")}</span>
            </Button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent>
          <p>{t("configTooltip")}</p>
        </TooltipContent>
      </Tooltip>
      <HeaderConfigFormContent open={open} onClose={() => setOpen(false)} />
    </Dialog>
  );
}

function HeaderConfigFormContent({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations("header");
  const tCommon = useTranslations("common");
  const [configLoading, setConfigLoading] = useState(false);
  const nonEmptyTrimmed = (msg: string) =>
    z
      .string()
      .min(1, msg)
      .refine((s) => s.trim().length > 0, { message: msg });

  const schema = z.object({
    imageModelApiKey: nonEmptyTrimmed(t("fieldRequired")),
    imageModelExample: nonEmptyTrimmed(t("fieldRequired")),
    videoModelApiKey: nonEmptyTrimmed(t("fieldRequired")),
    videoModelExample: nonEmptyTrimmed(t("fieldRequired")),
    imgbbApiKey: nonEmptyTrimmed(t("fieldRequired")),
  });

  type FormValues = z.infer<typeof schema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultClientApiConfig,
  });

  useEffect(() => {
    if (!open) {
      return;
    }
    let cancelled = false;
    setConfigLoading(true);
    void (async () => {
      try {
        const config = await getProjectsApiConfig();
        if (!cancelled) {
          form.reset(config);
        }
      } finally {
        if (!cancelled) {
          setConfigLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, form]);

  const onSubmit = async (values: FormValues) => {
    const next: ClientApiConfig = {
      imageModelApiKey: values.imageModelApiKey.trim(),
      imageModelExample: values.imageModelExample.trim(),
      videoModelApiKey: values.videoModelApiKey.trim(),
      videoModelExample: values.videoModelExample.trim(),
      imgbbApiKey: values.imgbbApiKey?.trim() ?? "",
    };
    const result = await saveProjectsApiConfig(next);
    if (result.success) {
      toast.success(t("saveConfigSuccess"));
      onClose();
    } else if (result.error === "required") {
      toast.error(t("fieldRequired"));
    } else {
      toast.error(t("saveConfigFailed"));
    }
  };

  const codeFieldClass =
    "font-mono text-xs min-h-[100px] leading-relaxed resize-y bg-muted/40 dark:bg-muted/20";

  return (
    <DialogContent className="!flex max-h-[80vh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-[520px]">
      <div className="shrink-0 space-y-2 px-4 pt-4 pr-12 pb-3">
        <DialogHeader>
          <DialogTitle>{t("configTitle")}</DialogTitle>
          <DialogDescription>{t("configDesc")}</DialogDescription>
        </DialogHeader>
      </div>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col overflow-hidden">
        <div
          className={cn(
            "overflow-y-auto overflow-x-hidden px-4 py-2",
            "max-h-[min(calc(80vh-10rem),560px)]",
            configLoading && "pointer-events-none opacity-60",
          )}
          aria-busy={configLoading}
        >
          <div className="grid gap-4 pb-4 pr-1">
            <fieldset className="grid gap-3 rounded-lg border border-border/80 p-3">
              <legend className="px-1 text-sm font-medium">{t("imageModel")}</legend>
              <div className="grid gap-2">
                <Label htmlFor="imageModelApiKey">{t("apiKey")}</Label>
                <Input
                  id="imageModelApiKey"
                  type="password"
                  autoComplete="off"
                  aria-required
                  {...form.register("imageModelApiKey")}
                />
                {form.formState.errors.imageModelApiKey && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.imageModelApiKey.message}
                  </p>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="imageModelExample">{t("example")}</Label>
                <Textarea
                  id="imageModelExample"
                  className={codeFieldClass}
                  aria-required
                  {...form.register("imageModelExample")}
                />
                {form.formState.errors.imageModelExample && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.imageModelExample.message}
                  </p>
                )}
              </div>
            </fieldset>

            <fieldset className="grid gap-3 rounded-lg border border-border/80 p-3">
              <legend className="px-1 text-sm font-medium">{t("videoModel")}</legend>
              <div className="grid gap-2">
                <Label htmlFor="videoModelApiKey">{t("apiKey")}</Label>
                <Input
                  id="videoModelApiKey"
                  type="password"
                  autoComplete="off"
                  aria-required
                  {...form.register("videoModelApiKey")}
                />
                {form.formState.errors.videoModelApiKey && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.videoModelApiKey.message}
                  </p>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="videoModelExample">{t("example")}</Label>
                <Textarea
                  id="videoModelExample"
                  className={codeFieldClass}
                  aria-required
                  {...form.register("videoModelExample")}
                />
                {form.formState.errors.videoModelExample && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.videoModelExample.message}
                  </p>
                )}
              </div>
            </fieldset>

            <fieldset className="grid gap-2 rounded-lg border border-border/80 p-3">
              <legend className="px-1 text-sm font-medium">{t("imgbb")}</legend>
              <Label htmlFor="imgbbApiKey">{t("apiKey")}</Label>
              <Input
                id="imgbbApiKey"
                type="password"
                autoComplete="off"
                {...form.register("imgbbApiKey")}
              />
              {form.formState.errors.imgbbApiKey && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.imgbbApiKey.message}
                </p>
              )}
            </fieldset>
          </div>
        </div>
        <DialogFooter
          className={cn(
            "!mx-0 !mb-0 shrink-0 gap-2 rounded-none border-t sm:gap-0",
            canvasDialogFooterGlass,
          )}
        >
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={configLoading || form.formState.isSubmitting}
          >
            {t("cancel")}
          </Button>
          <Button type="submit" disabled={configLoading || form.formState.isSubmitting}>
            {form.formState.isSubmitting ? tCommon("saving") : t("saveConfig")}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
