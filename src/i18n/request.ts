import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  if (!locale || !routing.locales.includes(locale as any)) {
    locale = routing.defaultLocale;
  }

  // Next.js middleware and edge runtime do not support fs/path module,
  // we must import dynamically or load statically if it's predictable.
  // Next-intl suggests loading using dynamic imports.
  const common = (await import(`../../messages/${locale}/common.json`)).default;
  const home = (await import(`../../messages/${locale}/home.json`)).default;
  const canvas = (await import(`../../messages/${locale}/canvas.json`)).default;
  const flow = (await import(`../../messages/${locale}/flow.json`)).default;
  const header = (await import(`../../messages/${locale}/header.json`)).default;

  const messages = {
    common,
    home,
    canvas,
    flow,
    header,
  };

  return {
    locale,
    messages,
  };
});
