import { useEffect } from "react";

/** The app is dark-only (Cyber Neon theme); this just pins the `dark` class. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    document.documentElement.classList.remove("light");
    document.documentElement.classList.add("dark");
  }, []);

  return <>{children}</>;
}
