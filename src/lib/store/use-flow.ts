import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { useChatStore } from "./use-chat";
import { v4 as uuidv4 } from "uuid";
import {
  Node,
  Edge,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  Connection,
  NodeChange,
  EdgeChange,
} from "@xyflow/react";

interface FlowState {
  nodes: Node[];
  edges: Edge[];
  selectedNodeId: string | null;
  setNodes: (nodes: Node[] | ((nodes: Node[]) => Node[])) => void;
  setEdges: (edges: Edge[] | ((edges: Edge[]) => Edge[])) => void;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  addNode: (node: Node) => void;
  updateNodeData: (nodeId: string, data: any) => void;
  initFlow: (nodes: Node[], edges: Edge[]) => void;
  modifiedNodesDuringChat: Map<string, Node>; // 记录聊天期间修改过的节点信息
  setModifiedNodesDuringChat: (
    nodes: Map<string, Node> | ((prev: Map<string, Node>) => Map<string, Node>),
  ) => void;
}

const syncGraph = (state: any, set: any) => {
  const episodeNode = state.nodes.find((n: any) => n.type === "episodeNode");
  if (!episodeNode) return;

  const episodeNodeId = episodeNode.id;

  const newNodes: Node[] = [];
  const newEdges: Edge[] = [];

  newNodes.push(episodeNode);

  let currentY = 0;

  // 1. Create single Video Preview Node
  let previewNode = state.nodes.find((n: any) => n.type === "videoPreviewNode");
  const previewNodeId = previewNode ? previewNode.id : `video-preview-main`;

  const episodesData: any[] = [];

  episodeNode.data.episodes.forEach((ep: any) => {
    const epPrefix = ep.title.split(" ")[0]; // e.g. "EP_001"
    const isChecked = ep.checked;

    // 2. Scene Node
    const sceneNodeId = `scene-${ep.id}`;
    let sceneNode = state.nodes.find((n: any) => n.id === sceneNodeId);

    if (!sceneNode) {
      if (isChecked) {
        sceneNode = {
          id: sceneNodeId,
          type: "sceneNode",
          position: { x: episodeNode.position.x + 400, y: currentY },
          data: {
            title: `分镜列表 ${epPrefix}`,
            scenes: [],
            ...getSceneHandlers(set, sceneNodeId),
          },
        };
      }
    } else {
      sceneNode.data = { ...sceneNode.data, ...getSceneHandlers(set, sceneNodeId) };
      if (!Array.isArray(sceneNode.data.scenes)) {
        sceneNode.data.scenes = [];
      }
    }

    if (sceneNode) {
      const wasHidden = sceneNode.hidden !== false;
      sceneNode.hidden = !isChecked;
      if (isChecked && wasHidden) {
        sceneNode.position = { x: episodeNode.position.x + 400, y: currentY };
      }
      newNodes.push(sceneNode);

      if (isChecked) {
        newEdges.push({
          id: `e-${episodeNodeId}-${sceneNodeId}`,
          source: episodeNodeId,
          target: sceneNodeId,
          sourceHandle: "main",
          targetHandle: "in",
          animated: true,
          style: { stroke: "#6366f1", strokeWidth: 2 },
        });
      }

      let sceneY = currentY;
      let selectedVideosCount = 0;
      const episodeItems: any[] = [];

      sceneNode.data.scenes.forEach((scene: any) => {
        const isSceneSelected = scene.selected;
        const imgNodeId = `scene-image-${ep.id}-${scene.id}`;
        const vidNodeId = `scene-video-${ep.id}-${scene.id}`;

        let imgNode = state.nodes.find((n: any) => n.id === imgNodeId);
        if (!imgNode) {
          if (isChecked && isSceneSelected) {
            imgNode = {
              id: imgNodeId,
              type: "sceneImageNode",
              position: { x: episodeNode.position.x + 900, y: sceneY },
              data: { id: scene.name, isExpanded: true, ...getImageHandlers(set, imgNodeId) },
            };
          }
        } else {
          imgNode.data = { ...imgNode.data, ...getImageHandlers(set, imgNodeId) };
        }

        if (imgNode) {
          const wasImgHidden = imgNode.hidden !== false;
          imgNode.hidden = !(isChecked && isSceneSelected);
          if (isChecked && isSceneSelected && wasImgHidden) {
            imgNode.position = { x: episodeNode.position.x + 900, y: sceneY };
          }
          newNodes.push(imgNode);

          if (isChecked && isSceneSelected) {
            newEdges.push({
              id: `e-${sceneNodeId}-${imgNodeId}`,
              source: sceneNodeId,
              target: imgNodeId,
              sourceHandle: "main",
              targetHandle: "in",
              animated: true,
              style: { stroke: "#3b82f6", strokeWidth: 2 },
            });
          }
        }

        let vidNode = state.nodes.find((n: any) => n.id === vidNodeId);
        if (!vidNode) {
          if (isChecked && isSceneSelected) {
            vidNode = {
              id: vidNodeId,
              type: "sceneVideoNode",
              position: { x: episodeNode.position.x + 1400, y: sceneY },
              data: { id: scene.name, isExpanded: true, ...getVideoHandlers(set, vidNodeId) },
            };
          }
        } else {
          vidNode.data = { ...vidNode.data, ...getVideoHandlers(set, vidNodeId) };
        }

        if (vidNode) {
          const wasVidHidden = vidNode.hidden !== false;
          vidNode.hidden = !(isChecked && isSceneSelected);
          if (isChecked && isSceneSelected && wasVidHidden) {
            vidNode.position = { x: episodeNode.position.x + 1400, y: sceneY };
          }
          newNodes.push(vidNode);

          if (isChecked && isSceneSelected) {
            newEdges.push({
              id: `e-${imgNodeId}-${vidNodeId}`,
              source: imgNodeId,
              target: vidNodeId,
              sourceHandle: "main",
              targetHandle: "in",
              animated: true,
              style: { stroke: "#10b981", strokeWidth: 2 },
            });

            if (vidNode.data && vidNode.data.videos) {
              vidNode.data.videos.forEach((v: any) => {
                if (v.selected) {
                  selectedVideosCount++;
                  episodeItems.push({
                    id: v.id,
                    url: v.url,
                    poster: v.poster,
                    duration: v.duration || "10s",
                    status: v.url ? "generated" : "pending",
                  });
                }
              });
            }
          }
        }

        if (isChecked && isSceneSelected) {
          sceneY += 450;
        }
      });

      if (isChecked) {
        episodesData.push({
          id: epPrefix,
          episodeName: ep.title,
          totalScenes: sceneNode.data.scenes.length,
          selectedVideos: selectedVideosCount,
          vid: `VID_${ep.id}`,
          items: episodeItems,
        });

        const selectedScenesCount = sceneNode.data.scenes.filter((s: any) => s.selected).length;
        currentY += Math.max(450, selectedScenesCount * 450);
      }
    }
  });

  if (!previewNode) {
    previewNode = {
      id: previewNodeId,
      type: "videoPreviewNode",
      position: { x: episodeNode.position.x - 450, y: episodeNode.position.y },
      selectable: false,
      data: {
        episodes: episodesData,
      },
    };
  } else {
    // Also prevent previewNode position from jumping
    previewNode.selectable = false;
    previewNode.data = { ...previewNode.data, episodes: episodesData };
  }
  newNodes.push(previewNode);

  state.nodes.forEach((n: any) => {
    if (
      n.type !== "episodeNode" &&
      n.type !== "videoPreviewNode" &&
      n.type !== "sceneNode" &&
      n.type !== "sceneImageNode" &&
      n.type !== "sceneVideoNode"
    ) {
      newNodes.push(n);
    }
  });

  state.nodes = newNodes;
  state.edges = newEdges;
};

