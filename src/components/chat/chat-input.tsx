import { Editor } from "@tiptap/react";
import { EditorContent } from "@tiptap/react";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { Agent } from "@/lib/types/agent.types";

import { AgentSelect } from "./agent-select";
import { ChatUpload, UploadedFileList, UploadedFile } from "./chat-upload";

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
}: ChatInputProps) {
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

          <Button
            size="icon"
            className="w-8 h-8 shrink-0 rounded-lg bg-primary hover:bg-primary/90 shadow-sm transition-transform active:scale-95 disabled:opacity-50"
            onClick={handleSend}
            disabled={(!input.trim() && uploadedFiles.length === 0) || !selectedAgentId}
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
