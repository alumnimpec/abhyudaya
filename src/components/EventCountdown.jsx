import { useState, useEffect, useMemo } from "react";
import "./EventCountdown.css";

/**
 * EventCountdown Component
 * Displays an attractive, accurate, live countdown timer (Days, Hours, Minutes, Seconds).
 * Updates every second while mounted and cleans up timers on unmount.
 * Automatically halts at zero and displays "Event Started".
 */
export default function EventCountdown({
  targetDate,
  title = "Event Starts In",
  variant = "card", // "card" | "hero" | "compact"
  className = "",
}) {
  const targetTime = useMemo(() => {
    if (!targetDate) return null;
    const d = new Date(targetDate);
    const time = d.getTime();
    return isNaN(time) ? null : time;
  }, [targetDate]);

  const calculateTimeLeft = useMemo(() => {
    return () => {
      if (!targetTime) return null;
      const now = Date.now();
      const difference = targetTime - now;

      if (difference <= 0) {
        return { total: 0, days: 0, hours: 0, minutes: 0, seconds: 0, isPast: true };
      }

      return {
        total: difference,
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60),
        isPast: false,
      };
    };
  }, [targetTime]);

  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft);

  useEffect(() => {
    if (!targetTime) return;

    // Recalculate immediately on target change
    setTimeLeft(calculateTimeLeft());

    const timer = setInterval(() => {
      const updated = calculateTimeLeft();
      setTimeLeft(updated);
      if (updated && updated.isPast) {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [targetTime, calculateTimeLeft]);

  if (!targetTime || !timeLeft) {
    return null;
  }

  if (timeLeft.isPast) {
    return (
      <div className={`event-countdown-wrapper is-started ${variant} ${className}`}>
        <div className="countdown-started-badge">
          <span className="started-pulse-dot" aria-hidden="true" />
          <span>Event Started</span>
        </div>
      </div>
    );
  }

  const pad = (n) => String(n).padStart(2, "0");

  return (
    <div className={`event-countdown-wrapper ${variant} ${className}`} aria-label="Event countdown">
      {title && <span className="countdown-header-title">{title}</span>}

      <div className="countdown-digits-grid">
        {/* Days */}
        <div className="countdown-unit">
          <div className="countdown-num-box">
            <span className="countdown-num">{pad(timeLeft.days)}</span>
          </div>
          <span className="countdown-label">Days</span>
        </div>

        <span className="countdown-separator">:</span>

        {/* Hours */}
        <div className="countdown-unit">
          <div className="countdown-num-box">
            <span className="countdown-num">{pad(timeLeft.hours)}</span>
          </div>
          <span className="countdown-label">Hours</span>
        </div>

        <span className="countdown-separator">:</span>

        {/* Minutes */}
        <div className="countdown-unit">
          <div className="countdown-num-box">
            <span className="countdown-num">{pad(timeLeft.minutes)}</span>
          </div>
          <span className="countdown-label">Mins</span>
        </div>

        <span className="countdown-separator">:</span>

        {/* Seconds */}
        <div className="countdown-unit">
          <div className="countdown-num-box">
            <span className="countdown-num accent-gold">{pad(timeLeft.seconds)}</span>
          </div>
          <span className="countdown-label">Secs</span>
        </div>
      </div>
    </div>
  );
}
