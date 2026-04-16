import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  devIndicators: false,
  // 启用 standalone 输出，用于 Docker 生产镜像
  output: "standalone",
};

export default withNextIntl(nextConfig);
