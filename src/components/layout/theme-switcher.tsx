"use client";

import { useTranslations } from "next-intl";
import { Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeSwitcher() {
  const t = useTranslations("header");
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="h-8 w-8 ml-2">
        <span className="sr-only">{t("toggleTheme")}</span>
      </Button>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 ml-2"
          onClick={() => setTheme(theme === "light" ? "dark" : "light")}
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 text-muted-foreground" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 text-muted-foreground" />
          <span className="sr-only">{t("toggleTheme")}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{t("toggleTheme")}</p>
      </TooltipContent>
    </Tooltip>
  );
}
