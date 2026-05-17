import {
  PluginPanelPlacements,
  PluginPanelTones,
  PluginViewActivations,
  PluginViewPlacements
} from "./constants";

// UI plugins render plain text views and panels inside the host TUI. The API is
// intentionally minimal: the host owns layout and lifecycle, while plugins own
// their local rendering state and input handling.

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

// A view instance is stateful and host-managed. The host may remount or reuse
// it depending on placement and singleton settings, so lifecycle hooks are
// optional and side effects should stay local to the instance.
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

// Panels are simpler than views: they are just shared line-oriented state that
// plugins update and the host decides how to present.
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
