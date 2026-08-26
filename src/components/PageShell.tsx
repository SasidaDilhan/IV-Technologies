/**
 * Scrolling container for the ordinary document pages (items, stock, history).
 * The app shell itself does not scroll, so these pages provide their own
 * scroll area rather than growing the window.
 */
export default function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl px-6 py-8">{children}</div>
    </div>
  );
}
