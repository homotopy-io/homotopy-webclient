import dotProp from "dot-prop-immutable";

export function notify(state, message) {
  return dotProp.set(state, "workspace.notifications", state.workspace.notifications.concat([message]));
}
