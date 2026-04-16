import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";

/** 仅允许标准 UUID 作为项目 ID，防止路径穿越 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 资产允许的分类白名单 */
const ALLOWED_CATEGORIES = new Set(["characters", "scenes", "props", "audio", "misc"]);

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: "Invalid project id" }, { status: 400 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const type = formData.get("type") as string; // 'image' or 'video' or 'audio'
    const source = formData.get("source") as string; // 'asset' or 'episode' (default)
    const category = formData.get("category") as string; // 'characters', 'scenes', 'props', 'audio'

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    let dirPath = "";
    let folder = "";
    let url = "";

    if (source === "asset") {
      folder = ALLOWED_CATEGORIES.has(category) ? category : "misc";
      dirPath = path.join(process.cwd(), "projects", id, "assets", folder);
    } else {
      folder = type === "video" ? "video" : "image";
      dirPath = path.join(process.cwd(), "projects", id, "episode", folder);
    }

    // 二次校验：确保最终路径未逃出项目目录
    const projectRoot = path.join(process.cwd(), "projects", id);
    if (!dirPath.startsWith(projectRoot + path.sep)) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    // Ensure directory exists
    await fs.mkdir(dirPath, { recursive: true });

    // Generate file name
    const ext =
      path.extname(file.name) || (type === "video" ? ".mp4" : type === "audio" ? ".mp3" : ".png");
    const fileName = `${uuidv4()}${ext}`;
    const filePath = path.join(dirPath, fileName);

    await fs.writeFile(filePath, buffer);

    if (source === "asset") {
      url = `/api/projects/${id}/assets/${folder}/${fileName}`;
    } else {
      url = `/api/projects/${id}/episode/${folder}/${fileName}`;
    }

    return NextResponse.json({ success: true, url });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
