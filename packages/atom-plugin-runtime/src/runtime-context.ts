import { throwMissingCapability } from "./capability";
import type { AtomConfigPaths } from "@typegaro/atom-types";
import type {
  PluginBundleSummary,
  PluginCapabilityName,
  PluginSessionOptions,
  PluginSessionRuntime
} from "@typegaro/atom-plugin";

export interface PluginRuntime {
  openSession(options?: PluginSessionOptions): PluginSessionRuntime<"models" | "sessions">;
  getConfigPaths(): AtomConfigPaths;
  listBundles(): string[];
  getBundle(name: string): PluginBundleSummary | undefined;
}

export function validateEventDefinition(
  pluginId: string,
  type: string,
  description: string,
  kind: string
): void {
  if (!type.trim()) {
    throw new Error(`Plugin "${pluginId}" registered an empty ${kind} event type`);
  }

  if (!description.trim()) {
    throw new Error(`Plugin "${pluginId}" must provide a description for ${kind} event "${type}"`);
  }
}

export function requireCapability(
  pluginId: string,
  capabilities: Set<PluginCapabilityName>,
  capability: PluginCapabilityName
): void {
  if (!capabilities.has(capability)) {
    throwMissingCapability(pluginId, capability);
  }
}

export { PluginSetupRegistry } from "./plugin-setup-registry";
export { PluginAgentContextView, PluginRuntimeContextView } from "./plugin-capability-views";
