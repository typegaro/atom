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
export declare const AtomConfigPath: {
    readonly DirName: ".atom";
    readonly ModelsFile: "models.json";
    readonly McpFile: "mcp.json";
    readonly OAuthFile: "auth.json";
    readonly NpmDir: "npm";
    readonly PluginsDir: "plugins";
    readonly SkillsDir: "skills";
    readonly BundlesFile: "bundles.json";
};
export declare function getConfigPaths(cwd?: string): AtomConfigPaths;
