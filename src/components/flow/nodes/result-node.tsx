import { Handle, Position } from "@xyflow/react";
import { SkillNodeData } from "../../../lib/types/flow.types";
import { useTranslations } from "next-intl";

export const SkillNode = ({ data }: { data: SkillNodeData }) => {
  const tFlow = useTranslations("flow.resultNode");

  const statusColors = {
    idle: "bg-muted text-muted-foreground",
    running: "bg-primary/20 text-primary animate-pulse",
    success: "bg-green-500/20 text-green-600 dark:text-green-400",
    error: "bg-destructive/20 text-destructive",
  };

  return (
    <div className="bg-background rounded-lg shadow-md border border-border p-4 min-w-[250px] text-foreground">
      <Handle type="target" position={Position.Top} className="w-3 h-3" />
      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-semibold capitalize">{data.skillType} Skill</h3>
          <span className={`text-[10px] px-2 py-1 rounded-full ${statusColors[data.status]}`}>
            {data.status}
          </span>
        </div>
        <div className="text-xs space-y-1 mt-2">
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">Agent:</span> {data.agent}
          </p>
          <p className="text-muted-foreground truncate" title={data.skillFilePath}>
            <span className="font-medium text-foreground">{tFlow("skillFile")}</span>{" "}
            {data.skillFilePath || tFlow("notSet")}
          </p>
          <p className="text-muted-foreground truncate" title={data.resourcePath}>
            <span className="font-medium text-foreground">{tFlow("resourceOutput")}</span>{" "}
            {data.resourcePath || tFlow("notSet")}
          </p>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="w-3 h-3" />
    </div>
  );
};
