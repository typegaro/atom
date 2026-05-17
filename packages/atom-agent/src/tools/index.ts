import type { Skill } from "atom-bundle";
import type { BuiltInTool } from "./types";
import { bashTool } from "./bash";
import { editTool } from "./edit";
import { globTool } from "./glob";
import { grepTool } from "./grep";
import { createLoadSkillTool } from "./load-skill";
import { readTool } from "./read";
import { writeTool } from "./write";

const STATIC_TOOLS = [readTool, editTool, writeTool, bashTool, globTool, grepTool] as const satisfies readonly BuiltInTool[];

export function buildCoreTools(skills: Skill[]) {
  return buildBuiltInTools(skills).map((tool) => tool.definition);
}

export function getBuiltInTool(name: string, skills: Skill[]): BuiltInTool | undefined {
  return buildBuiltInTools(skills).find((tool) => tool.definition.name === name);
}

function buildBuiltInTools(skills: Skill[]): BuiltInTool[] {
  return skills.length === 0
    ? [...STATIC_TOOLS]
    : [...STATIC_TOOLS, createLoadSkillTool()];
}
