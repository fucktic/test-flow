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
}

export const useFlowStore = create<FlowState>()(
  immer((set) => ({
    nodes: [
      {
        id: "episode-1",
        type: "episodeNode",
        position: { x: 100, y: 100 },
        data: {
          activeEpisodeId: "ep2",
          episodes: [
            { id: "ep1", title: "EP_001 雨夜的加冕", checked: false },
            {
              id: "ep2",
              title: "EP_002 危险的盟友",
              checked: true,
              script: {
                title: "剧本详情",
                timestamp: "2024-03-15 12:13:56",
                content:
                  "门被推开，林星阑站在门口。雨水顺着雨衣滴落，发丝紧贴脸颊，眼神中带着一丝不甘与决绝。光线从他身后跌入，与他交织的阴影。\n\n数月前，林星阑接任家族事业最鼎盛的时期。仅仅数月被家族人权，排血洗牌之后，只有他口袋里的这封信能证明林星阑，这宗表面光鲜公司的资产流水，林星阑需要找线，找到可以打破僵局的人。\n\n林星阑接任林氏家族人事最鼎盛洗牌后，仅仅数月被家族人权，排血洗牌之后，只有他口袋里的这封信能证明林星阑，这宗表面光鲜公司的资产流水，林星阑需要找线，找到可以打破僵局的人。",
              },
            },
            { id: "ep3", title: "EP_003 码头的审判", checked: false },
            { id: "ep4", title: "EP_004 红裙下的谎言", checked: false },
            { id: "ep5", title: "EP_005 黑白狂舞的结局", checked: false },
          ],
          onEpisodeCheck: (id: string, checked: boolean) => {
            set((state) => {
              const node = state.nodes.find((n) => n.id === "episode-1");
              if (node && node.type === "episodeNode") {
                const ep = (node.data as any).episodes.find((e: any) => e.id === id);
                if (ep) {
                  ep.checked = checked;
                }
              }
            });
          },
          onEpisodeSelect: (id: string) => {
            set((state) => {
              const node = state.nodes.find((n) => n.id === "episode-1");
              if (node && node.type === "episodeNode") {
                const data = node.data as any;
                data.activeEpisodeId = data.activeEpisodeId === id ? undefined : id;
              }
            });
          },
        },
      },
      {
        id: "scene-1",
        type: "sceneNode",
        position: { x: 550, y: 100 },
        data: {
          title: "EP_002",
          subtitle: "可多选多组分镜同时编辑",
          scenes: [
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
            {
              id: "s4",
              name: "S-4",
              content:
                "门被推开，林星阑站在门口。她的衣服被雨水打湿，发丝紧贴脸颊，眼神中带着一丝不甘与决绝。光线从她身后映入，勾勒出她的轮廓。",
              selected: false,
            },
            {
              id: "s5",
              name: "S-5",
              content:
                "门被推开，林星阑站在门口。她的衣服被雨水打湿，发丝紧贴脸颊，眼神中带着一丝不甘与决绝。光线从她身后映入，勾勒出她的轮廓。",
              selected: true,
            },
          ],
          onSceneSelect: (id: string) => {
            set((state) => {
              const node = state.nodes.find((n) => n.id === "scene-1");
              if (node && node.type === "sceneNode") {
                const scene = (node.data as any).scenes.find((s: any) => s.id === id);
                if (scene) {
                  scene.selected = !scene.selected;
                }
              }
            });
          },
          onSceneEdit: (id: string) => {
            console.log("Edit scene", id);
          },
          onSceneDelete: (id: string) => {
            set((state) => {
              const node = state.nodes.find((n) => n.id === "scene-1");
              if (node && node.type === "sceneNode") {
                (node.data as any).scenes = (node.data as any).scenes.filter(
                  (s: any) => s.id !== id,
                );
              }
            });
          },
          onSceneAdd: (index: number) => {
            set((state) => {
              const node = state.nodes.find((n) => n.id === "scene-1");
              if (node && node.type === "sceneNode") {
                const newId = `s${Date.now()}`;
                const newScene = {
                  id: newId,
                  name: `S-New`,
                  content: "新增的分镜内容...",
                  selected: false,
                };
                (node.data as any).scenes.splice(index, 0, newScene);
              }
            });
          },
        },
      },
      {
        id: "scene-image-1",
        type: "sceneImageNode",
        position: { x: 950, y: 100 },
        data: {
          sceneId: "S-2",
          imageUrl: "",
          assetPath: "asset/imageS2.1",
          isExpanded: true,
          referenceImages: [
            { id: "ref1", url: "" },
            { id: "ref2", url: "" },
            { id: "ref3", url: "" },
          ],
          outputFormat: "9grid",
          ratio: "16:9",
          skillId: "gemini-2.5-flat",
          prompt:
            "按照提供的参考图与分镜脚本进行生成图像，合理的场景结构、光影氛围，叙事感强，符合影视动画分镜标准的高质量成品图。",
          onToggleExpand: () => {
            set((state) => {
              const node = state.nodes.find((n) => n.id === "scene-image-1");
              if (node && node.type === "sceneImageNode") {
                const data = node.data as any;
                data.isExpanded = !data.isExpanded;
              }
            });
          },
          onRatioChange: (ratio: string) => {
            set((state) => {
              const node = state.nodes.find((n) => n.id === "scene-image-1");
              if (node && node.type === "sceneImageNode") {
                (node.data as any).ratio = ratio;
              }
            });
          },
          onOutputFormatChange: (format: string) => {
            set((state) => {
              const node = state.nodes.find((n) => n.id === "scene-image-1");
              if (node && node.type === "sceneImageNode") {
                (node.data as any).outputFormat = format;
              }
            });
          },
          onSkillChange: (skillId: string) => {
            set((state) => {
              const node = state.nodes.find((n) => n.id === "scene-image-1");
              if (node && node.type === "sceneImageNode") {
                (node.data as any).skillId = skillId;
              }
            });
          },
          onPromptChange: (prompt: string) => {
            set((state) => {
              const node = state.nodes.find((n) => n.id === "scene-image-1");
              if (node && node.type === "sceneImageNode") {
                (node.data as any).prompt = prompt;
              }
            });
          },
        },
      },
      {
        id: "scene-video-1",
        type: "sceneVideoNode",
        position: { x: 950, y: 500 },
        data: {
          sceneId: "S-3",
          videos: [
            {
              id: "v1",
              url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=800",
              selected: false,
            },
            {
              id: "v2",
              url: "https://images.unsplash.com/photo-1518791841217-8f162f1e1131?auto=format&fit=crop&q=80&w=800",
              selected: true,
            },
          ],
          assetPath: "asset/videoS3.1",
          isExpanded: true,
          referenceImages: [
            { id: "ref1", url: "" },
            { id: "ref2", url: "" },
            { id: "ref3", url: "" },
            { id: "ref4", url: "" },
          ],
          ratio: "16:9",
          skillId: "Seedance 1.5 P",
          prompt:
            "请根据提供的素材图像进行视频生成，严格遵循原图的内容、构图与风格，生成逻辑连贯、动作自然、光影真实、过渡流畅的动态视频。",
          onToggleExpand: () => {
            set((state) => {
              const node = state.nodes.find((n) => n.id === "scene-video-1");
              if (node && node.type === "sceneVideoNode") {
                const data = node.data as any;
                data.isExpanded = !data.isExpanded;
              }
            });
          },
          onVideoSelect: (id: string) => {
            set((state) => {
              const node = state.nodes.find((n) => n.id === "scene-video-1");
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
            set((state) => {
              const node = state.nodes.find((n) => n.id === "scene-video-1");
              if (node && node.type === "sceneVideoNode") {
                (node.data as any).ratio = ratio;
              }
            });
          },
          onSkillChange: (skillId: string) => {
            set((state) => {
              const node = state.nodes.find((n) => n.id === "scene-video-1");
              if (node && node.type === "sceneVideoNode") {
                (node.data as any).skillId = skillId;
              }
            });
          },
          onPromptChange: (prompt: string) => {
            set((state) => {
              const node = state.nodes.find((n) => n.id === "scene-video-1");
              if (node && node.type === "sceneVideoNode") {
                (node.data as any).prompt = prompt;
              }
            });
          },
        },
      },
      {
        id: "video-preview-1",
        type: "videoPreviewNode",
        position: { x: 1500, y: 100 },
        data: {
          episodeId: "EP_002",
          progress: {
            current: 9,
            total: 30,
          },
          vid: "VID_20260312",
          items: [
            {
              id: "S-1",
              url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=400",
              duration: "10s",
              status: "generated",
            },
            {
              id: "S-2",
              url: "https://images.unsplash.com/photo-1518791841217-8f162f1e1131?auto=format&fit=crop&q=80&w=400",
              duration: "10s",
              status: "generated",
            },
            {
              id: "S-3",
              url: "https://images.unsplash.com/photo-1506744626753-143d289069d2?auto=format&fit=crop&q=80&w=400",
              duration: "15s",
              status: "generated",
            },
            {
              id: "S-4",
              url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=400",
              duration: "10s",
              status: "generated",
            },
            {
              id: "S-5",
              url: "https://images.unsplash.com/photo-1518791841217-8f162f1e1131?auto=format&fit=crop&q=80&w=400",
              duration: "15s",
              status: "generated",
            },
            {
              id: "S-6",
              url: "https://images.unsplash.com/photo-1506744626753-143d289069d2?auto=format&fit=crop&q=80&w=400",
              duration: "15s",
              status: "generated",
            },
            {
              id: "S-7",
              url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=400",
              duration: "10s",
              status: "generated",
            },
            { id: "S-8", status: "pending" },
            {
              id: "S-9",
              url: "https://images.unsplash.com/photo-1518791841217-8f162f1e1131?auto=format&fit=crop&q=80&w=400",
              duration: "15s",
              status: "generated",
            },
            {
              id: "S-10",
              url: "https://images.unsplash.com/photo-1506744626753-143d289069d2?auto=format&fit=crop&q=80&w=400",
              duration: "10s",
              status: "generated",
            },
            { id: "S-11", status: "pending" },
            { id: "S-12", status: "pending" },
            { id: "S-13", status: "pending" },
            { id: "S-14", status: "pending" },
            { id: "S-15", status: "pending" },
            { id: "S-16", status: "pending" },
            { id: "S-17", status: "pending" },
            { id: "S-18", status: "pending" },
            { id: "S-19", status: "pending" },
            { id: "S-20", status: "pending" },
          ],
        },
      },
    ],
    edges: [
      {
        id: "e1-2",
        source: "episode-1",
        target: "scene-1",
        sourceHandle: "main",
        targetHandle: "in",
        animated: true,
        style: { stroke: "#F97316", strokeWidth: 2 },
      },
      {
        id: "e2-3",
        source: "scene-1",
        target: "scene-image-1",
        sourceHandle: "main",
        targetHandle: "target",
        animated: true,
        style: { stroke: "#3b82f6", strokeWidth: 2 },
      },
    ],
    selectedNodeId: null,

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
  })),
);
