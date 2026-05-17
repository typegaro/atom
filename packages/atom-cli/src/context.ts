import { getConfigPaths } from "@typegaro/atom-types";
import { BundleStore } from "atom-bundle";
import { preParseBundle, preParseModel, preParseProvider } from "./argv";

export interface AtomCliContext {
  argv: string[];
  configPaths: ReturnType<typeof getConfigPaths>;
  cliBundleName?: string;
  cliModelId?: string;
  cliProviderName?: string;
  cliPluginAllowList?: Set<string>;
}

// Pre-parses bundle and model flags before Commander runs so both built-in and
// plugin-provided commands can share the same early-resolved runtime defaults.
export function createCliContext(argv: string[] = Bun.argv): AtomCliContext {
  const cliBundleName = preParseBundle(argv);
  const cliModelId = preParseModel(argv);
  const cliProviderName = preParseProvider(argv);
  const bundles = new BundleStore();

  return {
    argv,
    configPaths: getConfigPaths(),
    cliBundleName,
    cliModelId,
    cliProviderName,
    cliPluginAllowList: cliBundleName ? new Set(bundles.resolvePlugins(cliBundleName) ?? []) : new Set()
  };
}
