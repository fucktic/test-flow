import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
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
}

const syncGraph = (state: any, set: any) => {
  const episodeNode = state.nodes.find((n: any) => n.id === "episode-1");
  if (!episodeNode) return;

  const checkedEpisodes = episodeNode.data.episodes.filter((ep: any) => ep.checked);

  const newNodes: Node[] = [];
  const newEdges: Edge[] = [];

  const previewNode = state.nodes.find((n: any) => n.id === "video-preview-1");
  if (previewNode) newNodes.push(previewNode);
  newNodes.push(episodeNode);

  if (previewNode) {
    newEdges.push({
      id: "e-ep-vp",
      source: "episode-1",
      target: "video-preview-1",
      sourceHandle: "main",
      animated: true,
      style: { stroke: "#6366f1", strokeWidth: 2 },
    });
  }

  let currentY = 0;

  checkedEpisodes.forEach((ep: any) => {
    const sceneNodeId = `scene-${ep.id}`;
    let sceneNode = state.nodes.find((n: any) => n.id === sceneNodeId);

    if (!sceneNode) {
      sceneNode = {
        id: sceneNodeId,
        type: "sceneNode",
        position: { x: 450, y: currentY },
        data: {
          title: `分镜列表 ${ep.title.split(" ")[0]}`,
          scenes: JSON.parse(JSON.stringify(defaultScenes)),
          ...getSceneHandlers(set, sceneNodeId),
        },
      };
    } else {
      sceneNode.position.y = currentY;
      sceneNode.data = { ...sceneNode.data, ...getSceneHandlers(set, sceneNodeId) };
    }

    newNodes.push(sceneNode);
    newEdges.push({
      id: `e-ep-${sceneNodeId}`,
      source: "episode-1",
      target: sceneNodeId,
      sourceHandle: "main",
      animated: true,
      style: { stroke: "#6366f1", strokeWidth: 2 },
    });

    const selectedScenes = sceneNode.data.scenes.filter((s: any) => s.selected);
    let sceneY = currentY;

    selectedScenes.forEach((scene: any) => {
      const imgNodeId = `scene-image-${ep.id}-${scene.id}`;
      const vidNodeId = `scene-video-${ep.id}-${scene.id}`;

      let imgNode = state.nodes.find((n: any) => n.id === imgNodeId);
      if (!imgNode) {
        imgNode = {
          id: imgNodeId,
          type: "sceneImageNode",
          position: { x: 950, y: sceneY },
          data: { sceneId: scene.name, isExpanded: true, ...getImageHandlers(set, imgNodeId) },
        };
      } else {
        imgNode.position.y = sceneY;
        imgNode.data = { ...imgNode.data, ...getImageHandlers(set, imgNodeId) };
      }

      let vidNode = state.nodes.find((n: any) => n.id === vidNodeId);
      if (!vidNode) {
        vidNode = {
          id: vidNodeId,
          type: "sceneVideoNode",
          position: { x: 1350, y: sceneY },
          data: { sceneId: scene.name, isExpanded: true, ...getVideoHandlers(set, vidNodeId) },
        };
      } else {
        vidNode.position.y = sceneY;
        vidNode.data = { ...vidNode.data, ...getVideoHandlers(set, vidNodeId) };
      }

      newNodes.push(imgNode, vidNode);

      newEdges.push({
        id: `e-${sceneNodeId}-${imgNodeId}`,
        source: sceneNodeId,
        target: imgNodeId,
        sourceHandle: "main",
        animated: true,
        style: { stroke: "#3b82f6", strokeWidth: 2 },
      });
      newEdges.push({
        id: `e-${imgNodeId}-${vidNodeId}`,
        source: imgNodeId,
        target: vidNodeId,
        sourceHandle: "main",
        animated: true,
        style: { stroke: "#10b981", strokeWidth: 2 },
      });

      sceneY += 450;
    });

    currentY += Math.max(450, selectedScenes.length * 450);
  });

  const totalHeight = currentY;
  const centerY = Math.max(0, totalHeight / 2 - 200);

  episodeNode.position.y = centerY;
  if (previewNode) {
    previewNode.position.y = centerY - 350;
  }

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

const getEpisodeHandlers = (set: any) => ({
  onEpisodeCheck: (id: string, checked: boolean) => {
    set((state: any) => {
      const node = state.nodes.find((n: any) => n.id === "episode-1");
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
      const node = state.nodes.find((n: any) => n.id === "episode-1");
      if (node && node.type === "episodeNode") {
        const data = node.data as any;
        data.activeEpisodeId = data.activeEpisodeId === id ? undefined : id;
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
        const newId = `s${Date.now()}`;
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

export const rehydrateNodes = (nodes: Node[], set: any) => {
  return nodes.map((node) => {
    if (node.type === "episodeNode") {
      return { ...node, data: { ...node.data, ...getEpisodeHandlers(set) } };
    }
    if (node.type === "sceneNode") {
      return { ...node, data: { ...node.data, ...getSceneHandlers(set, node.id) } };
    }
    if (node.type === "sceneImageNode") {
      return { ...node, data: { ...node.data, ...getImageHandlers(set, node.id) } };
    }
    if (node.type === "sceneVideoNode") {
      return { ...node, data: { ...node.data, ...getVideoHandlers(set, node.id) } };
    }
    return node;
  });
};

const defaultScenes = [
  {
    id: "s1",
    name: "S-1",
    content:
      "门被推开，林星阑站在门口。她的衣服被雨水打湿，发丝紧贴脸颊，眼神中带着一丝不甘与决绝。光线从她身后映入，勾勒出她的轮廓。",
    selected: false,
  },
  {
    id: "s2",
    name: "S-2",
    content:
      "门被推开，林星阑站在门口。她的衣服被雨水打湿，发丝紧贴脸颊，眼神中带着一丝不甘与决绝。光线从她身后映入，勾勒出她的轮廓。",
    selected: true,
  },
  {
    id: "s3",
    name: "S-3",
    content:
      "门被推开，林星阑站在门口。她的衣服被雨水打湿，发丝紧贴脸颊，眼神中带着一丝不甘与决绝。光线从她身后映入，勾勒出她的轮廓。",
    selected: true,
  },
];

export const useFlowStore = create<FlowState>()(
  immer((set, _get) => {
    const initialState = {
      nodes: [
        {
          id: "video-preview-1",
          type: "videoPreviewNode",
          position: { x: 0, y: 0 },
          data: {
            episodeId: "EP_002",
            progress: { current: 3, total: 12 },
            vid: "VID_20260312",
            items: [
              {
                id: "S-1",
                status: "generated",
                url: "https://images.unsplash.com/photo-1682687220742-aba13b6e50ba?q=80&w=200&h=200&auto=format&fit=crop",
                duration: "10s",
              },
              { id: "S-2", status: "pending" },
              {
                id: "S-3",
                status: "generated",
                url: "https://images.unsplash.com/photo-1682687982501-1e5898cb8f4b?q=80&w=200&h=200&auto=format&fit=crop",
                duration: "5s",
              },
            ],
          },
        },
        {
          id: "episode-1",
          type: "episodeNode",
          position: { x: 0, y: 350 },
          data: {
            episodes: [
              { id: "ep1", title: "EP_001 第1集", checked: false },
              {
                id: "ep2",
                title: "EP_002 第2集",
                checked: true,
                script: {
                  title: "EP_002 剧本",
                  timestamp: "2024-03-20 14:30",
                  content: "林星阑站在门口...",
                },
              },
              { id: "ep3", title: "EP_003 第3集", checked: false },
            ],
            activeEpisodeId: "ep2",
            ...getEpisodeHandlers(set),
          },
        },
      ] as Node[],
      edges: [] as Edge[],
      selectedNodeId: null,
    };

    const tempState = JSON.parse(JSON.stringify(initialState));
    syncGraph(tempState, set);

    return {
      ...tempState,
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
          state.nodes = applyNodeChanges(changes, state.nodes);
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
        });
      },
      updateNodeData: (nodeId: string, data: any) => {
        set((state) => {
          const node = state.nodes.find((n) => n.id === nodeId);
          if (node) {
            node.data = { ...node.data, ...data };
          }
        });
      },
      initFlow: (nodes: Node[], edges: Edge[]) => {
        set((state) => {
          state.nodes = rehydrateNodes(nodes, set);
          state.edges = edges;
        });
      },
    };
  }),
);
