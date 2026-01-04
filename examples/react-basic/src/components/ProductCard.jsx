// Issues seeded:
// - <div role="button"> without tabIndex={0} (interactive-role-not-focusable)
// - <button aria-hidden="true"> - focusable element hidden from AT (aria-hidden-focus)
// - Heading h3 when the surrounding document is still at h1 (heading-order,
//   detectable at app level; left here for illustration)
export default function ProductCard({ name, price }) {
  return (
    <article className="product">
      <h3>{name}</h3>
      <p className="price">{price}</p>

      <div role="button" onClick={() => console.log('add', name)}>
        Add to cart
      </div>

      <button type="button" aria-hidden="true" onClick={() => console.log('preview')}>
        Quick look
      </button>
    </article>
  );
}
