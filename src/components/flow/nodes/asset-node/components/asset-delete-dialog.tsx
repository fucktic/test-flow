import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AssetItem } from "@/lib/types/flow.types";

interface AssetDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deleteAsset?: AssetItem;
  onConfirm: () => void;
  onCancel: () => void;
}

export function AssetDeleteDialog({
  open,
  onOpenChange,
  deleteAsset,
  onConfirm,
  onCancel,
}: AssetDeleteDialogProps) {
  const tFlow = useTranslations("flow.assetNode");
  const tCommon = useTranslations("common");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{tFlow("deleteConfirmTitle")}</DialogTitle>
        </DialogHeader>
        <div className="text-sm text-muted-foreground">
          {deleteAsset
            ? tFlow("deleteConfirmDescriptionWithName", { name: deleteAsset.name })
            : tFlow("deleteConfirmDescription")}
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
