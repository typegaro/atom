import type { Provider } from "./provider";
import type { ConfiguredProviderLoader } from "../../types/provider-definition";

// Cohesive registration unit for an API family: the same object knows how to
// discover configured providers and instantiate the matching runtime provider.
// Named "module" to avoid confusion with Atom's user-facing plugin system.
export interface ProviderModule<TProvider extends Provider = Provider> {
  api: string;
  loadProviders: ConfiguredProviderLoader;
}
