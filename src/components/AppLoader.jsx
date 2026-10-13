import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import ConstellationLoader from "./ConstellationLoader.jsx";
import "./AppLoader.css";

const INTRO_FALLBACK_MS = 5500;

function prefersReducedMotion() {
  return typeof window !== "undefined"
    && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

export default function AppLoader({ children }) {
  const [initialState] = useState(() => {
    const reducedMotion = prefersReducedMotion();
    return { showIntro: !reducedMotion, revealed: reducedMotion };
  });
  const [revealed, setRevealed] = useState(initialState.revealed);
  const showIntro = initialState.showIntro;
  const hasRevealed = useRef(false);

  const revealApp = useCallback(() => {
    if (hasRevealed.current) return;
    hasRevealed.current = true;
    setRevealed(true);
  }, []);

  useLayoutEffect(() => {
    if (revealed || typeof document === "undefined") return undefined;

    const root = document.documentElement;
    const body = document.body;
    const previousRootOverflow = root.style.overflow;
    const previousBodyOverflow = body.style.overflow;

    root.style.overflow = "hidden";
    body.style.overflow = "hidden";

    return () => {
      root.style.overflow = previousRootOverflow;
      body.style.overflow = previousBodyOverflow;
    };
  }, [revealed]);

  useEffect(() => {
    if (revealed) return undefined;

    const fallback = window.setTimeout(revealApp, INTRO_FALLBACK_MS);
    return () => window.clearTimeout(fallback);
  }, [revealed, revealApp]);

  return (
    <>
      {showIntro && !revealed && (
        <ConstellationLoader isReady onComplete={revealApp} />
      )}
      <div
        className={`app-intro-content${revealed ? " app-intro-content--visible" : ""}`}
        aria-hidden={!revealed}
      >
        {children}
      </div>
    </>
  );
}
