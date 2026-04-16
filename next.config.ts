import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/** 局域网用 IP 访问 dev 时须放行，否则 /_next/* 与 webpack-hmr WebSocket 会被拦截，页面只剩空壳 */
const extraAllowedDevOrigins =
  process.env.ALLOWED_DEV_ORIGINS?.split(/[\s,]+/).filter(Boolean) ?? [];

const nextConfig: NextConfig = {
  /* config options here */
  devIndicators: false,
  allowedDevOrigins: ["127.0.0.1", "localhost", ...extraAllowedDevOrigins],
};

export default withNextIntl(nextConfig);
