import { Allocation } from './domain';

/**
 * Allocation is always rounded in cents so every generated split reconciles
 * exactly to the ledger CNY total.
 */
const roundCents = (value: number) => Math.round(value * 100);

export const buildEqualAllocations = (cnyTotal: number, participantIds: string[]): Allocation[] => {
  const allocations = participantIds.map((memberId) => ({ memberId, amount: 0 }));
  const totalCents = roundCents(cnyTotal);
  const baseCents = Math.floor(totalCents / allocations.length);
  const remainderCents = totalCents - baseCents * allocations.length;

  allocations.forEach((allocation, index) => {
    allocation.amount = (baseCents + (index < remainderCents ? 1 : 0)) / 100;
  });

  return allocations;
};

export const buildPercentageAllocations = (
  cnyTotal: number,
  participantIds: string[],
  percentages: Record<string, number>,
): Allocation[] => {
  const allocations = participantIds.map((memberId) => ({
    memberId,
    amount: 0,
    percentage: Number(percentages[memberId] ?? 0),
  }));
  const totalCents = roundCents(cnyTotal);
  const centParts = allocations.map((allocation, index) => {
    const exactCents = totalCents * allocation.percentage / 100;
    const baseCents = Math.floor(exactCents);
    return { index, baseCents, remainder: exactCents - baseCents };
  });

  let remainingCents = totalCents - centParts.reduce((sum, part) => sum + part.baseCents, 0);

  // Largest remainder method: deterministic cent distribution.
  centParts
    .slice()
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index)
    .forEach((part) => {
      if (remainingCents > 0) {
        part.baseCents += 1;
        remainingCents -= 1;
      }
    });

  centParts.forEach((part) => {
    allocations[part.index].amount = part.baseCents / 100;
  });

  return allocations;
};

export const buildAllocationsByMode = (
  cnyTotal: number,
  participantIds: string[],
  mode: 'equal' | 'preset_percentage' | 'custom_percentage',
  percentages?: Record<string, number>,
): Allocation[] => {
  if (mode === 'equal') return buildEqualAllocations(cnyTotal, participantIds);
  return buildPercentageAllocations(cnyTotal, participantIds, percentages ?? {});
};
