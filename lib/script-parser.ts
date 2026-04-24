export type ParsedScriptEpisode = {
  name: string;
};

export type ParsedScript = {
  name: string;
  episodeCount: number;
  episodes: ParsedScriptEpisode[];
};

// Extract project metadata and episode headings from the markdown script.
export function parseScriptMD(content: string): ParsedScript {
  const lines = content.split("\n");

  const firstNonEmpty = lines.find((line) => line.trim().length > 0);
  const name = firstNonEmpty ? firstNonEmpty.replace(/^#+\s*/, "").trim() : "";

  const episodeSectionIndex = lines.findIndex((line) =>
    /^##\s*.+分集剧本/.test(line)
  );

  if (episodeSectionIndex === -1) {
    throw new Error("PARSE_NO_EPISODE_SECTION");
  }

  let sectionEnd = lines.length;
  for (let i = episodeSectionIndex + 1; i < lines.length; i++) {
    if (/^##\s+/.test(lines[i])) {
      sectionEnd = i;
      break;
    }
  }

  const episodes: ParsedScriptEpisode[] = [];
  for (let i = episodeSectionIndex + 1; i < sectionEnd; i++) {
    const match = lines[i].match(/^###\s*(第\d+集.*)$/);
    if (match) {
      episodes.push({ name: match[1].trim() });
    }
  }

  if (episodes.length === 0) {
    throw new Error("PARSE_NO_EPISODES");
  }

  return { name, episodeCount: episodes.length, episodes };
}
