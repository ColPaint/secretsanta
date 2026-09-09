import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { GeneratedPairs, generatePairs, getMultiplier, validateMultipliers } from './generatePairs';
import { Participant, Rule } from '../types';
import { parseParticipantsText, ParseSuccess } from './parseParticipants';

describe('generatePairs', () => {
  // Arbitrary to generate valid participant names (non-empty strings)
  const nameArb = fc.string({ minLength: 1 }).map(s => s.trim()).filter(s => s.length > 0);

  // Arbitrary to generate a valid participant
  const participantArb = fc.record({
    id: fc.string(),
    name: nameArb,
    rules: fc.array(
      fc.record({
        type: fc.constantFrom<'must' | 'mustNot'>('must', 'mustNot'),
        targetParticipantId: fc.integer({ min: 0 })
      }),
      { maxLength: 3 }
    )
  });

  // Updated participantsArb to generate valid rule combinations
  const participantsArb = fc.dictionary(
    fc.string(),
    participantArb,
    { minKeys: 2, maxKeys: 10 }
  ).map(participants => {
    // Fix rule IDs and ensure rule consistency
    return Object.fromEntries(
      Object.entries(participants).map(([id, participant]) => {
        const rules = participant.rules
          // Remove duplicate rules for the same target
          .filter((rule, index, self) => 
            index === self.findIndex(r => r.targetParticipantId === rule.targetParticipantId)
          )
          // Ensure valid IDs
          .map(r => ({
            ...r,
            targetParticipantId: Object.keys(participants)[
              r.targetParticipantId % Object.keys(participants).length
            ]
          }));

        // Ensure no more than one MUST rule
        const mustRules = rules.filter(r => r.type === 'must');
        const validRules = mustRules.length > 1 
          ? [mustRules[0], ...rules.filter(r => r.type === 'mustNot')]
          : rules;

        // Remove conflicting MUST/MUST NOT rules
        const mustRule = validRules.find(r => r.type === 'must');
        const finalRules = mustRule
          ? validRules.filter(r => 
              r.type === 'must' || 
              r.targetParticipantId !== mustRule.targetParticipantId
            )
          : validRules;

        return [id, {
          ...participant,
          id,
          rules: finalRules
        }];
      })
    );
  });

  it('should always return valid pairings or null', () => {
    fc.assert(
      fc.property(participantsArb, (participants) => {
        const result = generatePairs(participants);
        
        if (result === null) {
          return true; // Null is a valid result
        }

        // Properties that must hold for valid pairings:
        const expectedEdges = Object.values(participants).reduce(
          (sum, p) => sum + getMultiplier(p),
          0
        );
        expect(result.pairings).toHaveLength(expectedEdges);

        for (const id of Object.keys(participants)) {
          const m = getMultiplier(participants[id]);
          expect(result.pairings.filter(({giver}) => giver.id === id)).toHaveLength(m);
          expect(result.pairings.filter(({receiver}) => receiver.id === id)).toHaveLength(m);
        }

        const edges = new Set(result.pairings.map(({giver, receiver}) => `${giver.id}->${receiver.id}`));
        expect(edges.size).toBe(result.pairings.length);
        
        // All MUST rules are respected (target is among the giver's receivers)
        for (const [id, participant] of Object.entries(participants)) {
          const mustRules = participant.rules.filter(r => r.type === 'must');
          if (mustRules.length === 0) continue;
          const receivers = result.pairings
            .filter(({giver}) => giver.id === id)
            .map(({receiver}) => receiver.id);
          mustRules.forEach(rule => {
            expect(receivers).toContain(rule.targetParticipantId);
          });
        }

        // All MUST NOT rules are respected
        result.pairings.forEach(({giver, receiver}) => {
          const mustNotRules = participants[giver.id].rules.filter(r => r.type === 'mustNot');
          
          mustNotRules.forEach(rule => {
            expect(receiver.id).not.toBe(rule.targetParticipantId);
          });
        });

        // No self-assignments unless required by MUST rule
        result.pairings.forEach(({giver, receiver}) => {
          if (giver.id === receiver.id) {
            const selfAssignmentRequired = participants[giver.id].rules.some(
              (r: Rule) => r.type === 'must' && r.targetParticipantId === giver.id
            );
            expect(selfAssignmentRequired).toBe(true);
          }
        });
      })
    );
  });

  it('should return null for impossible configurations', () => {
    // Test case: everyone MUST NOT give to everyone else
    fc.assert(
      fc.property(fc.integer({ min: 2, max: 5 }), (size) => {
        const participants: Record<string, Participant> = {};
        for (let i = 0; i < size; i++) {
          const id = `person${i}`;
          participants[id] = {
            id,
            name: `Person${i}`,
            rules: Object.keys(participants).map(targetId => ({
              type: 'mustNot' as const,
              targetParticipantId: targetId
            }))
          };
        }

        const result = generatePairs(participants);
        expect(result).toBeNull();
      })
    );
  });

  it('should handle circular MUST rules correctly', () => {
    const participants: Record<string, Participant> = {
      'A': { id: 'A', name: 'A', rules: [{ type: 'must', targetParticipantId: 'B' }] },
      'B': { id: 'B', name: 'B', rules: [{ type: 'must', targetParticipantId: 'C' }] },
      'C': { id: 'C', name: 'C', rules: [{ type: 'must', targetParticipantId: 'A' }] },
    };

    const result = generatePairs(participants);
    expect(result?.pairings.map(({giver, receiver}) => [
      participants[giver.id],
      participants[receiver.id],
    ])).toEqual([
      [participants['A'], participants['B']],
      [participants['B'], participants['C']],
      [participants['C'], participants['A']],
    ]);
  });

  it('should return null for invalid rule configurations', () => {
    // Test multiple MUST rules
    const multiMustParticipants: Record<string, Participant> = {
      'A': { 
        id: 'A',
        name: 'A', 
        rules: [
          { type: 'must', targetParticipantId: 'B' },
          { type: 'must', targetParticipantId: 'C' }
        ] 
      },
      'B': { id: 'B', name: 'B', rules: [] },
      'C': { id: 'C', name: 'C', rules: [] },
    };

    expect(generatePairs(multiMustParticipants)).toBeNull();

    // Test conflicting MUST/MUST NOT rules
    const conflictingRulesParticipants: Record<string, Participant> = {
      'A': { 
        id: 'A',
        name: 'A', 
        rules: [
          { type: 'must', targetParticipantId: 'B' },
          { type: 'mustNot', targetParticipantId: 'B' }
        ] 
      },
      'B': { id: 'B', name: 'B', rules: [] },
    };

    expect(generatePairs(conflictingRulesParticipants)).toBeNull();
  });

  it('should support generating complex configurations', () => {
    const parseResult = parseParticipantsText(`
      Alice !Brian !Claire
      Brian !Alice !Claire
      Claire !Brian !Alice
      Ethan !Fiona !Grace !Hannah !Ivy !Jack !Kyle
      Fiona !Ethan !Grace !Hannah !Ivy !Jack !Kyle
      Grace !Fiona !Ethan !Hannah !Ivy !Jack !Kyle
      Hannah !Fiona !Grace !Ethan !Ivy !Jack !Kyle
      Ivy !Fiona !Grace !Hannah !Ethan !Jack !Kyle
      Kyle !Fiona !Grace !Hannah !Ethan !Jack !Ivy
      Logan !Sophie
      Sophie !Logan
      Matthew !Nina !Olivia !Paige !Quinn !Ryan
      Nina !Matthew !Olivia !Paige !Quinn !Ryan
      Olivia !Nina !Matthew !Paige !Quinn !Ryan
      Paige !Nina !Olivia !Matthew !Quinn !Ryan
      Jack !Fiona !Grace !Hannah !Ethan !Ivy !Kyle
      Quinn !Matthew !Nina !Olivia !Paige !Ryan
      Ryan !Quinn !Matthew !Nina !Olivia !Paige
    `);

    expect(parseResult.ok).toBe(true);
    const parseOk = parseResult as ParseSuccess;

    const result = generatePairs(parseOk.participants);
    expect(result).not.toBeNull();
  });

  it('should generate valid pairings for a given complex configuration', () => {
    const parseResult = parseParticipantsText(`
      Alice !Brian !Claire
      Brian !Alice !Claire
      Claire !Brian !Alice
      Ethan !Fiona !Grace !Hannah !Ivy !Jack !Kyle
      Fiona !Ethan !Grace !Hannah !Ivy !Jack !Kyle
      Grace !Fiona !Ethan !Hannah !Ivy !Jack !Kyle
      Hannah !Fiona !Grace !Ethan !Ivy !Jack !Kyle
      Ivy !Fiona !Grace !Hannah !Ethan !Jack !Kyle
      Kyle !Fiona !Grace !Hannah !Ethan !Jack !Ivy
      Logan !Sophie
      Sophie !Logan
      Matthew !Nina !Olivia !Paige !Quinn !Ryan
      Nina !Matthew !Olivia !Paige !Quinn !Ryan
      Olivia !Nina !Matthew !Paige !Quinn !Ryan
      Paige !Nina !Olivia !Matthew !Quinn !Ryan
      Jack !Fiona !Grace !Hannah !Ethan !Ivy !Kyle
      Quinn !Matthew !Nina !Olivia !Paige !Ryan
      Ryan !Quinn !Matthew !Nina !Olivia !Paige
    `);

    expect(parseResult.ok).toBe(true);
    const parseOk = parseResult as ParseSuccess;

    for (let t = 0; t < 100; t++) {
      const generationResult = generatePairs(parseOk.participants);

      expect(generationResult).not.toBeNull();
      const {pairings} = generationResult as GeneratedPairs;

      for (const id of Object.keys(parseOk.participants)) {
        const m = parseOk.participants[id].multiplier ?? 1;
        expect(pairings.filter(p => p.giver.id === id)).toHaveLength(m);
        expect(pairings.filter(p => p.receiver.id === id)).toHaveLength(m);
      }

      // Verify no self-assignments
      for (const {giver, receiver} of pairings) {
        expect(giver.id).not.toBe(receiver.id);
      }

      const edges = new Set(pairings.map(({giver, receiver}) => `${giver.id}->${receiver.id}`));
      expect(edges.size).toBe(pairings.length);

      // Verify all MUST NOT rules are respected
      for (const {giver, receiver} of pairings) {
        const participant = parseOk.participants[giver.id];
        const mustNotRules = participant.rules.filter(r => r.type === 'mustNot');
        
        for (const rule of mustNotRules) {
          expect(receiver.id).not.toBe(rule.targetParticipantId);
        }
      }

      // Verify all MUST rules are respected
      for (const id of Object.keys(parseOk.participants)) {
        const participant = parseOk.participants[id];
        const mustRules = participant.rules.filter(r => r.type === 'must');
        const receivers = pairings.filter(p => p.giver.id === id).map(p => p.receiver.id);

        for (const rule of mustRules) {
          expect(receivers).toContain(rule.targetParticipantId);
        }
      }
    }
  });

  it('should honor multipliers for give and receive counts', () => {
    const participants: Record<string, Participant> = {
      A: { id: 'A', name: 'A', rules: [], multiplier: 2 },
      B: { id: 'B', name: 'B', rules: [] },
      C: { id: 'C', name: 'C', rules: [] },
    };

    const result = generatePairs(participants);
    expect(result).not.toBeNull();
    expect(result!.pairings).toHaveLength(4);

    const giveCount = (id: string) => result!.pairings.filter(p => p.giver.id === id).length;
    const receiveCount = (id: string) => result!.pairings.filter(p => p.receiver.id === id).length;
    expect(giveCount('A')).toBe(2);
    expect(receiveCount('A')).toBe(2);
    expect(giveCount('B')).toBe(1);
    expect(receiveCount('B')).toBe(1);
    expect(giveCount('C')).toBe(1);
    expect(receiveCount('C')).toBe(1);

    const aReceivers = result!.pairings.filter(p => p.giver.id === 'A').map(p => p.receiver.id);
    expect(new Set(aReceivers).size).toBe(2);
    expect(aReceivers).not.toContain('A');
  });

  it('should include MUST targets among a multiplied giver\'s receivers', () => {
    const participants: Record<string, Participant> = {
      A: { id: 'A', name: 'A', rules: [{ type: 'must', targetParticipantId: 'B' }], multiplier: 2 },
      B: { id: 'B', name: 'B', rules: [] },
      C: { id: 'C', name: 'C', rules: [] },
    };

    const result = generatePairs(participants);
    expect(result).not.toBeNull();
    const aReceivers = result!.pairings.filter(p => p.giver.id === 'A').map(p => p.receiver.id);
    expect(aReceivers).toContain('B');
    expect(aReceivers).toHaveLength(2);
  });

  it('should reject multipliers greater than n-1', () => {
    const participants: Record<string, Participant> = {
      A: { id: 'A', name: 'A', rules: [], multiplier: 2 },
      B: { id: 'B', name: 'B', rules: [] },
    };

    expect(validateMultipliers(participants)).toBe('errors.impossibleMultiplier');
    expect(generatePairs(participants)).toBeNull();
  });
}); 
