import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { AtomConfigPath, getConfigPaths } from "@typegaro/atom-types";
import { listScopedPaths, type ConfigScope } from "./config-utils";

export type { ConfigScope };

export interface Skill {
  name: string;
  description: string;
  path: string;
  baseDir: string;
  content: string;
}

export interface SkillSource {
  name: string;
  description: string;
  path: string;
  baseDir: string;
  scope: ConfigScope;
}

// Skills are discovered from `SKILL.md` documents with a tiny frontmatter
// parser instead of a general markdown/YAML stack. That keeps loading cheap and
// makes skill files easy to author inside normal repositories.
export function listSkillSources(cwd = process.cwd()): SkillSource[] {
  const sources = new Map<string, SkillSource>();
  const paths = getConfigPaths(cwd);

  for (const [dir, scope] of listScopedPaths(paths.skillsDir, paths.localSkillsDir, cwd)) {
    if (!existsSync(dir)) {
      continue;
    }

    for (const entry of readdirSync(dir).sort((a, b) => a.localeCompare(b))) {
      const baseDir = resolve(dir, entry);
      const path = resolve(baseDir, AtomConfigPath.SkillFile);

      if (!existsSync(path)) {
        continue;
      }

      const stat = statSync(baseDir);
      if (!stat.isDirectory()) {
        continue;
      }

      const parsed = parseSkillDocument(readFileSync(path, "utf8"), path, entry);
      if (!parsed) {
        continue;
      }

      const { name, description } = parsed;
      sources.delete(name);
      sources.set(name, { name, description, path, baseDir, scope });
    }
  }

  return Array.from(sources.values());
}

// Loads the final skill bodies that can be injected into the agent prompt at
// runtime. Invalid skill files are rejected here because later stages assume a
// skill has a name, description, and non-empty body.
export function loadSkills(cwd = process.cwd()): Skill[] {
  return listSkillSources(cwd).map(({ name, description, path, baseDir }) => {
    const parsed = parseSkillDocument(readFileSync(path, "utf8"), path, name);
    if (!parsed) {
      throw new Error(`Invalid skill file: ${path}`);
    }

    return {
      name,
      description,
      path,
      baseDir,
      content: parsed.body
    };
  });
}

function parseSkillDocument(content: string, path: string, directoryName: string): { name: string; description: string; body: string } | undefined {
  const normalized = content.replace(/^\uFEFF/, "");

  if (!normalized.startsWith("---\n")) {
    return undefined;
  }

  const frontmatterEnd = normalized.indexOf("\n---\n", 4);
  if (frontmatterEnd === -1) {
    return undefined;
  }

  const frontmatter = normalized.slice(4, frontmatterEnd);
  const body = normalized.slice(frontmatterEnd + 5).trim();
  const metadata = parseFrontmatterBlock(frontmatter);
  const title = metadata.title?.trim();
  const description = metadata.description?.trim();

  if (!title || !description || !body) {
    return undefined;
  }

  return {
    name: title,
    description,
    body
  };
}

function parseFrontmatterBlock(frontmatter: string): Record<string, string> {
  const result: Record<string, string> = {};

  for (const rawLine of frontmatter.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf(":");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();

    if (!key) {
      continue;
    }

    result[key] = stripYamlQuotes(value);
  }

  return result;
}

function stripYamlQuotes(value: string): string {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }

  return value;
}