const getEpisodeHandlers = (set: any, nodeId: string) => ({
  onEpisodeCheck: (id: string, checked: boolean) => {
    set((state: any) => {
      const node = state.nodes.find((n: any) => n.id === nodeId);
      if (node && node.type === "episodeNode") {
        const eps = (node.data as any).episodes;

        if (checked) {
          const checkedCount = eps.filter((e: any) => e.checked).length;
          if (checkedCount >= 3) return;
        }

        const ep = eps.find((e: any) => e.id === id);
        if (ep) {
          ep.checked = checked;
        }
        syncGraph(state, set);
      }
    });
  },
  onEpisodeSelect: (id: string) => {
    set((state: any) => {
      const node = state.nodes.find((n: any) => n.id === nodeId);
      if (node && node.type === "episodeNode") {
        const data = node.data as any;
        data.activeId = data.activeId === id ? undefined : id;
      }
    });
  },
});

const getSceneHandlers = (set: any, nodeId: string) => ({
  onSceneSelect: (id: string) => {
    set((state: any) => {
      const node = state.nodes.find((n: any) => n.id === nodeId);
      if (node && node.type === "sceneNode") {
        const scenes = (node.data as any).scenes;
        const scene = scenes.find((s: any) => s.id === id);
        if (scene) {
          if (!scene.selected) {
            const selectedCount = scenes.filter((s: any) => s.selected).length;
            if (selectedCount >= 3) return;
          }
          scene.selected = !scene.selected;
        }
        syncGraph(state, set);
      }
    });
  },
  onSceneEdit: (id: string) => {
    console.log("Edit scene", id);
  },
  onSceneChange: (id: string, content: string, name?: string, prompt?: string) => {
    set((state: any) => {
      const node = state.nodes.find((n: any) => n.id === nodeId);
      if (node && node.type === "sceneNode") {
        const scenes = (node.data as any).scenes;
        const scene = scenes.find((s: any) => s.id === id);
        if (scene) {
          scene.content = content;
          if (name !== undefined) {
            scene.name = name;
          }
          if (prompt !== undefined) {
            scene.prompt = prompt;
          }
        }
      }
    });
  },
  onSceneDelete: (id: string) => {
    set((state: any) => {
      const node = state.nodes.find((n: any) => n.id === nodeId);
      if (node && node.type === "sceneNode") {
        (node.data as any).scenes = (node.data as any).scenes.filter((s: any) => s.id !== id);
        syncGraph(state, set);
      }
    });
  },
  onSceneAdd: (index: number) => {
    set((state: any) => {
      const node = state.nodes.find((n: any) => n.id === nodeId);
      if (node && node.type === "sceneNode") {
        const newId = uuidv4();
        const newScene = {
          id: newId,
          name: `S-New`,
          content: "新增的分镜内容...",
          selected: false,
        };
        (node.data as any).scenes.splice(index, 0, newScene);
        syncGraph(state, set);
      }
    });
  },
});

