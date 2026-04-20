import fs from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

/** 只读提供仓库内固定路径 `db/剧本样本.md`，供剧本格式参考 */
export async function GET() {
  const filePath = path.join(process.cwd(), "db", "剧本样本.md");
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return new NextResponse(content, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Sample not found" }, { status: 404 });
  }
}
