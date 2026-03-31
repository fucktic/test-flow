import { Handle, Position } from "@xyflow/react";
import { TextNodeData } from "../../../lib/types/flow.types";
import { useTranslations } from "next-intl";
import { getNodeWrapperClassName } from "./utils";

export const TextNode = ({ data, selected }: { data: TextNodeData; selected?: boolean }) => {
  const tFlow = useTranslations("flow.commandNode");

  return (
    <div className={getNodeWrapperClassName(selected, "p-4 min-w-50 text-foreground")}>
      <Handle type="target" position={Position.Top} className="w-3 h-3" />
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">{data.title || tFlow("textCommand")}</h3>
        <p className="text-xs text-muted-foreground">{data.text || tFlow("noContent")}</p>
        <div className="mt-2 text-xs bg-muted p-2 rounded text-muted-foreground font-mono">
          {data.command || tFlow("placeholder")}
        </div>
        {data.isExecuting && (
          <div className="text-xs text-primary animate-pulse">{tFlow("executing")}</div>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="w-3 h-3" />
    </div>
  );
};
