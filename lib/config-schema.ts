import { z } from "zod";

export const videoReferenceModeSchema = z.enum(["all-purpose", "first-last-frame"]);

export const imageModelSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  apiKey: z.string().min(1),
  example: z.string().min(1),
});

export const videoModelSchema = imageModelSchema.extend({
  videoReferenceMode: videoReferenceModeSchema,
});

export const imageBedSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  apiKey: z.string().min(1),
  example: z.string().min(1),
  isDefault: z.boolean(),
});

export const appConfigSchema = z.object({
  imageModels: z.array(imageModelSchema),
  videoModels: z.array(videoModelSchema),
  imageBeds: z.array(imageBedSchema),
});

export type VideoReferenceMode = z.infer<typeof videoReferenceModeSchema>;
export type ImageModelConfig = z.infer<typeof imageModelSchema>;
export type VideoModelConfig = z.infer<typeof videoModelSchema>;
export type ImageBedConfig = z.infer<typeof imageBedSchema>;
export type AppConfig = z.infer<typeof appConfigSchema>;
