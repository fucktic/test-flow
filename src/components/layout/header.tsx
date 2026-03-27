"use client";

import { Link } from "@/i18n/routing";
import { ProjectSwitcher } from "./project-switcher";
import { NewProjectButton } from "./new-project-button";
import { ImportSkillButton } from "./import-skill-button";
import { ThemeSwitcher } from "./theme-switcher";
import { LanguageSwitcher } from "./language-switcher";

export function Header({ isSkillsEmpty = false }: { isSkillsEmpty?: boolean }) {
  return (
    <header className="flex h-14 items-center justify-between border-b bg-background px-4 lg:px-6">
      <div className="flex items-center gap-4">
        <Link href="/" className="flex items-center gap-2 ">
          <svg
            width="28"
            height="20"
            viewBox="0 0 30 20"
            fill="none"
            className="scale-125"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient
                id="brand-grad"
                x1="5"
                y1="10"
                x2="25"
                y2="10"
                gradientUnits="userSpaceOnUse"
              >
                <stop stopColor="#A855F7"></stop>
                <stop offset="0.5" stopColor="#3B82F6"></stop>
                <stop offset="1" stopColor="#A855F7"></stop>
              </linearGradient>
            </defs>
            <path
              d="M10 5C7.23858 5 5 7.23858 5 10C5 12.7614 7.23858 15 10 15C11.5 15 13 14 15 10C17 6 18.5 5 20 5C22.7614 5 25 7.23858 25 10C25 12.7614 22.7614 15 20 15C18.5 15 17 14 15 10"
              stroke="url(#brand-grad)"
              strokeWidth="3.5"
              strokeLinecap="round"
            ></path>
          </svg>
          <span className="font-extrabold text-lg hidden sm:inline-block tracking-tight text-primary">
            Mantur Flow
          </span>
        </Link>
      </div>

      <div className="flex items-center gap-2">
        <ProjectSwitcher />
        <NewProjectButton />
        <ImportSkillButton defaultOpen={isSkillsEmpty} />
        <LanguageSwitcher />
        <ThemeSwitcher />
      </div>
    </header>
  );
}
