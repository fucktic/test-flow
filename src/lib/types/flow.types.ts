import { Node, Edge } from "@xyflow/react";
import { SkillType } from "./agent.types";

export interface FlowState {
  nodes: Node[];
  edges: Edge[];
  selectedNodeId: string | null;
}

export interface TextNodeData {
  text: string;
  command: string;
  isExecuting?: boolean;
  result?: string;
  error?: string;
}

export interface SkillNodeData {
  skillId: string;
  skillType: SkillType;
  skillFilePath: string; // 地址
  resourcePath: string; // 资源地址
  status: "idle" | "running" | "success" | "error";
  agent: string;
}
