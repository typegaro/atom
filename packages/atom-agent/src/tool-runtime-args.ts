import { isAbsolute, resolve } from "node:path";

export function expectString(value: unknown, name: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Tool argument ${name} must be a non-empty string`);
  }

  return value;
}

export function expectNullableString(value: unknown, name: string): string {
  if (typeof value !== "string") {
    throw new Error(`Tool argument ${name} must be a string`);
  }

  return value;
}

export function expectRequiredPositiveInteger(value: unknown, name: string): number {
  if (value === undefined) {
    throw new Error(`Tool argument ${name} is required but was not provided`);
  }

  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new Error(`Tool argument ${name} must be a positive integer`);
  }

  return value;
}

export function resolveWorkspacePath(workspaceRoot: string, path: string): string {
  return isAbsolute(path) ? path : resolve(workspaceRoot, path);
}
