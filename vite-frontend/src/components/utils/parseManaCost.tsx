// src/components/utils/parseManaCost.tsx
import { ManaSymbols } from './ManaSymbols';

export const parseManaCost = (manaCost: string): React.ReactNode[] => {
  if (!manaCost) return [];

  // Use regex to find all curly bracket patterns (e.g., {1}, {B}, {W/U})
  const regex = /\{[^}]+\}/g;
  return manaCost.match(regex)?.map((symbol, index) => {
    const SymbolComponent = ManaSymbols[symbol];
    return SymbolComponent ? <SymbolComponent key={`${symbol}-${index}`} /> : symbol;
  }) || [];
};