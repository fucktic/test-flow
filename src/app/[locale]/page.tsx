import { FlowCanvas } from "@/components/flow/canvas-wrapper";
import { setRequestLocale } from "next-intl/server";

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main className="w-full h-full">
      <FlowCanvas />
    </main>
  );
}
