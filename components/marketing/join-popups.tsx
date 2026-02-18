"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ShieldCheck, UserRound } from "lucide-react";

type JoinEvent = {
  id: string;
  city: string;
  minutesAgo: number;
};

const CITIES = [
  "Mumbai",
  "Delhi",
  "Bengaluru",
  "Hyderabad",
  "Chennai",
  "Pune",
  "Ahmedabad",
  "Surat",
  "Kolkata",
  "Jaipur",
  "Lucknow",
  "Indore"
] as const;

const TOAST_VISIBLE_MS = 2000;
const TOAST_EXIT_MS = 320;
const CHIME_COOLDOWN_MS = 1200;
const CHIME_MASTER_GAIN = 0.065;
const CHIME_ECHO_GAIN = 0.18;
const CHIME_ECHO_TIME = 0.16;
const CHIME_SEQUENCE = [
  { frequency: 987.77, start: 0, duration: 0.2 },
  { frequency: 1318.51, start: 0.08, duration: 0.24 },
  { frequency: 1760, start: 0.2, duration: 0.34 }
] as const;
const CONFETTI_PARTICLES = [
  { left: "22%", top: "16%", dx: "-12px", dy: "-26px", rot: "32deg", delay: "0ms", duration: "720ms", color: "#FF5FA2", size: 6, round: false },
  { left: "34%", top: "10%", dx: "6px", dy: "-28px", rot: "-24deg", delay: "40ms", duration: "760ms", color: "#E64B8C", size: 5, round: false },
  { left: "42%", top: "14%", dx: "14px", dy: "-24px", rot: "40deg", delay: "90ms", duration: "760ms", color: "#F5F7FF", size: 4, round: true },
  { left: "68%", top: "12%", dx: "-10px", dy: "-22px", rot: "-38deg", delay: "20ms", duration: "680ms", color: "#22C55E", size: 4, round: true },
  { left: "76%", top: "18%", dx: "12px", dy: "-26px", rot: "58deg", delay: "110ms", duration: "760ms", color: "#FF5FA2", size: 5, round: false },
  { left: "80%", top: "12%", dx: "18px", dy: "-18px", rot: "-42deg", delay: "70ms", duration: "700ms", color: "#E64B8C", size: 5, round: false },
  { left: "58%", top: "18%", dx: "-6px", dy: "-20px", rot: "24deg", delay: "140ms", duration: "740ms", color: "#F5F7FF", size: 4, round: true },
  { left: "50%", top: "10%", dx: "0px", dy: "-30px", rot: "-36deg", delay: "60ms", duration: "780ms", color: "#FF5FA2", size: 5, round: false }
] as const;
const STATUS_CONFETTI_PARTICLES = [
  { left: "-6px", top: "10px", dx: "-10px", dy: "-14px", rot: "-30deg", delay: "0ms", duration: "640ms", color: "#22C55E", size: 3, round: true },
  { left: "12px", top: "-4px", dx: "-2px", dy: "-12px", rot: "24deg", delay: "40ms", duration: "680ms", color: "#FF5FA2", size: 3, round: false },
  { left: "44px", top: "-6px", dx: "4px", dy: "-12px", rot: "-18deg", delay: "70ms", duration: "640ms", color: "#F5F7FF", size: 2, round: true },
  { left: "78px", top: "2px", dx: "8px", dy: "-10px", rot: "28deg", delay: "20ms", duration: "700ms", color: "#22C55E", size: 3, round: true },
  { left: "88px", top: "14px", dx: "10px", dy: "-8px", rot: "-26deg", delay: "90ms", duration: "720ms", color: "#FF5FA2", size: 3, round: false },
  { left: "70px", top: "24px", dx: "4px", dy: "-6px", rot: "34deg", delay: "120ms", duration: "680ms", color: "#E64B8C", size: 2, round: true },
  { left: "28px", top: "26px", dx: "-4px", dy: "-6px", rot: "-22deg", delay: "100ms", duration: "700ms", color: "#F5F7FF", size: 2, round: true },
  { left: "0px", top: "22px", dx: "-8px", dy: "-8px", rot: "40deg", delay: "130ms", duration: "740ms", color: "#22C55E", size: 3, round: true }
] as const;

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function makeAnonymousEvent(): JoinEvent {
  return {
    id: crypto.randomUUID(),
    city: CITIES[randomInt(0, CITIES.length - 1)] || "India",
    minutesAgo: randomInt(0, 9)
  };
}

