import { useEffect, useRef } from "react";
import { useFlowStore } from "../store/use-flow";

export const useFlowPolling = (intervalMs = 3000) => {
  const { nodes, updateNodeData } = useFlowStore();
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const pollResults = async () => {
      const runningNodes = nodes.filter(
        (n) => n.type === "skillNode" && n.data?.status === "running",
      );

      if (runningNodes.length === 0) return;

      for (const node of runningNodes) {
        try {
          // 这里将来可以替换为真实的 API 轮询逻辑
          // const res = await fetch(`/api/agents/status?taskId=${node.data.taskId}`);
          // const result = await res.json();

          // 模拟成功
          if (Math.random() > 0.7) {
            updateNodeData(node.id, {
              status: "success",
            });
          }
        } catch (error) {
          console.error(`Failed to poll status for node ${node.id}`, error);
        }
      }
    };

    timerRef.current = setInterval(pollResults, intervalMs);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [nodes, updateNodeData, intervalMs]);
};
