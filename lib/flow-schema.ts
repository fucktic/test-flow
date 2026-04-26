import {z} from "zod";
import type {JsonObject, JsonValue} from "@/lib/project-types";

const nodePositionSchema = z.object({
  x: z.number(),
  y: z.number(),
});

const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
);

const nodeDataSchema: z.ZodType<JsonObject> = z.record(z.string(), jsonValueSchema);

const flowNodeSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1).optional(),
  position: nodePositionSchema,
  data: nodeDataSchema.optional(),
  hidden: z.boolean().optional(),
});

const flowEdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  sourceHandle: z.string().optional(),
  targetHandle: z.string().optional(),
  animated: z.boolean().optional(),
  hidden: z.boolean().optional(),
  style: z.record(z.string(), jsonValueSchema).optional(),
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
      type: "default",
      position: {x: 40, y: 80},
      data: {label: "Brief"},
    },
    {
      id: "canvas",
      type: "default",
      position: {x: 340, y: 80},
      data: {label: "Canvas"},
    },
    {
      id: "publish",
      type: "default",
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
