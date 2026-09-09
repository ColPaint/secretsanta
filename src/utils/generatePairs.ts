import { Multiplier, Participant, Rule } from "../types";

export function checkRules(rules: Rule[]): string | null {
  const mustRules = rules.filter(r => r.type === 'must');
  if (mustRules.length > 1) {
    return 'errors.multipleMustRules';
  } else if (mustRules.length === 1) {
    if (rules.some(r => r.type === 'mustNot' && r.targetParticipantId === mustRules[0].targetParticipantId)) {
      return 'errors.conflictingRules';
    }
  }

  return null;
}

export function getMultiplier(participant: Participant): Multiplier {
  return participant.multiplier ?? 1;
}

export function validateMultipliers(participants: Record<string, Participant>): 'errors.impossibleMultiplier' | null {
  const n = Object.keys(participants).length;
  for (const participant of Object.values(participants)) {
    const m = getMultiplier(participant);
    if (m < 1 || m > 4 || m > n - 1) {
      return 'errors.impossibleMultiplier';
    }
  }

  return null;
}

export function generateGenerationHash(participants: Record<string, Participant>): string {
  return JSON.stringify(Object.values(participants).map(p => ({
    rules: p.rules,
    hint: p.hint,
    multiplier: getMultiplier(p),
  })));
}

export type GeneratedPairs = {
  hash: string;
  pairings: {
    giver: {id: string; name: string};
    receiver: {id: string; name: string};
  }[];
};

export function generatePairs(participants: Record<string, Participant>): GeneratedPairs | null {
  const participantIds = Object.keys(participants);
  
  if (participantIds.length < 2) {
    return null;
  }

  // Validate rules
  for (const participant of Object.values(participants)) {
    if (checkRules(participant.rules)) {
      return null;
    }
  }

  if (validateMultipliers(participants)) {
    return null;
  }

  const allowedReceivers = new Map<string, Set<string>>();
  const mustTargets = new Map<string, string>();

  for (const giverId of participantIds) {
    const giver = participants[giverId];
    
    const candidates = new Set(participantIds.filter(id => id !== giverId));
    
    const mustRule = giver.rules.find(r => r.type === 'must');
    if (mustRule) {
      if (mustRule.targetParticipantId === giverId) {
        candidates.add(giverId);
      }
      mustTargets.set(giverId, mustRule.targetParticipantId);
    }

    giver.rules
      .filter(r => r.type === 'mustNot')
      .forEach(r => candidates.delete(r.targetParticipantId));

    allowedReceivers.set(giverId, candidates);
  }

  const legalCandidates = (
    giverId: string,
    remainingIn: Map<string, number>,
    assigned: Map<string, Set<string>>,
  ): Set<string> => {
    const result = new Set<string>();
    for (const receiverId of allowedReceivers.get(giverId)!) {
      if ((remainingIn.get(receiverId) ?? 0) <= 0) continue;
      if (assigned.get(giverId)!.has(receiverId)) continue;
      result.add(receiverId);
    }
    return result;
  };

  const findNextGiver = (
    remainingOut: Map<string, number>,
    remainingIn: Map<string, number>,
    assigned: Map<string, Set<string>>,
  ): string | null => {
    let minOptions = Infinity;
    let result: string | null = null;

    for (const giverId of participantIds) {
      if ((remainingOut.get(giverId) ?? 0) <= 0) continue;
      const count = legalCandidates(giverId, remainingIn, assigned).size;
      if (count < minOptions) {
        minOptions = count;
        result = giverId;
      }
    }

    return result;
  };

  pairingGenerations:
  for (let t = 0; t < 10; t++) {
    const remainingOut: Map<string, number> = new Map(participantIds.map(id => [id, getMultiplier(participants[id])]));
    const remainingIn: Map<string, number> = new Map(participantIds.map(id => [id, getMultiplier(participants[id])]));
    const assigned = new Map(participantIds.map(id => [id, new Set<string>()]));
    const finalPairs: [string, string][] = [];

    const assign = (giverId: string, receiverId: string) => {
      assigned.get(giverId)!.add(receiverId);
      remainingOut.set(giverId, remainingOut.get(giverId)! - 1);
      remainingIn.set(receiverId, remainingIn.get(receiverId)! - 1);
      finalPairs.push([giverId, receiverId]);
    };

    const canAssign = (giverId: string, receiverId: string) => {
      if ((remainingOut.get(giverId) ?? 0) <= 0) return false;
      if ((remainingIn.get(receiverId) ?? 0) <= 0) return false;
      if (assigned.get(giverId)!.has(receiverId)) return false;
      return allowedReceivers.get(giverId)!.has(receiverId);
    };

    for (const giverId of participantIds) {
      const mustTarget = mustTargets.get(giverId);
      if (mustTarget === undefined) continue;
      if (!canAssign(giverId, mustTarget)) {
        continue pairingGenerations;
      }
      assign(giverId, mustTarget);
    }

    while ([...remainingOut.values()].some(n => n > 0)) {
      const giverId = findNextGiver(remainingOut, remainingIn, assigned);
      if (giverId === null) {
        continue pairingGenerations;
      }

      const candidates = legalCandidates(giverId, remainingIn, assigned);
      if (candidates.size === 0) {
        continue pairingGenerations;
      }

      const receiverId = Array.from(candidates)[Math.floor(Math.random() * candidates.size)];
      assign(giverId, receiverId);
    }

    const expectedEdges = participantIds.reduce((sum, id) => sum + getMultiplier(participants[id]), 0);
    if (finalPairs.length !== expectedEdges) {
      continue pairingGenerations;
    }

    const pairings = finalPairs.map(([giverId, receiverId]) => ({
      giver: {
        id: giverId,
        name: participants[giverId].name
      },
      receiver: {
        id: receiverId,
        name: participants[receiverId].name
      }
    }));

    return {
      hash: generateGenerationHash(participants),
      pairings
    };
  }

  return null;
}
