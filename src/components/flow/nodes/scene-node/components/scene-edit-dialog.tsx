import { useState, useEffect, useMemo, forwardRef, useImperativeHandle } from "react";
import { SceneItem } from "@/lib/types/flow.types";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFlowStore } from "@/lib/store/use-flow";
import {
  EditorContent,
  useEditor,
  ReactNodeViewRenderer,
  NodeViewWrapper,
  ReactRenderer,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Mention from "@tiptap/extension-mention";
import tippy, { Instance as TippyInstance } from "tippy.js";
import "tippy.js/dist/tippy.css";
import "@/styles/tiptap-mention.css";
import { cn } from "@/lib/utils";
import { Music, Image as ImageIcon, Video, Box, Users, FileVideo, Paperclip } from "lucide-react";

// --- Custom Asset Mention Node View ---
const AssetNodeView = (props: any) => {
  const { node } = props;
  const { label, assetType, url } = node.attrs;

  // Different colors for different asset types
  const colorMap: Record<string, string> = {
    characters: " bg-blue-500/10 border-blue-500/20",
    scenes: " bg-green-500/10 border-green-500/20",
    props: " bg-amber-500/10 border-amber-500/20",
    audio: " bg-purple-500/10 border-purple-500/20",
    image: " bg-indigo-500/10 border-indigo-500/20",
    video: " bg-rose-500/10 border-rose-500/20",
  };

  const className = colorMap[assetType] || "text-muted-foreground bg-background border-primary/20";
  const displayUrl = url;

  return (
    <NodeViewWrapper
      as="span"
      className={cn(
        "inline-flex items-center gap-1 px-2  rounded-xl  mx-1  py-1 align-middle backdrop-blur-md",
        className,
      )}
    >
      <span className="flex items-center gap-1 cursor-pointer">
        {(assetType === "image" ||
          assetType === "video" ||
          assetType === "characters" ||
          assetType === "scenes" ||
          assetType === "props") &&
          displayUrl && (
            <img src={displayUrl} alt={label} className="w-5 h-5 object-cover rounded-sm" />
          )}
        <span className="text-xs font-medium">{label}</span>
      </span>
    </NodeViewWrapper>
  );
};

// --- Custom Asset Mention Extension ---
export const AssetMention = Mention.extend({
  name: "assetMention",
  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-id"),
        renderHTML: (attributes) => {
          if (!attributes.id) return {};
          return { "data-id": attributes.id };
        },
      },
      label: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-label"),
        renderHTML: (attributes) => {
          if (!attributes.label) return {};
          return { "data-label": attributes.label };
        },
      },
      assetType: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-asset-type"),
        renderHTML: (attributes) => {
          if (!attributes.assetType) return {};
          return { "data-asset-type": attributes.assetType };
        },
      },
      url: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-url"),
        renderHTML: (attributes) => {
          if (!attributes.url) return {};
          return { "data-url": attributes.url };
        },
      },
    };
  },
  parseHTML() {
    return [
      {
        tag: 'span[data-type="assetMention"]',
      },
    ];
  },
  renderHTML({ node, HTMLAttributes }) {
    return [
      "span",
      { ...HTMLAttributes, "data-type": "assetMention" },
      `@${node.attrs.label || ""}`,
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(AssetNodeView);
  },
});

