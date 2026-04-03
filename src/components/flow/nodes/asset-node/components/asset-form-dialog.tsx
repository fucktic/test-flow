import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileUpload } from "@/components/common/file-upload";
import { Controller } from "react-hook-form";
import { AssetCategory, AssetItem } from "@/lib/types/flow.types";

interface AssetFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isEditMode: boolean;
  form: any;
  assetCategory: AssetCategory;
  tabs: { id: AssetCategory; label: string }[];
  uploadedFileUrl: string;
  uploadedFileName: string;
  uploadedMediaType?: AssetItem["type"];
  uploadError: string;
  onFileUpload: (file: File) => Promise<void>;
  onClearFile: () => void;
  onSave: () => void;
  onCancel: () => void;
  setUploadError: (error: string) => void;
}

export function AssetFormDialog({
  open,
  onOpenChange,
  isEditMode,
  form,
  assetCategory,
  tabs,
  uploadedFileUrl,
  uploadedFileName,
  uploadedMediaType,
  uploadError,
  onFileUpload,
  onClearFile,
  onSave,
  onCancel,
  setUploadError,
}: AssetFormDialogProps) {
  const tFlow = useTranslations("flow.assetNode");

  const getAcceptMime = (category: AssetCategory) => {
    return category === "audio" ? "audio/*" : "image/*";
  };

  return (
    <Dialog aria-describedby open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditMode ? tFlow("editTitle") : tFlow("createTitle")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>{tFlow("nameLabel")}</Label>
            <Input {...form.register("name")} />
            {form.formState.errors.name && (
              <div className="text-xs text-destructive">
                {form.formState.errors.name.message as string}
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>{tFlow("categoryLabel")}</Label>
            <Controller
              control={form.control}
              name="category"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(value) => {
                    field.onChange(value);
                    setUploadError("");
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {tabs.map((tab) => (
                      <SelectItem key={tab.id} value={tab.id}>
                        {tab.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{tFlow("descriptionLabel")}</Label>
            <Textarea {...form.register("description")} />
          </div>
          <div className="space-y-1.5">
            <Label>{tFlow("uploadLabel")}</Label>
            <FileUpload
              accept={getAcceptMime(assetCategory)}
              onFileSelect={(file) => void onFileUpload(file)}
              fileUrl={uploadedFileUrl}
              fileName={uploadedFileName}
              mediaType={uploadedMediaType}
              onClear={onClearFile}
              hint={tFlow("uploadHint")}
              subHint={assetCategory === "audio" ? tFlow("typeAudio") : tFlow("typeImage")}
              error={uploadError}
              replaceText={tFlow("replaceFile")}
              clearText={tFlow("clearFile")}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            {tFlow("cancel")}
          </Button>
          <Button onClick={onSave} disabled={!form.watch("name")?.trim()}>
            {isEditMode ? tFlow("save") : tFlow("create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
