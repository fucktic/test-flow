import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { existsSync } from "fs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; path: string[] }> },
) {
  const { id, path: pathArray } = await params;

  try {
    const filePath = path.join(process.cwd(), "projects", id, "episode", ...pathArray);

    // Check path traversal
    if (!filePath.startsWith(path.join(process.cwd(), "projects", id, "episode"))) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    if (!existsSync(filePath)) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const fileBuffer = await fs.readFile(filePath);

    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".mp4": "video/mp4",
      ".gif": "image/gif",
      ".webp": "image/webp",
      ".svg": "image/svg+xml",
      ".webm": "video/webm",
      ".mov": "video/quicktime",
      ".mp3": "audio/mpeg",
      ".wav": "audio/wav",
      ".ogg": "audio/ogg",
    };

    const contentType = mimeTypes[ext] || "application/octet-stream";

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error: unknown) {
    console.error("Failed to load file:", error);
    return NextResponse.json({ error: "Failed to load file" }, { status: 500 });
  }
}
