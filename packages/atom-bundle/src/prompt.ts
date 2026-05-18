import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DEFAULT_SYSTEM_PROMPT } from "./default-system-prompt";
import type { Skill } from "./skills";

export { DEFAULT_SYSTEM_PROMPT };

// Workspace instructions are intentionally coarse-grained: we read a small set
// of convention files and inject their full contents into the system prompt.
export function loadWorkspaceInstructions(workspaceRoot: string): string[] {
  return ["AGENTS.md", "CLAUDE.md"]
    .map((name) => resolve(workspaceRoot, name))
    .filter((path) => existsSync(path))
    .map((path) => readFileSync(path, "utf8").trim())
    .filter(Boolean);
}

export interface PromptShard {
  source: string;
  content: string;
}

export function buildSystemPromptShards(
  baseSystemPrompt: string,
  workspaceInstructions: string[],
  pluginInstructions: PromptShard[],
  skills: Skill[]
): PromptShard[] {
  const shards: PromptShard[] = [
    { source: "core", content: baseSystemPrompt },
    ...workspaceInstructions.map((content, index) => ({ source: `workspace:${index + 1}`, content })),
    ...pluginInstructions
  ];

  if (skills.length > 0) {
    shards.push({ source: "skills", content: buildSkillCatalog(skills) });
  }

  return shards;
}

export function buildSystemPrompt(
  baseSystemPrompt: string,
  workspaceInstructions: string[],
  pluginInstructions: string[],
  skills: Skill[]
): string {
  return buildSystemPromptShards(
    baseSystemPrompt,
    workspaceInstructions,
    pluginInstructions.map((content, index) => ({ source: `plugin:${index + 1}`, content })),
    skills
  ).map((shard) => shard.content).join("\n\n");
}

function buildSkillCatalog(skills: Skill[]): string {
  return [
    "<available_skills>",
    ...skills.flatMap((skill) => [
      "  <skill>",
      `    <name>${escapeXml(skill.name)}</name>`,
      `    <description>${escapeXml(skill.description)}</description>`,
      "  </skill>"
    ]),
    "</available_skills>"
  ].join("\n");
}

export function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
