"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { useTranslations } from "next-intl"

export function AssetsPanel() {
  const t = useTranslations("Sidebar")
  const tabs: { key: string; label: string }[] = [
    { key: "all", label: t("assetTabs.all") },
    { key: "character", label: t("assetTabs.character") },
    { key: "scene", label: t("assetTabs.scene") },
    { key: "prop", label: t("assetTabs.prop") },
    { key: "voice", label: t("assetTabs.voice") },
    { key: "video", label: t("assetTabs.video") },
  ]
  const [activeTab, setActiveTab] = useState("all")

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-1 border-b px-3 py-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "rounded px-2 py-1 text-xs transition-colors",
              activeTab === tab.key
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="p-4">
        <p className="text-muted-foreground text-xs">{tabs.find((t) => t.key === activeTab)?.label} — 暂无内容</p>
      </div>
    </div>
  )
}
