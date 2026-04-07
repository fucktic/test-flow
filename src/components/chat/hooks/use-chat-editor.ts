import { useState, useRef, useEffect, MutableRefObject } from "react";
import { useEditor, ReactRenderer } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import tippy, { Instance as TippyInstance } from "tippy.js";
import { useTranslations } from "next-intl";
import {
  AssetMention,
  MentionList,
} from "@/components/flow/nodes/scene-node/components/scene-edit-dialog";
import { useFlowStore } from "@/lib/store/use-flow";

interface UseChatEditorProps {
  mentionItemsRef: MutableRefObject<any[]>;
  currentSelectionRef: MutableRefObject<any>;
  currentSelection: any;
  allAssets: any[];
  handleSendRef: MutableRefObject<(() => void) | null>;
}

export function useChatEditor({
  mentionItemsRef,
  currentSelection,
  allAssets,
  handleSendRef,
}: UseChatEditorProps) {
  const t = useTranslations("chat");
  const [input, setInput] = useState("");
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
  const { updateNodeData } = useFlowStore();
  const updateNodeDataRef = useRef(updateNodeData);

  useEffect(() => {
    updateNodeDataRef.current = updateNodeData;
  }, [updateNodeData]);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false,
      }),
      Placeholder.configure({
        placeholder: t("inputPlaceholder"),
      }),
      AssetMention.configure({
        HTMLAttributes: {
          class: "asset-mention",
        },
        suggestion: {
          char: "@",
          findSuggestionMatch: ({ char, $position }: any) => {
            const text = $position.nodeBefore?.isText && $position.nodeBefore.text;
            if (!text) return null;

            const escapedChar = char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
            const list = mentionItemsRef.current
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

                requestAnimationFrame(() => {
                  popup = tippy("body", {
                    getReferenceClientRect: props.clientRect,
                    appendTo: () => document.body,
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
    content: input,
    onUpdate: ({ editor }) => {
      setInput(editor.getText());
    },
    editorProps: {
      attributes: {
        class:
          "w-full h-20 overflow-y-auto resize-none border-0 bg-transparent focus-visible:ring-0 p-1 text-sm outline-none",
      },
      handleKeyDown: (view, event) => {
        const isMentionPopupVisible = document.querySelector(
          '.tippy-box[data-theme="asset-mention"]',
        );

        if (event.key === "Enter" && !event.shiftKey && !isMentionPopupVisible) {
          event.preventDefault();
          handleSendRef.current?.();
          return true;
        }
        return false;
      },
    },
  });

  // 根据当前选择自动更新输入框的 prompt
  useEffect(() => {
    if (!editor) return;
    const selectionId = currentSelection?.id;

    if (selectionId && selectionId !== lastSelectedId) {
      setLastSelectedId(selectionId);

      const promptText = currentSelection?.prompt || "";
      if (promptText) {
        const regex =
          /@([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})([a-zA-Z]+)?/gi;
        let lastIndex = 0;
        let match;
        const content: any[] = [];

        while ((match = regex.exec(promptText)) !== null) {
          const id = match[1];
          const assetType = match[2];

          if (match.index > lastIndex) {
            content.push({
              type: "text",
              text: promptText.substring(lastIndex, match.index),
            });
          }

          const asset = allAssets.find((a) => a.id === id);
          if (asset) {
            content.push({
              type: "assetMention",
              attrs: {
                id: asset.id,
                label: asset.name,
                assetType: assetType || asset.category || asset.type,
                url: asset.url,
              },
            });
          } else {
            content.push({
              type: "text",
              text: match[0],
            });
          }
          lastIndex = regex.lastIndex;
        }

        if (lastIndex < promptText.length) {
          content.push({
            type: "text",
            text: promptText.substring(lastIndex),
          });
        }

        setTimeout(() => {
          editor.commands.setContent({
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: content.length > 0 ? content : undefined,
              },
            ],
          });
        }, 0);
      } else {
        setTimeout(() => {
          editor.commands.clearContent();
        }, 0);
      }
    } else if (!selectionId && lastSelectedId) {
      setLastSelectedId(null);
      setTimeout(() => {
        editor.commands.clearContent();
      }, 0);
    }
  }, [currentSelection, lastSelectedId, editor, allAssets]);

  return {
    editor,
    input,
    setInput,
  };
}
