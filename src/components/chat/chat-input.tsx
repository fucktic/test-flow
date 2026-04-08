import { Editor } from "@tiptap/react";
import { EditorContent } from "@tiptap/react";
import { Button } from "@/components/ui/button";
import { Send, Square, ImageIcon, Video, Box, X } from "lucide-react";
import { Agent } from "@/lib/types/agent.types";

import { AgentSelect } from "./agent-select";
import { ChatUpload, UploadedFileList, UploadedFile } from "./chat-upload";

import { useTranslations } from "next-intl";

interface ChatInputProps {
  editor: Editor | null;
  input: string;
  isExecuting: boolean;
  selectedAgentId: string | null;
  agents: Agent[];
  currentAgent: Agent | undefined;
  uploadedFiles: UploadedFile[];
  setUploadedFiles: React.Dispatch<React.SetStateAction<UploadedFile[]>>;
  setSelectedAgentId: (id: string | null) => void;
  setAgentModalOpen: (open: boolean) => void;

  onSend: () => void;
  onStop: () => void;
  currentSelection?: {
    type: string;
    title: string;
  } | null;
  onClearSelection?: () => void;
}

export function ChatInput({
  editor,
  input,
  isExecuting,
  selectedAgentId,
  agents,
  currentAgent,
  uploadedFiles,
  setUploadedFiles,
  setSelectedAgentId,
  setAgentModalOpen,
  onSend,
  onStop,
  currentSelection,
  onClearSelection,
}: ChatInputProps) {
  const t = useTranslations("chat");

  const handleRemoveFile = (id: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleSend = () => {
    // 触发发送（后续如果需要将文件传给后端，可修改 onSend 签名或通过 store 传递）
    onSend();
    // 发送后可以选择清空附件
    setUploadedFiles([]);
  };

  return (
    <div className="p-3 border-t bg-background/80 backdrop-blur-sm">
      <UploadedFileList files={uploadedFiles} onRemove={handleRemoveFile} />

      <div className="bg-muted/30 p-2 rounded-xl border border-border/50 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 transition-all flex flex-col gap-2">
        {currentSelection && (
          <div className="flex items-center">
            <div className="inline-flex items-center max-w-[90%] gap-1.5 px-2.5 py-1.5 bg-primary/5 border border-primary/10 rounded-xl text-xs shadow-sm overflow-hidden relative group">
              <span className="text-muted-foreground/60 shrink-0 border-r border-border/50 pr-2">
                {t("currentOperationNode")}
              </span>
              <span className="flex items-center justify-center text-primary/80 shrink-0">
                {currentSelection.type === "sceneImageNode" && (
                  <ImageIcon className="w-3.5 h-3.5" />
                )}
                {currentSelection.type === "sceneVideoNode" && <Video className="w-3.5 h-3.5" />}
                {(currentSelection.type === "assetItem" || currentSelection.type === "node") && (
                  <Box className="w-3.5 h-3.5" />
                )}
              </span>
              <span className="font-medium text-foreground/80 truncate pr-4">
                {currentSelection.title}
              </span>
              <button
                onClick={onClearSelection}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                title={t("clearSelection")}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}
        <div className="w-full">
          <EditorContent editor={editor} />
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-1">
            <div className="w-40">
              <AgentSelect
                selectedAgentId={selectedAgentId}
                agents={agents}
                currentAgent={currentAgent}
                setSelectedAgentId={setSelectedAgentId}
                setAgentModalOpen={setAgentModalOpen}
              />
            </div>
            <ChatUpload files={uploadedFiles} onFilesChange={setUploadedFiles} />
          </div>

          {isExecuting ? (
            <Button
              size="icon"
              className="w-8 h-8 shrink-0 rounded-lg bg-destructive hover:bg-destructive/90 shadow-sm transition-transform active:scale-95 text-destructive-foreground"
              onClick={onStop}
            >
              <Square className="w-3.5 h-3.5 fill-current" />
            </Button>
          ) : (
            <Button
              size="icon"
              className="w-8 h-8 shrink-0 rounded-lg bg-primary hover:bg-primary/90 shadow-sm transition-transform active:scale-95 disabled:opacity-50"
              onClick={handleSend}
              disabled={(!input.trim() && uploadedFiles.length === 0) || !selectedAgentId}
            >
              <Send className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>

      <div className="text-[10px] text-muted-foreground/60 text-center mt-2 font-medium">
        {t("pressEnterToSend")}
      </div>
    </div>
  );
}
