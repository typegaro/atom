import { homedir } from "node:os";
import { resolve } from "node:path";

// Atom keeps a user-level config tree and a workspace-local override tree.
// Callers usually need both at once, so this helper resolves the whole path set
// in one place instead of letting each package rebuild it ad hoc.

export interface AtomConfigPaths {
  configDir: string;
  settings: string;
  mcp: string;
  oauth: string;
  bundles: string;
  npmDir: string;
  pluginsDir: string;
  skillsDir: string;
  localConfigDir: string;
  localMcp: string;
  localBundles: string;
  localNpmDir: string;
  localPluginsDir: string;
  localSkillsDir: string;
}

export enum AtomConfigPath {
  DirName = ".atom",
  ModelsFile = "models.json",
  McpFile = "mcp.json",
  OAuthFile = "auth.json",
  NpmDir = "npm",
  PluginsDir = "plugins",
  SkillsDir = "skills",
  SessionsDir = "sessions",
  SkillFile = "SKILL.md",
  BundlesFile = "bundles.json"
}

// Resolves both global and workspace-local config locations. `CONFIG_FOLDER`
// only overrides the global root; local paths always stay relative to `cwd`.
export function getConfigPaths(cwd = process.cwd()): AtomConfigPaths {
  const configFolderOverride = process.env.CONFIG_FOLDER?.trim();
  const configDir = configFolderOverride
    ? resolve(configFolderOverride)
    : resolve(homedir(), AtomConfigPath.DirName);
  const localConfigDir = resolve(cwd, AtomConfigPath.DirName);

  return {
    configDir,
    settings: resolve(configDir, AtomConfigPath.ModelsFile),
    mcp: resolve(configDir, AtomConfigPath.McpFile),
    oauth: resolve(configDir, AtomConfigPath.OAuthFile),
    bundles: resolve(configDir, AtomConfigPath.BundlesFile),
    npmDir: resolve(configDir, AtomConfigPath.NpmDir),
    pluginsDir: resolve(configDir, AtomConfigPath.PluginsDir),
    skillsDir: resolve(configDir, AtomConfigPath.SkillsDir),
    localConfigDir,
    localMcp: resolve(localConfigDir, AtomConfigPath.McpFile),
    localBundles: resolve(localConfigDir, AtomConfigPath.BundlesFile),
    localNpmDir: resolve(localConfigDir, AtomConfigPath.NpmDir),
    localPluginsDir: resolve(localConfigDir, AtomConfigPath.PluginsDir),
    localSkillsDir: resolve(localConfigDir, AtomConfigPath.SkillsDir)
  };
}
