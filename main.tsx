import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, useLocation } from "react-router";
import { TRPCProvider } from "@/providers/trpc";
import "./index.css";
import App from "./App.tsx";

/** Every navigation starts at the top of the new page — unless the URL targets
 *  a section anchor (#chairman etc.), in which case we land on the section. */
function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      const tryScroll = () => {
        const el = document.getElementById(hash.slice(1));
        if (el) el.scrollIntoView();
      };
      tryScroll();
      const t = setTimeout(tryScroll, 350); // content may load async (CMS)
      return () => clearTimeout(t);
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <ScrollToTop />
      <TRPCProvider>
        <App />
      </TRPCProvider>
    </BrowserRouter>
  </StrictMode>
);
