import fs from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";

/**
 * 将文件保存到项目的 temp 文件夹中
 */
export async function saveTempFilesToProject(projectId: string, files: File[]): Promise<string[]> {
  // 根据项目规范，只能读写 projects/[项目ID]/* 目录
  const tempDir = path.join(process.cwd(), "projects", projectId, "temp");
  await fs.mkdir(tempDir, { recursive: true });

  const uploadedPaths: string[] = [];

  console.log(`[Upload Service] Processing ${files.length} files for project ${projectId}`);

  for (const file of files) {
    console.log(
      `[Upload Service] Processing file: name=${file.name}, type=${file.type}, size=${file.size}`,
    );
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
        else ext = ""; // fallback
      }

      const fileName = `${uuidv4()}${ext}`;
      const filePath = path.join(tempDir, fileName);

      await fs.writeFile(filePath, buffer);
      console.log(`[Upload Service] Saved file to: ${filePath}`);
      uploadedPaths.push(filePath);
    } catch (e) {
      console.error(`[Upload Service] Error processing file ${file.name}:`, e);
      throw e;
    }
  }

  console.log(`[Upload Service] Successfully saved ${uploadedPaths.length} files.`);
  return uploadedPaths;
}
