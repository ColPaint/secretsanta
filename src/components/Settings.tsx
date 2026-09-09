import { useTranslation } from 'react-i18next';
import { BudgetConfig, CURRENCIES } from '../types';

interface SettingsProps {
  instructions: string;
  onChangeInstructions: (instructions: string) => void;
  budget: BudgetConfig;
  onChangeBudget: (budget: BudgetConfig) => void;
}

export function Settings({ instructions, onChangeInstructions, budget, onChangeBudget }: SettingsProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <div className="p-4 bg-gray-50 rounded-lg">
        <div className="mb-2">
          <h4 className="block text-sm font-medium text-gray-700">
            {t('settings.budget')}
          </h4>
          <p className="mt-1 text-xs text-gray-500">
            {t('settings.budgetHelp')}
          </p>
        </div>
        <div className="flex gap-2">
          <input
            type="number"
            min={0}
            value={budget.amount ?? ''}
            onChange={(e) => onChangeBudget({
              ...budget,
              amount: e.target.value === '' ? null : Number(e.target.value),
            })}
            className="flex-1 min-w-0 p-2 border rounded"
            placeholder={t('settings.budgetAmount')}
            aria-label={t('settings.budgetAmount')}
          />
          <select
            value={budget.currency}
            onChange={(e) => onChangeBudget({ ...budget, currency: e.target.value })}
            className="p-2 border rounded bg-white"
            aria-label={t('settings.currency')}
          >
            {CURRENCIES.map(currency => (
              <option key={currency} value={currency}>{currency}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="p-4 bg-gray-50 rounded-lg">
        <div className="mb-2">
          <h4 className="block text-sm font-medium text-gray-700">
            {t('settings.instructions')}
          </h4>
          <p className="mt-1 text-xs text-gray-500">
            {t('settings.instructionsHelp')}
          </p>
        </div>
        <textarea
          value={instructions}
          onChange={(e) => onChangeInstructions(e.target.value)}
          className="w-full p-2 border rounded min-h-[100px]"
          placeholder={t('settings.instructionsPlaceholder')}
        />
      </div>
    </div>
  );
}
