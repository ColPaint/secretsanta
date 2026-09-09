import "@fontsource/dancing-script/700.css";
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { decryptText } from '../utils/crypto';
import { PostCard } from '../components/PostCard';
import { Trans, useTranslation } from 'react-i18next';
import { MenuItem } from '../components/SideMenu';
import { ArrowLeft, Info } from '@phosphor-icons/react';
import { motion } from 'framer-motion';
import CryptoJS from 'crypto-js';
import { Layout } from "../components/Layout";
import { ReceiverData, RecipientReveal } from "../types";

function normalizeReceiverData(data: ReceiverData): {
  recipients: RecipientReveal[];
  budget?: { amount: number; currency: string };
} {
  if (data.recipients && data.recipients.length > 0) {
    return { recipients: data.recipients, budget: data.budget };
  }

  return {
    recipients: [{ name: data.name, hint: data.hint }],
    budget: data.budget,
  };
}

async function loadPairing(searchParams: URLSearchParams): Promise<[string, ReceiverData]> {
  // Legacy pairings, not generated anymore; remove after 2025-01-01
  if (searchParams.has(`name`) && searchParams.has(`key`) && searchParams.has(`pairing`)) {
    const name = searchParams.get(`name`)!;
    const key = searchParams.get(`key`)!;
    const pairing = searchParams.get(`pairing`)!;

    return [name, {name: CryptoJS.AES.decrypt(pairing, key).toString(CryptoJS.enc.Utf8)}];
  }

  if (searchParams.has(`to`)) {
    const from = searchParams.get('from')!;
    const to = searchParams.get('to')!;
    const decrypted = await decryptText(to);

    try {
      const data = JSON.parse(decrypted) as ReceiverData;
      return [from, data];
    } catch {
      return [from, {name: decrypted, hint: undefined} as ReceiverData];
    }
  }

  throw new Error(`Missing key or to parameter in search params`);
}

export function Pairing() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assignment, setAssignment] = useState<[string, ReceiverData] | null>(null);
  const [instructions, setInstructions] = useState<string | null>(null);

  useEffect(() => {
    const decryptReceiver = async () => {
      try {
        setAssignment(await loadPairing(searchParams));
        setInstructions(searchParams.get('info'));
      } catch (err) {
        console.error('Decryption error:', err);
        setError(t('pairing.error'));
      } finally {
        setLoading(false);
      }
    };

    decryptReceiver();
  }, [searchParams, t]);

  if (error) {
    return (
      <div className="min-h-screen bg-red-700 flex items-center justify-center">
        <div className="text-xl text-white">{error}</div>
      </div>
    );
  }

  const menuItems = [
    <MenuItem key={`back`} to="/" icon={<ArrowLeft weight={`bold`}/>}>
      {t('pairing.startYourOwn')}
    </MenuItem>
  ];

  const normalized = assignment ? normalizeReceiverData(assignment[1]) : null;
  const hints = normalized?.recipients.filter(r => r.hint) ?? [];
  const showInfo = Boolean(instructions || hints.length > 0 || normalized?.budget);

  return (
    <Layout menuItems={menuItems}>
      <div>
        {!loading && assignment && normalized && (
          <motion.div
            initial={{ rotateZ: -360 * 1, scale: 0 }}
            animate={{ rotateZ: 0, scale: 1, opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ ease: `easeIn`, duration: .6 }}
          >
            <PostCard>
              <h1 className="text-3xl font-bold mb-6 text-center text-red-700">
                {t('pairing.title')}
              </h1>
              <p className="mb-6 text-center text-gray-600">
                <Trans
                  i18nKey="pairing.assignment"
                  components={{
                    name: <span className="font-semibold">{assignment[0]}</span>
                  }}
                />
              </p>
              <div className="space-y-4">
                {normalized.recipients.map((recipient) => {
                  const hasCoGifters = Boolean(recipient.coGifters && recipient.coGifters.length > 0);
                  const useCard = normalized.recipients.length > 1 || hasCoGifters;

                  return (
                    <div
                      key={recipient.name}
                      className={useCard ? 'rounded-xl border border-gray-200 bg-gray-50 px-4 py-2' : undefined}
                    >
                      <div className={`${useCard && normalized.recipients.length > 1 ? 'text-6xl' : 'text-8xl'} font-bold text-center p-6 font-dancing-script`}>
                        {recipient.name}
                      </div>
                      {hasCoGifters && (
                        <p className="mt-1 mb-4 pt-3 border-t border-gray-200 text-center text-sm text-gray-600">
                          {t('pairing.coGifters', {
                            recipient: recipient.name,
                            names: recipient.coGifters!.join(', '),
                          })}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
              {showInfo && (
                <div className="mt-6 flex p-4 bg-gray-50 rounded-lg leading-6 text-gray-600 whitespace-pre-wrap">
                  <div className="mr-4">
                    <Info size={24}/>
                  </div>
                  <div className="space-y-2">
                    {hints.map((recipient) => (
                      <p key={recipient.name}>
                        {normalized.recipients.length > 1
                          ? `${recipient.name}: ${recipient.hint}`
                          : recipient.hint}
                      </p>
                    ))}
                    {normalized.budget && (
                      <p>
                        {t('pairing.budget', {
                          amount: normalized.budget.amount,
                          currency: normalized.budget.currency,
                        })}
                      </p>
                    )}
                    {instructions && <p>{instructions}</p>}
                  </div>
                </div>
              )}
            </PostCard>
          </motion.div>
        )}
      </div>
    </Layout>
  );
}
