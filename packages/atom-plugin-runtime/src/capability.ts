import type { PluginCapabilityName } from "@typegaro/atom-plugin";

export function throwMissingCapability(pluginId: string, capability: PluginCapabilityName): never {
  throw new Error(formatMissingCapabilityMessage(pluginId, capability));
}

function formatMissingCapabilityMessage(pluginId: string | undefined, capability: PluginCapabilityName): string {
  return pluginId
    ? `Plugin \"${pluginId}\" requires the \"${capability}\" capability`
    : `Missing required plugin capability: \"${capability}\"`;
}
