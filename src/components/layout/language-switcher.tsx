"use client";

import { useTranslations, useLocale } from "next-intl";
import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { usePathname, useRouter } from "@/i18n/routing";

export function LanguageSwitcher() {
  const t = useTranslations("header");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const toggleLanguage = () => {
    const nextLocale = locale === "zh" ? "en" : "zh";
    router.replace(pathname, { locale: nextLocale });
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 ml-2" onClick={toggleLanguage}>
          <Languages className="h-4 w-4 text-muted-foreground" />
          <span className="sr-only">{t("switchLanguage")}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{t("switchLanguage")}</p>
      </TooltipContent>
    </Tooltip>
  );
}
