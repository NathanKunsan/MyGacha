/**
 * Helper to get clean card display name.
 * If a card in database or storage has duplicate suffix like "-1", "-2", "-3",
 * this strips the suffix so it always displays as the original clean name.
 */
export const getCardDisplayName = (name?: string): string => {
  if (!name) return '';
  return name.replace(/-\d+$/, '').trim();
};

/**
 * Checks for duplicate card names in a list of cards based on their clean display name.
 * Returns a map of clean name to the array of matching cards.
 */
export const findDuplicateCardNameGroups = <T extends { name: string }>(
  cards: T[]
): Map<string, T[]> => {
  const map = new Map<string, T[]>();
  cards.forEach(card => {
    const clean = getCardDisplayName(card.name).toLowerCase();
    if (clean) {
      if (!map.has(clean)) map.set(clean, []);
      map.get(clean)!.push(card);
    }
  });

  const duplicateMap = new Map<string, T[]>();
  map.forEach((group, key) => {
    if (group.length > 1) {
      duplicateMap.set(key, group);
    }
  });

  return duplicateMap;
};

/**
 * Assigns database names with -1, -2, -3 suffix for duplicate cards in a pack,
 * while preserving the original clean display name.
 */
export const prepareCardsForDatabase = <T extends { name: string; dbName?: string; fields?: any[] }>(
  cards: T[]
): T[] => {
  const nameOccurrences = new Map<string, number>();

  // Count total occurrences for each name
  cards.forEach(card => {
    const clean = getCardDisplayName(card.name).toLowerCase();
    nameOccurrences.set(clean, (nameOccurrences.get(clean) || 0) + 1);
  });

  const nameIndex = new Map<string, number>();

  return cards.map(card => {
    const clean = getCardDisplayName(card.name);
    const key = clean.toLowerCase();
    const total = nameOccurrences.get(key) || 1;
    const currentIndex = (nameIndex.get(key) || 0) + 1;
    nameIndex.set(key, currentIndex);

    // If there are duplicates, assign dbName with -1, -2, -3
    const dbName = total > 1 ? `${clean}-${currentIndex}` : clean;

    const updatedFields = card.fields?.map((f: any) => {
      if (f.name === 'ชื่อการ์ด' || f.name === 'Card Name') {
        return { ...f, value: clean };
      }
      return f;
    });

    return {
      ...card,
      name: clean,
      dbName,
      ...(updatedFields ? { fields: updatedFields } : {}),
    };
  });
};

/**
 * Sorts a list of cards according to the ordered sequence of rarities configured in Create.
 * If a card's rarity is not found in the rarities list, it is placed at the end.
 */
export const sortCardsByRarityOrder = <T extends { rarity?: string }>(
  cardsList: T[],
  raritiesList?: { name: string }[]
): T[] => {
  if (!cardsList || cardsList.length <= 1) return cardsList || [];
  if (!raritiesList || raritiesList.length === 0) return cardsList;

  const orderMap = new Map<string, number>();
  raritiesList.forEach((r, idx) => {
    if (r && r.name) {
      orderMap.set(r.name.trim().toLowerCase(), idx);
    }
  });

  return [...cardsList].sort((a, b) => {
    const rA = (a.rarity || '').trim().toLowerCase();
    const rB = (b.rarity || '').trim().toLowerCase();
    const idxA = orderMap.has(rA) ? orderMap.get(rA)! : 9999;
    const idxB = orderMap.has(rB) ? orderMap.get(rB)! : 9999;
    return idxA - idxB;
  });
};