// --- Mention List Component ---
export const MentionList = forwardRef((props: any, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const tFlow = useTranslations("flow.sceneNode");

  const categoryMap: Record<string, string> = {
    characters: "角色",
    scenes: "场景",
    props: "道具",
    audio: "音频",
    image: "图片",
    video: "视频",
    file: "文件",
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "characters":
        return <Users className="w-4 h-4" />;
      case "scenes":
        return <FileVideo className="w-4 h-4" />;
      case "props":
        return <Box className="w-4 h-4" />;
      case "audio":
        return <Music className="w-4 h-4" />;
      case "image":
        return <ImageIcon className="w-4 h-4" />;
      case "video":
        return <Video className="w-4 h-4" />;
      case "file":
        return <Paperclip className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const selectItem = (index: number) => {
    const item = props.items[index];
    if (item) {
      props.command({
        id: item.id,
        label: item.name,
        assetType: item.category || item.type,
        url: item.url,
      });
    }
  };

  const upHandler = () => {
    setSelectedIndex((selectedIndex + props.items.length - 1) % props.items.length);
  };

  const downHandler = () => {
    setSelectedIndex((selectedIndex + 1) % props.items.length);
  };

  const enterHandler = () => {
    selectItem(selectedIndex);
  };

  useEffect(() => setSelectedIndex(0), [props.items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: any) => {
      if (event.key === "ArrowUp") {
        upHandler();
        return true;
      }
      if (event.key === "ArrowDown") {
        downHandler();
        return true;
      }
      if (event.key === "Enter") {
        enterHandler();
        return true;
      }
      return false;
    },
  }));

  if (!props.items || props.items.length === 0) {
    return (
      <div className="bg-popover text-popover-foreground border border-border shadow-lg rounded-xl p-3 text-sm w-64 text-center z-[999999]">
        {tFlow("noMatchedAssets")}
      </div>
    );
  }

  return (
    <div className="bg-popover text-popover-foreground border border-border/50 shadow-xl rounded-xl overflow-hidden flex flex-col w-64 max-h-75 overflow-y-auto z-99999 p-1.5 ring-1 ring-black/5 gap-x-2">
      {props.items.map((item: any, index: number) => {
        const itemType = item.category || item.type;
        const typeText = categoryMap[itemType] || itemType;

        const prevItem = index > 0 ? props.items[index - 1] : null;
        const prevItemType = prevItem ? prevItem.category || prevItem.type : null;
        const isFirstOfGroup = itemType !== prevItemType;

        return (
          <div key={index} className="flex flex-col w-full">
            {isFirstOfGroup && (
              <div
                className={cn(
                  "px-2 py-1 text-xs font-semibold text-muted-foreground bg-muted/30 sticky top-0 backdrop-blur-sm z-10 mb-1 rounded-sm",
                  index > 0 ? "mt-2" : "",
                )}
              >
                {typeText}
              </div>
            )}
            <button
              className={cn(
                "flex items-center gap-3 w-full text-left px-2 py-1.5 text-sm transition-all rounded-md outline-none select-none",
                index === selectedIndex
                  ? "bg-accent/80 text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
              )}
              onClick={() => selectItem(index)}
            >
              <div className="w-8 h-8 rounded-md shrink-0 bg-muted border border-border/50 flex items-center justify-center overflow-hidden">
                {item.url ? (
                  itemType === "audio" ? (
                    <div className="w-full h-full bg-purple-500/10 text-purple-500 flex items-center justify-center">
                      <Music className="w-4 h-4" />
                    </div>
                  ) : (
                    <img src={item.url} alt={item.name} className="w-full h-full object-cover" />
                  )
                ) : (
                  <div className="w-full h-full bg-primary/5 text-primary flex items-center justify-center">
                    {getIcon(itemType) || (
                      <span className="text-xs font-medium">
                        {itemType?.charAt(0).toUpperCase() || "?"}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="flex flex-col overflow-hidden gap-0.5">
                <span className="truncate font-medium text-foreground leading-none">
                  {item.name}
                </span>
                <span className="text-[10px] opacity-80 truncate uppercase tracking-wider">
                  {typeText}
                </span>
              </div>
            </button>
          </div>
        );
      })}
    </div>
  );
});

MentionList.displayName = "MentionList";

// --- Scene Edit Dialog ---
interface SceneEditDialogProps {
  scene: SceneItem;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, name: string, content: string, prompt?: string) => void;
}

export function SceneEditDialog({ scene, onOpenChange, onSave }: SceneEditDialogProps) {
  const tFlow = useTranslations("flow.sceneNode");
  const tCommon = useTranslations("common");
  const [name, setName] = useState(scene.name);
  const nodes = useFlowStore((state) => state.nodes);

  // Gather all assets
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
    // Ensure we always have some dummy data if the list is empty,
    // to test that the dropdown logic actually works
    if (list.length === 0) {
    }
    return list;
  }, [nodes]);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      AssetMention.configure({
        HTMLAttributes: {
          class: "asset-mention",
        },
        suggestion: {
          char: "@",
          // 使用自定义的匹配逻辑，完全覆盖默认规则，支持任何字符后直接触发 @
          findSuggestionMatch: ({ char, $position }: any) => {
            const text = $position.nodeBefore?.isText && $position.nodeBefore.text;
            if (!text) return null;

            const escapedChar = char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            // 匹配文本末尾的 @ 及其后的非空白字符
            const regexp = new RegExp(`${escapedChar}([^\\s${escapedChar}]*)$`);
            const match = regexp.exec(text);

            if (!match) return null;

            const textFrom = $position.pos - text.length;
            const from = textFrom + match.index;
            const to = from + match[0].length;

            return {
              range: { from, to },
              query: match[1],
              text: match[0],
            };
          },
          items: ({ query }: { query: string }) => {
            const list = allAssets
              .filter((item) =>
                (item.name || "").toLowerCase().includes((query || "").toLowerCase()),
              )
              .sort((a, b) => {
                const typeA = a.category || a.type || "";
                const typeB = b.category || b.type || "";
                if (typeA !== typeB) {
                  return typeA.localeCompare(typeB);
                }
                return (a.name || "").localeCompare(b.name || "");
              })
              .slice(0, 10);
            return list;
          },
          render: () => {
            let component: any;
            let popup: TippyInstance<any>[];

            return {
              onStart: (props: any) => {
                component = new ReactRenderer(MentionList, {
                  props,
                  editor: props.editor,
                });

                if (!props.clientRect) {
                  return;
                }

                // 使用 requestAnimationFrame 避免 flushSync 报错
                requestAnimationFrame(() => {
                  popup = tippy("body", {
                    getReferenceClientRect: props.clientRect,
                    appendTo: () =>
                      document.getElementById("scene-edit-dialog-content") || document.body,
                    content: component.element,
                    showOnCreate: true,
                    interactive: true,
                    trigger: "manual",
                    placement: "bottom-start",
                    zIndex: 99999,
                    allowHTML: true,
                    arrow: false,
                    offset: [0, 8],
                    theme: "asset-mention",
                  });
                });
              },
              onUpdate(props: any) {
                component?.updateProps(props);

                if (!props.clientRect) {
                  return;
                }

                requestAnimationFrame(() => {
                  popup?.[0]?.setProps({
                    getReferenceClientRect: props.clientRect,
                  });
                });
              },
              onKeyDown(props: any) {
                if (props.event.key === "Escape") {
                  popup?.[0]?.hide();
                  return true;
                }
                return component?.ref?.onKeyDown(props) || false;
              },
              onExit() {
                requestAnimationFrame(() => {
                  if (popup?.[0] && !popup[0].state.isDestroyed) {
                    popup[0].destroy();
                  }
                  component?.destroy();
                });
              },
            };
          },
        },
      }),
    ],
    content: scene.content,
  });

  const handleSave = () => {
    if (editor) {
      onSave(scene.id, name, editor.getHTML());
    }
  };

  return (
    <Dialog open={true} onOpenChange={onOpenChange}>
      <DialogContent
        id="scene-edit-dialog-content"
        className="sm:max-w-150 flex flex-col h-[80vh] z-50"
      >
        <DialogHeader>
          <DialogTitle>{tFlow("editScene")}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex flex-col gap-4 py-4 overflow-hidden px-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="scene-name">{tFlow("sceneName")}</Label>
            <Input
              id="scene-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={tFlow("sceneNamePlaceholder")}
            />
          </div>

          <div className="flex-1 flex flex-col gap-2 min-h-0">
            <div
              className="flex-1 border rounded-md p-3 overflow-y-auto bg-background/50 focus-within:ring-1 focus-within:ring-primary focus-within:border-primary/50 transition-all cursor-text text-sm"
              onClick={() => editor?.commands.focus()}
            >
              <EditorContent
                editor={editor}
                className="min-h-full outline-none [&_.ProseMirror]:min-h-50 [&_.ProseMirror]:outline-none leading-7"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tCommon("cancel")}
          </Button>
          <Button onClick={handleSave}>{tCommon("save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
