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

/**
 * Normalizes card names or file names into a canonical base key for cross-rarity comparison.
 * Strips file extensions (.png, .jpg, .webp, etc.)
 * Strips duplicate/index suffixes like -1, -2, _1, _2, (1), (2), [1], [2]
 * Trims whitespace and lowercases.
 */
export const normalizeCardBaseName = (nameOrFileName?: string): string => {
  if (!nameOrFileName) return '';
  let str = String(nameOrFileName).trim();
  // Strip file extension (.png, .jpg, .jpeg, .webp, .gif)
  str = str.replace(/\.[a-zA-Z0-9]{2,5}$/, '');
  // Strip bracketed or parenthesized numbers, e.g. " (1)", " [2]"
  str = str.replace(/\s*[\(\[]\s*\d+\s*[\)\]]$/, '');
  // Strip hyphen or underscore index suffixes, e.g. "-1", "-2", "_1", "_01"
  str = str.replace(/[-_#]\s*\d+$/, '');
  return str.trim().toLowerCase();
};

/**
 * Returns the normalized comparison key and clean display name for a card.
 */
export const getCardComparisonInfo = (card: { name?: string; fileName?: string }): { key: string; displayName: string } => {
  const fromFile = normalizeCardBaseName(card.fileName);
  const fromName = normalizeCardBaseName(card.name);
  const key = fromFile || fromName || '';

  let displayName = (card.name || card.fileName || '').trim();
  displayName = displayName.replace(/\.[a-zA-Z0-9]{2,5}$/, '');
  displayName = displayName.replace(/\s*[\(\[]\s*\d+\s*[\)\]]$/, '');
  displayName = displayName.replace(/[-_#]\s*\d+$/, '').trim();

  return {
    key,
    displayName: displayName || card.name || card.fileName || 'Unnamed Card',
  };
};

export interface ParityMissingCard {
  key: string;
  displayName: string;
  foundInRarities: string[];
  exampleCard?: any;
}

export interface ParityRarityReport {
  rarityName: string;
  rarityColor?: string;
  cardCount: number;
  missingCards: ParityMissingCard[];
  matchedKeys: string[];
  uniqueKeys: string[];
}

export interface ParityReport {
  isBalanced: boolean;
  totalCardsAcrossRarities: number;
  totalDistinctKeys: number;
  reports: ParityRarityReport[];
  allKeys: string[];
  keyToDisplayName: Map<string, string>;
  keyToCardsByRarity: Map<string, Map<string, any>>;
}

/**
 * Performs a comprehensive card parity check across selected rarities.
 * Accurately treats variants like "a" and "a-1" as the same card.
 */
export const checkRarityCardParity = <T extends { name: string; rarity?: string; fileName?: string; imageUrl?: string }>(
  rarityNames: string[],
  allCards: T[],
  rarityColorMap?: Record<string, string>
): ParityReport => {
  const cleanRarities = Array.from(new Set(rarityNames.map(r => r.trim()).filter(Boolean)));
  
  const rarityCardsMap = new Map<string, T[]>();
  const rarityKeysMap = new Map<string, Set<string>>();
  const allKeys = new Set<string>();
  const keyToDisplayName = new Map<string, string>();
  const keyToCardsByRarity = new Map<string, Map<string, T>>();

  cleanRarities.forEach(rName => {
    const rCards = allCards.filter(
      c => c.rarity && c.rarity.trim().toLowerCase() === rName.trim().toLowerCase()
    );
    rarityCardsMap.set(rName, rCards);

    const keys = new Set<string>();
    rCards.forEach(card => {
      const { key, displayName } = getCardComparisonInfo(card);
      if (key) {
        keys.add(key);
        allKeys.add(key);

        if (!keyToDisplayName.has(key)) {
          keyToDisplayName.set(key, displayName);
        }

        if (!keyToCardsByRarity.has(key)) {
          keyToCardsByRarity.set(key, new Map());
        }
        keyToCardsByRarity.get(key)!.set(rName, card);
      }
    });

    rarityKeysMap.set(rName, keys);
  });

  const sortedAllKeys = Array.from(allKeys).sort((a, b) => {
    const nameA = keyToDisplayName.get(a) || a;
    const nameB = keyToDisplayName.get(b) || b;
    return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
  });

  const reports: ParityRarityReport[] = cleanRarities.map(rName => {
    const rCards = rarityCardsMap.get(rName) || [];
    const rKeys = rarityKeysMap.get(rName) || new Set();

    const missingCards: ParityMissingCard[] = [];
    const matchedKeys: string[] = [];
    const uniqueKeys: string[] = [];

    sortedAllKeys.forEach(k => {
      if (rKeys.has(k)) {
        matchedKeys.push(k);
        const havingOther = cleanRarities.filter(o => o !== rName && rarityKeysMap.get(o)?.has(k));
        if (havingOther.length === 0) {
          uniqueKeys.push(k);
        }
      } else {
        const foundIn = cleanRarities.filter(o => o !== rName && rarityKeysMap.get(o)?.has(k));
        let exampleCard: T | undefined;
        for (const foundR of foundIn) {
          const c = keyToCardsByRarity.get(k)?.get(foundR);
          if (c) {
            exampleCard = c;
            break;
          }
        }

        missingCards.push({
          key: k,
          displayName: keyToDisplayName.get(k) || k,
          foundInRarities: foundIn,
          exampleCard,
        });
      }
    });

    return {
      rarityName: rName,
      rarityColor: rarityColorMap?.[rName],
      cardCount: rCards.length,
      missingCards,
      matchedKeys,
      uniqueKeys,
    };
  });

  const counts = reports.map(r => r.cardCount);
  const minCount = counts.length > 0 ? Math.min(...counts) : 0;
  const maxCount = counts.length > 0 ? Math.max(...counts) : 0;
  const isBalanced = cleanRarities.length >= 2 && minCount === maxCount && reports.every(r => r.missingCards.length === 0);

  let totalCardsAcross = 0;
  reports.forEach(r => { totalCardsAcross += r.cardCount; });

  return {
    isBalanced,
    totalCardsAcrossRarities: totalCardsAcross,
    totalDistinctKeys: sortedAllKeys.length,
    reports,
    allKeys: sortedAllKeys,
    keyToDisplayName,
    keyToCardsByRarity,
  };
};

export interface ParityLogEntry {
  id: string;
  timestamp: string;
  type: 'info' | 'success' | 'warn' | 'error';
  tag: string;
  message: string;
}

/**
 * Generates audit log lines for parity check execution.
 */
export const generateParityLogs = <T extends { name: string; rarity?: string; fileName?: string }>(
  report: ParityReport,
  cleanRarities: string[],
  allCards: T[]
): ParityLogEntry[] => {
  const logs: ParityLogEntry[] = [];
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

  let logId = 1;
  const addLog = (type: 'info' | 'success' | 'warn' | 'error', tag: string, message: string) => {
    logs.push({
      id: `log-${Date.now()}-${logId++}`,
      timestamp: timeStr,
      type,
      tag,
      message,
    });
  };

  addLog('info', 'START', `เริ่มตรวจสอบความครบถ้วนของการ์ดระหว่าง ${cleanRarities.length} ระดับ: [${cleanRarities.join(', ')}]`);

  cleanRarities.forEach(rName => {
    const rCards = allCards.filter(c => c.rarity && c.rarity.trim().toLowerCase() === rName.trim().toLowerCase());
    const reportItem = report.reports.find(r => r.rarityName === rName);
    const count = rCards.length;
    const unique = reportItem ? reportItem.matchedKeys.length : count;
    addLog('info', 'SCAN', `ระดับ '${rName}': พบการ์ด ${count} ใบ (ฐานชื่อการ์ด ${unique} แบบ)`);
  });

  report.allKeys.forEach(k => {
    const displayName = report.keyToDisplayName.get(k) || k;
    const missingIn = cleanRarities.filter(rName => {
      const rep = report.reports.find(r => r.rarityName === rName);
      return rep?.missingCards.some(m => m.key === k);
    });
    const foundIn = cleanRarities.filter(rName => !missingIn.includes(rName));

    if (missingIn.length === 0) {
      addLog('success', 'MATCH', `'${displayName}' (ฐานชื่อ: ${k}) มีครบในทุกระดับ [${foundIn.join(', ')}]`);
    } else {
      addLog('warn', 'MISSING', `'${displayName}' (ฐานชื่อ: ${k}) ขาดในระดับ [${missingIn.join(', ')}] (พบใน: [${foundIn.join(', ')}])`);
    }
  });

  if (report.isBalanced) {
    addLog('success', 'PASS', `การตรวจสอบเสร็จสมบูรณ์: ทุกระดับที่เลือกมีการ์ดตรงกันครบถ้วนสมบูรณ์ 100% (${report.totalDistinctKeys} แบบ, รวม ${report.totalCardsAcrossRarities} ใบ)`);
  } else {
    const mismatchCount = report.reports.filter(r => r.missingCards.length > 0).length;
    addLog('error', 'FAIL', `การตรวจสอบพบข้อแตกต่าง: มี ${mismatchCount} ระดับที่มีการ์ดไม่ครบถ้วนเทียบกับระดับอื่น`);
  }

  return logs;
};

