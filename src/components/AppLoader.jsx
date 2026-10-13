import { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ConstellationLoader from "./ConstellationLoader";

const AUTH_TIMEOUT_MS = 12000;

export default function AppLoader({ children }) {
  const { loading: authLoading } = useAuth();
  const { pathname } = useLocation();
  const [gate, setGate] = useState(() => ({ pathname, complete: false }));
  const [error, setError] = useState(null);

  if (gate.pathname !== pathname) {
    setGate({ pathname, complete: false });
  }
  const introVisible = gate.pathname !== pathname || !gate.complete;

  useEffect(() => {
    if (!authLoading) return undefined;

    const timeout = setTimeout(() => {
      setError("Taking longer than expected. Please check your internet connection.");
    }, AUTH_TIMEOUT_MS);

    return () => clearTimeout(timeout);
  }, [authLoading]);

  const handleRetry = useCallback(() => {
    window.location.reload();
  }, []);
  const handleComplete = useCallback(() => {
    setGate({ pathname, complete: true });
  }, [pathname]);

  return (
    <>
      {introVisible && (
        <ConstellationLoader
          key={pathname}
          isReady={!authLoading}
          error={error}
          onRetry={handleRetry}
          onComplete={handleComplete}
        />
      )}
      <div
        style={{
          visibility: introVisible ? "hidden" : "visible",
          pointerEvents: introVisible ? "none" : "auto",
        }}
        aria-hidden={introVisible}
      >
        {children}
      </div>
    </>
  );
}
