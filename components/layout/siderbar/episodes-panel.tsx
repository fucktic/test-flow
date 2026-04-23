"use client"

import { useTranslations } from "next-intl"

export function EpisodesPanel() {
  const t = useTranslations("Sidebar")
  return (
    <div className="flex flex-col gap-3 p-4">
      <h3 className="text-sm font-semibold">{t("episodes")}</h3>
      <p className="text-muted-foreground text-xs">{t("episodes")} — 暂无内容</p>
    </div>
  )
}
