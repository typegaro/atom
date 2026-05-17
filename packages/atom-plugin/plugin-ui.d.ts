import { PluginPanelPlacements, PluginPanelTones, PluginViewActivations, PluginViewPlacements } from "./constants";
export type PluginViewPlacement = typeof PluginViewPlacements[keyof typeof PluginViewPlacements];
export type PluginViewActivation = typeof PluginViewActivations[keyof typeof PluginViewActivations];
export interface PluginViewContext {
    requestRender(): void;
    notify(message: string): void;
    close(): void;
    focus(): void;
    blur(): void;
}
export interface PluginKeyEvent {
    raw: string;
    key: string;
    ctrl: boolean;
    alt: boolean;
    shift: boolean;
    id: string;
}
export interface PluginShortcut {
    key: string;
    handler(): boolean | void;
}
export interface PluginViewInstance {
    id: string;
    render(width: number): string[];
    handleInput?(data: string): void;
    handleKey?(event: PluginKeyEvent): boolean | void;
    shortcuts?: PluginShortcut[];
    isFocused?(): boolean;
    focus?(): void;
    blur?(): void;
    advanceAnimationFrame?(): void;
    mount?(): void;
    unmount?(): void;
    dispose?(): void;
}
export interface PluginView {
    id: string;
    placement?: PluginViewPlacement;
    activation?: PluginViewActivation;
    singleton?: boolean;
    create(context: PluginViewContext): PluginViewInstance;
}
export type PluginPanelPlacement = typeof PluginPanelPlacements[keyof typeof PluginPanelPlacements];
export type PluginPanelTone = typeof PluginPanelTones[keyof typeof PluginPanelTones];
export interface PluginPanelLine {
    text: string;
    tone?: PluginPanelTone;
}
export interface PluginPanelState {
    title?: string;
    visible?: boolean;
    lines: PluginPanelLine[];
}
export interface PluginPanel {
    id: string;
    placement: PluginPanelPlacement;
    state: PluginPanelState;
}
export interface PluginPanelDefinition {
    id: string;
    placement: PluginPanelPlacement;
    initialState?: PluginPanelState;
}
export interface PanelHandle {
    update(state: PluginPanelState): void;
}
