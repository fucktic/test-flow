import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";
import fs from "fs";
import path from "path";

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  if (!locale || !routing.locales.includes(locale as any)) {
    locale = routing.defaultLocale;
  }

  const messagesDir = path.join(process.cwd(), "messages", locale);
  const files = fs.readdirSync(messagesDir).filter((f) => f.endsWith(".json"));

  const messages: Record<string, unknown> = {};
  for (const file of files) {
    const namespace = file.replace(".json", "");
    const filePath = path.join(messagesDir, file);
    messages[namespace] = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  }

  return {
    locale,
    messages,
  };
});
