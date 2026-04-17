import fs from "fs/promises";
import type { CommonPhrasesFileShape, CustomCommonPhrase } from "@/lib/types/common-phrases.types";
import { dbCommonPhrasesPath, dbDir } from "@/lib/constants/db-paths";

async function readFile(): Promise<CommonPhrasesFileShape> {
  const filePath = dbCommonPhrasesPath();
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw) as CommonPhrasesFileShape;
    return {
      custom: Array.isArray(parsed.custom) ? parsed.custom : [],
    };
  } catch {
    return { custom: [] };
  }
}

async function writeFile(data: CommonPhrasesFileShape): Promise<void> {
  await fs.mkdir(dbDir(), { recursive: true });
  await fs.writeFile(dbCommonPhrasesPath(), JSON.stringify(data, null, 2), "utf-8");
}

export async function getCustomPhrases(): Promise<CustomCommonPhrase[]> {
  const data = await readFile();
  return data.custom;
}

export async function addCustomPhrase(phrase: CustomCommonPhrase): Promise<void> {
  const data = await readFile();
  data.custom.push(phrase);
  await writeFile(data);
}

/** 按 id 删除自定义短语；不存在则返回 false */
export async function removeCustomPhraseById(id: string): Promise<boolean> {
  const data = await readFile();
  const next = data.custom.filter((p) => p.id !== id);
  if (next.length === data.custom.length) {
    return false;
  }
  await writeFile({ custom: next });
  return true;
}
