"use client";

import { useTranslations } from "next-intl";
import { Folder } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function ProjectSwitcher() {
  const t = useTranslations("header");

  return (
    <div className="flex items-center gap-1 border-r pr-2 mr-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 gap-2 px-2">
            <Folder className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Default Project</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{t("switchProject")}</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
