export type SkillType = "script" | "asset" | "storyboard" | "video";

export interface SkillDefinition {
  id: string;
  name: string;
  type: SkillType;
  description: string;
  agentName: string; // The agent to call, e.g., 'opencode', 'openclaw'
  commandTemplate: string; // The command template to run in the terminal
}

export interface SkillExecutionResult {
  success: boolean;
  outputUrl?: string;
  message?: string;
  timestamp: number;
}
