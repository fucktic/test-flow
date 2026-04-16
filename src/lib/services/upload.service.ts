import fs from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";

/**
 * 将文件保存到项目的 temp 文件夹中
 */
export async function saveTempFilesToProject(
  projectId: string,
  files: File[],
  ids?: string[],
): Promise<string[]> {
  const tempDir = path.join(process.cwd(), "projects", projectId, "temp");
  await fs.mkdir(tempDir, { recursive: true });

  const uploadedPaths: string[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const fileId = ids && ids[i] ? ids[i] : uuidv4();
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      let ext = path.extname(file.name) || "";

      if (!ext) {
        if (file.type.startsWith("image/png")) ext = ".png";
        else if (file.type.startsWith("image/jpeg")) ext = ".jpg";
        else if (file.type.startsWith("image/gif")) ext = ".gif";
        else if (file.type.startsWith("image/webp")) ext = ".webp";
        else if (file.type.startsWith("video/mp4")) ext = ".mp4";
        else if (file.type.startsWith("video/quicktime")) ext = ".mov";
        else if (file.type.startsWith("video/webm")) ext = ".webm";
        else if (file.type.startsWith("text/markdown") || file.name.endsWith(".md")) ext = ".md";
        else ext = "";
      }

      const fileName = `${fileId}temp${ext}`;
      const filePath = path.join(tempDir, fileName);
      await fs.writeFile(filePath, buffer);
      uploadedPaths.push(filePath);
    } catch (e) {
      console.error(`[Upload Service] Error processing file ${file.name}:`, e);
      throw e;
    }
  }

  return uploadedPaths;
}
