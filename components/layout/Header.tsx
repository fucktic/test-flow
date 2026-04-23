import { getTranslations } from "next-intl/server";
import Image from "next/image";
import { LanguageSwitcher } from "./LanguageSwitcher";
import AgentSwitcher from "./AgentSwitcher";
export default async function Header() {
    const t = await getTranslations("Header");

    return (
        <header className="pointer-events-none fixed top-0 left-0 right-0 z-50 h-16 px-16 flex items-center">
            <span className="inline-flex items-center gap-2">
                <Image
                    src="/mantur-logo.svg"
                    alt={t("logoAlt")}
                    width={68}
                    height={20}
                    loading="eager"

                />
                <span className="text-xl font-bold">{t("brandName")}</span>
            </span>
            <div className="flex-1"></div>
            <span className="pointer-events-auto flex items-center gap-2">
                <AgentSwitcher />
                <LanguageSwitcher />
            </span>
        </header>
    );
}
