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
  // 根据项目规范，只能读写 projects/[项目ID]/* 目录
  const tempDir = path.join(process.cwd(), "projects", projectId, "temp");
  await fs.mkdir(tempDir, { recursive: true });

  const uploadedPaths: string[] = [];

  console.log(`[Upload Service] Processing ${files.length} files for project ${projectId}`);

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const fileId = ids && ids[i] ? ids[i] : uuidv4();
    console.log(
      `[Upload Service] Processing file: name=${file.name}, type=${file.type}, size=${file.size}, id=${fileId}`,
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

      // 这里保存为 UUID 的名字。考虑到有些情况可能需要带上 temp 后缀，
      // 如果用户期望的文件名为 id + temp，为了兼容我们直接使用 ${fileId}temp${ext} 或 ${fileId}${ext}
      // 根据用户需求，这里保存为 fileId + ext，代理需要通过 \uuidtemp 去推断文件。
      // 为简单起见，我们保存为 {id}temp{ext} 或 {id}{ext} 都可以。
      // 我们保存为 `${fileId}temp${ext}` 来显式匹配用户的输入！
      const fileName = `${fileId}temp${ext}`;
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
