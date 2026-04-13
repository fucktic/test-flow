"use client";

import { useLocale } from "next-intl";
import { Languages, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePathname, useRouter } from "@/i18n/routing";
import { routing } from "@/i18n/routing";

const LOCALE_LABELS: Record<string, string> = {
  zh: "简体中文",
  en: "English",
  "zh-TW": "繁體中文",
  ja: "日本語",
  ru: "Русский",
  vi: "Tiếng Việt",
};

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const switchLocale = (nextLocale: string) => {
    router.replace(pathname, { locale: nextLocale as any });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 ml-2">
          <Languages className="h-4 w-4 text-muted-foreground" />
          <span className="sr-only">Switch Language</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {routing.locales.map((loc) => (
          <DropdownMenuItem
            key={loc}
            onClick={() => switchLocale(loc)}
            className="flex items-center justify-between gap-3 cursor-pointer"
          >
            <span>{LOCALE_LABELS[loc] ?? loc}</span>
            {locale === loc && <Check className="h-3.5 w-3.5 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