const getImageHandlers = (set: any, nodeId: string) => ({
  onToggleExpand: () => {
    set((state: any) => {
      const node = state.nodes.find((n: any) => n.id === nodeId);
      if (node && node.type === "sceneImageNode") {
        const data = node.data as any;
        data.isExpanded = !data.isExpanded;
      }
    });
  },
  onRatioChange: (ratio: string) => {
    set((state: any) => {
      const node = state.nodes.find((n: any) => n.id === nodeId);
      if (node && node.type === "sceneImageNode") {
        (node.data as any).ratio = ratio;
      }
    });
  },
  onOutputFormatChange: (format: string) => {
    set((state: any) => {
      const node = state.nodes.find((n: any) => n.id === nodeId);
      if (node && node.type === "sceneImageNode") {
        (node.data as any).outputFormat = format;
      }
    });
  },
  onSkillChange: (skillId: string) => {
    set((state: any) => {
      const node = state.nodes.find((n: any) => n.id === nodeId);
      if (node && node.type === "sceneImageNode") {
        (node.data as any).skillId = skillId;
      }
    });
  },
  onPromptChange: (prompt: string) => {
    set((state: any) => {
      const node = state.nodes.find((n: any) => n.id === nodeId);
      if (node && node.type === "sceneImageNode") {
        (node.data as any).prompt = prompt;
      }
    });
  },
});

const getVideoHandlers = (set: any, nodeId: string) => ({
  onToggleExpand: () => {
    set((state: any) => {
      const node = state.nodes.find((n: any) => n.id === nodeId);
      if (node && node.type === "sceneVideoNode") {
        const data = node.data as any;
        data.isExpanded = !data.isExpanded;
      }
    });
  },
  onVideoSelect: (id: string) => {
    set((state: any) => {
      const node = state.nodes.find((n: any) => n.id === nodeId);
      if (node && node.type === "sceneVideoNode") {
        const data = node.data as any;
        if (data.videos) {
          data.videos.forEach((v: any) => {
            v.selected = v.id === id;
          });
        }
      }
    });
  },
  onRatioChange: (ratio: string) => {
    set((state: any) => {
      const node = state.nodes.find((n: any) => n.id === nodeId);
      if (node && node.type === "sceneVideoNode") {
        (node.data as any).ratio = ratio;
      }
    });
  },
  onSkillChange: (skillId: string) => {
    set((state: any) => {
      const node = state.nodes.find((n: any) => n.id === nodeId);
      if (node && node.type === "sceneVideoNode") {
        (node.data as any).skillId = skillId;
      }
    });
  },
  onPromptChange: (prompt: string) => {
    set((state: any) => {
      const node = state.nodes.find((n: any) => n.id === nodeId);
      if (node && node.type === "sceneVideoNode") {
        (node.data as any).prompt = prompt;
      }
    });
  },
});

