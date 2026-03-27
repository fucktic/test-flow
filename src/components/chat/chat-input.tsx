import { useTranslations } from "next-intl";
import { Editor } from "@tiptap/react";
import { EditorContent } from "@tiptap/react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectSeparator,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Settings, Send, Orbit, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Agent } from "@/lib/types/agent.types";

interface ChatInputProps {
  editor: Editor | null;
  input: string;
  isExecuting: boolean;
  selectedAgentId: string | null;
  agents: Agent[];
  currentAgent: Agent | undefined;
  setSelectedAgentId: (id: string | null) => void;
  setAgentModalOpen: (open: boolean) => void;
  onSend: () => void;
}

export function ChatInput({
  editor,
  input,
  isExecuting,
  selectedAgentId,
  agents,
  currentAgent,
  setSelectedAgentId,
  setAgentModalOpen,
  onSend,
}: ChatInputProps) {
  const t = useTranslations("chat");

  return (
    <div className="p-3 border-t bg-background/80 backdrop-blur-sm">
      <div className="bg-muted/30 p-2 rounded-xl border border-border/50 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 transition-all flex flex-col gap-2">
        <div className="w-full">
          <EditorContent editor={editor} />
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 max-w-40">
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
                  <div className="p-2 text-sm text-center text-muted-foreground">
                    {t("noAgentFound")}
                  </div>
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
          </div>

          <Button
            size="icon"
            className="w-8 h-8 shrink-0 rounded-lg bg-primary hover:bg-primary/90 shadow-sm transition-transform active:scale-95 disabled:opacity-50"
            onClick={onSend}
            disabled={!input.trim() || !selectedAgentId || isExecuting}
          >
            <Send className={cn("w-3.5 h-3.5", isExecuting && "animate-pulse")} />
          </Button>
        </div>
      </div>

      <div className="text-[10px] text-muted-foreground/60 text-center mt-2 font-medium">
        Press Enter to send, Shift + Enter for new line
      </div>
    </div>
  );
}
