import Image from "next/image";

/**
 * Next.js Suspense boundary fallback for the (app) route group.
 * Shown when a page's server components are still resolving and the
 * NavigationLoader's overlay has already been dismissed too early.
 * This acts as a secondary safety net.
 */
export default function Loading() {
  return (
    <div
      className="fixed inset-0 z-[9990] flex flex-col items-center justify-center"
      style={{
        background: "oklch(0.985 0.004 255 / 0.92)",
        backdropFilter: "blur(10px)",
      }}
    >
      {/* Top shimmer bar */}
      <div className="absolute top-0 left-0 right-0 h-[2.5px] overflow-hidden">
        <div
          className="h-full w-full"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, oklch(0.53 0.22 265) 40%, oklch(0.72 0.18 55) 60%, transparent 100%)",
            backgroundSize: "200% 100%",
            animation: "shimmerBar 1.4s ease-in-out infinite",
          }}
        />
      </div>

      <div className="flex flex-col items-center gap-6">
        <div className="relative">
          <div
            className="absolute inset-0 rounded-3xl blur-2xl"
            style={{
              background: "oklch(0.53 0.22 265 / 25%)",
              animation: "loadingPulse 2s ease-in-out infinite",
            }}
          />
          <div
            className="relative flex size-[72px] items-center justify-center rounded-3xl border p-3 shadow-2xl"
            style={{
              background:
                "linear-gradient(135deg, oklch(0.17 0.04 265), oklch(0.13 0.03 260))",
              borderColor: "oklch(0.53 0.22 265 / 28%)",
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
                  animation: `loadingBounce 1.1s ease-in-out infinite`,
                  animationDelay: `${i * 0.18}s`,
                }}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="absolute bottom-8 text-center">
        <p
          className="text-[11px] font-medium tracking-[0.12em] uppercase"
          style={{ color: "oklch(0.70 0.015 260)" }}
        >
          EPPS ITAM
        </p>
      </div>

      <style>{`
        @keyframes shimmerBar {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes loadingPulse {
          0%, 100% { opacity: 0.4; transform: scale(0.9); }
          50% { opacity: 1; transform: scale(1.1); }
        }
        @keyframes loadingBounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-6px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
