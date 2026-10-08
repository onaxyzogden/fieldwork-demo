import React from "react";
import { createRoot } from "react-dom/client";
/* First, so the CSS its screens import keeps its place before the global
   sheets below. */
import { App } from "./Workspace";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import "@fontsource/manrope/500.css";
import "@fontsource/manrope/600.css";
import "@fontsource/manrope/700.css";
import "./tokens.css";
import "./base.css";
import "./layout.css";
import "./responsive.css";
import "./typography.css";
import "./work.css";
import "./primitives.css";
import "./customer-concept.css";
import "./operator-concept.css";
import "./contractor-concept.css";
import "./cards.css";
import "./assessment.css";
import { Boundary, lazyScreen } from "./Recovery";

/* Loaded when first opened, not with the app (ADR 074). */
const Blueprint = lazyScreen(() => import("./Blueprint"));
const Assessment = lazyScreen(() => import("./Assessment"));

/**
 * The whole router. The customer's assessment is a link they open, so it has to
 * be addressable — and in a prototype with no backend, a URL parameter is what a
 * link can be. The page says as much rather than implying the link is secret.
 */
function pickView() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("view") === "blueprint") return <Blueprint />;
  if (params.get("view") === "assessment") {
    /* Before the first paint, not in an effect: the assessment is a document
       and always reads light, and setting it after mount flashes the dark
       palette's text onto a light page. */
    document.documentElement.dataset.theme = "light";
    return (
      <Assessment
        token={params.get("t") || ""}
        legacyId={params.get("id") || ""}
      />
    );
  }
  return <App />;
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Boundary>{pickView()}</Boundary>
  </React.StrictMode>,
);
