// @bun
// packages/atom-plugin/src/constants.ts
var PluginEventName = {
  RunStart: "run-start",
  RunEnd: "run-end",
  MessageStart: "message-start",
  MessageEnd: "message-end",
  ToolRunStart: "tool-run-start",
  ToolRunEnd: "tool-run-end"
};
var PluginPanelPlacements = {
  Footer: "footer"
};
var PluginViewPlacements = {
  Body: "body",
  Footer: "footer"
};
var PluginViewActivations = {
  Auto: "auto",
  Command: "command"
};
var PluginPanelTones = {
  Default: "default",
  Muted: "muted",
  Success: "success",
  Warning: "warning",
  Danger: "danger"
};
// packages/atom-types/src/messages.ts
var ContentPartType;
((ContentPartType2) => {
  ContentPartType2["Text"] = "text";
  ContentPartType2["Image"] = "image";
  ContentPartType2["Thinking"] = "thinking";
  ContentPartType2["ToolCall"] = "tool-call";
})(ContentPartType ||= {});
var MessageRole;
((MessageRole2) => {
  MessageRole2["User"] = "user";
  MessageRole2["Assistant"] = "assistant";
  MessageRole2["Tool"] = "tool";
})(MessageRole ||= {});
// packages/atom-types/src/runtime-events.ts
var RuntimeEventType;
((RuntimeEventType2) => {
  RuntimeEventType2["MessageStart"] = "message-start";
  RuntimeEventType2["TextDelta"] = "text-delta";
  RuntimeEventType2["ThinkingDelta"] = "thinking-delta";
  RuntimeEventType2["ToolRunStart"] = "tool-run-start";
  RuntimeEventType2["ToolRunEnd"] = "tool-run-end";
  RuntimeEventType2["FileEdit"] = "file-edit";
  RuntimeEventType2["Interrupted"] = "interrupted";
  RuntimeEventType2["Error"] = "error";
  RuntimeEventType2["Done"] = "done";
  RuntimeEventType2["SessionRefresh"] = "session-refresh";
})(RuntimeEventType ||= {});
var SessionEventType;
((SessionEventType2) => {
  SessionEventType2["Session"] = "session";
  SessionEventType2["TitleChange"] = "title_change";
  SessionEventType2["ModelChange"] = "model_change";
  SessionEventType2["Message"] = "message";
  SessionEventType2["Interrupt"] = "interrupt";
  SessionEventType2["RuntimeEvent"] = "runtime_event";
})(SessionEventType ||= {});
// packages/atom-plugin/src/plugin-hooks.ts
var AgentHookName;
((AgentHookName2) => {
  AgentHookName2["BeforeRun"] = "before-run";
  AgentHookName2["AfterRun"] = "after-run";
  AgentHookName2["BeforeModelCall"] = "before-model-call";
  AgentHookName2["AfterModelCall"] = "after-model-call";
  AgentHookName2["BeforeToolCall"] = "before-tool-call";
  AgentHookName2["AfterToolCall"] = "after-tool-call";
})(AgentHookName ||= {});
// packages/atom-plugin/src/plugin-definition.ts
function definePlugin(plugin) {
  return plugin;
}
// packages/atom-plugin/src/style.ts
var ANSI_RESET = "\x1B[0m";
function wrap(text, ...codes) {
  return `${codes.join("")}${text}${ANSI_RESET}`;
}
var ansi = {
  reset: ANSI_RESET,
  bold: "\x1B[1m",
  dim: "\x1B[2m",
  italic: "\x1B[3m",
  underline: "\x1B[4m",
  inverse: "\x1B[7m",
  fg256: (color) => `\x1B[38;5;${color}m`,
  bg256: (color) => `\x1B[48;5;${color}m`,
  fgRgb: (red, green, blue) => `\x1B[38;2;${red};${green};${blue}m`,
  bgRgb: (red, green, blue) => `\x1B[48;2;${red};${green};${blue}m`
};
var text = {
  plain(value) {
    return value;
  },
  bold(value) {
    return wrap(value, ansi.bold);
  },
  dim(value) {
    return wrap(value, ansi.dim);
  },
  italic(value) {
    return wrap(value, ansi.italic);
  },
  underline(value) {
    return wrap(value, ansi.underline);
  },
  inverse(value) {
    return wrap(value, ansi.inverse);
  },
  fg256(color) {
    return (value) => wrap(value, ansi.fg256(color));
  },
  bg256(color) {
    return (value) => wrap(value, ansi.bg256(color));
  },
  rgb(red, green, blue) {
    return (value) => wrap(value, ansi.fgRgb(red, green, blue));
  },
  onRgb(red, green, blue) {
    return (value) => wrap(value, ansi.bgRgb(red, green, blue));
  },
  compose(...styles) {
    return (value) => styles.reduce((current, style) => style(current), value);
  },
  cell(background, foreground, content = "  ") {
    const codes = [ansi.bg256(background)];
    if (foreground !== undefined) {
      codes.push(ansi.fg256(foreground));
    }
    return wrap(content, ...codes);
  }
};
function styleText(value, ...styles) {
  return text.compose(...styles)(value);
}
export {
  text,
  styleText,
  definePlugin,
  ansi,
  SessionEventType,
  RuntimeEventType,
  PluginViewPlacements,
  PluginViewActivations,
  PluginPanelTones,
  PluginPanelPlacements,
  PluginEventName,
  MessageRole,
  ContentPartType,
  AgentHookName
};
