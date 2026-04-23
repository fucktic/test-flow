import {z} from "zod";

const nodePositionSchema = z.object({
  x: z.number(),
  y: z.number(),
});

const nodeDataSchema = z.object({
  label: z.string().min(1),
});

const flowNodeSchema = z.object({
  id: z.string().min(1),
  position: nodePositionSchema,
  data: nodeDataSchema,
});

const flowEdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  animated: z.boolean().optional(),
});

export const flowStateSchema = z.object({
  nodes: z.array(flowNodeSchema),
  edges: z.array(flowEdgeSchema),
});

export type FlowState = z.infer<typeof flowStateSchema>;

export const initialFlowState = flowStateSchema.parse({
  nodes: [
    {
      id: "brief",
      position: {x: 40, y: 80},
      data: {label: "Brief"},
    },
    {
      id: "canvas",
      position: {x: 340, y: 80},
      data: {label: "Canvas"},
    },
    {
      id: "publish",
      position: {x: 640, y: 80},
      data: {label: "Publish"},
    },
  ],
  edges: [
    {
      id: "brief-canvas",
      source: "brief",
      target: "canvas",
      animated: true,
    },
    {
      id: "canvas-publish",
      source: "canvas",
      target: "publish",
      animated: true,
    },
  ],
});
