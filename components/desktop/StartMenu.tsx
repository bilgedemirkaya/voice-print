"use client";

/** The Win95 Start menu, with the vertical brand rail and a couple of shortcuts. */
export function StartMenu({
  onOpenVisualizer,
  onOpenSettings,
}: {
  onOpenVisualizer: () => void;
  onOpenSettings: () => void;
}) {
  const items = [
    { label: "Open Visualizer", icon: "🖥", onClick: onOpenVisualizer },
    { label: "Display Properties…", icon: "🎨", onClick: onOpenSettings },
  ];
  return (
    <nav
      aria-label="Start menu"
      className="fixed bottom-9 left-1 z-50 flex w-60 bevel-raised bg-w95-silver p-1"
    >
      <div className="mr-1 flex items-end justify-center bg-[linear-gradient(to_top,#9b51e0,#5cb8ff)] px-1.5 py-3">
        <span className="rotate-180 text-base font-bold tracking-wider text-white [writing-mode:vertical-rl]">
          VOICEPRINT<span className="opacity-70">.SCR</span>
        </span>
      </div>
      <ul className="flex-1 self-stretch py-1 text-sm">
        {items.map((item) => (
          <li key={item.label}>
            <button
              type="button"
              onClick={item.onClick}
              className="flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-w95-navy hover:text-white focus-visible:bg-w95-navy focus-visible:text-white focus-visible:outline-none"
            >
              <span aria-hidden>{item.icon}</span>
              {item.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
