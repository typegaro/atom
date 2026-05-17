export function preParseBundle(argv: string[]): string | undefined {
  for (let i = 2; i < argv.length - 1; i++) {
    if (argv[i] === "-b" || argv[i] === "--bundle") {
      return argv[i + 1];
    }
  }

  return undefined;
}

export function preParseModel(argv: string[]): string | undefined {
  for (let i = 2; i < argv.length - 1; i++) {
    if (argv[i] === "-m" || argv[i] === "--model") {
      return argv[i + 1];
    }
  }

  return undefined;
}

export function preParseProvider(argv: string[]): string | undefined {
  for (let i = 2; i < argv.length - 1; i++) {
    if (argv[i] === "-p" || argv[i] === "--provider") {
      return argv[i + 1];
    }
  }

  return undefined;
}
