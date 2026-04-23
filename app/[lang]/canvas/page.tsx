import {ArrowLeft} from "lucide-react";
import {getTranslations, setRequestLocale} from "next-intl/server";
import {notFound} from "next/navigation";
import {hasLocale} from "use-intl";
import {buttonVariants} from "@/components/ui/button";
import {CanvasWorkspace} from "@/components/canvas/workspace";
import {Link} from "@/i18n/navigation";
import {routing} from "@/i18n/routing";
import {cn} from "@/lib/utils";

export default async function CanvasPage({
  params,
}: PageProps<"/[lang]/canvas">) {
  const {lang} = await params;

  if (!hasLocale(routing.locales, lang)) {
    notFound();
  }

  setRequestLocale(lang);
  const t = await getTranslations({locale: lang, namespace: "Canvas"});

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.22),transparent_25%),linear-gradient(180deg,#09090b_0%,#020617_100%)] px-4 py-6 text-stone-50 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/"
            className={cn(buttonVariants({variant: "ghost"}), "gap-2")}
          >
            <ArrowLeft className="size-4" />
            {t("back")}
          </Link>
        </div>

        <CanvasWorkspace />
      </div>
    </main>
  );
}
