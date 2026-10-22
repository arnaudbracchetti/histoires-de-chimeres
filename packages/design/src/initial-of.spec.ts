import { describe, expect, it } from 'vitest';
import { initialOf } from './initial-of.js';

describe('initialOf', () => {
  it("ignore l'article de tête : « La Tour d'ébène » → T", () => {
    expect(initialOf("La Tour d'ébène")).toBe('T');
  });

  it("ignore l'article élidé : « L'Ombre » → O", () => {
    expect(initialOf("L'Ombre")).toBe('O');
    expect(initialOf('L’Ombre')).toBe('O');
  });

  it("ignore l'article anglais : « The Dark » → D", () => {
    expect(initialOf('The Dark')).toBe('D');
  });

  it("prend l'initiale d'un titre d'un seul mot", () => {
    expect(initialOf('Dune')).toBe('D');
  });

  it('met une minuscule en capitale', () => {
    expect(initialOf('écho des abysses')).toBe('É');
  });

  it('garde un mot qui commence comme un article : « Lames du cardinal » → L', () => {
    expect(initialOf('Lames du cardinal')).toBe('L');
  });
});
