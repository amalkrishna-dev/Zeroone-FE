import { useEffect, useRef } from 'react';

// Calls `onIdle` after `timeoutMs` of no user interaction. Any of the
// listed activity events resets the countdown. Pass `enabled = false`
// (e.g. when signed out) to fully disarm the timer and detach listeners.
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];

export default function useIdleTimeout(onIdle, { timeoutMs, enabled = true } = {}) {
  // Keep the latest callback without re-arming the timer on every render.
  const onIdleRef = useRef(onIdle);
  onIdleRef.current = onIdle;

  useEffect(() => {
    if (!enabled || !timeoutMs) return undefined;

    let timer;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => onIdleRef.current?.(), timeoutMs);
    };

    // Coalesce bursts of activity (e.g. mousemove) to one reset per frame.
    let throttled = false;
    const handleActivity = () => {
      if (throttled) return;
      throttled = true;
      requestAnimationFrame(() => { throttled = false; });
      reset();
    };

    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, handleActivity, { passive: true }));
    reset();

    return () => {
      clearTimeout(timer);
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, handleActivity));
    };
  }, [enabled, timeoutMs]);
}