const getAssetHandlers = (set: any, nodeId: string) => ({
  onTabChange: (tab: string) => {
    set((state: any) => {
      const node = state.nodes.find((n: any) => n.id === nodeId);
      if (node && node.type === "assetNode") {
        (node.data as any).activeTab = tab;
      }
    });
  },
  onAssetAdd: (
    tab: string,
    payload: {
      name: string;
      category: string;
      description: string;
      fileUrl?: string;
      mediaType?: "image" | "audio" | "video";
      prompt?: string;
    },
  ) => {
    set((state: any) => {
      const node = state.nodes.find((n: any) => n.id === nodeId);
      if (node && node.type === "assetNode") {
        const data = node.data as any;
        const id = uuidv4();
        if (!data.assets?.[payload.category]) {
          return;
        }
        data.assets[payload.category].push({
          id,
          name: payload.name,
          type: payload.mediaType || (payload.category === "audio" ? "audio" : "image"),
          url: payload.fileUrl || "",
          description: payload.description,
          prompt: payload.prompt,
        });
        data.selectedId = id;
        data.activeTab = payload.category;
      }
    });
  },
  onAssetUpdate: (
    tab: string,
    id: string,
    payload: {
      name: string;
      category: string;
      description: string;
      fileUrl?: string;
      mediaType?: "image" | "audio" | "video";
      prompt?: string;
    },
  ) => {
    set((state: any) => {
      const node = state.nodes.find((n: any) => n.id === nodeId);
      if (node && node.type === "assetNode") {
        const data = node.data as any;
        const targetAsset = data.assets?.[tab]?.find((item: any) => item.id === id);
        if (!targetAsset) {
          return;
        }
        const nextType =
          payload.mediaType ||
          (payload.category === "audio"
            ? "audio"
            : targetAsset.type === "audio"
              ? "image"
              : targetAsset.type);
        const updatedAsset = {
          ...targetAsset,
          name: payload.name,
          type: nextType,
          url: payload.fileUrl || targetAsset.url,
          description: payload.description,
          prompt: payload.prompt !== undefined ? payload.prompt : targetAsset.prompt,
        };
        if (payload.category === tab) {
          Object.assign(targetAsset, updatedAsset);
        } else {
          data.assets[tab] = data.assets[tab].filter((item: any) => item.id !== id);
          if (!data.assets?.[payload.category]) {
            return;
          }
          data.assets[payload.category].push(updatedAsset);
          data.activeTab = payload.category;
        }
      }
    });
  },
  onAssetSelect: (id?: string) => {
    set((state: any) => {
      const node = state.nodes.find((n: any) => n.id === nodeId);
      if (node && node.type === "assetNode") {
        (node.data as any).selectedId = id;
      }
    });
  },
  onAssetDelete: (id: string) => {
    set((state: any) => {
      const node = state.nodes.find((n: any) => n.id === nodeId);
      if (node && node.type === "assetNode") {
        const data = node.data as any;
        Object.keys(data.assets).forEach((key) => {
          data.assets[key] = data.assets[key].filter((item: any) => item.id !== id);
        });
        if (data.selectedId === id) {
          data.selectedId = undefined;
        }
      }
    });
  },
});

