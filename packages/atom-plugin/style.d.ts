export type TextStyle = (text: string) => string;
export declare const ansi: {
    readonly reset: "\u001B[0m";
    readonly bold: "\u001B[1m";
    readonly dim: "\u001B[2m";
    readonly italic: "\u001B[3m";
    readonly underline: "\u001B[4m";
    readonly inverse: "\u001B[7m";
    readonly fg256: (color: number) => string;
    readonly bg256: (color: number) => string;
    readonly fgRgb: (red: number, green: number, blue: number) => string;
    readonly bgRgb: (red: number, green: number, blue: number) => string;
};
export declare const text: {
    readonly plain: (value: string) => string;
    readonly bold: (value: string) => string;
    readonly dim: (value: string) => string;
    readonly italic: (value: string) => string;
    readonly underline: (value: string) => string;
    readonly inverse: (value: string) => string;
    readonly fg256: (color: number) => TextStyle;
    readonly bg256: (color: number) => TextStyle;
    readonly rgb: (red: number, green: number, blue: number) => TextStyle;
    readonly onRgb: (red: number, green: number, blue: number) => TextStyle;
    readonly compose: (...styles: TextStyle[]) => TextStyle;
    readonly cell: (background: number, foreground?: number, content?: string) => string;
};
export declare function styleText(value: string, ...styles: TextStyle[]): string;
