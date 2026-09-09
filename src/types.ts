export interface Rule {
  type: 'must' | 'mustNot';
  targetParticipantId: string;
}

export type Multiplier = 1 | 2 | 3 | 4;

export const MULTIPLIERS: Multiplier[] = [1, 2, 3, 4];

export interface Participant {
  id: string;
  name: string;
  hint?: string;
  rules: Rule[];
  multiplier?: Multiplier;
}

export type Participants = Record<string, Participant>;

export interface BudgetConfig {
  amount: number | null;
  currency: string;
}

export const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'CHF', 'JPY'] as const;

export interface RecipientReveal {
  name: string;
  hint?: string;
  coGifters?: string[];
}

export interface ReceiverData {
  name: string;
  hint?: string;
  recipients?: RecipientReveal[];
  budget?: { amount: number; currency: string };
}
