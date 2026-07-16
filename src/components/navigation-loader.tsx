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

  const clearTimers = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    intervalRef.current = null;
    timeoutRef.current = null;
  }, []);

  const startLoading = useCallback(() => {
    clearTimers();
    setVisible(true);
    setCompleting(false);
    setProgress(8);

    // Simulate realistic progress: fast at first, then slowing down, capping at ~88%
    let current = 8;
    intervalRef.current = setInterval(() => {
      const remaining = 88 - current;
      const step = Math.max(0.5, remaining * 0.08);
      current = Math.min(88, current + step);
      setProgress(current);
      if (current >= 88) {
        if (intervalRef.current) clearInterval(intervalRef.current);
      }
    }, 120);
  }, [clearTimers]);

  const finishLoading = useCallback(() => {
    clearTimers();
    setCompleting(true);
    setProgress(100);
    timeoutRef.current = setTimeout(() => {
      setVisible(false);
      setProgress(0);
      setCompleting(false);
    }, 380);
  }, [clearTimers]);

  // Detect when navigation completes (pathname changed)
  useEffect(() => {
    if (prevPathname.current !== pathname) {
      prevPathname.current = pathname;
      if (visible) {
        finishLoading();
      }
    }
  }, [pathname, visible, finishLoading]);

  // Intercept anchor clicks to trigger the loader immediately
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href) return;

      // Skip external links, hash links, mailto, tel, same page
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

      // Only trigger for different pages
      const targetPath = href.split("?")[0];
      const currentPath = pathname.split("?")[0];
      if (targetPath === currentPath) return;

      startLoading();
    };

    // Also handle form submissions that navigate
    const handleSubmit = (e: SubmitEvent) => {
      const form = e.target as HTMLFormElement;
      if (form.method?.toLowerCase() === "get" || form.action) {
        startLoading();
      }
    };

    document.addEventListener("click", handleClick, true);
    document.addEventListener("submit", handleSubmit, true);

    return () => {
      document.removeEventListener("click", handleClick, true);
      document.removeEventListener("submit", handleSubmit, true);
      clearTimers();
    };
  }, [pathname, startLoading, clearTimers]);

  if (!visible) return null;

  return (
    <>
      {/* Top progress bar */}
      <div className="fixed top-0 left-0 right-0 z-[10000] h-[2.5px] overflow-hidden">
        <div
          className="h-full origin-left"
          style={{
            width: `${progress}%`,
            background: "linear-gradient(90deg, oklch(0.53 0.22 265), oklch(0.68 0.20 265), oklch(0.72 0.18 55))",
            transition: completing
              ? "width 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
              : "width 0.12s linear",
            boxShadow: "0 0 12px oklch(0.53 0.22 265 / 60%)",
          }}
        />
      </div>

      {/* Full-screen overlay */}
      <div
        className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
        style={{
          background: "oklch(0.985 0.004 255 / 0.88)",
          backdropFilter: "blur(12px) saturate(1.4)",
          WebkitBackdropFilter: "blur(12px) saturate(1.4)",
          animation: completing
            ? "navLoaderFadeOut 0.38s cubic-bezier(0.4, 0, 1, 1) both"
            : "navLoaderFadeIn 0.18s cubic-bezier(0, 0, 0.2, 1) both",
        }}
      >
        <div className="flex flex-col items-center gap-6">
          {/* Logo with ambient glow */}
          <div className="relative">
            <div
              className="absolute inset-0 rounded-3xl blur-2xl"
              style={{
                background: "oklch(0.53 0.22 265 / 30%)",
                animation: "navLoaderPulse 1.8s ease-in-out infinite",
              }}
            />
            <div
              className="relative flex size-[72px] items-center justify-center rounded-3xl border p-3 shadow-2xl"
              style={{
                background: "linear-gradient(135deg, oklch(0.17 0.04 265), oklch(0.13 0.03 260))",
                borderColor: "oklch(0.53 0.22 265 / 30%)",
                boxShadow: "0 20px 40px oklch(0.53 0.22 265 / 20%), inset 0 1px 0 oklch(1 0 0 / 12%)",
              }}
            >
              <Image
                src="/brand/EPPS-logo-mark.png"
                alt="EPPS"
                width={44}
                height={44}
                className="object-contain"
                priority
              />
            </div>
          </div>

          {/* Loading text + dots */}
          <div className="flex flex-col items-center gap-3">
            <span
              className="text-sm font-semibold tracking-wide"
              style={{ color: "oklch(0.52 0.022 260)" }}
            >
              Loading
            </span>
            <div className="flex items-center gap-[5px]">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="size-[5px] rounded-full"
                  style={{
                    background: "oklch(0.53 0.22 265)",
                    animation: `navLoaderBounce 1.1s ease-in-out infinite`,
                    animationDelay: `${i * 0.18}s`,
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Bottom brand hint */}
        <div
          className="absolute bottom-8 text-center"
          style={{ color: "oklch(0.70 0.015 260)" }}
        >
          <p className="text-[11px] font-medium tracking-[0.12em] uppercase">
            EPPS ITAM
          </p>
        </div>
      </div>

      <style>{`
        @keyframes navLoaderFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes navLoaderFadeOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }
        @keyframes navLoaderPulse {
          0%, 100% { opacity: 0.5; transform: scale(0.92); }
          50% { opacity: 1; transform: scale(1.08); }
        }
        @keyframes navLoaderBounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-6px); opacity: 1; }
        }
      `}</style>
    </>
  );
}
