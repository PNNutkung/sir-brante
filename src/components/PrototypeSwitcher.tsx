import { useEffect } from 'react';

export interface PrototypeVariant {
  id: string;
  name: string;
  description: string;
}

export function PrototypeSwitcher({
  variants,
  current,
  onChange,
}: {
  variants: PrototypeVariant[];
  current: string;
  onChange: (id: string) => void;
}) {
  const currentIndex = variants.findIndex((v) => v.id === current);
  const cur = variants[currentIndex] ?? variants[0];

  const prev = () => {
    const nextIdx = (currentIndex - 1 + variants.length) % variants.length;
    onChange(variants[nextIdx].id);
  };

  const next = () => {
    const nextIdx = (currentIndex + 1) % variants.length;
    onChange(variants[nextIdx].id);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) {
        return;
      }
      if (e.key === 'ArrowLeft') {
        prev();
      } else if (e.key === 'ArrowRight') {
        next();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [currentIndex, variants]);

  return (
    <div className="prototype-switcher-pill" role="region" aria-label="Prototype Variant Switcher">
      <button className="proto-btn" onClick={prev} title="Previous variant (Left arrow)">
        ◀
      </button>
      <div className="proto-info">
        <span className="proto-tag">PROTOTYPE DESIGN</span>
        <span className="proto-name">
          <strong>Variant {cur.id}</strong>: {cur.name}
        </span>
        <span className="proto-desc">{cur.description}</span>
      </div>
      <button className="proto-btn" onClick={next} title="Next variant (Right arrow)">
        ▶
      </button>
      <div className="proto-pills">
        {variants.map((v) => (
          <button
            key={v.id}
            className={`proto-pill-chip ${v.id === current ? 'active' : ''}`}
            onClick={() => onChange(v.id)}
          >
            {v.id}
          </button>
        ))}
      </div>
    </div>
  );
}
