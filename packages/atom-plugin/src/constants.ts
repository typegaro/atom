export const PluginEventName = {
  RunStart: "run-start",
  RunEnd: "run-end",
  MessageStart: "message-start",
  MessageEnd: "message-end",
  ToolRunStart: "tool-run-start",
  ToolRunEnd: "tool-run-end"
} as const;

export const PluginPanelPlacements = {
  Footer: "footer"
} as const;

export const PluginViewPlacements = {
  Body: "body",
  Footer: "footer"
} as const;

export const PluginViewActivations = {
  Auto: "auto",
  Command: "command"
} as const;

export const PluginPanelTones = {
  Default: "default",
  Muted: "muted",
  Success: "success",
  Warning: "warning",
  Danger: "danger"
} as const;
