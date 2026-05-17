import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawn } from "node:child_process";

export async function runNpmInstall(prefix: string, packageName: string, devDependency: boolean): Promise<void> {
  ensureDirForPrefix(prefix);
  const previousDependencies = readInstalledDependencyMap(prefix);
  await runNpmCommand(["install", devDependency ? "--save-dev" : "--save", packageName], prefix);

  const installedDependencies = readInstalledDependencyMap(prefix);
  const changedPackages = Array.from(installedDependencies.entries())
    .filter(([name, version]) => previousDependencies.get(name) !== version)
    .map(([name]) => name);

  try {
    for (const installedPackageName of changedPackages) {
      validateInstalledPluginPackage(prefix, installedPackageName);
    }
  } catch (error) {
    if (changedPackages.length > 0) {
      await runNpmCommand(["remove", ...changedPackages], prefix);
    }

    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${message}. Rolled back install.`);
  }
}

export async function runNpmRemove(prefix: string, packageName: string): Promise<void> {
  if (!existsSync(prefix)) {
    throw new Error(`Plugin install directory does not exist: ${prefix}`);
  }

  await runNpmCommand(["remove", packageName], prefix);
}

export function ensureDirForPrefix(prefix: string): void {
  if (!existsSync(prefix)) {
    mkdirSync(prefix, { recursive: true });
  }
}

function readInstalledDependencyMap(prefix: string): Map<string, string> {
  const packageJsonPath = resolve(prefix, "package.json");
  if (!existsSync(packageJsonPath)) {
    return new Map();
  }

  try {
    const parsed = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
      dependencies?: Record<string, unknown>;
      devDependencies?: Record<string, unknown>;
    };

    return new Map(
      [...Object.entries(parsed.dependencies ?? {}), ...Object.entries(parsed.devDependencies ?? {})]
        .filter((entry): entry is [string, string] => typeof entry[1] === "string")
    );
  } catch {
    return new Map();
  }
}

async function runNpmCommand(args: string[], prefix: string): Promise<void> {
  await new Promise<void>((resolvePromise, reject) => {
    const child = spawn("npm", ["--prefix", prefix, ...args], { stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }

      reject(new Error(`npm ${args.join(" ")} failed with exit code ${String(code ?? 1)}`));
    });
  });
}

function validateInstalledPluginPackage(prefix: string, packageName: string): void {
  const packageRoot = resolve(prefix, "node_modules", ...packageName.split("/"));
  const packageJsonPath = resolve(packageRoot, "package.json");

  if (!existsSync(packageJsonPath)) {
    throw new Error(`Installed package ${packageName} is missing package.json at ${packageJsonPath}`);
  }

  const parsed = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
    atom?: { plugins?: unknown };
  };
  const pluginEntries = parsed.atom?.plugins;

  if (!Array.isArray(pluginEntries) || pluginEntries.length === 0) {
    throw new Error(`Installed package ${packageName} is not a valid Atom plugin: missing atom.plugins in package.json`);
  }

  const normalizedEntries = pluginEntries
    .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);

  if (normalizedEntries.length === 0) {
    throw new Error(`Installed package ${packageName} is not a valid Atom plugin: atom.plugins must contain at least one file path`);
  }

  const missingEntries = normalizedEntries
    .map((entry) => ({ entry, path: resolve(packageRoot, entry) }))
    .filter(({ path }) => !existsSync(path));

  if (missingEntries.length > 0) {
    throw new Error(
      `Installed package ${packageName} is not a valid Atom plugin: missing plugin entry files ${missingEntries.map(({ entry }) => entry).join(", ")}`
    );
  }
}
