import { useState } from 'react';

// Issues seeded:
// - <input> without associated <label> (labels-or-instructions / input-label,
//   to be caught by semantic/aria specialists as "label missing on input")
// - aria-describedby pointing to an id that does not exist anywhere
//   (aria-idref-describedby)
// - <div role="buton"> - typo, invalid ARIA role (aria-valid-role)
export default function Checkout() {
  const [email, setEmail] = useState('');

  return (
    <section className="checkout">
      <h2>Checkout</h2>

      <form onSubmit={(event) => event.preventDefault()}>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          aria-describedby="email-help-note-that-does-not-exist"
        />

        <div role="buton" tabIndex={0} onClick={() => alert('TODO')}>
          Subscribe
        </div>
      </form>
    </section>
  );
}
