import path from "path";

export const DB_DIR_NAME = "db";
export const DB_AGENTS_FILE = "agents.json";
export const DB_COMMON_PHRASES_FILE = "common-phrases.json";

export function dbDir(): string {
  return path.join(process.cwd(), DB_DIR_NAME);
}

export function dbAgentsPath(): string {
  return path.join(dbDir(), DB_AGENTS_FILE);
}

export function dbCommonPhrasesPath(): string {
  return path.join(dbDir(), DB_COMMON_PHRASES_FILE);
}
