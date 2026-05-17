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
export declare enum AtomConfigPath {
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
export declare function getConfigPaths(cwd?: string): AtomConfigPaths;
