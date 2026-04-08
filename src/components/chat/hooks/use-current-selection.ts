import { useMemo, useRef, useEffect } from "react";
import { useFlowStore } from "@/lib/store/use-flow";
import { useTranslations } from "next-intl";
import { UploadedFile } from "../chat-upload";

export function useCurrentSelection(uploadedFiles: UploadedFile[]) {
  const t = useTranslations("chat");
  const nodes = useFlowStore((state) => state.nodes);
  const edges = useFlowStore((state) => state.edges);

  const allAssets = useMemo(() => {
    const assetNodes = nodes.filter((n) => n.type === "assetNode" || n.type === "asset-node");
    const list: any[] = [];
    assetNodes.forEach((n) => {
      const assetsData = n.data.assets as any;
      if (assetsData) {
        Object.keys(assetsData).forEach((cat) => {
          if (Array.isArray(assetsData[cat])) {
            list.push(...assetsData[cat].map((a: any) => ({ ...a, category: cat })));
          }
        });
      }
    });

    // 如果当前选中的是视频节点，找到对应的图片节点，将其生成的图片也加入 allAssets
    const selectedVideoNode = nodes.find(
      (n) => (n.type === "sceneVideoNode" || n.type === "scene-video-node") && n.selected,
    );

    if (selectedVideoNode) {
      // 优先通过边（edge）查找前置图片节点，如果未找到则退化为按 ID 模式匹配
      const edge = edges.find((e) => e.target === selectedVideoNode.id);
      let imageNodeId = edge
        ? edge.source
        : selectedVideoNode.id.replace("scene-video-", "scene-image-");
      let imageNode = nodes.find((n) => n.id === imageNodeId);

      // 确保找到的是图片节点
      if (
        imageNode &&
        imageNode.type !== "sceneImageNode" &&
        imageNode.type !== "scene-image-node"
      ) {
        imageNodeId = selectedVideoNode.id.replace("scene-video-", "scene-image-");
        imageNode = nodes.find((n) => n.id === imageNodeId);
      }

      if (imageNode && imageNode.data.images && Array.isArray(imageNode.data.images)) {
        imageNode.data.images.forEach((img: any, index: number) => {
          list.push({
            id: img.id,
            name: `${t("imagePrefix") || "图片"}-${imageNode?.data.id || ""}-${index + 1}`,
            category: "image",
            type: "image",
            url: img.url,
          });
        });
      }
    }

    // 收集所有场景分镜（scene）到 allAssets 中
    const sceneNodes = nodes.filter((n) => n.type === "sceneNode" || n.type === "scene-node");
    sceneNodes.forEach((n) => {
      const scenesData = n.data.scenes as any[];
      if (Array.isArray(scenesData)) {
        scenesData.forEach((scene) => {
          list.push({
            id: scene.id,
            name: scene.name || "分镜",
            category: "props", // 给一个 category 标识，以生成 @uuidprops
            type: "scene",
            prompt: scene.prompt,
            content: scene.content,
          });
        });
      }
    });

    return list;
  }, [nodes, edges, t]);

  const mentionItems = useMemo(() => {
    let imageIndex = 1;
    let fileIndex = 1;
    const fileItems = uploadedFiles.map((f) => {
      const isImage = f.type === "image";
      const name = isImage
        ? `${t("imagePrefix")}${imageIndex++}`
        : `${t("filePrefix")}${fileIndex++}`;
      return {
        id: f.id,
        name,
        category: f.type,
        url: f.previewUrl || f.file.name,
      };
    });
    return [...allAssets, ...fileItems];
  }, [allAssets, uploadedFiles, t]);

  const mentionItemsRef = useRef(mentionItems);
  useEffect(() => {
    mentionItemsRef.current = mentionItems;
  }, [mentionItems]);

  const currentSelection = useMemo(() => {
    const imgNode = nodes.find(
      (n) => (n.type === "sceneImageNode" || n.type === "scene-image-node") && n.selected,
    );
    if (imgNode) {
      return {
        type: "sceneImageNode",
        node: imgNode,
        id: imgNode.id,
        title: String(imgNode.data.id || "图像节点"),
        prompt: String(imgNode.data.prompt || ""),
      };
    }

    const vidNode = nodes.find(
      (n) => (n.type === "sceneVideoNode" || n.type === "scene-video-node") && n.selected,
    );
    if (vidNode) {
      return {
        type: "sceneVideoNode",
        node: vidNode,
        id: vidNode.id,
        title: String(vidNode.data.id || "视频节点"),
        prompt: String(vidNode.data.prompt || ""),
      };
    }

    const assetNode = nodes.find(
      (n) =>
        (n.type === "assetNode" || n.type === "asset-node") &&
        n.selected &&
        (n.data as any).selectedId,
    );
    if (assetNode) {
      const data = assetNode.data as any;
      let selectedAsset: any = null;
      Object.keys(data.assets || {}).forEach((cat) => {
        const found = data.assets[cat]?.find((a: any) => a.id === data.selectedId);
        if (found) selectedAsset = found;
      });
      if (selectedAsset) {
        return {
          type: "assetItem",
          node: assetNode,
          asset: selectedAsset,
          id: selectedAsset.id,
          title: String(selectedAsset.name || "资产"),
          prompt: String(selectedAsset.prompt || ""),
        };
      }
    }

    const selectedNodes = nodes.filter((n) => n.selected);
    if (selectedNodes.length > 0) {
      return {
        type: "node",
        node: selectedNodes[0],
        id: selectedNodes.map((n) => n.id).join(", "),
        title: selectedNodes.map((n) => n.data?.title || n.data?.name || n.id).join(", "),
        prompt: "",
      };
    }

    return null;
  }, [nodes]);

  const currentSelectionRef = useRef(currentSelection);
  useEffect(() => {
    currentSelectionRef.current = currentSelection;
  }, [currentSelection]);

  return {
    allAssets,
    mentionItems,
    mentionItemsRef,
    currentSelection,
    currentSelectionRef,
  };
}
