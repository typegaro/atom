import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import type { BuiltInTool } from "./types";
import { LOAD_SKILL_TOOL_DESCRIPTION } from "./descriptions";
import { expectString } from "../tool-runtime-args";
import { escapeXml } from "atom-bundle";
const IGNORED_DIRS = new Set([".git", "node_modules"]);
const MAX_SKILL_RESOURCE_COUNT = 128;

export function createLoadSkillTool(): BuiltInTool {
  return {
    definition: {
      name: "load_skill",
      description: LOAD_SKILL_TOOL_DESCRIPTION,
      inputSchema: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Exact skill name"
          }
        },
        required: ["name"]
      }
    },
    async run(arguments_, context) {
      const name = expectString(arguments_.name, "name");
      const skill = context.skills.find((entry) => entry.name === name);

      if (!skill) {
        throw new Error(`Unknown skill: ${name}`);
      }

      const resources = listSkillResources(skill.baseDir);

      return [
        `<skill_content name="${escapeXml(skill.name)}">`,
        skill.content,
        "",
        `Skill directory: ${skill.baseDir}`,
        "Relative paths in this skill are relative to the skill directory.",
        resources.length === 0
          ? ""
          : [
            "",
            "<skill_resources>",
            ...resources.map((resource) => `  <file>${escapeXml(resource)}</file>`),
            "</skill_resources>"
          ].join("\n"),
        "</skill_content>"
      ].filter(Boolean).join("\n");
    }
  };
}

function listSkillResources(baseDir: string): string[] {
  const files: string[] = [];
  collectSkillResources(baseDir, baseDir, files);
  return files;
}

function collectSkillResources(skillDir: string, currentDir: string, files: string[]): void {
  if (files.length >= MAX_SKILL_RESOURCE_COUNT) {
    return;
  }

  for (const entry of readdirSync(currentDir, { withFileTypes: true })) {
    if (files.length >= MAX_SKILL_RESOURCE_COUNT) {
      return;
    }

    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) {
        continue;
      }

      collectSkillResources(skillDir, resolve(currentDir, entry.name), files);
      continue;
    }

    if (!entry.isFile() || entry.name === "SKILL.md") {
      continue;
    }

    const fullPath = resolve(currentDir, entry.name);
    files.push(fullPath.slice(skillDir.length + 1));
  }
}
