import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// TEMP DIAGNOSTIC: log every Headers.set() call and args to find an invalid header value
const _origSet = Headers.prototype.set;
Headers.prototype.set = function (name: string, value: string) {
  try {
    return _origSet.call(this, name, value);
  } catch (err) {
    console.log("[DIAG] Headers.set threw:", { name, value, typeofValue: typeof value, err: String(err) });
    throw err;
  }
};

createRoot(document.getElementById("root")!).render(<App />);
