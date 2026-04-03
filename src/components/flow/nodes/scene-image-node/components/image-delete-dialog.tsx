import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ImageDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ImageDeleteDialog({
  open,
  onOpenChange,
  onConfirm,
  onCancel,
}: ImageDeleteDialogProps) {
  const tFlow = useTranslations("flow.sceneImageNode");
  const tCommon = useTranslations("common");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{tFlow("deleteConfirmTitle")}</DialogTitle>
        </DialogHeader>
        <div className="py-4 text-sm text-muted-foreground">
          {tFlow("deleteConfirmDescription")}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            {tCommon("cancel")}
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            {tCommon("delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
