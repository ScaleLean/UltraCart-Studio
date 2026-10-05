import { ArrowUpRight, ArrowRight, ShoppingBag, Leaf } from 'lucide-react';
import type { Draft } from '../../shared/types';
import { sampleBody } from '../../shared/sample';
import { cn } from '../lib/utils';

export function SamplePreview({
  draft,
  path = '/',
  original = false,
  mobile = false,
  editable = false,
  onSelect,
}: {
  draft?: Draft | null;
  path?: string;
  original?: boolean;
  mobile?: boolean;
  editable?: boolean;
  onSelect?: (pointer: string) => void;
}) {
  const baseline = JSON.parse(sampleBody(path));
  const value = (index: number, key = 'text') => {
    const field = draft?.fields.find((f) => f.pointer === `/childWidgets/${index}/config/${key}`);
    return field ? (original ? field.before : field.value) : baseline.childWidgets[index].config[key];
  };
  const field = (index: number, key = 'text') => ({
    'data-editable': editable,
    onClick: editable ? () => onSelect?.(`/childWidgets/${index}/config/${key}`) : undefined,
    title: editable ? 'Edit this text' : undefined,
  });
  return (
    <div className={cn('sample-store', mobile && 'is-mobile')}>
      <div className="sample-announcement" {...field(5)}>
        {value(5)} <ArrowUpRight size={10} />
      </div>
      <nav className="sample-nav">
        <span className="fieldwork-wordmark">
          fieldwork<span>®</span>
        </span>
        <div>
          Shop <span>Our story</span> <span>Field notes</span>
        </div>
        <ShoppingBag size={15} />
      </nav>
      <section className="sample-hero">
        <div className="sample-hero-copy">
          <span className="sample-eyebrow" {...field(0)}>
            {value(0)}
          </span>
          <h2 {...field(1)}>{value(1)}</h2>
          <p {...field(2)}>{value(2)}</p>
          <button {...field(3, 'label')}>
            {value(3, 'label')}
            <ArrowRight size={13} />
          </button>
          <div className="sample-footnote">
            <span className="tiny-star">✳</span> Thoughtfully made. Naturally yours.
          </div>
        </div>
        <div className="sample-still-life" aria-label="Illustration of Fieldwork skincare bottles">
          <div className="sample-sun" />
          <div className="sample-pedestal" />
          <div className="sample-leaf leaf-one" />
          <div className="sample-leaf leaf-two" />
          <div className="sample-leaf leaf-three" />
          <div className="product-bottle tall">
            <div className="bottle-cap" />
            <div className="bottle-label">
              <strong>fieldwork</strong>
              <span>
                THE DAILY
                <br />
                CLEANSER
              </span>
              <small>PURE. SIMPLE. EVERYDAY.</small>
              <i>200 ml / 6.7 fl oz</i>
            </div>
          </div>
          <div className="product-bottle small-bottle">
            <div className="bottle-cap" />
            <div className="bottle-label">
              <strong>fieldwork</strong>
              <span>
                BOTANICAL
                <br />
                FACE OIL
              </span>
              <small>A LITTLE EVERYDAY GLOW.</small>
              <i>30 ml / 1 fl oz</i>
            </div>
          </div>
          <div className="sample-seal">
            LESS, BUT
            <br />
            <span>better.</span>
          </div>
          <div className="sample-corner">01 / THE EVERYDAY EDIT</div>
        </div>
      </section>
      <div className="sample-values">
        <span>
          <Leaf size={12} /> Plant considered
        </span>
        <span>Made with intention</span>
        <span>Good for your everyday</span>
      </div>
      <section className="sample-collection">
        <div>
          <span className="sample-eyebrow">THE EVERYDAY EDIT</span>
          <h3 {...field(4)}>{value(4)}</h3>
        </div>
        <span>
          Shop the collection <ArrowUpRight size={12} />
        </span>
      </section>
      <div className="sample-products">
        {['Daily Cleanser', 'Botanical Face Oil', 'Everyday Body Wash'].map((name, index) => (
          <div key={name}>
            <div className={`sample-product-tile tone-${index}`}>
              <div className="mini-bottle">
                <span>fieldwork</span>
              </div>
            </div>
            <b>{name}</b>
            <small>Keep it simple.</small>
          </div>
        ))}
      </div>
    </div>
  );
}
