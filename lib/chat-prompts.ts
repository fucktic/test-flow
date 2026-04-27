export type ChatFeatureSkill =
  | "asset-parse"
  | "asset-map-generate"
  | "asset-generate"
  | "general-chat"
  | "node-image-generate"
  | "storyboard-parse"
  | "video-generate";

type BuildSystemPromptParams = {
  featureSkill: ChatFeatureSkill;
  projectId: string;
  projectRoot: string;
};

type BuildFeaturePromptParams = {
  featureSkill: ChatFeatureSkill;
  userText: string;
};

export const FIXED_SYSTEM_PROMPT_TEMPLATE =
  "[System Instruction] " +
  "Skills are located at {projectRoot}/skills/. Before responding, list the available skill folders, read the best matching SKILL.md, and execute the matching workflow directly when useful. " +
  "All file reads and writes must stay within {projectRoot}/projects/{projectId}/. Never create or modify files inside the skills/ directory.";

const FEATURE_SKILL_PROMPTS: Record<ChatFeatureSkill, string> = {
  "asset-parse":
    "Feature skill: asset parsing. Parse the current project script and flow into reusable character, scene, prop, voice, and video asset records. Update only the project-scoped serializable asset data and keep every generated field ready for later image or video generation.",
  "asset-map-generate":
    "Feature skill: asset map generation. Build or refresh the storyboard asset map for the active scenes. Resolve which character, scene, prop, and reference assets each shot needs, preserve stable asset IDs, and keep references compatible with the video prompt workflow.",
  "asset-generate":
    "Feature skill: asset image generation. Generate or refresh production-ready global asset images from the parsed asset prompts. Save images only inside the current project, write serializable URLs and prompts back to project data, and keep existing valid assets unless the user asks to replace them.",
  "general-chat":
    "Feature skill: general project chat. Use the current project context, choose the most relevant available skill when useful, and answer or act without changing files unless the user clearly requests a project update.",
  "node-image-generate":
    "Feature skill: node image generation. Generate or replace the selected node image from the node prompt, user prompt, selected model, and any attached references. Save the resulting image in the current project and update only the selected image node or media item.",
  "storyboard-parse":
    "Feature skill: storyboard parsing. Parse the current episode or selected script content into storyboard scenes. Create concise shot names, descriptions, image prompts, video prompts, and serializable flow node data that can be persisted to flow.json.",
  "video-generate":
    "Feature skill: video generation. Generate or replace the selected storyboard video from the video prompt, selected model, duration, shot options, and referenced images. Save the video in the current project and update only the selected video node or media item.",
};

export function buildChatSystemPrompt({
  featureSkill,
  projectId,
  projectRoot,
}: BuildSystemPromptParams) {
  const fixedPrompt = FIXED_SYSTEM_PROMPT_TEMPLATE.replaceAll(
    "{projectRoot}",
    projectRoot,
  ).replaceAll("{projectId}", projectId);

  return [
    fixedPrompt,
    `[Feature Skill]\n${featureSkill}`,
    `[Feature Prompt]\n${FEATURE_SKILL_PROMPTS[featureSkill]}`,
  ].join("\n");
}

export function buildFeatureUserPrompt({ featureSkill, userText }: BuildFeaturePromptParams) {
  return [
    `[Requested Feature Skill]\n${featureSkill}`,
    `[Feature Task]\n${FEATURE_SKILL_PROMPTS[featureSkill]}`,
    `[User Prompt]\n${userText}`,
  ].join("\n");
}