export function JoinPopups({
  enabled = true,
  maxPerSession
}: {
  enabled?: boolean;
  maxPerSession?: number;
}) {
  const [isMounted, setIsMounted] = useState(false);
  const [isVisitor, setIsVisitor] = useState<boolean | null>(null);
  const [current, setCurrent] = useState<JoinEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const shownRef = useRef(0);
  const timersRef = useRef<number[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const lastChimeAtRef = useRef(0);

  const clearTimers = () => {
    for (const id of timersRef.current) {
      window.clearTimeout(id);
    }
    timersRef.current = [];
  };

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const detectMembership = async () => {
      try {
        const response = await fetch("/api/membership/access-check", {
          method: "GET",
          cache: "no-store"
        });
        const payload = await response.json();
        const active = Boolean(response.ok && payload?.ok && payload?.data?.active);
        if (!cancelled) {
          setIsVisitor(!active);
        }
      } catch {
        // If status cannot be checked, default to visitor behavior.
        if (!cancelled) {
          setIsVisitor(true);
        }
      }
    };

    void detectMembership();

    return () => {
      cancelled = true;
    };
  }, []);

  const ensureAudioContext = useCallback(() => {
    try {
      if (audioContextRef.current) {
        return audioContextRef.current;
      }

      const AudioContextConstructor =
        window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextConstructor) {
        return null;
      }

      audioContextRef.current = new AudioContextConstructor();
      return audioContextRef.current;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    const context = ensureAudioContext();
    if (!context) {
      return;
    }
    if (context.state === "suspended") {
      void context.resume().catch(() => undefined);
    }
  }, [ensureAudioContext]);

  const synthesizeChime = useCallback((context: AudioContext) => {
    const currentTime = context.currentTime;
    const masterGain = context.createGain();
    masterGain.gain.setValueAtTime(0.0001, currentTime);
    masterGain.gain.linearRampToValueAtTime(CHIME_MASTER_GAIN, currentTime + 0.02);
    masterGain.gain.exponentialRampToValueAtTime(0.0001, currentTime + 0.78);
    masterGain.connect(context.destination);

    const echoDelay = context.createDelay(0.4);
    echoDelay.delayTime.setValueAtTime(CHIME_ECHO_TIME, currentTime);
    const echoFeedback = context.createGain();
    echoFeedback.gain.setValueAtTime(CHIME_ECHO_GAIN, currentTime);
    const echoWet = context.createGain();
    echoWet.gain.setValueAtTime(0.24, currentTime);

    masterGain.connect(echoDelay);
    echoDelay.connect(echoWet);
    echoWet.connect(context.destination);
    echoDelay.connect(echoFeedback);
    echoFeedback.connect(echoDelay);

    CHIME_SEQUENCE.forEach((note) => {
      const body = context.createOscillator();
      const shimmer = context.createOscillator();
      const noteGain = context.createGain();
      const shimmerGain = context.createGain();

      body.type = "triangle";
      shimmer.type = "sine";

      body.frequency.setValueAtTime(note.frequency, currentTime + note.start);
      shimmer.frequency.setValueAtTime(note.frequency * 2, currentTime + note.start);

      noteGain.gain.setValueAtTime(0.0001, currentTime + note.start);
      noteGain.gain.linearRampToValueAtTime(0.88, currentTime + note.start + 0.02);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, currentTime + note.start + note.duration);

      shimmerGain.gain.setValueAtTime(0.0001, currentTime + note.start);
      shimmerGain.gain.linearRampToValueAtTime(0.24, currentTime + note.start + 0.015);
      shimmerGain.gain.exponentialRampToValueAtTime(
        0.0001,
        currentTime + note.start + note.duration * 0.75
      );

      body.connect(noteGain);
      shimmer.connect(shimmerGain);
      shimmerGain.connect(noteGain);
      noteGain.connect(masterGain);

      body.start(currentTime + note.start);
      body.stop(currentTime + note.start + note.duration + 0.03);
      shimmer.start(currentTime + note.start);
      shimmer.stop(currentTime + note.start + note.duration * 0.8 + 0.03);
    });

    const sparkle = context.createOscillator();
    const sparkleGain = context.createGain();
    sparkle.type = "sine";
    sparkle.frequency.setValueAtTime(2400, currentTime);
    sparkle.frequency.exponentialRampToValueAtTime(1500, currentTime + 0.16);
    sparkleGain.gain.setValueAtTime(0.0001, currentTime);
    sparkleGain.gain.linearRampToValueAtTime(0.16, currentTime + 0.015);
    sparkleGain.gain.exponentialRampToValueAtTime(0.0001, currentTime + 0.17);
    sparkle.connect(sparkleGain);
    sparkleGain.connect(masterGain);
    sparkle.start(currentTime);
    sparkle.stop(currentTime + 0.18);

    const cleanupTimer = window.setTimeout(() => {
      masterGain.disconnect();
      echoDelay.disconnect();
      echoFeedback.disconnect();
      echoWet.disconnect();
    }, 1300);
    timersRef.current.push(cleanupTimer);
  }, []);

  const playChime = useCallback(() => {
    const nowMs = Date.now();
    if (nowMs - lastChimeAtRef.current < CHIME_COOLDOWN_MS) {
      return;
    }
    lastChimeAtRef.current = nowMs;

    try {
      const context = ensureAudioContext();
      if (!context) {
        return;
      }

      if (context.state === "running") {
        synthesizeChime(context);
        return;
      }

      if (context.state === "suspended") {
        void context
          .resume()
          .then(() => {
            if (context.state === "running") {
              synthesizeChime(context);
            }
          })
          .catch(() => undefined);
      }
    } catch {
      // Ignore sound failures and continue UI flow.
    }
  }, [ensureAudioContext, synthesizeChime]);

  useEffect(() => {
    clearTimers();
    shownRef.current = 0;

    if (!enabled || isVisitor !== true) {
      return;
    }

    const scheduleNext = () => {
      if (typeof maxPerSession === "number" && shownRef.current >= maxPerSession) {
        return;
      }

      const delay =
        shownRef.current === 0 ? randomInt(1_600, 3_000) : randomInt(7_000, 11_000);

      const nextTimer = window.setTimeout(() => {
        const event = makeAnonymousEvent();
        const nextShown = shownRef.current + 1;

        setCurrent(event);
        setIsVisible(false);
        window.requestAnimationFrame(() => setIsVisible(true));
        playChime();
        shownRef.current = nextShown;

        const hideTimer = window.setTimeout(() => {
          setIsVisible(false);
        }, TOAST_VISIBLE_MS);

        const removeTimer = window.setTimeout(() => {
          setCurrent((existing) => (existing?.id === event.id ? null : existing));
          scheduleNext();
        }, TOAST_VISIBLE_MS + TOAST_EXIT_MS);

        timersRef.current.push(hideTimer, removeTimer);
      }, delay);

      timersRef.current.push(nextTimer);
    };

    scheduleNext();

    return clearTimers;
  }, [enabled, isVisitor, maxPerSession, playChime]);

  if (!isMounted || !current || isVisitor !== true) {
    return null;
  }

  return createPortal(
    <div
      className="pointer-events-none fixed z-[120] w-[min(24rem,calc(100vw-1rem))] sm:w-[min(24rem,calc(100vw-2rem))]"
      style={{
        top: "max(clamp(3.25rem,18vh,8.5rem), env(safe-area-inset-top))",
        right: "max(0.9rem, env(safe-area-inset-right))"
      }}
      aria-live="polite"
    >
      <div
        className={[
          "join-popup-card relative overflow-hidden rounded-2xl border px-3.5 py-3 backdrop-blur-md sm:px-4",
          "will-change-transform transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          "motion-reduce:transition-none",
          isVisible ? "translate-y-0 scale-100 opacity-100" : "-translate-y-2 scale-[0.98] opacity-0"
        ].join(" ")}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/75 to-transparent" />
        <div className="pointer-events-none absolute right-3 top-3">
          <div className="pointer-events-none absolute -left-2 -top-2 h-9 w-[6.3rem]">
            {STATUS_CONFETTI_PARTICLES.map((piece, index) => {
              const style = {
                left: piece.left,
                top: piece.top,
                width: `${piece.size}px`,
                height: `${piece.size}px`,
                backgroundColor: piece.color,
                animationDelay: piece.delay,
                animationDuration: piece.duration,
                ["--toast-confetti-x" as const]: piece.dx,
                ["--toast-confetti-y" as const]: piece.dy,
                ["--toast-confetti-r" as const]: piece.rot
              } as CSSProperties;

              return (
                <span
                  key={`status-${current.id}-${index}`}
                  className={`toast-confetti-piece toast-confetti-status ${piece.round ? "toast-confetti-dot" : ""}`}
                  style={style}
                />
              );
            })}
          </div>

          <div className="inline-flex items-center gap-1.5 rounded-full border border-success/35 bg-success/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-success">
            <span className="relative h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success/75 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success" />
            </span>
            Online
          </div>
        </div>
        <div className="pointer-events-none absolute inset-0">
          {CONFETTI_PARTICLES.map((piece, index) => {
            const style = {
              left: piece.left,
              top: piece.top,
              width: `${piece.size}px`,
              height: `${piece.size}px`,
              backgroundColor: piece.color,
              animationDelay: piece.delay,
              animationDuration: piece.duration,
              ["--toast-confetti-x" as const]: piece.dx,
              ["--toast-confetti-y" as const]: piece.dy,
              ["--toast-confetti-r" as const]: piece.rot
            } as CSSProperties;

            return (
              <span
                key={`${current.id}-${index}`}
                className={`toast-confetti-piece ${piece.round ? "toast-confetti-dot" : ""}`}
                style={style}
              />
            );
          })}
        </div>

        <div className="relative flex items-center gap-3">
          <div className="relative shrink-0">
            <div className="absolute inset-0 rounded-full bg-accent/45 blur-md" />
            <div className="join-popup-avatar relative grid h-10 w-10 place-items-center rounded-full border border-accent/45">
              <UserRound className="h-[18px] w-[18px] text-white/95" />
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 pr-14">
              <p className="flex items-center gap-1.5 text-sm font-semibold leading-none text-text sm:text-[0.95rem]">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-success" />
                New member joined
              </p>
            </div>

            <div className="mt-2 flex items-center gap-2">
              <span className="join-popup-city inline-flex items-center rounded-full border border-accent/45 bg-accent/15 px-2.5 py-0.5 text-[11px] font-semibold text-accent sm:text-xs">
                {current.city}
              </span>
              <span className="text-[11px] font-medium text-muted sm:text-xs">
                {current.minutesAgo === 0 ? "Just now" : `${current.minutesAgo} min ago`}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
