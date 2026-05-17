import type { Command } from "commander";
import { BundleStore } from "atom-bundle";

export function registerBundleCommands(program: Command): void {
  const bundles = new BundleStore();
  const bundleProgram = program
    .command("bundle")
    .description("Manage bundles (plugins, MCP servers, skills, default model)");

  bundleProgram
    .command("list")
    .description("List bundles")
    .option("-l, --local", "Show only local bundles", false)
    .option("-g, --global", "Show only global bundles", false)
    .action((options: { local?: boolean; global?: boolean }) => {
      const payload = options.local
        ? { local: bundles.loadScope("local") }
        : options.global
          ? { global: bundles.loadScope("global") }
          : { merged: bundles.load(), global: bundles.loadScope("global"), local: bundles.loadScope("local") };
      console.log(JSON.stringify(payload, null, 2));
    });

  bundleProgram
    .command("create")
    .description("Create or replace a bundle")
    .argument("<bundleName>", "bundle name")
    .argument("[plugins...]", "initial plugin names")
    .option("-l, --local", "Write to ./.atom/bundles.json", false)
    .option("-t, --tags <tags>", "Comma-separated tags for the bundle")
    .action((bundleName: string, plugins: string[], options: { local?: boolean; tags?: string }) => {
      const scope = options.local ? "local" : "global";
      const tags = options.tags?.split(",").map((t) => t.trim()).filter(Boolean);
      const updated = bundles.upsert(scope, bundleName, { plugins, tags: tags?.length ? tags : undefined });
      console.log(JSON.stringify({ scope, bundleName, bundle: updated[bundleName] ?? {} }, null, 2));
    });

  bundleProgram
    .command("delete")
    .description("Delete a bundle")
    .argument("<bundleName>", "bundle name")
    .option("-l, --local", "Delete from ./.atom/bundles.json", false)
    .action((bundleName: string, options: { local?: boolean }) => {
      const scope = options.local ? "local" : "global";
      bundles.delete(scope, bundleName);
      console.log(JSON.stringify({ scope, deleted: bundleName }, null, 2));
    });

  bundleProgram
    .command("add")
    .description("Add a plugin to a bundle")
    .argument("<bundleName>", "bundle name")
    .argument("<pluginName>", "plugin name")
    .option("-l, --local", "Write to ./.atom/bundles.json", false)
    .action((bundleName: string, pluginName: string, options: { local?: boolean }) => {
      const scope = options.local ? "local" : "global";
      const plugins = bundles.addPlugin(scope, bundleName, pluginName);
      console.log(JSON.stringify({ scope, bundleName, plugins }, null, 2));
    });

  bundleProgram
    .command("remove")
    .description("Remove a plugin from a bundle")
    .argument("<bundleName>", "bundle name")
    .argument("<pluginName>", "plugin name")
    .option("-l, --local", "Write to ./.atom/bundles.json", false)
    .action((bundleName: string, pluginName: string, options: { local?: boolean }) => {
      const scope = options.local ? "local" : "global";
      const plugins = bundles.removePlugin(scope, bundleName, pluginName);
      console.log(JSON.stringify({ scope, bundleName, plugins }, null, 2));
    });

  bundleProgram
    .command("tag")
    .description("Add a tag to a bundle")
    .argument("<bundleName>", "bundle name")
    .argument("<tag>", "tag to add")
    .option("-l, --local", "Write to ./.atom/bundles.json", false)
    .action((bundleName: string, tag: string, options: { local?: boolean }) => {
      const scope = options.local ? "local" : "global";
      const bundlesData = bundles.loadScope(scope);
      const current = bundlesData[bundleName] ?? {};
      const tags = [...new Set([...(current.tags ?? []), tag.trim()])].filter(Boolean).sort();
      bundles.upsert(scope, bundleName, { ...current, tags });
      console.log(JSON.stringify({ scope, bundleName, tags }, null, 2));
    });

  bundleProgram
    .command("untag")
    .description("Remove a tag from a bundle")
    .argument("<bundleName>", "bundle name")
    .argument("<tag>", "tag to remove")
    .option("-l, --local", "Write to ./.atom/bundles.json", false)
    .action((bundleName: string, tag: string, options: { local?: boolean }) => {
      const scope = options.local ? "local" : "global";
      const bundlesData = bundles.loadScope(scope);
      const current = bundlesData[bundleName] ?? {};
      const tags = (current.tags ?? []).filter((t) => t !== tag.trim());
      bundles.upsert(scope, bundleName, { ...current, tags: tags.length ? tags : undefined });
      console.log(JSON.stringify({ scope, bundleName, tags: tags.length ? tags : [] }, null, 2));
    });
}
