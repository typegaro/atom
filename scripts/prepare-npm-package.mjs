import { copyFileSync, cpSync, existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

const [, , packageDirArg] = process.argv;

if (!packageDirArg) {
  throw new Error("Expected package directory argument.");
}

const rootDir = resolve(import.meta.dirname, "..");
const packageDir = resolve(rootDir, packageDirArg);
const distDir = join(packageDir, "dist");
const sourcePackageJsonPath = join(packageDir, "package.json");
const sourcePackage = JSON.parse(readFileSync(sourcePackageJsonPath, "utf8"));

const publicConfigs = {
  "packages/atom-types": {
    description: "Shared event and session types for Atom",
    engines: { bun: ">=1.3.12" }
  },
  "packages/atom-cli": {
    description: "Atom local agent CLI",
    bin: "./index.js",
    engines: { bun: ">=1.3.12" },
    workspaceDependencies: ["@typegaro/atom-plugin"],
    copyDirs: [{ from: "packages/atom-bundle/src/prompts", to: "prompts" }]
  },
  "packages/atom-plugin": {
    description: "SDK for building Atom plugins",
    engines: { bun: ">=1.3.12" },
    workspaceDependencies: ["@typegaro/atom-types"]
  }
};

const config = publicConfigs[packageDirArg];

if (!config) {
  throw new Error(`Unsupported public package: ${packageDirArg}`);
}

const readmePath = join(packageDir, "README.md");
const hasReadme = existsSync(readmePath);

if (hasReadme) {
  copyFileSync(readmePath, join(distDir, "README.md"));
}

for (const copyDir of config.copyDirs ?? []) {
  cpSync(join(rootDir, copyDir.from), join(distDir, copyDir.to), { recursive: true });
}

const distEntries = readdirSync(distDir)
  .filter((entry) => entry !== "package.json" && entry !== "README.md")
  .sort();
const sourceDependencies = sourcePackage.dependencies ?? {};
const publicWorkspaceDependencies = new Set(config.workspaceDependencies ?? []);
const dependencies = Object.fromEntries(
  Object.entries(sourceDependencies).filter(([name, version]) => (
    !String(version).startsWith("workspace:")
    || publicWorkspaceDependencies.has(name)
  )).map(([name, version]) => [
    name,
    String(version).startsWith("workspace:")
      ? getWorkspaceDependencyVersion(name)
      : version
  ])
);

function getWorkspaceDependencyVersion(packageName) {
  const workspacePackagePath = findWorkspacePackageJson(packageName);
  if (!workspacePackagePath) {
    throw new Error(`Could not find workspace dependency ${packageName}`);
  }

  const workspacePackage = JSON.parse(readFileSync(workspacePackagePath, "utf8"));
  if (!workspacePackage.version) {
    throw new Error(`Workspace dependency ${packageName} has no version`);
  }

  return `^${workspacePackage.version}`;
}

function findWorkspacePackageJson(packageName) {
  const packagesDir = join(rootDir, "packages");
  for (const entry of readdirSync(packagesDir)) {
    const packageJsonPath = join(packagesDir, entry, "package.json");
    if (!existsSync(packageJsonPath)) continue;

    const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8"));
    if (pkg.name === packageName) return packageJsonPath;
  }

  return undefined;
}

const publishPackage = {
  name: sourcePackage.name,
  version: sourcePackage.version,
  description: config.description,
  type: "module",
  main: "./index.js",
  exports: {
    ".": "./index.js"
  },
  files: [
    ...distEntries.map((entry) => basename(entry)),
    ...(hasReadme ? ["README.md"] : [])
  ],
  engines: config.engines,
  ...(Object.keys(dependencies).length > 0 ? { dependencies } : {}),
  ...(existsSync(join(distDir, "index.d.ts")) ? { types: "./index.d.ts" } : {}),
  ...(config.bin ? { bin: config.bin } : {})
};

writeFileSync(join(distDir, "package.json"), `${JSON.stringify(publishPackage, null, 2)}\n`);
