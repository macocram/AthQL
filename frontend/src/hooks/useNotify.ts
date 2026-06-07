import { App } from "antd";

/** Themed message/modal/notification — must be used inside ThemeProvider's App wrapper. */
export function useNotify() {
  return App.useApp();
}
