"use server";

import { randomUUID } from "crypto";
import {
  addCustomPhrase as appendPhrase,
  getCustomPhrases,
  removeCustomPhraseById,
} from "@/lib/services/common-phrases.service";
import type { CustomCommonPhrase } from "@/lib/types/common-phrases.types";

export async function fetchCustomPhrases(): Promise<CustomCommonPhrase[]> {
  return getCustomPhrases();
}

export type AddCustomPhraseResult =
  | { success: true; phrases: CustomCommonPhrase[] }
  | { success: false; error: "validation" };

export async function saveCustomPhraseAction(input: {
  name: string;
  content: string;
}): Promise<AddCustomPhraseResult> {
  const name = input.name.trim();
  const content = input.content.trim();
  if (!name || !content) {
    return { success: false, error: "validation" };
  }
  if (name.length > 10 || content.length > 200) {
    return { success: false, error: "validation" };
  }

  const phrase: CustomCommonPhrase = {
    id: randomUUID(),
    name,
    content,
    createdAt: Date.now(),
  };
  await appendPhrase(phrase);
  const phrases = await getCustomPhrases();
  return { success: true, phrases };
}

export type DeleteCustomPhraseResult =
  | { success: true; phrases: CustomCommonPhrase[] }
  | { success: false; error: "not_found" };

export async function deleteCustomPhraseAction(id: string): Promise<DeleteCustomPhraseResult> {
  const trimmed = id?.trim();
  if (!trimmed) {
    return { success: false, error: "not_found" };
  }
  const removed = await removeCustomPhraseById(trimmed);
  if (!removed) {
    return { success: false, error: "not_found" };
  }
  const phrases = await getCustomPhrases();
  return { success: true, phrases };
}
