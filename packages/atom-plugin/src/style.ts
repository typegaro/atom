const ANSI_RESET = "\x1b[0m";

export type TextStyle = (text: string) => string;

function wrap(text: string, ...codes: string[]): string {
  return `${codes.join("")}${text}${ANSI_RESET}`;
}

export const ansi = {
  reset: ANSI_RESET,
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  italic: "\x1b[3m",
  underline: "\x1b[4m",
  inverse: "\x1b[7m",
  fg256: (color: number) => `\x1b[38;5;${color}m`,
  bg256: (color: number) => `\x1b[48;5;${color}m`,
  fgRgb: (red: number, green: number, blue: number) => `\x1b[38;2;${red};${green};${blue}m`,
  bgRgb: (red: number, green: number, blue: number) => `\x1b[48;2;${red};${green};${blue}m`
} as const;

export const text = {
  plain(value: string): string {
    return value;
  },
  bold(value: string): string {
    return wrap(value, ansi.bold);
  },
  dim(value: string): string {
    return wrap(value, ansi.dim);
  },
  italic(value: string): string {
    return wrap(value, ansi.italic);
  },
  underline(value: string): string {
    return wrap(value, ansi.underline);
  },
  inverse(value: string): string {
    return wrap(value, ansi.inverse);
  },
  fg256(color: number): TextStyle {
    return (value: string) => wrap(value, ansi.fg256(color));
  },
  bg256(color: number): TextStyle {
    return (value: string) => wrap(value, ansi.bg256(color));
  },
  rgb(red: number, green: number, blue: number): TextStyle {
    return (value: string) => wrap(value, ansi.fgRgb(red, green, blue));
  },
  onRgb(red: number, green: number, blue: number): TextStyle {
    return (value: string) => wrap(value, ansi.bgRgb(red, green, blue));
  },
  compose(...styles: TextStyle[]): TextStyle {
    return (value: string) => styles.reduce((current, style) => style(current), value);
  },
  cell(background: number, foreground?: number, content = "  "): string {
    const codes = [ansi.bg256(background)];

    if (foreground !== undefined) {
      codes.push(ansi.fg256(foreground));
    }

    return wrap(content, ...codes);
  }
} as const;

export function styleText(value: string, ...styles: TextStyle[]): string {
  return text.compose(...styles)(value);
}
