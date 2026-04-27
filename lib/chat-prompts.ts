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

const joinPrompt = (parts: string[]) => parts.join(" ");

export const FIXED_SYSTEM_PROMPT_TEMPLATE =
  "[System Instruction] " +
  "Skills are located at {projectRoot}/skills/. Before responding, list the available skill folders, read the best matching SKILL.md, and execute the matching workflow directly when useful. " +
  "All file reads and writes must stay within {projectRoot}/projects/{projectId}/. Never create or modify files inside the skills/ directory.";

const COMMAND_PROMPTS = {
  analyze:
    "Command ~analyze: extract global assets, asset prompts, and the asset image call plan. Write detailed assets to images/images.json, grouped references to project.json.assets, and image call plans to image-curl-manifest.json.",
  generateAssets:
    "Command ~generate-assets: generate asset reference images from parsed asset prompts, save images to images/{uuid}.png, and update image-curl-manifest.json.",
  generateStoryboardImages:
    "Command ~generate-storyboard-images: generate first-frame and last-frame images, save images to images/{uuid}.png, and update frame prompt/url fields.",
  linkAssets: "Command ~link-assets: link assets to a single storyboard shot by updating that storyboard's images field.",
  splitEpisode: "Command ~split-episode: split a single episode script into storyboard shots and write episode/{episode_id}.json.",
  status: "Command ~status: check the current project progress and output only a progress report.",
  storyboardPrompts:
    "Command ~storyboard-prompts: generate first-frame and last-frame image prompts and write episodes/{episode_id}/image-prompts/{storyboard_id}.md.",
  uploadImages:
    "Command ~upload-images: upload local images to the configured image host and write image-url-manifest.json.",
  videoPrompts:
    "Command ~video-prompts: generate the video prompt for a single storyboard shot and write episodes/{episode_id}/video-prompts/{storyboard_id}.md.",
  generateVideos:
    "Command ~generate-videos: generate a single storyboard video, save videos/{uuid}.mp4, update videos/videos.json, and update the storyboard videos field.",
} as const;

const ASSET_STORAGE_GUARD =
  "Follow the storage contract in this feature task exactly, keep data serializable, do not create or write assets.json, use asset prompts in the current project/script language, and set project.json assetsParsed to true.";

export const ASSET_PARSE_USER_PROMPT = "Run ~analyze for the current project.";
export const ASSET_GENERATE_USER_PROMPT =
  "Run ~generate-assets for the current filtered asset set.";

const FEATURE_SKILL_PROMPTS: Record<ChatFeatureSkill, string> = {
  "asset-parse": joinPrompt(["Feature: asset parsing.", COMMAND_PROMPTS.analyze, ASSET_STORAGE_GUARD]),
  "asset-map-generate": joinPrompt([
    "Feature: asset map generation.",
    COMMAND_PROMPTS.linkAssets,
    "Build or refresh asset relationships for active scenes, resolve which character, scene, prop, and reference assets each shot needs, preserve stable asset IDs, and keep references compatible with the video prompt workflow.",
  ]),
  "asset-generate": joinPrompt([
    "Feature: asset image generation.",
    COMMAND_PROMPTS.generateAssets,
    COMMAND_PROMPTS.uploadImages,
    "Save images only inside the current project, write serializable URLs and prompts back to project data, and keep existing valid assets unless the user asks to replace them.",
  ]),
  "general-chat": joinPrompt([
    "Feature: general project chat.",
    "Use the current project context, choose the most relevant available workflow when useful, and answer or act without changing files unless the user clearly requests a project update.",
    `If the user asks for project progress or uses ~status, ${COMMAND_PROMPTS.status}`,
  ]),
  "node-image-generate": joinPrompt([
    "Feature: node image generation.",
    COMMAND_PROMPTS.generateStoryboardImages,
    "Generate or replace the selected node image from the node prompt, user prompt, selected model, and any attached references. Save the resulting image in the current project and update only the selected image node or media item.",
  ]),
  "storyboard-parse": joinPrompt([
    "Feature: storyboard parsing.",
    COMMAND_PROMPTS.splitEpisode,
    "Write episode/{episode_id}.json as a serializable storyboard array. Each item must include id, name, description, prompt, videoPrompt, images, videos, and selectedVideo. Use concise names, generation-ready image prompts, generation-ready videoPrompt fields, matched asset UUIDs, preserved videos, and selectedVideo values.",
  ]),
  "video-generate": joinPrompt([
    "Feature: video generation.",
    COMMAND_PROMPTS.videoPrompts,
    COMMAND_PROMPTS.generateVideos,
    "Generate or replace storyboard video from the video prompt, selected model, duration, shot options, and referenced images.",
  ]),
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
    `[Feature]\n${featureSkill}`,
    `[Feature Task]\n${FEATURE_SKILL_PROMPTS[featureSkill]}`,
  ].join("\n");
}

export function buildFeatureUserPrompt({ featureSkill, userText }: BuildFeaturePromptParams) {
  return [
    `[Feature Task]\n${FEATURE_SKILL_PROMPTS[featureSkill]}`,
    `[User Instruction]\n${userText}`,
  ].join("\n");
}
