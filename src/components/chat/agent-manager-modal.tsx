"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useChatStore } from "@/lib/store/use-chat";
import { Agent } from "@/lib/types/agent.types";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Edit2, Trash2 } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

export function AgentManagerModal() {
  const t = useTranslations("chat");
  const { agents, saveAgents, isAgentModalOpen, setAgentModalOpen } = useChatStore();

  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const formSchema = z.object({
    name: z.string().min(1, { message: t("nameRequired") }),
    endpoint: z.string().min(1, { message: t("endpointRequired") }),
    description: z.string().optional(),
    icon: z
      .string()
      .min(1, { message: t("iconRequired") })
      .url({ message: t("iconInvalid") }),
  });

  type FormValues = z.infer<typeof formSchema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      endpoint: "",
      description: "",
      icon: "",
    },
  });

  // 处理弹窗开关
  const handleOpenChange = (open: boolean) => {
    setAgentModalOpen(open);
    if (!open) {
      resetForm();
    }
  };

  // 重置表单状态
  const resetForm = () => {
    setEditingAgent(null);
    form.reset({ name: "", endpoint: "", description: "", icon: "" });
    setIsFormOpen(false);
  };

  // 保存智能体（新增或更新）
  const onSubmit = async (values: FormValues) => {
    let newAgents = [...agents];
    if (editingAgent) {
      newAgents = newAgents.map((a) => (a.id === editingAgent.id ? { ...a, ...values } : a));
    } else {
      newAgents.push({
        id: uuidv4(),
        ...values,
      });
    }

    await saveAgents(newAgents);
    resetForm();
  };

  // 准备编辑智能体
  const handleEdit = (agent: Agent) => {
    setEditingAgent(agent);
    form.reset({
      name: agent.name,
      endpoint: agent.endpoint || "",
      description: agent.description || "",
      icon: agent.icon || "",
    });
    setIsFormOpen(true);
  };

  // 删除智能体
  const handleDelete = async (id: string) => {
    const newAgents = agents.filter((a) => a.id !== id);
    await saveAgents(newAgents);
  };

  return (
    <Dialog open={isAgentModalOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{t("agentManagerTitle")}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2">
          {!isFormOpen ? (
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button size="sm" onClick={() => setIsFormOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  {t("addAgent")}
                </Button>
              </div>
              <div className="space-y-2">
                {agents.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8 text-sm">
                    {t("noAgentFound")}
                  </div>
                ) : (
                  agents.map((agent) => (
                    <div
                      key={agent.id}
                      className="flex items-center justify-between p-3 border rounded-md"
                    >
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          {agent.icon ? (
                            <img
                              src={agent.icon}
                              alt={agent.name}
                              className="w-5 h-5 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[10px] font-bold">
                              {agent.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <span className="font-medium text-sm">{agent.name}</span>
                        </div>
                        {agent.description && (
                          <span className="text-xs text-muted-foreground mt-1">
                            {agent.description}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(agent)}>
                          <Edit2 className="w-4 h-4 text-muted-foreground" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(agent.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>{t("agentName")}</Label>
                <Input {...form.register("name")} placeholder={t("agentName")} />
                {form.formState.errors.name && (
                  <p className="text-[10px] text-destructive">
                    {form.formState.errors.name.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>{t("agentEndpoint")}</Label>
                <Input {...form.register("endpoint")} placeholder={t("agentEndpoint")} />
                {form.formState.errors.endpoint && (
                  <p className="text-[10px] text-destructive">
                    {form.formState.errors.endpoint.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>{t("agentDesc")}</Label>
                <Input {...form.register("description")} placeholder={t("agentDesc")} />
              </div>
              <div className="space-y-2">
                <Label>{t("agentIcon")}</Label>
                <Input {...form.register("icon")} placeholder="https://example.com/icon.png" />
                {form.formState.errors.icon && (
                  <p className="text-[10px] text-destructive">
                    {form.formState.errors.icon.message}
                  </p>
                )}
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={resetForm}>
                  {t("cancel")}
                </Button>
                <Button type="submit">{t("save")}</Button>
              </div>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
