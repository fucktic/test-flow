"use client";

import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils/index";

export const ASPECT_RATIO_IDS = [
  "smart",
  "21:9",
  "16:9",
  "3:2",
  "4:3",
  "1:1",
  "3:4",
  "2:3",
  "9:16",
] as const;

export type AspectRatioId = (typeof ASPECT_RATIO_IDS)[number];

function RatioShape({ ratio }: { ratio: number }) {
  const maxW = 26;
  const maxH = 16;
  let w = maxW;
  let h = w / ratio;
  if (h > maxH) {
    h = maxH;
    w = h * ratio;
  }
  return (
    <div
      className="shrink-0 rounded-[2px] border border-foreground/85 bg-transparent"
      style={{ width: w, height: h }}
    />
  );
}

type Props = {
  value: AspectRatioId;
  onChange: (id: AspectRatioId) => void;
  label: (id: AspectRatioId) => string;
};

export function AspectRatioSelector({ value, onChange, label }: Props) {
  return (
    <div className="rounded-xl bg-muted/60 p-2">
      <div className="flex gap-1 overflow-x-auto pb-1 [scrollbar-width:thin] [scrollbar-color:theme(colors.muted.foreground)_transparent]">
        {ASPECT_RATIO_IDS.map((id) => {
          const active = value === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              className={cn(
                "flex min-w-[52px] flex-col items-center gap-1 rounded-lg px-1.5 py-1.5 text-[11px] font-medium text-foreground/90 transition-colors",
                active ? "bg-background shadow-sm" : "hover:bg-background/60",
              )}
            >
              <span className="flex h-5 items-center justify-center">
                {id === "smart" ? (
                  <span className="relative flex h-5 w-5 items-center justify-center">
                    <span className="absolute inset-0 rounded-[3px] border border-foreground/85" />
                    <span className="absolute inset-[3px] rounded-[2px] border border-foreground/60" />
                    <Sparkles
                      className="relative z-[1] h-2.5 w-2.5 text-foreground/90"
                      strokeWidth={2}
                    />
                  </span>
                ) : (
                  <RatioShape ratio={aspectNumericRatio(id)} />
                )}
              </span>
              <span className="whitespace-nowrap leading-none">{label(id)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function aspectNumericRatio(id: Exclude<AspectRatioId, "smart">): number {
  const [a, b] = id.split(":").map(Number);
  return a / b;
}
