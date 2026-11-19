import { describe, expect, it } from 'vitest';
import { addAction, moveAction, removeAction, shiftAction } from '../src/screen/draft';

const v = { kind: 'vampire' } as const;
const list = () => {
  let l = addAction([], 'bleed', v, {}, 'a');
  l = addAction(l, 'move', v, { to: 'east' }, 'b');
  return addAction(l, 'hide', v, {}, 'c');
};
const ids = (l: { uid: string }[]) => l.map((a) => a.uid).join('');

describe('draft', () => {
  it('lägger till, tar bort och flyttar', () => {
    expect(ids(list())).toBe('abc');
    expect(ids(removeAction(list(), 'b'))).toBe('ac');
    expect(ids(moveAction(list(), 'c', 'a'))).toBe('cab');
    expect(ids(moveAction(list(), 'a', 'c'))).toBe('bca');
    expect(ids(shiftAction(list(), 'b', -1))).toBe('bac');
    expect(ids(shiftAction(list(), 'c', 1))).toBe('abc');
  });
  it('kopierar params', () => {
    const p = { to: 'east' };
    const l = addAction([], 'move', v, p, 'x');
    p.to = 'west';
    expect(l[0]!.params.to).toBe('east');
  });
});
