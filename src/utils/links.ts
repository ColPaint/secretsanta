import { encryptText } from "./crypto";
import { BudgetConfig, ReceiverData, RecipientReveal } from "../types";

export async function generateAssignmentLink(
  giver: string,
  recipients: RecipientReveal[],
  instructions?: string,
  budget?: BudgetConfig,
) {
  const baseUrl = `${window.location.origin}${window.location.pathname.replace(/\/[^/]*$/, '')}`;

  const dataToEncrypt: ReceiverData = {
    name: recipients[0]?.name ?? '',
    hint: recipients[0]?.hint,
    recipients,
  };

  if (budget?.amount != null) {
    dataToEncrypt.budget = { amount: budget.amount, currency: budget.currency };
  }

  const encryptedReceiver = await encryptText(JSON.stringify(dataToEncrypt));
  const params = new URLSearchParams({
    from: giver,
    to: encryptedReceiver,
  });
  
  if (instructions?.trim()) {
    params.set('info', instructions.trim());
  }

  return `${baseUrl}/pairing?${params.toString()}`;
}

export function generateCSV(assignments: [string, string][]) {
  const csvContent = assignments
    .map(([giver, receiver]) => `${giver}\t${receiver}`)
    .join('\n');
  return `Giver\tReceiver\n${csvContent}`;
}
