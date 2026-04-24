"use client"

import { useState, Fragment } from "react"
import { Layers, Package, FolderKanban, Settings, Video, X, Wrench } from "lucide-react"
import { Dialog } from "radix-ui"
import { cn } from "@/lib/utils"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { useTranslations } from "next-intl"
import { EpisodesPanel } from "./episodes-panel"
import { AssetsPanel } from "./assets-panel"
import { ProjectsPanel } from "./projects-panel"
import { SettingsPanel } from "./settings-panel"
import { SkillsPanel } from "./skills-panel"

type NavSection = "episodes" | "assets" | "projects" | "settings" | "skills" | "video" | null

type NavItem = { key: Exclude<NavSection, null>; icon: typeof Layers; group: number }

const FLOAT_KEYS = new Set(["episodes", "assets", "video"])
const DIALOG_KEYS = new Set(["projects", "settings", "skills"])

const NAV_ITEMS: NavItem[] = [
  { key: "episodes", icon: Layers, group: 0 },
  { key: "assets", icon: Package, group: 0 },
  { key: "projects", icon: FolderKanban, group: 1 },
  { key: "settings", icon: Settings, group: 1 },
  { key: "skills", icon: Wrench, group: 1 },
  { key: "video", icon: Video, group: 2 },
]

function VideoPanel() {
  const t = useTranslations("Sidebar")
  const label = t("video")
  return (
    <div className="flex flex-col gap-3 p-4">
      <h3 className="text-sm font-semibold">{label}</h3>
      <p className="text-muted-foreground text-xs">{label} — 暂无内容</p>
    </div>
  )
}

function FloatingPanel({
  active,
  onClose,
}: {
  active: NavSection
  onClose: () => void
}) {
  if (active === null || !FLOAT_KEYS.has(active)) return null

  return (
    <div className="fixed top-16 left-20 z-40 overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <span className="text-sm font-semibold capitalize">{active}</span>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="overflow-y-auto">
        {active === "episodes" && <EpisodesPanel />}
        {active === "assets" && <AssetsPanel />}
        {active === "video" && <VideoPanel />}
      </div>
    </div>
  )
}

function DialogPanel({
  active,
  t,
  onClose,
}: {
  active: NavSection
  t: (key: string) => string
  onClose: () => void
}) {
  return (
    <Dialog.Root
      open={active !== null && DIALOG_KEYS.has(active)}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content
          className="fixed top-1/2 left-1/2 z-50 max-h-[85vh] w-[min(92vw,960px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl outline-none"
        >
          <div className="flex items-center justify-between border-b border-border px-6 py-3">
            {active ? <Dialog.Title className="text-lg font-semibold">{t(active)}</Dialog.Title> : null}
            <Dialog.Close asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </Button>
            </Dialog.Close>
          </div>

          <div className="overflow-y-auto p-4">
            {active === "projects" && <ProjectsPanel />}
            {active === "settings" && <SettingsPanel />}
            {active === "skills" && <SkillsPanel />}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

const Sidebar = () => {
  const t = useTranslations("Sidebar")
  const [active, setActive] = useState<NavSection>(null)

  const toggle = (key: NavSection) => {
    setActive((prev) => (prev === key ? null : key))
  }

  return (
    <TooltipProvider delayDuration={300}>
      {/* Icon strip */}
      <aside className="fixed top-16 left-4 z-30 flex w-12 flex-col items-center gap-1 border bg-card py-3 rounded-full">
        {NAV_ITEMS.map(({ key, icon: Icon, group }, i) => (
          <Fragment key={key}>
            {i > 0 && group !== NAV_ITEMS[i - 1].group && <Separator key={`sep-${group}`} className="w-6" />}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => toggle(key)}
                  className={cn(
                    "flex size-9 items-center justify-center rounded-lg transition-colors",
                    active === key
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  <Icon className="size-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>{t(key)}</p>
              </TooltipContent>
            </Tooltip>
          </Fragment>
        ))}
      </aside>

      {/* Floating panel: episodes, assets, video */}
      <FloatingPanel active={active} onClose={() => setActive(null)} />

      {/* Modal dialog: projects, settings, skills */}
      <DialogPanel active={active} t={t} onClose={() => setActive(null)} />
    </TooltipProvider>
  )
}

export default Sidebar
