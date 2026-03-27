import fs from "fs/promises";
import path from "path";
import { Agent } from "@/lib/types/agent.types";

const getAgentFilePath = () => path.join(process.cwd(), "public", "agent.json");

/**
 * 获取智能体列表
 */
export async function getAgents(): Promise<Agent[]> {
  try {
    const data = await fs.readFile(getAgentFilePath(), "utf-8");
    return JSON.parse(data);
  } catch (error: any) {
    if (error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

/**
 * 保存智能体列表
 */
export async function saveAgents(agents: Agent[]): Promise<void> {
  await fs.writeFile(getAgentFilePath(), JSON.stringify(agents, null, 2), "utf-8");
}
