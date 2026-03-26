import fs from "fs/promises";
import path from "path";

/**
 * 初始化应用的基础目录（projects 和 skills），并检查 skills 目录是否为空
 * @returns {Promise<boolean>} isSkillsEmpty - 返回 skills 目录是否为空的状态
 */
export async function initializeAppDirectories(): Promise<boolean> {
  let isSkillsEmpty = true;
  try {
    const projectsDir = path.join(process.cwd(), "projects");
    const skillsDir = path.join(process.cwd(), "skills");

    await fs.mkdir(projectsDir, { recursive: true });
    await fs.mkdir(skillsDir, { recursive: true });

    const skillsFiles = await fs.readdir(skillsDir);
    isSkillsEmpty = skillsFiles.filter((f) => !f.startsWith(".")).length === 0;
  } catch (error) {
    console.error("Failed to initialize directories:", error);
  }
  return isSkillsEmpty;
}
