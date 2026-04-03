import { useTranslations } from "next-intl";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectSeparator,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Settings, Orbit, Info } from "lucide-react";
import { Agent } from "@/lib/types/agent.types";

interface AgentSelectProps {
  selectedAgentId: string | null;
  agents: Agent[];
  currentAgent: Agent | undefined;
  setSelectedAgentId: (id: string | null) => void;
  setAgentModalOpen: (open: boolean) => void;
}

/**
 * 智能体选择器组件
 */
export function AgentSelect({
  selectedAgentId,
  agents,
  currentAgent,
  setSelectedAgentId,
  setAgentModalOpen,
}: AgentSelectProps) {
  const t = useTranslations("chat");

  return (
    <Select
      value={selectedAgentId || ""}
      onValueChange={(val) => {
        if (val === "manage_agents_action") {
          setAgentModalOpen(true);
          return;
        }
        setSelectedAgentId(val);
      }}
    >
      <SelectTrigger className="w-full h-8 text-xs bg-background/50 border-muted-foreground/20 hover:bg-background/80 transition-colors">
        <SelectValue placeholder={t("selectAgentPrompt")}>
          {currentAgent ? (
            <div className="flex items-center gap-2">
              {currentAgent.icon ? (
                <img
                  src={currentAgent.icon}
                  alt="icon"
                  className="w-4 h-4 rounded-full object-cover"
                  loading="lazy"
                />
              ) : (
                <Orbit className="w-4 h-4" />
              )}
              <span className="truncate">{currentAgent.name}</span>
            </div>
          ) : (
            t("selectAgentPrompt")
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {agents.length === 0 ? (
          <div className="p-2 text-sm text-center text-muted-foreground">{t("noAgentFound")}</div>
        ) : (
          agents.map((agent) => (
            <SelectItem key={agent.id} value={agent.id} className="text-xs w-full pr-8">
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  {agent.icon ? (
                    <img
                      src={agent.icon}
                      alt={agent.name}
                      className="w-4 h-4 rounded-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-4 h-4 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[10px] font-bold">
                      {agent.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  {agent.name}
                </div>
                {agent.endpoint && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="w-3.5 h-3.5 text-muted-foreground hover:text-primary cursor-help ml-2 shrink-0" />
                      </TooltipTrigger>
                      <TooltipContent side="right">
                        <p className="text-xs font-mono">{agent.endpoint}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            </SelectItem>
          ))
        )}
        <SelectSeparator />
        <SelectItem
          value="manage_agents_action"
          className="text-primary text-xs font-medium cursor-pointer flex items-center justify-center py-2"
        >
          <div className="flex items-center gap-2">
            <Settings className="w-3.5 h-3.5" />
            {t("manageAgents")}
          </div>
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
