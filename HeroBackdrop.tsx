/**
 * Optional CMS-driven hero background image. When the admin uploads an image
 * to a `*.hero.image` content key it renders behind the hero copy with a dark
 * scrim so the text stays readable; when empty the hero keeps its plain look.
 */
export function HeroBackdrop({ src }: { src?: string }) {
  if (!src) return null;
  return (
    <>
      <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-ink/70" />
    </>
  );
}
