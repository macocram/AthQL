import { MoonOutlined, SunOutlined } from "@ant-design/icons";
import { Button, Tooltip } from "antd";

import { useTheme } from "../context/ThemeContext";

export function ThemeToggle() {
  const { isDark, toggle } = useTheme();

  return (
    <Tooltip title={isDark ? "Switch to light mode" : "Switch to dark mode"}>
      <Button
        type="text"
        size="small"
        icon={isDark ? <SunOutlined /> : <MoonOutlined />}
        onClick={toggle}
        aria-label="Toggle theme"
      />
    </Tooltip>
  );
}
