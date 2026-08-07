// @vitest-environment jsdom
/**
 * Bramka runtime: modal, ktorego nie widac, nie moze zamrozic strony.
 *
 * REGRESJA Z PRODUKCJI (iPhone, 2026-08-07). `MiniCartDrawer` siedzial w
 * `SiteHeader` w kontenerze `hidden ... lg:flex`, wiec ponizej breakpointu `lg`
 * cale poddrzewo bylo `display: none`. Efekty Reacta biegna niezaleznie od CSS,
 * wiec `useFocusTrap` i tak ustawial `document.body.style.overflow = 'hidden'`:
 * uzytkownik dostawal zamrozony ekran, bez widocznego okna i bez czegokolwiek,
 * co da sie kliknac, zeby je zamknac. Blokada szla dalej na `/cart`, bo
 * `CartDropdown` zyje w headerze i nie odmontowuje sie przy nawigacji.
 *
 * jsdom nie liczy layoutu — `getClientRects()` zwraca tam pusto DLA WSZYSTKIEGO.
 * Gdyby test polegal na tym wprost, przechodzilby takze dla implementacji bez
 * zadnego guardu, czyli mierzylby jsdom zamiast kodu. Dlatego widocznosc jest
 * tu STEROWANA jawnie: stub `getClientRects` oddaje pudelko tylko dla elementu
 * uznanego za widoczny.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { useFocusTrap } from '../useFocusTrap';

const RECT = { x: 0, y: 0, width: 400, height: 800, top: 0, left: 0, right: 400, bottom: 800 };

// Sterowana widocznosc: efekt czyta `getClientRects()` RAZ, przy montowaniu,
// wiec flaga musi byc ustawiona przed pierwszym commitem.
let layoutVisible = false;
let originalGetClientRects: () => DOMRectList;
let root: Root | null = null;
let host: HTMLDivElement;

function Trapped({ visible }: { visible: boolean }) {
  const ref = useFocusTrap<HTMLDivElement>({ active: true, lockScroll: true });
  return (
    <div ref={ref} tabIndex={-1} data-visible={visible}>
      <button type="button">zamknij</button>
    </div>
  );
}

beforeEach(() => {
  layoutVisible = false;
  originalGetClientRects = Element.prototype.getClientRects;
  Element.prototype.getClientRects = function getClientRects(this: Element) {
    const rects = layoutVisible ? [RECT] : [];
    return Object.assign(rects, { item: (i: number) => rects[i] ?? null }) as unknown as DOMRectList;
  };
  host = document.createElement('div');
  document.body.appendChild(host);
  document.body.style.overflow = '';
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  root = null;
  host.remove();
  Element.prototype.getClientRects = originalGetClientRects;
  document.body.style.overflow = '';
});

function render(visible: boolean) {
  layoutVisible = visible;
  root = createRoot(host);
  act(() => {
    root!.render(<Trapped visible={visible} />);
  });
}

describe('useFocusTrap — blokada scrolla', () => {
  it('NIE blokuje scrolla, gdy kontener nie ma pudelka layoutu (ukryty przodek)', () => {
    render(false);
    expect(document.body.style.overflow).toBe('');
  });

  it('blokuje scroll, gdy kontener jest realnie wyrenderowany', () => {
    render(true);
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('oddaje scroll po odmontowaniu', () => {
    render(true);
    expect(document.body.style.overflow).toBe('hidden');
    act(() => {
      root!.unmount();
    });
    root = null;
    expect(document.body.style.overflow).toBe('');
  });
});
