import { cn } from "@/lib/utils";

/** Glowing AI avatar: cyan→violet core with a gold ring. */
export function AiOrb({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("h-9 w-9 shrink-0 rounded-full ring-2 ring-[#f5c84c]", className)}
      style={{
        background:
          "radial-gradient(circle at 35% 30%, #fff 0%, #7df3ff 18%, #00e5ff 40%, #a855f7 75%, #2a0f4a 100%)",
        boxShadow: "0 0 18px rgba(0, 229, 255, 0.65)",
      }}
    />
  );
}