export const rehydrateNodes = (nodes: Node[], set: any) => {
  return nodes.map((node) => {
    // Normalize node types for backward compatibility
    let type = node.type;
    if (type === "episode-node") type = "episodeNode";
    if (type === "scene-node") type = "sceneNode";
    if (type === "scene-image-node") type = "sceneImageNode";
    if (type === "scene-video-node") type = "sceneVideoNode";
    if (type === "video-preview-node") type = "videoPreviewNode";
    if (type === "asset-node") type = "assetNode";
    if (type === "result-node") type = "skillNode";
    if (type === "command-node") type = "textNode";

    const normalizedNode = { ...node, type };

    if (type === "episodeNode") {
      return {
        ...normalizedNode,
        data: { ...normalizedNode.data, ...getEpisodeHandlers(set, normalizedNode.id) },
      };
    }
    if (type === "sceneNode") {
      return {
        ...normalizedNode,
        data: { ...normalizedNode.data, ...getSceneHandlers(set, normalizedNode.id) },
      };
    }
    if (type === "sceneImageNode") {
      return {
        ...normalizedNode,
        data: { ...normalizedNode.data, ...getImageHandlers(set, normalizedNode.id) },
      };
    }
    if (type === "sceneVideoNode") {
      return {
        ...normalizedNode,
        data: { ...normalizedNode.data, ...getVideoHandlers(set, normalizedNode.id) },
      };
    }
    if (type === "assetNode") {
      return {
        ...normalizedNode,
        data: { ...normalizedNode.data, ...getAssetHandlers(set, normalizedNode.id) },
      };
    }
    return normalizedNode;
  });
};

export const useFlowStore = create<FlowState>()(
  immer((set, _get) => {
    // 初始化空的节点和连线状态，移除原有的 mock 数据
    const initialState = {
      nodes: [] as Node[],
      edges: [] as Edge[],
      selectedNodeId: null,
      modifiedNodesDuringChat: new Map<string, Node>(),
    };

    const tempState = JSON.parse(
      JSON.stringify({ ...initialState, modifiedNodesDuringChat: undefined }),
    );
    tempState.modifiedNodesDuringChat = initialState.modifiedNodesDuringChat;
    syncGraph(tempState, set);

    return {
      ...tempState,
      setModifiedNodesDuringChat: (
        update: Map<string, Node> | ((prev: Map<string, Node>) => Map<string, Node>),
      ) => {
        set((state) => {
          state.modifiedNodesDuringChat =
            typeof update === "function"
              ? update(state.modifiedNodesDuringChat as unknown as Map<string, Node>)
              : update;
        });
      },
      setNodes: (update) => {
        set((state) => {
          state.nodes = typeof update === "function" ? update(state.nodes) : update;
        });
      },
      setEdges: (update) => {
        set((state) => {
          state.edges = typeof update === "function" ? update(state.edges) : update;
        });
      },
      onNodesChange: (changes: NodeChange[]) => {
        set((state) => {
          const isChatting = useChatStore.getState().isChatting;
          const newNodes = applyNodeChanges(changes, state.nodes);

          if (isChatting) {
            // Record modified nodes during chat
            changes.forEach((change) => {
              if (
                change.type === "position" ||
                change.type === "dimensions" ||
                change.type === "replace"
              ) {
                const nodeId = change.id;
                const modifiedNode = newNodes.find((n) => n.id === nodeId);
                if (modifiedNode) {
                  state.modifiedNodesDuringChat.set(
                    nodeId,
                    JSON.parse(JSON.stringify(modifiedNode)),
                  );
                }
              }
            });
          }

          state.nodes = newNodes;
        });
      },
      onEdgesChange: (changes: EdgeChange[]) => {
        set((state) => {
          state.edges = applyEdgeChanges(changes, state.edges);
        });
      },
      onConnect: (connection: Connection) => {
        set((state) => {
          state.edges = addEdge(connection, state.edges);
        });
      },
      addNode: (node: Node) => {
        set((state) => {
          state.nodes.push(node);

          // Record added nodes during chat
          const isChatting = useChatStore.getState().isChatting;
          if (isChatting) {
            state.modifiedNodesDuringChat.set(node.id, JSON.parse(JSON.stringify(node)));
          }
        });
      },
      updateNodeData: (nodeId: string, data: any) => {
        set((state) => {
          const node = state.nodes.find((n) => n.id === nodeId);
          if (node) {
            node.data = { ...node.data, ...data };

            // Record modified nodes during chat
            const isChatting = useChatStore.getState().isChatting;
            if (isChatting) {
              state.modifiedNodesDuringChat.set(nodeId, JSON.parse(JSON.stringify(node)));
            }
          }
        });
      },
      initFlow: (nodes: Node[], edges: Edge[]) => {
        set((state) => {
          state.nodes = rehydrateNodes(
            nodes.map((n) => ({ ...n, selected: false })),
            set,
          );
          state.edges = edges.map((e) => ({ ...e, selected: false }));
          syncGraph(state, set);
        });
      },
    };
  }),
);
