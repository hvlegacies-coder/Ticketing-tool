import { createContext, useContext, useEffect } from "react";

// The app is dark-only (Cyber Neon theme). useTheme stays as a stub so any
// remaining callers compile; they get a fixed "dark" theme.
type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "dark",
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    document.documentElement.classList.remove("light");
    document.documentElement.classList.add("dark");
  }, []);

  return <ThemeContext.Provider value={{ theme: "dark", setTheme: () => {} }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
