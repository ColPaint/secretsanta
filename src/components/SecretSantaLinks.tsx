import React from "react";
import { DownloadSimple } from "@phosphor-icons/react";
import { useTranslation } from "react-i18next";
import { CopyButton } from "./CopyButton";
import { generateAssignmentLink, generateCSV } from "../utils/links";
import { BudgetConfig, Participant, RecipientReveal } from "../types";
import { GeneratedPairs, generateGenerationHash } from "../utils/generatePairs";

interface SecretSantaLinksProps {
  assignments: GeneratedPairs;
  instructions?: string;
  budget: BudgetConfig;
  participants: Record<string, Participant>;
  onGeneratePairs: () => void;
}

export function SecretSantaLinks({ assignments, instructions, budget, participants, onGeneratePairs }: SecretSantaLinksProps) {
  const { t } = useTranslation();

  const currentHash = generateGenerationHash(participants);
  const hasChanged = currentHash !== assignments.hash;

  const resolveName = (id: string, fallback: string) => participants[id]?.name ?? fallback;

  const giverIds = [...new Set(assignments.pairings.map(({giver}) => giver.id))];
  giverIds.sort((a, b) => {
    const nameA = resolveName(a, assignments.pairings.find(p => p.giver.id === a)?.giver.name ?? '');
    const nameB = resolveName(b, assignments.pairings.find(p => p.giver.id === b)?.giver.name ?? '');
    return nameA.localeCompare(nameB);
  });

  const recipientsForGiver = (giverId: string): RecipientReveal[] => {
    return assignments.pairings
      .filter(({giver}) => giver.id === giverId)
      .map(({receiver}) => {
        const coGifters = assignments.pairings
          .filter(p => p.receiver.id === receiver.id && p.giver.id !== giverId)
          .map(p => resolveName(p.giver.id, p.giver.name));
        return {
          name: resolveName(receiver.id, receiver.name),
          hint: participants[receiver.id]?.hint,
          coGifters: coGifters.length > 0 ? coGifters : undefined,
        };
      });
  };

  const csvRows: [string, string][] = assignments.pairings.map(({giver, receiver}) => [
    resolveName(giver.id, giver.name),
    resolveName(receiver.id, receiver.name),
  ]);
  csvRows.sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]));

  const handleExportCSV = () => {
    const csvContent = generateCSV(csvRows);
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'secret-santa-assignments.csv';
    a.click();

    window.URL.revokeObjectURL(url);
  };

  return <>
    {hasChanged && (
      <div className="mb-2 p-3 bg-yellow-100 border border-yellow-400 text-yellow-800 rounded">
        <p className="text-sm">
          {t('links.warningParticipantsChanged')}
        </p>
        <button
          className="mt-2 w-full px-2 py-1 bg-yellow-700/40 rounded hover:bg-yellow-700/50 text-center text-white text-xs"
          onClick={onGeneratePairs}
        >
          {t('links.resetAssignments')}
        </button>
      </div>
    )}
    <div className="p-4 bg-gray-50 rounded-lg">
      <div className="flex space-x-4 items-center mb-4">
        <p className="text-gray-600 text-balance">
          {t('links.shareInstructions')}
        </p>
        <button
          onClick={handleExportCSV}
          className="p-2 bg-green-500 text-white rounded hover:bg-green-600 flex flex-none items-center gap-2"
        >
          <DownloadSimple size={20} weight="bold" />
          {t('links.exportCSV')}
        </button>
      </div>
      <div className="grid grid-cols-[minmax(100px,auto)_1fr] gap-3">
        {giverIds.map(giverId => {
          const giverName = resolveName(
            giverId,
            assignments.pairings.find(p => p.giver.id === giverId)?.giver.name ?? ''
          );
          const recipients = recipientsForGiver(giverId);
          return (
            <React.Fragment key={giverId}>
              <span className="font-medium self-center">
                {giverName}:
              </span>
              <CopyButton
                textToCopy={() => generateAssignmentLink(giverName, recipients, instructions, budget)}
                className="p-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center justify-center gap-2"
              >
                {t('links.copySecretLink')}
              </CopyButton>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  </>;
}
