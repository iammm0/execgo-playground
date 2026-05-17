import { useEffect, useState } from "react";
import type { Page } from "../App";

type Props = {
  current: Page;
  onNavigate: (page: Page) => void;
};

type Theme = "system" | "dark" | "light";

const items: { page: Page; label: string }[] = [
  { page: "home", label: "主页" },
  { page: "benchmark", label: "测评配置" },
  { page: "commands", label: "命令终端" },
  { page: "results", label: "运行结果" },
];

export function Nav({ current, onNavigate }: Props) {
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem("theme") as Theme) || "system";
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") {
      root.removeAttribute("data-theme");
    } else {
      root.setAttribute("data-theme", theme);
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

  function cycleTheme() {
    setTheme((t) => (t === "system" ? "dark" : t === "dark" ? "light" : "system"));
  }

  const themeLabel = theme === "system" ? "自动" : theme === "dark" ? "深色" : "浅色";

  return (
    <nav className="nav-bar">
      {items.map((item) => (
        <button
          key={item.page}
          className={current === item.page ? "nav-item active" : "nav-item"}
          onClick={() => onNavigate(item.page)}
        >
          {item.label}
        </button>
      ))}
      <button className="nav-item theme-toggle" onClick={cycleTheme}>
        {themeLabel}
      </button>
    </nav>
  );
}
