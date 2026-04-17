import fs from "fs/promises";
import path from "path";
import { Agent } from "@/lib/types/agent.types";
import { dbAgentsPath, dbDir } from "@/lib/constants/db-paths";

const LEGACY_AGENT_PATH = path.join(process.cwd(), "public", "agent.json");

async function migrateLegacyAgentsIfNeeded(): Promise<void> {
  const target = dbAgentsPath();
  try {
    await fs.access(target);
    return;
  } catch {
    // target missing — try legacy file once
  }
  try {
    const data = await fs.readFile(LEGACY_AGENT_PATH, "utf-8");
    await fs.mkdir(dbDir(), { recursive: true });
    await fs.writeFile(target, data, "utf-8");
  } catch {
    // no legacy file or unreadable — first read will return []
  }
}

/**
 * 获取智能体列表（持久化于项目根目录 `db/agents.json`）
 */
export async function getAgents(): Promise<Agent[]> {
  await migrateLegacyAgentsIfNeeded();
  try {
    const data = await fs.readFile(dbAgentsPath(), "utf-8");
    return JSON.parse(data);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

/**
 * 保存智能体列表
 */
export async function saveAgents(agents: Agent[]): Promise<void> {
  await fs.mkdir(dbDir(), { recursive: true });
  await fs.writeFile(dbAgentsPath(), JSON.stringify(agents, null, 2), "utf-8");
}
