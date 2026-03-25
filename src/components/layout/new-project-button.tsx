"use client";

import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function NewProjectButton() {
  const t = useTranslations("header");

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Plus className="h-4 w-4 text-muted-foreground" />
          <span className="sr-only">{t("newProject")}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{t("newProject")}</p>
      </TooltipContent>
    </Tooltip>
  );
}
