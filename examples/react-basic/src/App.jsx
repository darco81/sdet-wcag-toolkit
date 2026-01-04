import Checkout from './components/Checkout.jsx';
import Hero from './components/Hero.jsx';
import ProductCard from './components/ProductCard.jsx';

// Issues seeded here:
// - No <main> landmark anywhere in the tree (landmark-main)
// - h1 in Hero → h3 in ProductCard (heading-order) - spans components
export default function App() {
  return (
    <div className="app">
      <header>
        <nav>
          <ul>
            <li>
              <a href="/">Home</a>
            </li>
            <li>
              <a href="/about">About</a>
            </li>
            {/* Intentional: non-<li> child of <ul> */}
            <div>Contact</div>
          </ul>
        </nav>
      </header>

      <Hero />

      <section className="products">
        <ProductCard name="Widget" price="$39.99" />
        <ProductCard name="Gizmo" price="$24.50" />
      </section>

      <Checkout />
    </div>
  );
}
