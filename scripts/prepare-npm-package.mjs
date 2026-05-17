import { copyFileSync, existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
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
    engines: { bun: ">=1.3.12" }
  },
  "packages/atom-plugin": {
    description: "SDK for building Atom plugins",
    engines: { bun: ">=1.3.12" }
  }
};

const config = publicConfigs[packageDirArg];

if (!config) {
  throw new Error(`Unsupported public package: ${packageDirArg}`);
}

const distEntries = readdirSync(distDir)
  .filter((entry) => entry !== "package.json")
  .sort();
const readmePath = join(packageDir, "README.md");
const hasReadme = existsSync(readmePath);

if (hasReadme) {
  copyFileSync(readmePath, join(distDir, "README.md"));
}

const dependencies = Object.fromEntries(
  Object.entries(sourcePackage.dependencies ?? {}).filter(([, version]) => !String(version).startsWith("workspace:"))
);

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
