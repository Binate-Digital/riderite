export function CTA() {
  return (
    <section className="relative py-28 bg-background overflow-hidden">
      <div className="absolute inset-0 bg-gradient-hero opacity-80" />
      <div className="relative mx-auto max-w-5xl px-6 text-center">
        <h2 className="text-display text-5xl sm:text-7xl leading-[0.95]">
          READY TO RIDE <span className="text-primary">RIGHT?</span>
        </h2>
        <p className="mt-5 text-lg text-muted-foreground max-w-xl mx-auto">
          Download the RideRite app and get your first ride on us. Florida and beyond.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <a href="#" className="inline-flex items-center gap-3 rounded-md bg-primary px-6 py-4 text-base font-bold text-primary-foreground shadow-red hover:brightness-110 transition">
            <AppleIcon /> Download for iOS
          </a>
          <a href="#" className="inline-flex items-center gap-3 rounded-md border border-border bg-surface px-6 py-4 text-base font-bold text-foreground hover:border-primary transition">
            <PlayIcon /> Get it on Android
          </a>
        </div>
      </div>
    </section>
  );
}

function AppleIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M16.36 12.69c-.02-2.13 1.74-3.16 1.82-3.21-.99-1.45-2.54-1.65-3.09-1.67-1.31-.13-2.56.77-3.23.77-.67 0-1.7-.75-2.8-.73-1.44.02-2.77.84-3.51 2.13-1.5 2.6-.38 6.45 1.07 8.56.71 1.04 1.55 2.2 2.65 2.16 1.07-.04 1.47-.69 2.76-.69 1.29 0 1.65.69 2.78.67 1.15-.02 1.88-1.05 2.58-2.1.82-1.21 1.16-2.39 1.18-2.45-.03-.01-2.26-.87-2.21-3.44zM14.2 6.31c.59-.71.99-1.7.88-2.69-.85.03-1.88.57-2.49 1.28-.55.62-1.03 1.63-.9 2.6.95.07 1.92-.48 2.51-1.19z"/></svg>;
}
function PlayIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M3 20.5V3.5c0-.6.7-1 1.2-.7l13.7 8.5c.5.3.5 1 0 1.3L4.2 21.2c-.5.3-1.2-.1-1.2-.7z"/></svg>;
}
