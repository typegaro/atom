import { loadSkills, type Skill } from "./skills";

// SkillManager mirrors the PluginManager lifecycle: loadIfNeeded + isLoaded,
// with an optional allow-list to filter which skills from disk are exposed.
export class SkillManager {
  private loaded = false;
  private allSkills: Skill[] = [];
  private filteredSkills: Skill[] = [];
  private nameIndex = new Map<string, Skill>();
  private readonly cwd: string;
  private readonly allowList?: Set<string>;

  constructor(cwd = process.cwd(), allowList?: Set<string>) {
    this.cwd = cwd;
    this.allowList = allowList;
  }

  isLoaded(): boolean {
    return this.loaded;
  }

  async loadIfNeeded(): Promise<void> {
    if (this.loaded) return;

    this.allSkills = loadSkills(this.cwd);
    this.filteredSkills = this.allowList
      ? this.allSkills.filter((s) => this.allowList!.has(s.name))
      : this.allSkills;

    for (const skill of this.filteredSkills) {
      this.nameIndex.set(skill.name, skill);
    }

    this.loaded = true;
  }

  /** All skills that passed the allow-list filter. */
  getAll(): Skill[] {
    return this.filteredSkills;
  }

  /** All skills before filtering — for completeness but rarely needed. */
  getAllUnfiltered(): Skill[] {
    return this.allSkills;
  }

  /** Lookup by name (for the load_skill tool). */
  get(name: string): Skill | undefined {
    return this.nameIndex.get(name);
  }

  /** Reload skills from disk — re-reads all SKILL.md files and re-applies the filter. */
  async reload(): Promise<void> {
    this.loaded = false;
    this.nameIndex.clear();
    await this.loadIfNeeded();
  }
}
