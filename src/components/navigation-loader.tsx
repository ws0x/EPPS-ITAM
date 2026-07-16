"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";

export function NavigationLoader() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const [completing, setCompleting] = useState(false);

  const prevPathname = useRef(pathname);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    intervalRef.current = null;
    timeoutRef.current = null;
    rafRef.current = null;
  }, []);

  const startLoading = useCallback(() => {
    clearTimers();
    setVisible(true);
    setCompleting(false);
    setProgress(10);

    let current = 10;
    intervalRef.current = setInterval(() => {
      // Slow eased crawl toward 88% — never reaches 100 on its own
      const remaining = 88 - current;
      const step = Math.max(0.4, remaining * 0.07);
      current = Math.min(88, current + step);
      setProgress(current);
      if (current >= 88 && intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }, 130);
  }, [clearTimers]);

  const finishLoading = useCallback(() => {
    clearTimers();
    setCompleting(true);
    setProgress(100);
    timeoutRef.current = setTimeout(() => {
      setVisible(false);
      setProgress(0);
      setCompleting(false);
    }, 400);
  }, [clearTimers]);

  // When pathname changes, the URL is updated — but the Suspense boundary
  // may still be resolving server data. We wait for TWO animation frames
  // (ensures the browser has painted the fully-resolved page) before
  // dismissing the overlay. This keeps us as the single continuous loader.
  useEffect(() => {
    if (prevPathname.current !== pathname) {
      prevPathname.current = pathname;
      if (visible) {
        // Double rAF + small buffer = wait for Suspense resolve + paint
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = requestAnimationFrame(() => {
            timeoutRef.current = setTimeout(() => {
              finishLoading();
            }, 80);
          });
        });
      }
    }
  }, [pathname, visible, finishLoading]);

  // Intercept all internal link clicks to trigger the loader instantly
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href) return;

      // Skip external, hash, protocol links and modifier-key combos
      if (
        href.startsWith("http") ||
        href.startsWith("//") ||
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        e.ctrlKey ||
        e.metaKey ||
        e.shiftKey ||
        anchor.target === "_blank"
      ) {
        return;
      }

      // Only trigger when navigating to a different path
      const targetPath = href.split("?")[0];
      const currentPath = window.location.pathname;
      if (targetPath === currentPath) return;

      startLoading();
    };

    document.addEventListener("click", handleClick, true);
    return () => {
      document.removeEventListener("click", handleClick, true);
      clearTimers();
    };
  }, [startLoading, clearTimers]);

  if (!visible) return null;

  return (
    <>
      {/* ── Top progress bar ─────────────────────────────── */}
      <div className="fixed top-0 left-0 right-0 z-[10001] h-[2.5px] overflow-hidden pointer-events-none">
        <div
          style={{
            height: "100%",
            width: `${progress}%`,
            background:
              "linear-gradient(90deg, oklch(0.53 0.22 265), oklch(0.68 0.20 265), oklch(0.72 0.18 55))",
            boxShadow: "0 0 14px oklch(0.53 0.22 265 / 70%)",
            transition: completing
              ? "width 0.35s cubic-bezier(0.4, 0, 0.2, 1)"
              : "width 0.13s linear",
          }}
        />
      </div>

      {/* ── Full-screen frosted overlay ───────────────────── */}
      <div
        className="fixed inset-0 z-[10000] flex flex-col items-center justify-center pointer-events-all"
        style={{
          background: "oklch(0.985 0.004 255 / 0.9)",
          backdropFilter: "blur(14px) saturate(1.5)",
          WebkitBackdropFilter: "blur(14px) saturate(1.5)",
          animation: completing
            ? "navFadeOut 0.4s cubic-bezier(0.4, 0, 1, 1) both"
            : "navFadeIn 0.15s cubic-bezier(0, 0, 0.2, 1) both",
        }}
      >
        <div className="flex flex-col items-center gap-7">
          {/* Logo with pulsing ambient glow */}
          <div className="relative">
            <div
              style={{
                position: "absolute",
                inset: "-8px",
                borderRadius: "28px",
                background: "oklch(0.53 0.22 265 / 28%)",
                filter: "blur(20px)",
                animation: "navGlowPulse 2s ease-in-out infinite",
              }}
            />
            <div
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 76,
                height: 76,
                borderRadius: 24,
                border: "1px solid oklch(0.53 0.22 265 / 28%)",
                background:
                  "linear-gradient(145deg, oklch(0.19 0.045 265), oklch(0.13 0.03 260))",
                boxShadow:
                  "0 24px 48px oklch(0.53 0.22 265 / 22%), inset 0 1px 0 oklch(1 0 0 / 10%)",
                padding: 14,
              }}
            >
              <Image
                src="/brand/EPPS-logo-mark.png"
                alt="EPPS"
                width={46}
                height={46}
                className="object-contain"
                priority
              />
            </div>
          </div>

          {/* Label + animated dots */}
          <div className="flex flex-col items-center gap-3">
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: "0.05em",
                color: "oklch(0.50 0.022 260)",
              }}
            >
              Loading page
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "oklch(0.53 0.22 265)",
                    animation: "navDotBounce 1.2s ease-in-out infinite",
                    animationDelay: `${i * 0.2}s`,
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Bottom brand tag */}
        <div
          style={{
            position: "absolute",
            bottom: 32,
            textAlign: "center",
            color: "oklch(0.72 0.012 260)",
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}
        >
          EPPS ITAM
        </div>
      </div>

      <style>{`
        @keyframes navFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes navFadeOut {
          from { opacity: 1; }
          to   { opacity: 0; }
        }
        @keyframes navGlowPulse {
          0%, 100% { opacity: 0.45; transform: scale(0.90); }
          50%       { opacity: 1;    transform: scale(1.10); }
        }
        @keyframes navDotBounce {
          0%, 70%, 100% { transform: translateY(0);   opacity: 0.35; }
          35%            { transform: translateY(-7px); opacity: 1;    }
        }
      `}</style>
    </>
  );
}
