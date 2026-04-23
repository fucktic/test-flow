"use client"

import { useTranslations } from "next-intl"

export function ProjectsPanel() {
  const t = useTranslations("Sidebar")
  const label = t("projects")
  return (
    <div className="flex flex-col gap-3 p-4">
      <h3 className="text-sm font-semibold">{label}</h3>
      <p className="text-muted-foreground text-xs">{label} — 暂无内容</p>
    </div>
  )
}
