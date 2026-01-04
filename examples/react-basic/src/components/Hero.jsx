// Issues seeded:
// - <img> without alt prop (image-alt)
// - <div onClick> without keyboard handler or interactive role (click-without-keyboard)
// - tabIndex={1} - positive value (tabindex-positive)
export default function Hero() {
  return (
    <section className="hero">
      <h1>Welcome to the shop</h1>

      <img src="/assets/hero.jpg" />

      <p className="tagline">Curated gadgets, delivered weekly.</p>

      <div
        className="cta"
        tabIndex={1}
        onClick={() => (window.location.href = '/shop')}
      >
        Shop now
      </div>
    </section>
  );
}
