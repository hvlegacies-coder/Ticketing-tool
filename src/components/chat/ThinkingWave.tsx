/** Five pulsing bars shown while the AI is composing a reply. */
export function ThinkingWave() {
  return (
    <div role="status" aria-label="Assistant is typing" className="flex h-4 items-end gap-[3px]">
      {[0, 0.15, 0.3, 0.45, 0.6].map((delay) => (
        <span
          key={delay}
          className="animate-wave h-full w-[3px] origin-bottom rounded-sm bg-cyan shadow-[0_0_6px_hsl(var(--cyan))]"
          style={{ animationDelay: `${delay}s` }}
        />
      ))}
    </div>
  );
}
