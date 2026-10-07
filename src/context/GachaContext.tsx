import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { CardItem, PackSeries, ToastMessage, UserProfile, ContentReport } from '../types';
import { STARTER_PACKS } from '../data/starterPacks';
import { sound } from '../utils/sound';
import { isMainAdmin } from '../utils/admin';
import { getUsernameChangeStatus } from '../utils/thaiTime';
import {
  supabase,
  isSupabaseConfigured,
  uploadPackToSupabaseStorage,
  uploadUserAvatarToSupabase,
  fetchPublishedPacksFromSupabase,
  fetchUserInventoryFromSupabase,
  syncCardsToUserInventory,
  fetchRemoteRoles,
  saveRemoteRoles,
  broadcastRealtimeEvent,
  localBroadcastChannel,
  getSharedRealtimeChannel,
  REALTIME_CHANNEL_NAME,
  DEFAULT_TAGS,
  fetchTagsFromSupabase,
  createTagInSupabase,
  updateTagInSupabase,
  deleteTagInSupabase,
  deletePackFromSupabase,
  fetchReportsFromSupabase,
  submitReportToSupabase,
  resolveReportInSupabase,
  deleteReportInSupabase,
} from '../lib/supabase';
import {
  idbSavePack,
  idbGetPack,
  idbSaveActiveDraft,
  idbGetActiveDraft,
  idbGetAllPacks,
  idbDeletePack,
  idbClearAllPacks,
} from '../utils/storage';
import { getCardDisplayName, prepareCardsForDatabase } from '../utils/cardName';

interface GachaContextType {
  currentUser: UserProfile | null;
  packs: PackSeries[];
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  language: 'th' | 'en';
  toggleLanguage: () => void;
  toasts: ToastMessage[];
  addToast: (message: string, type?: ToastMessage['type']) => void;
  removeToast: (id: string) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  // URL & Routing
  currentPath: string;
  navigate: (path: string) => void;
  // Auth & Economy
  login: (username: string, pass: string) => Promise<boolean>;
  register: (username: string, email: string, pass: string, avatarDataUrl?: string) => Promise<boolean>;
  logout: () => void;
  claimDailyReward: () => boolean;
  canClaimDailyReward: boolean;
  spendCoins: (amount: number) => boolean;
  addCardsToInventory: (packId: string, cards: CardItem[]) => void;
  // Pack Creator
  savePack: (pack: PackSeries, silent?: boolean) => Promise<PackSeries | void>;
  publishPack: (pack: PackSeries) => Promise<void>;
  deletePack: (id: string) => Promise<boolean>;
  editingPack: PackSeries | null;
  setEditingPack: (pack: PackSeries | null) => void;
  // Delete confirm preference
  dontAskDeleteAgain: boolean;
  setDontAskDeleteAgain: (val: boolean) => void;
  updateUserAvatar: (avatarUrl: string) => void;
  updateUsername: (newUsername: string) => Promise<boolean>;
  // Admin & Real-time cross-machine capabilities
  updateMemberCoins: (username: string, newCoins: number, memberId?: string, memberEmail?: string) => Promise<void>;
  updateMemberRole: (username: string, newRole: 'Admin' | 'User', memberId?: string) => Promise<void>;
  togglePackPublished: (packId: string) => Promise<void>;
  refreshPacks: () => Promise<void>;
  // Tags Management
  tags: string[];
  addTag: (name: string) => Promise<boolean>;
  editTag: (oldName: string, newName: string) => Promise<boolean>;
  deleteTag: (name: string) => Promise<boolean>;
  refreshTags: () => Promise<void>;
  startNewPackCreation: () => void;
  // Reports Management
  reports: ContentReport[];
  submitReport: (report: Omit<ContentReport, 'id' | 'createdAt' | 'status'>) => Promise<boolean>;
  resolveReport: (reportId: string) => Promise<boolean>;
  deleteReport: (reportId: string) => Promise<boolean>;
  refreshReports: () => Promise<void>;
}

const GachaContext = createContext<GachaContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY_USER = 'mygacha_user_v2';
const LOCAL_STORAGE_KEY_ACCOUNTS = 'mygacha_accounts_v2';
const LOCAL_STORAGE_KEY_PACKS = 'mygacha_packs_v2';
const LOCAL_STORAGE_KEY_THEME = 'mygacha_theme_v2';
const LOCAL_STORAGE_KEY_LANG = 'mygacha_lang_v2';
const LOCAL_STORAGE_KEY_TAGS = 'mygacha_tags';
const LOCAL_STORAGE_KEY_DONT_ASK = 'mygacha_dont_ask_delete';
const LOCAL_STORAGE_KEY_DELETED_PACKS = 'mygacha_deleted_pack_ids_v1';

const getDeletedPackIds = (): Set<string> => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY_DELETED_PACKS);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
};

const addDeletedPackId = (id: string) => {
  try {
    const current = getDeletedPackIds();
    current.add(id);
    localStorage.setItem(LOCAL_STORAGE_KEY_DELETED_PACKS, JSON.stringify(Array.from(current)));
  } catch {}
};

// Normalize path: clean up trailing slashes and remove any redundant /MyGacha prefix
const normalizePath = (p: string) => {
  if (!p || p === '' || p === '/index.html') return '/';
  // If user visits /MyGacha, treat as root
  if (p === '/MyGacha' || p === '/MyGacha/') return '/';
  // Strip redundant leading /MyGacha/ if present
  if (p.startsWith('/MyGacha/')) {
    return p.slice('/MyGacha'.length);
  }
  return p;
};

export const GachaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem(LOCAL_STORAGE_KEY_THEME) as 'light' | 'dark') || 'light';
  });

  const [language, setLanguage] = useState<'th' | 'en'>(() => {
    return (localStorage.getItem(LOCAL_STORAGE_KEY_LANG) as 'th' | 'en') || 'th';
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Browser URL Routing
  const [currentPath, setCurrentPath] = useState<string>(() => {
    return normalizePath(window.location.pathname);
  });

  const navigate = (path: string) => {
    const target = normalizePath(path);
    if (window.location.pathname !== target) {
      window.history.pushState({}, '', target);
    }
    setCurrentPath(target);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    // If browser URL currently starts with /MyGacha, clean it immediately
    const cleanCurrent = normalizePath(window.location.pathname);
    if (window.location.pathname !== cleanCurrent) {
      window.history.replaceState({}, '', cleanCurrent);
      setCurrentPath(cleanCurrent);
    }

    const handlePopState = () => {
      setCurrentPath(normalizePath(window.location.pathname));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Preference for "ไม่ถามซ้ำ"
  const [dontAskDeleteAgain, setDontAskDeleteAgainState] = useState<boolean>(() => {
    return localStorage.getItem(LOCAL_STORAGE_KEY_DONT_ASK) === 'true';
  });

  const setDontAskDeleteAgain = (val: boolean) => {
    setDontAskDeleteAgainState(val);
    localStorage.setItem(LOCAL_STORAGE_KEY_DONT_ASK, String(val));
  };

  const [editingPack, setEditingPack] = useState<PackSeries | null>(() => {
    try {
      const saved = localStorage.getItem('mygacha_creator_draft');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object' && (parsed.franchiseName || parsed.seriesName || (parsed.cards && parsed.cards.length > 0))) {
          return parsed;
        }
      }
    } catch {}
    return null;
  });

  // User state
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY_USER);
    if (saved) {
      try {
        const u = JSON.parse(saved);
        if (u && typeof u === 'object') {
          const isHead = isMainAdmin(u.username, u.email);
          let role: 'Admin' | 'User' = isHead ? 'Admin' : (u.role || 'User');
          try {
            const rolesOverride = JSON.parse(localStorage.getItem('mygacha_user_roles_v2') || '{}');
            if (rolesOverride[u.username?.toLowerCase()] && !isHead) {
              role = rolesOverride[u.username.toLowerCase()];
            }
          } catch {}
          u.role = role;
          u.coins = typeof u.coins === 'number' ? u.coins : 5000;
          u.inventory = (u.inventory && typeof u.inventory === 'object') ? u.inventory : {};
          return u;
        }
      } catch (e) {
        console.error(e);
      }
    }
    return null; // Guest initially to match wireframe 1
  });

  // Packs state (Requirement 3: ล้างข้อมูล Pack ทุก Pack ออกจากฐานข้อมูลทุกเครื่อง)
  const [packs, setPacks] = useState<PackSeries[]>(() => {
    const WIPE_PACKS_VERSION = 'mygacha_wipe_all_packs_v7';
    if (localStorage.getItem(WIPE_PACKS_VERSION) !== 'true') {
      try {
        localStorage.setItem(WIPE_PACKS_VERSION, 'true');
        localStorage.removeItem(LOCAL_STORAGE_KEY_PACKS);
        localStorage.removeItem('mygacha_creator_draft');
        localStorage.removeItem('mygacha_franchise_templates');
        idbClearAllPacks();
      } catch {}
      return [];
    }

    const saved = localStorage.getItem(LOCAL_STORAGE_KEY_PACKS);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const deletedIds = getDeletedPackIds();
          const realPacks = parsed.filter(p =>
            !deletedIds.has(p.id) &&
            p.id !== 'test-pack-001' &&
            p.id !== 'pack-1791291048286' &&
            p.id !== 'pack-mythic-01' &&
            p.id !== 'pack-elemental-champions' &&
            p.id !== 'pack-how-to-fish' &&
            p.franchiseName !== 'Cyber Mythos' &&
            p.franchiseName !== 'Elemental Champions' &&
            p.franchiseName !== 'How To Fish' &&
            p.franchiseName !== 'TestFranchise' &&
            p.franchiseName?.toLowerCase() !== 'untitled' &&
            !p.franchiseName?.toLowerCase().includes('untitled') &&
            !p.seriesName?.includes('Vol .1') &&
            !p.seriesName?.includes('Vol. 1')
          );
          return realPacks;
        }
      } catch (e) {
        console.error(e);
      }
    }
    return [];
  });

  const recentSavesRef = React.useRef<Map<string, { timestamp: number; pack: PackSeries }>>(new Map());
  const savingPackIdsRef = React.useRef<Set<string>>(new Set());
  const lastLocalCoinChangeTimeRef = React.useRef<number>(0);

  // Dark mode effect
  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY_THEME, theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Language effect
  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY_LANG, language);
  }, [language]);

  // Tags state & synchronization with Supabase and localStorage (Strictly no mock tags)
  const [tags, setTags] = useState<string[]>(() => {
    try {
      const local = localStorage.getItem('mygacha_tags');
      if (local) {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed)) {
          const mocks = new Set(['General', 'Anime', 'Gaming', 'Fantasy', 'Sci-Fi', 'Cute', 'Art', 'Action', 'ทั่วไป', 'ทั่วไป (General)']);
          const clean = parsed.filter(t => typeof t === 'string' && t.trim() && !mocks.has(t.trim()));
          localStorage.setItem('mygacha_tags', JSON.stringify(clean));
          return clean;
        }
      }
    } catch {}
    return [];
  });

  const refreshTags = useCallback(async () => {
    try {
      const list = await fetchTagsFromSupabase();
      if (Array.isArray(list)) {
        const mocks = new Set(['General', 'Anime', 'Gaming', 'Fantasy', 'Sci-Fi', 'Cute', 'Art', 'Action', 'ทั่วไป', 'ทั่วไป (General)']);
        const clean = list.filter(t => typeof t === 'string' && t.trim() && !mocks.has(t.trim()));
        setTags(clean);
      }
    } catch (e) {
      console.warn('Failed to refresh tags:', e);
    }
  }, []);

  useEffect(() => {
    refreshTags();
  }, [refreshTags]);

  const addTag = async (name: string): Promise<boolean> => {
    const trimmed = name.trim();
    if (!trimmed) return false;
    if (tags.some(t => t.toLowerCase() === trimmed.toLowerCase())) return false;
    
    // 1. Instant local & state update (0ms delay)
    setTags(prev => {
      const next = Array.from(new Set([...prev, trimmed]));
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY_TAGS, JSON.stringify(next));
      } catch {}
      return next;
    });
    broadcastRealtimeEvent('tag_updated', { action: 'add', name: trimmed });

    // 2. Background sync to Supabase without blocking UI feedback
    createTagInSupabase(trimmed).catch(err => {
      console.warn('Background createTagInSupabase failed:', err);
    });

    return true;
  };

  const editTag = async (oldName: string, newName: string): Promise<boolean> => {
    const trimmedOld = oldName.trim();
    const trimmedNew = newName.trim();
    if (!trimmedOld || !trimmedNew) return false;
    if (trimmedOld.toLowerCase() === trimmedNew.toLowerCase()) return true;

    // 1. Instant local & state update (0ms delay)
    setTags(prev => {
      const next = prev.map(t => (t.toLowerCase() === trimmedOld.toLowerCase() ? trimmedNew : t));
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY_TAGS, JSON.stringify(next));
      } catch {}
      return next;
    });
    setPacks(prev => {
      const next = prev.map(p => (p.tag?.toLowerCase() === trimmedOld.toLowerCase() ? { ...p, tag: trimmedNew } : p));
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY_PACKS, JSON.stringify(next));
      } catch {}
      return next;
    });
    broadcastRealtimeEvent('tag_updated', { action: 'edit', oldName: trimmedOld, newName: trimmedNew });

    // 2. Background sync
    updateTagInSupabase(trimmedOld, trimmedNew).catch(err => {
      console.warn('Background updateTagInSupabase failed:', err);
    });

    return true;
  };

  const deleteTag = async (name: string): Promise<boolean> => {
    const trimmed = name.trim();
    if (!trimmed) return false;

    // 1. Instant local & state update (0ms delay)
    setTags(prev => {
      const next = prev.filter(t => t.toLowerCase() !== trimmed.toLowerCase());
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY_TAGS, JSON.stringify(next));
      } catch {}
      return next;
    });
    setPacks(prev => {
      const next = prev.map(p => (p.tag?.toLowerCase() === trimmed.toLowerCase() ? { ...p, tag: '' } : p));
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY_PACKS, JSON.stringify(next));
      } catch {}
      return next;
    });
    broadcastRealtimeEvent('tag_updated', { action: 'delete', name: trimmed });

    // 2. Background sync
    deleteTagInSupabase(trimmed).catch(err => {
      console.warn('Background deleteTagInSupabase failed:', err);
    });

    return true;
  };

  // Helper to start fresh pack creation with completely cleared inputs
  const startNewPackCreation = () => {
    setEditingPack(null);
    try {
      localStorage.removeItem('mygacha_creator_draft');
    } catch {}
    idbSaveActiveDraft(null as any).catch(() => {});
    navigate('/CreateCardsPack');
  };

  // Reports Management State & Functions
  const [reports, setReports] = useState<ContentReport[]>(() => {
    try {
      const local = localStorage.getItem('mygacha_reports');
      return local ? JSON.parse(local) : [];
    } catch {
      return [];
    }
  });

  const refreshReports = useCallback(async () => {
    try {
      const list = await fetchReportsFromSupabase();
      if (Array.isArray(list)) {
        setReports(list);
      }
    } catch (e) {
      console.warn('Failed to refresh reports:', e);
    }
  }, []);

  useEffect(() => {
    refreshReports();
  }, [refreshReports]);

  const submitReport = async (reportData: Omit<ContentReport, 'id' | 'createdAt' | 'status'>): Promise<boolean> => {
    const newReport: ContentReport = {
      ...reportData,
      id: `rep-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      createdAt: new Date().toISOString(),
      status: 'pending',
    };

    // 1. Instant local state and localStorage update (0ms delay, never lost on repeats)
    setReports(prev => {
      const next = [newReport, ...prev.filter(r => r.id !== newReport.id)];
      try {
        localStorage.setItem('mygacha_reports', JSON.stringify(next));
      } catch {}
      return next;
    });

    // 2. Broadcast local realtime event
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const bc = new BroadcastChannel('mygacha_realtime_bus');
        bc.postMessage({ type: 'report_submitted', payload: newReport });
        bc.close();
      }
    } catch {}

    // 3. Background sync to Supabase
    submitReportToSupabase(newReport).catch(e => {
      console.warn('Background submitReportToSupabase failed:', e);
    });

    return true;
  };

  const resolveReport = async (reportId: string): Promise<boolean> => {
    // 1. Instant local & state update (0ms delay)
    setReports(prev => {
      const next = prev.map(r => r.id === reportId ? {
        ...r,
        status: 'resolved' as const,
        resolvedAt: new Date().toISOString(),
        resolvedBy: currentUser?.username || 'Admin',
      } : r);
      try {
        localStorage.setItem('mygacha_reports', JSON.stringify(next));
      } catch {}
      return next;
    });

    // 2. Background sync
    resolveReportInSupabase(reportId, currentUser?.username || 'Admin').catch(e => {
      console.warn('Background resolveReportInSupabase failed:', e);
    });

    return true;
  };

  const deleteReport = async (reportId: string): Promise<boolean> => {
    // 1. Instant local & state update (0ms delay)
    setReports(prev => {
      const next = prev.filter(r => r.id !== reportId);
      try {
        localStorage.setItem('mygacha_reports', JSON.stringify(next));
      } catch {}
      return next;
    });

    // 2. Background sync
    deleteReportInSupabase(reportId).catch(e => {
      console.warn('Background deleteReportInSupabase failed:', e);
    });

    return true;
  };

  // Persist User
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(LOCAL_STORAGE_KEY_USER, JSON.stringify(currentUser));
      if (isSupabaseConfigured && supabase) {
        supabase.from('profiles').upsert({
          id: currentUser.id,
          username: currentUser.username,
          email: currentUser.email,
          avatar_url: currentUser.avatarUrl || null,
          coins: currentUser.coins,
          last_daily_reward_date: currentUser.lastDailyRewardDate,
          inventory: currentUser.inventory,
          updated_at: new Date().toISOString(),
        }).then(({ error }) => {
          if (error) console.error('Supabase profile sync error:', error);
        });
      }
    } else {
      localStorage.removeItem(LOCAL_STORAGE_KEY_USER);
    }
  }, [currentUser]);

  // Persist Packs locally
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_PACKS, JSON.stringify(packs));
    } catch (err) {
      console.warn('LocalStorage packs persist skipped (quota limit, IndexedDB used):', err);
    }
  }, [packs]);

  // Hydrate Packs from IndexedDB on initial mount
  useEffect(() => {
    const WIPE_PACKS_VERSION = 'mygacha_wipe_all_packs_v7';
    if (localStorage.getItem(WIPE_PACKS_VERSION) !== 'true') {
      localStorage.setItem(WIPE_PACKS_VERSION, 'true');
      localStorage.removeItem(LOCAL_STORAGE_KEY_PACKS);
      localStorage.removeItem('mygacha_creator_draft');
      localStorage.removeItem('mygacha_franchise_templates');
      idbClearAllPacks();
      setPacks([]);
      return;
    }

    idbGetAllPacks().then((idbPacks) => {
      if (idbPacks && idbPacks.length > 0) {
        const deletedIds = getDeletedPackIds();
        setPacks(prev => {
          const map = new Map<string, PackSeries>();
          prev.forEach(p => {
            if (
              !deletedIds.has(p.id) &&
              p.id !== 'test-pack-001' &&
              p.id !== 'pack-1791291048286' &&
              p.franchiseName !== 'TestFranchise' &&
              !p.seriesName?.includes('Vol .1') &&
              !p.seriesName?.includes('Vol. 1') &&
              !p.franchiseName?.toLowerCase().includes('untitled')
            ) {
              map.set(p.id, p);
            }
          });
          idbPacks.forEach(rawP => {
            const p: PackSeries = {
              ...rawP,
              cards: (rawP.cards || []).map((c: any) => ({
                ...c,
                name: getCardDisplayName(c.name),
              })),
            };
            if (
              !deletedIds.has(p.id) &&
              p.id !== 'test-pack-001' &&
              p.id !== 'pack-1791291048286' &&
              p.franchiseName !== 'TestFranchise' &&
              !p.seriesName?.includes('Vol .1') &&
              !p.seriesName?.includes('Vol. 1') &&
              !p.franchiseName?.toLowerCase().includes('untitled')
            ) {
              const existing = map.get(p.id);
              if (!existing || (p.cards && p.cards.length > (existing.cards?.length || 0))) {
                map.set(p.id, p);
              }
            }
          });
          return Array.from(map.values());
        });
      }
    });
  }, []);

  // Refresh packs from Supabase across all machines
  const refreshPacks = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) return;
    try {
      const { data, error } = await supabase
        .from('card_packs')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        const deletedIds = getDeletedPackIds();
        const validRows = data.filter((row: any) =>
          row.id !== 'test-pack-001' &&
          row.id !== 'pack-1791291048286' &&
          Boolean(row.franchise_name) &&
          !deletedIds.has(row.id)
        );

        const remotePacks: PackSeries[] = validRows.map((row: any) => ({
          id: row.id,
          authorId: row.author_id,
          franchiseName: row.franchise_name,
          seriesName: row.series_name,
          tag: row.tag || '',
          coverImageUrl: row.cover_image_url || '',
          coverAspectRatio: row.cover_aspect_ratio || 'auto',
          tearConfig: row.tear_config || { direction: 'up' },
          cardsPerPack: row.cards_per_pack || 5,
          price: row.price || 500,
          rarities: row.rarities || [],
          cards: (row.cards || []).map((c: any) => ({
            ...c,
            name: getCardDisplayName(c.name),
            fields: (c.fields || []).map((f: any) => ({
              ...f,
              value: (f.name === 'ชื่อการ์ด' || f.name === 'Card Name') ? getCardDisplayName(f.value) : f.value,
            })),
          })),
          createdAt: row.created_at || new Date().toISOString(),
          isPublished: row.is_published ?? true,
        }));

        setPacks(prev => {
          const prevMap = new Map<string, PackSeries>();
          prev.forEach(p => {
            if (!deletedIds.has(p.id)) {
              prevMap.set(p.id, p);
            }
          });

          const now = Date.now();
          const merged: PackSeries[] = remotePacks.map(remote => {
            const local = prevMap.get(remote.id);
            const recent = recentSavesRef.current.get(remote.id);
            const isSaving = savingPackIdsRef.current.has(remote.id);

            // If a local save occurred recently (< 45s) or currently saving, prioritize local pack
            const isRecentlySaved = (recent && (now - recent.timestamp < 45000)) || isSaving;
            const effectiveLocal = (recent?.pack) || local;

            // Ensure tearConfig with custom points or non-default direction is preserved if remote row is empty/default
            const finalCoverAspectRatio =
              remote.coverAspectRatio && remote.coverAspectRatio !== 'auto'
                ? remote.coverAspectRatio
                : (effectiveLocal?.coverAspectRatio || remote.coverAspectRatio || 'auto');

            const hasRemoteCustomTear =
              remote.tearConfig &&
              (remote.tearConfig.direction === 'custom'
                ? Boolean(remote.tearConfig.customStart && remote.tearConfig.customEnd)
                : remote.tearConfig.direction !== 'up');

            const finalTearConfig = hasRemoteCustomTear
              ? remote.tearConfig
              : (effectiveLocal?.tearConfig || remote.tearConfig || { direction: 'up' });

            // SMART CARDS MERGE: NEVER DOWNGRADE OR DROP CARDS!
            let finalCards = remote.cards || [];
            if (effectiveLocal && effectiveLocal.cards && effectiveLocal.cards.length > 0) {
              if (finalCards.length === 0) {
                // Remote has no cards, keep local cards
                finalCards = effectiveLocal.cards;
              } else if (effectiveLocal.cards.length > finalCards.length || isRecentlySaved) {
                // Local has more cards than remote or was recently saved! Retain all local cards
                const remoteCardIds = new Set(finalCards.map(c => c.id));
                const extraLocalCards = effectiveLocal.cards.filter(c => !remoteCardIds.has(c.id));
                finalCards = [...finalCards, ...extraLocalCards];
              } else {
                // Merge in any rich local fields / dataUrls
                finalCards = finalCards.map(rc => {
                  const lc = effectiveLocal.cards.find(c => c.id === rc.id);
                  if (lc && lc.imageUrl && lc.imageUrl.startsWith('data:') && (!rc.imageUrl || !rc.imageUrl.startsWith('http'))) {
                    return { ...rc, imageUrl: lc.imageUrl };
                  }
                  return rc;
                });
              }
            }

            const p: PackSeries = {
              ...remote,
              cards: finalCards,
              coverAspectRatio: finalCoverAspectRatio,
              tearConfig: finalTearConfig,
            };
            idbSavePack(p).catch(() => {});
            return p;
          });

          prev.forEach(p => {
            if (!deletedIds.has(p.id) && !merged.some(m => m.id === p.id)) {
              merged.push(p);
            }
          });

          try {
            localStorage.setItem(LOCAL_STORAGE_KEY_PACKS, JSON.stringify(merged));
          } catch {}

          return merged;
        });
      }
    } catch (err) {
      console.warn('Error refreshing packs from Supabase:', err);
    }
  }, []);

  // Real-time synchronization for Packs, Coins, and Roles across all machines & browser tabs (Requirement 6, 7 & 8)
  useEffect(() => {
    refreshPacks();

    const handlePackUpdated = (incomingPack: PackSeries) => {
      if (!incomingPack?.id) return;
      const cleanPack: PackSeries = {
        ...incomingPack,
        cards: (incomingPack.cards || []).map(c => ({
          ...c,
          name: getCardDisplayName(c.name),
        })),
      };
      idbSavePack(cleanPack).catch(() => {});
      setPacks(prev => {
        const idx = prev.findIndex(p => p.id === cleanPack.id);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = cleanPack;
          try {
            localStorage.setItem(LOCAL_STORAGE_KEY_PACKS, JSON.stringify(updated));
          } catch {}
          return updated;
        }
        const updated = [cleanPack, ...prev];
        try {
          localStorage.setItem(LOCAL_STORAGE_KEY_PACKS, JSON.stringify(updated));
        } catch {}
        return updated;
      });
    };

    const handlePackDeleted = (deletedId: string) => {
      if (!deletedId) return;
      addDeletedPackId(deletedId);
      idbDeletePack(deletedId).catch(() => {});
      setPacks(prev => {
        const next = prev.filter(p => p.id !== deletedId);
        try {
          localStorage.setItem(LOCAL_STORAGE_KEY_PACKS, JSON.stringify(next));
        } catch {}
        return next;
      });
    };

    const handleCoinsUpdate = (payload: any) => {
      const { username, coins: newCoins, memberId, email } = payload || {};
      if (newCoins === undefined) return;
      lastLocalCoinChangeTimeRef.current = Date.now();
      setCurrentUser(curr => {
        if (!curr) return null;
        const match =
          (username && curr.username.toLowerCase() === String(username).toLowerCase()) ||
          (memberId && curr.id === memberId) ||
          (email && curr.email && curr.email.toLowerCase() === String(email).toLowerCase());
        if (match) {
          const finalVal = Number(newCoins);
          const updated = { ...curr, coins: finalVal };
          try {
            localStorage.setItem(LOCAL_STORAGE_KEY_USER, JSON.stringify(updated));
            const stored = localStorage.getItem(LOCAL_STORAGE_KEY_ACCOUNTS);
            if (stored) {
              const accs = JSON.parse(stored);
              if (accs[curr.username.toLowerCase()]) {
                accs[curr.username.toLowerCase()].coins = finalVal;
                localStorage.setItem(LOCAL_STORAGE_KEY_ACCOUNTS, JSON.stringify(accs));
              }
            }
          } catch {}
          if (isSupabaseConfigured && supabase) {
            supabase.from('profiles').update({ coins: finalVal }).eq('id', curr.id).then(() => {});
          }
          return updated;
        }
        return curr;
      });
    };

    const handleRoleUpdate = (payload: any) => {
      const { username, role: newRole, memberId, email } = payload || {};
      if (!newRole) return;
      setCurrentUser(curr => {
        if (!curr) return null;
        if (isMainAdmin(curr.username, curr.email)) return curr;
        const match =
          (username && curr.username.toLowerCase() === String(username).toLowerCase()) ||
          (memberId && curr.id === memberId) ||
          (email && curr.email && curr.email.toLowerCase() === String(email).toLowerCase());
        if (match) {
          const updated = { ...curr, role: newRole as 'Admin' | 'User' };
          try {
            localStorage.setItem(LOCAL_STORAGE_KEY_USER, JSON.stringify(updated));
          } catch {}
          return updated;
        }
        return curr;
      });
    };

    // 1. Instant 0ms Cross-Tab Local Broadcast Listener
    if (localBroadcastChannel) {
      localBroadcastChannel.onmessage = (e: MessageEvent) => {
        try {
          const { event, payload } = e.data || {};
          if (event === 'pack_updated' && payload?.pack) {
            handlePackUpdated(payload.pack);
          } else if (event === 'pack_deleted' && payload?.packId) {
            handlePackDeleted(payload.packId);
          } else if (event === 'member_coins_updated') {
            handleCoinsUpdate(payload);
          } else if (event === 'member_role_updated') {
            handleRoleUpdate(payload);
          } else if (event === 'tag_updated') {
            refreshTags();
          } else if (event === 'report_submitted' || event === 'report_deleted') {
            refreshReports();
          } else if (event === 'report_acknowledged') {
            const data = payload?.payload || payload;
            if (data?.userId && currentUser && currentUser.id === data.userId) {
              addToast(
                language === 'th'
                  ? `ผู้ดูแลระบบได้รับทราบคำร้องรายงานของคุณแล้ว (เรื่อง: ${data.category || 'เนื้อหา'})`
                  : `The admin has acknowledged your report (${data.category || 'content'})`,
                'info'
              );
            }
            refreshReports();
          }
        } catch (err) {
          console.warn('Local broadcast handler error:', err);
        }
      };
    }

    // 2. Storage event fallback for cross-tab sync
    const handleStorageEvent = (e: StorageEvent) => {
      try {
        if (e.key === LOCAL_STORAGE_KEY_USER && e.newValue) {
          const parsed = JSON.parse(e.newValue);
          if (parsed && typeof parsed === 'object') {
            parsed.inventory = parsed.inventory || {};
            parsed.coins = typeof parsed.coins === 'number' ? parsed.coins : 5000;
            setCurrentUser(parsed);
          }
        } else if (e.key === LOCAL_STORAGE_KEY_PACKS && e.newValue) {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            setPacks(parsed);
          }
        }
      } catch (err) {
        console.warn('Storage event handle error:', err);
      }
    };
    window.addEventListener('storage', handleStorageEvent);

    // 3. Supabase WebSocket Realtime Channel for remote/cross-machine sync
    let channel: any = null;
    if (isSupabaseConfigured && supabase) {
      try {
        channel = supabase.channel(REALTIME_CHANNEL_NAME)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'card_packs' },
            () => {
              try { refreshPacks(); } catch {}
            }
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'profiles' },
            (payload: any) => {
              try {
                const updated = payload.new;
                if (updated) {
                  handleCoinsUpdate({
                    username: updated.username,
                    coins: updated.coins,
                    memberId: updated.id,
                    email: updated.email,
                  });
                }
              } catch {}
            }
          )
          .on('broadcast', { event: 'pack_updated' }, (payload: any) => {
            try {
              if (payload?.payload?.pack) {
                handlePackUpdated(payload.payload.pack);
              }
              refreshPacks();
            } catch {}
          })
          .on('broadcast', { event: 'pack_deleted' }, (payload: any) => {
            try {
              if (payload?.payload?.packId) {
                handlePackDeleted(payload.payload.packId);
              }
            } catch {}
          })
          .on('broadcast', { event: 'member_coins_updated' }, (payload: any) => {
            try {
              handleCoinsUpdate(payload.payload);
            } catch {}
          })
          .on('broadcast', { event: 'member_role_updated' }, (payload: any) => {
            try {
              handleRoleUpdate(payload.payload);
            } catch {}
          })
          .on('broadcast', { event: 'tag_updated' }, () => {
            try {
              refreshTags();
            } catch {}
          })
          .on('broadcast', { event: 'report_submitted' }, () => {
            try { refreshReports(); } catch {}
          })
          .on('broadcast', { event: 'report_deleted' }, () => {
            try { refreshReports(); } catch {}
          })
          .on('broadcast', { event: 'report_acknowledged' }, (payload: any) => {
            try {
              const data = payload?.payload || payload;
              if (data?.userId && currentUser && currentUser.id === data.userId) {
                addToast(
                  language === 'th'
                    ? `ผู้ดูแลระบบได้รับทราบคำร้องรายงานของคุณแล้ว (เรื่อง: ${data.category || 'เนื้อหา'})`
                    : `The admin has acknowledged your report (${data.category || 'content'})`,
                  'info'
                );
              }
              refreshReports();
            } catch {}
          })
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'tags' },
            () => {
              try { refreshTags(); } catch {}
            }
          )
          .subscribe((status: string) => {
            if (status === 'SUBSCRIBED') {
              console.log('[Supabase Realtime] Subscribed successfully');
            }
          });
      } catch (chErr) {
        console.warn('Realtime channel init warning:', chErr);
      }
    }

    // 4. Fallback Polling every 1 second (1000ms) for high-speed real-time sync
    const pollInterval = setInterval(() => {
      try {
        refreshPacks();

        if (currentUser && supabase) {
          supabase
            .from('profiles')
            .select('coins')
            .eq('id', currentUser.id)
            .maybeSingle()
            .then(
              ({ data }) => {
                if (
                  data &&
                  data.coins !== undefined &&
                  Date.now() - lastLocalCoinChangeTimeRef.current >= 45000
                ) {
                  setCurrentUser(curr => {
                    if (!curr || curr.coins === data.coins) return curr;
                    const updated = { ...curr, coins: data.coins, inventory: curr.inventory || {} };
                    try {
                      localStorage.setItem(LOCAL_STORAGE_KEY_USER, JSON.stringify(updated));
                    } catch {}
                    return updated;
                  });
                }
              },
              () => {}
            );

          fetchRemoteRoles().then(roles => {
            const isHead = isMainAdmin(currentUser.username, currentUser.email);
            const expectedRole = isHead ? 'Admin' : (roles[currentUser.username.toLowerCase()] || 'User');
            if (currentUser.role !== expectedRole) {
              setCurrentUser(curr => (curr ? { ...curr, role: expectedRole, inventory: curr.inventory || {} } : null));
            }
          }).catch(() => {});
        }
      } catch (pollErr) {
        console.warn('Polling error:', pollErr);
      }
    }, 1000);

    return () => {
      window.removeEventListener('storage', handleStorageEvent);
      if (channel && supabase) {
        try {
          supabase.removeChannel(channel);
        } catch {
          try { channel.unsubscribe(); } catch {}
        }
      }
      clearInterval(pollInterval);
    };
  }, [refreshPacks, currentUser?.id, currentUser?.username]);

  // Requirement 3 & 5: Reset all packs across all client machines, reset coins to 5000
  useEffect(() => {
    const WIPE_PACKS_VERSION = 'mygacha_wipe_all_packs_v7';
    if (localStorage.getItem(WIPE_PACKS_VERSION) !== 'true') {
      localStorage.setItem(WIPE_PACKS_VERSION, 'true');
      localStorage.removeItem(LOCAL_STORAGE_KEY_PACKS);
      localStorage.removeItem('mygacha_creator_draft');
      localStorage.removeItem('mygacha_franchise_templates');
      idbClearAllPacks();
      setPacks([]);
    }
  }, []);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  const toggleLanguage = () => {
    setLanguage(prev => (prev === 'th' ? 'en' : 'th'));
  };

  const addToast = (message: string, type: ToastMessage['type'] = 'info') => {
    const id = Date.now().toString() + Math.random().toString();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      removeToast(id);
    }, 3800);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Daily Reward Check (Requirement 6: Counts after midnight in Thailand - Asia/Bangkok)
  const getThailandDateString = (): string => {
    try {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Bangkok',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date());
    } catch {
      const now = new Date();
      const bkkTime = new Date(now.getTime() + (7 * 60 * 60 * 1000));
      return bkkTime.toISOString().slice(0, 10);
    }
  };

  const todayStr = getThailandDateString();
  const canClaimDailyReward = Boolean(
    currentUser && currentUser.lastDailyRewardDate !== todayStr
  );

  const claimDailyReward = (): boolean => {
    if (!currentUser) {
      addToast(language === 'th' ? 'กรุณาเข้าสู่ระบบก่อนรับรางวัล' : 'Please sign in first', 'warning');
      return false;
    }
    if (!canClaimDailyReward) {
      addToast(language === 'th' ? 'คุณได้รับรางวัลประจำวันไปแล้ววันนี้' : 'Daily reward already claimed today', 'warning');
      return false;
    }

    sound.playCoinSound();
    lastLocalCoinChangeTimeRef.current = Date.now();
    setCurrentUser(prev => {
      if (!prev) return null;
      const updatedCoins = prev.coins + 2000;
      const updated = {
        ...prev,
        coins: updatedCoins,
        lastDailyRewardDate: todayStr,
      };
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY_USER, JSON.stringify(updated));
        const stored = localStorage.getItem(LOCAL_STORAGE_KEY_ACCOUNTS);
        if (stored) {
          const accs = JSON.parse(stored);
          if (accs[prev.username.toLowerCase()]) {
            accs[prev.username.toLowerCase()].coins = updatedCoins;
            accs[prev.username.toLowerCase()].lastDailyRewardDate = todayStr;
            localStorage.setItem(LOCAL_STORAGE_KEY_ACCOUNTS, JSON.stringify(accs));
          }
        }
      } catch {}

      if (isSupabaseConfigured && supabase) {
        supabase
          .from('profiles')
          .update({
            coins: updatedCoins,
            last_daily_reward_date: todayStr,
          })
          .eq('id', prev.id)
          .then(({ error }) => {
            if (error) console.warn('Supabase daily reward coins sync error:', error);
          });
      }
      return updated;
    });

    addToast(language === 'th' ? 'รับรางวัลประจำวันสำเร็จ +2,000 Coin' : 'Daily reward claimed +2,000 Coin', 'success');
    return true;
  };

  const spendCoins = (amount: number): boolean => {
    // If in test mode, NEVER deduct real coins!
    if (typeof window !== 'undefined' && window.location.pathname.toLowerCase().includes('/test/')) {
      return true;
    }
    if (!currentUser) {
      addToast(language === 'th' ? 'กรุณาเข้าสู่ระบบก่อนซื้อซอง' : 'Please sign in to buy packs', 'warning');
      return false;
    }
    if (currentUser.coins < amount) {
      addToast(language === 'th' ? 'Coin ไม่เพียงพอ' : 'Not enough Coins', 'error');
      return false;
    }

    lastLocalCoinChangeTimeRef.current = Date.now();
    setCurrentUser(prev => {
      if (!prev) return null;
      const updatedCoins = prev.coins - amount;
      const updated = {
        ...prev,
        coins: updatedCoins,
      };
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY_USER, JSON.stringify(updated));
        const stored = localStorage.getItem(LOCAL_STORAGE_KEY_ACCOUNTS);
        if (stored) {
          const accs = JSON.parse(stored);
          if (accs[prev.username.toLowerCase()]) {
            accs[prev.username.toLowerCase()].coins = updatedCoins;
            localStorage.setItem(LOCAL_STORAGE_KEY_ACCOUNTS, JSON.stringify(accs));
          }
        }
      } catch {}

      if (isSupabaseConfigured && supabase) {
        supabase
          .from('profiles')
          .update({
            coins: updatedCoins,
          })
          .eq('id', prev.id)
          .then(({ error }) => {
            if (error) console.warn('Supabase spend coins sync error:', error);
          });
      }
      return updated;
    });
    return true;
  };

  const addCardsToInventory = (packId: string, drawnCards: CardItem[]) => {
    if (!currentUser) return;

    setCurrentUser(prev => {
      if (!prev) return null;
      const newInventory = { ...prev.inventory };
      drawnCards.forEach(card => {
        newInventory[card.id] = (newInventory[card.id] || 0) + 1;
        if (isSupabaseConfigured && supabase) {
          syncCardsToUserInventory(prev.id, card.id, newInventory[card.id]);
        }
      });
      return {
        ...prev,
        inventory: newInventory,
      };
    });
  };

  const login = async (username: string, pass: string): Promise<boolean> => {
    const cleanUser = username.trim();
    if (!cleanUser || !pass.trim()) {
      addToast(language === 'th' ? 'กรุณากรอกข้อมูลให้ครบถ้วน' : 'Please fill in all fields', 'warning');
      return false;
    }

    if (isSupabaseConfigured && supabase) {
      try {
        let emailToAuth = cleanUser;

        // If not an email, lookup user in profiles table by username
        if (!cleanUser.includes('@')) {
          const { data: profileRow } = await supabase
            .from('profiles')
            .select('email, username')
            .ilike('username', cleanUser)
            .maybeSingle();

          if (profileRow && profileRow.email) {
            emailToAuth = profileRow.email;
          } else {
            // Requirement 4: User does not exist in database, DO NOT allow login!
            addToast(
              language === 'th' ? 'ไม่พบบัญชีนี้ในฐานข้อมูล กรุณาสมัครสมาชิกก่อน' : 'Account not found in database',
              'error'
            );
            return false;
          }
        }

        const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
          email: emailToAuth,
          password: pass,
        });

        if (authErr || !authData?.user) {
          addToast(
            language === 'th' ? 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง หรือยังไม่มีบัญชีในระบบ' : 'Invalid credentials or user does not exist',
            'error'
          );
          return false;
        }

        const userId = authData.user.id;
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();

        const remoteInventory = await fetchUserInventoryFromSupabase(userId);

        const usernameResolved = profileData?.username || authData.user.user_metadata?.username || cleanUser;
        const emailResolved = profileData?.email || emailToAuth;
        const isTargetAdmin = isMainAdmin(usernameResolved, emailResolved);

        let userRole: 'Admin' | 'User' = isTargetAdmin ? 'Admin' : 'User';
        if (!isTargetAdmin) {
          try {
            const remoteRoles = await fetchRemoteRoles();
            if (remoteRoles[usernameResolved.toLowerCase()]) {
              userRole = remoteRoles[usernameResolved.toLowerCase()];
            }
          } catch {}
        }

        let resolvedCoins = 5000;
        if (typeof profileData?.coins === 'number') {
          resolvedCoins = profileData.coins;
        } else {
          try {
            const stored = localStorage.getItem(LOCAL_STORAGE_KEY_USER);
            if (stored) {
              const u = JSON.parse(stored);
              if (typeof u?.coins === 'number') resolvedCoins = u.coins;
            }
          } catch {}
        }

        const loggedInUser: UserProfile = {
          id: userId,
          username: usernameResolved,
          email: emailResolved,
          avatarUrl: profileData?.avatar_url || authData.user.user_metadata?.avatar_url || '',
          role: userRole,
          lastUsernameChangeDate: profileData?.last_username_change_date || authData.user.user_metadata?.last_username_change_date || null,
          coins: resolvedCoins,
          lastDailyRewardDate: profileData?.last_daily_reward_date || null,
          inventory: remoteInventory,
        };

        setCurrentUser(loggedInUser);
        addToast(language === 'th' ? 'เข้าสู่ระบบสำเร็จ' : 'Logged in successfully', 'success');
        return true;
      } catch (err) {
        console.error('Supabase auth error:', err);
        // Fallback for Admin credentials: gmail: 6nathan.dev@gmail.com | pass: Khunsan.1605 or username: NathanKunsan | pass: Khunsan.1605
        if (
          (cleanUser.toLowerCase() === 'nathankunsan' || cleanUser.toLowerCase() === '6nathan.dev@gmail.com') &&
          pass === 'Khunsan.1605'
        ) {
          let preservedCoins = 5000;
          let preservedInv = {};
          let preservedDaily = null;
          try {
            const stored = localStorage.getItem(LOCAL_STORAGE_KEY_USER);
            if (stored) {
              const u = JSON.parse(stored);
              if (typeof u?.coins === 'number') preservedCoins = u.coins;
              if (u?.inventory) preservedInv = u.inventory;
              if (u?.lastDailyRewardDate) preservedDaily = u.lastDailyRewardDate;
            }
          } catch {}
          const adminUser: UserProfile = {
            id: 'cff953ba-e896-4f6f-b769-54ef218d1480',
            username: 'NathanKunsan',
            email: '6nathan.dev@gmail.com',
            avatarUrl: '',
            role: 'Admin',
            coins: preservedCoins,
            lastDailyRewardDate: preservedDaily,
            inventory: preservedInv,
          };
          setCurrentUser(adminUser);
          addToast(language === 'th' ? 'เข้าสู่ระบบ Admin สำเร็จ' : 'Logged in as Admin', 'success');
          return true;
        }

        addToast(
          language === 'th' ? 'เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล' : 'Database connection error',
          'error'
        );
        return false;
      }
    }

    // Local fallback only if Supabase is NOT configured at all
    if (
      (cleanUser.toLowerCase() === 'nathankunsan' || cleanUser.toLowerCase() === '6nathan.dev@gmail.com') &&
      pass === 'Khunsan.1605'
    ) {
      let preservedCoins = 5000;
      let preservedInv = {};
      let preservedDaily = null;
      try {
        const stored = localStorage.getItem(LOCAL_STORAGE_KEY_USER);
        if (stored) {
          const u = JSON.parse(stored);
          if (typeof u?.coins === 'number') preservedCoins = u.coins;
          if (u?.inventory) preservedInv = u.inventory;
          if (u?.lastDailyRewardDate) preservedDaily = u.lastDailyRewardDate;
        }
      } catch {}
      const adminUser: UserProfile = {
        id: 'cff953ba-e896-4f6f-b769-54ef218d1480',
        username: 'NathanKunsan',
        email: '6nathan.dev@gmail.com',
        avatarUrl: '',
        role: 'Admin',
        coins: preservedCoins,
        lastDailyRewardDate: preservedDaily,
        inventory: preservedInv,
      };
      setCurrentUser(adminUser);
      addToast(language === 'th' ? 'เข้าสู่ระบบ Admin สำเร็จ' : 'Logged in as Admin', 'success');
      return true;
    }

    addToast(language === 'th' ? 'ยังไม่ได้เชื่อมต่อฐานข้อมูล Supabase' : 'Database not configured', 'error');
    return false;
  };

  const register = async (
    rawUsername: string,
    email: string,
    pass: string,
    avatarDataUrl?: string
  ): Promise<boolean> => {
    // English alphanumeric only silently
    const username = rawUsername.trim().replace(/[^a-zA-Z0-9]/g, '');
    if (!username) {
      addToast(language === 'th' ? 'ชื่อผู้ใช้ต้องเป็นตัวอักษรภาษาอังกฤษและตัวเลขเท่านั้น' : 'Username must be alphanumeric', 'warning');
      return false;
    }

    const finalEmail = email || `${username.toLowerCase()}@gmail.com`;
    let uploadedAvatarUrl = avatarDataUrl || '';

    // Requirement: ตรวจสอบความซ้ำกับฐานข้อมูล Supabase ว่าชื่อบัญชีมีความซ้ำไหม
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: existingUser } = await supabase
          .from('profiles')
          .select('id, username')
          .ilike('username', username)
          .maybeSingle();

        if (existingUser) {
          addToast(language === 'th' ? 'กรุณาตั้ง username ใหม่' : 'Please choose a different username', 'warning');
          return false;
        }

        const nowIso = new Date().toISOString();
        const isTargetAdmin = isMainAdmin(username, finalEmail);

        const { data: authData, error: authErr } = await supabase.auth.signUp({
          email: finalEmail,
          password: pass,
          options: {
            data: { username, role: isTargetAdmin ? 'Admin' : 'User', last_username_change_date: nowIso },
          },
        });

        if (!authErr && authData?.user) {
          const userId = authData.user.id;
          if (avatarDataUrl) {
            const remoteUrl = await uploadUserAvatarToSupabase(userId, avatarDataUrl);
            if (remoteUrl) uploadedAvatarUrl = remoteUrl;
          }

          await supabase.from('profiles').upsert({
            id: userId,
            username,
            email: finalEmail,
            avatar_url: uploadedAvatarUrl || null,
            coins: 5000,
            last_daily_reward_date: null,
          });

          const regUser: UserProfile = {
            id: userId,
            username,
            email: finalEmail,
            avatarUrl: uploadedAvatarUrl,
            role: isTargetAdmin ? 'Admin' : 'User',
            lastUsernameChangeDate: nowIso,
            coins: 5000,
            lastDailyRewardDate: null,
            inventory: {},
          };

          setCurrentUser(regUser);

          // Save account locally as well
          try {
            const stored = localStorage.getItem(LOCAL_STORAGE_KEY_ACCOUNTS);
            const accs = stored ? JSON.parse(stored) : {};
            accs[username.toLowerCase()] = regUser;
            localStorage.setItem(LOCAL_STORAGE_KEY_ACCOUNTS, JSON.stringify(accs));
          } catch {}

          addToast(language === 'th' ? 'สมัครสมาชิกสำเร็จ' : 'Registered successfully', 'success');
          return true;
        } else if (authErr) {
          addToast(authErr.message, 'error');
          return false;
        }
      } catch (err) {
        console.warn('Supabase register error:', err);
      }
    }

    // Local check fallback
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY_ACCOUNTS);
      if (stored) {
        const accs = JSON.parse(stored);
        if (accs[username.toLowerCase()]) {
          addToast(language === 'th' ? 'กรุณาตั้ง username ใหม่' : 'Please choose a different username', 'warning');
          return false;
        }
      }
    } catch {}

    addToast(language === 'th' ? 'สมัครสมาชิกล้มเหลว' : 'Registration failed', 'error');
    return false;
  };

  const updateUsername = async (newUsername: string): Promise<boolean> => {
    if (!currentUser) return false;
    // Requirement 5: English alphanumeric only silently
    const clean = newUsername.trim().replace(/[^a-zA-Z0-9]/g, '');
    if (!clean) {
      addToast(language === 'th' ? 'ชื่อผู้ใช้ต้องเป็นตัวอักษรภาษาอังกฤษและตัวเลขเท่านั้น' : 'Username must be alphanumeric', 'warning');
      return false;
    }
    if (clean.toLowerCase() === currentUser.username.toLowerCase()) {
      return true;
    }

    // 15-day edit restriction: advances each day after 12:00 PM Thailand noon
    if (currentUser.lastUsernameChangeDate) {
      const status = getUsernameChangeStatus(currentUser.lastUsernameChangeDate, 15);
      if (!status.canChange) {
        addToast(
          language === 'th'
            ? `สามารถเปลี่ยนชื่อผู้ใช้ได้ทุกๆ 15 วัน (เหลืออีก ${status.remainingDays} วัน)`
            : `Can change username in ${status.remainingDays} days`,
          'warning'
        );
        return false;
      }
    }

    const nowIso = new Date().toISOString();

    if (isSupabaseConfigured && supabase) {
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .ilike('username', clean)
        .neq('id', currentUser.id)
        .maybeSingle();

      if (existing) {
        addToast(language === 'th' ? 'ชื่อผู้ใช้นี้มีคนใช้แล้ว' : 'Username already taken', 'warning');
        return false;
      }

      await supabase
        .from('profiles')
        .update({ username: clean })
        .eq('id', currentUser.id);

      try {
        await supabase.auth.updateUser({
          data: { username: clean, last_username_change_date: nowIso },
        });
      } catch {}
    }

    const updatedUser: UserProfile = {
      ...currentUser,
      username: clean,
      lastUsernameChangeDate: nowIso,
    };
    setCurrentUser(updatedUser);

    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY_ACCOUNTS);
      const accs = stored ? JSON.parse(stored) : {};
      accs[clean.toLowerCase()] = updatedUser;
      localStorage.setItem(LOCAL_STORAGE_KEY_ACCOUNTS, JSON.stringify(accs));
    } catch {}

    addToast(language === 'th' ? 'เปลี่ยนชื่อผู้ใช้สำเร็จ' : 'Username updated', 'success');
    return true;
  };

  const updateUserAvatar = (newAvatarUrl: string) => {
    if (!currentUser) return;
    setCurrentUser(prev => {
      if (!prev) return null;
      const updated = { ...prev, avatarUrl: newAvatarUrl };
      try {
        const stored = localStorage.getItem(LOCAL_STORAGE_KEY_ACCOUNTS);
        const accs = stored ? JSON.parse(stored) : {};
        accs[prev.username.toLowerCase()] = updated;
        localStorage.setItem(LOCAL_STORAGE_KEY_ACCOUNTS, JSON.stringify(accs));
      } catch {}
      return updated;
    });

    if (isSupabaseConfigured && supabase) {
      uploadUserAvatarToSupabase(currentUser.id, newAvatarUrl);
      supabase
        .from('profiles')
        .update({ avatar_url: newAvatarUrl })
        .eq('id', currentUser.id);
    }
    addToast(language === 'th' ? 'อัปเดตรูปโปรไฟล์สำเร็จ' : 'Avatar updated', 'success');
  };

  const logout = () => {
    if (isSupabaseConfigured && supabase) {
      supabase.auth.signOut().catch(() => {});
    }
    setCurrentUser(null);
    addToast(language === 'th' ? 'ออกจากระบบเรียบร้อยแล้ว' : 'Logged out', 'info');
  };

  // Requirement 6: Single toast on Save, no double popup
  const savePack = async (pack: PackSeries, silent = false): Promise<PackSeries> => {
    // Prepare cards with dbName for DB indexing while preserving clean display name
    const preparedCards = prepareCardsForDatabase(pack.cards || []);
    const finalPack: PackSeries = {
      ...pack,
      cards: preparedCards,
      authorId: pack.authorId || currentUser?.id || undefined,
    };

    // Mark recent local save so polling and refresh never overwrite with older data
    recentSavesRef.current.set(finalPack.id, { timestamp: Date.now(), pack: finalPack });
    savingPackIdsRef.current.add(finalPack.id);

    // 1. Persist immediately to IndexedDB & active draft (< 5ms)
    idbSavePack(finalPack).catch(() => {});
    idbSaveActiveDraft(finalPack).catch(() => {});

    setPacks(prev => {
      const idx = prev.findIndex(p => p.id === finalPack.id);
      let next: PackSeries[];
      if (idx >= 0) {
        next = [...prev];
        next[idx] = finalPack;
      } else {
        next = [finalPack, ...prev];
      }
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY_PACKS, JSON.stringify(next));
      } catch (err) {
        console.warn('Failed to write packs to localStorage (IndexedDB preserved):', err);
      }
      return next;
    });

    // Keep active draft updated so refreshing/reopening never loses work
    try {
      localStorage.setItem('mygacha_creator_draft', JSON.stringify(finalPack));
    } catch {}

    // 2. Broadcast update across machines immediately
    broadcastRealtimeEvent('pack_updated', { packId: finalPack.id, pack: finalPack });

    // 3. Show feedback notification IMMEDIATELY (Instant response, zero perceived lag!)
    if (!silent) {
      addToast(
        language === 'th'
          ? `ทำการบันทึกแล้ว (พบการ์ด ${finalPack.cards.length} ใบ)`
          : `Pack saved successfully (${finalPack.cards.length} cards)`,
        'success'
      );
    }

    // 4. Online Sync to Supabase Storage & Database in background (Instant UI response!)
    if (isSupabaseConfigured && supabase) {
      uploadPackToSupabaseStorage(finalPack).then((syncedPack) => {
        if (syncedPack) {
          recentSavesRef.current.set(syncedPack.id, { timestamp: Date.now(), pack: syncedPack });
          idbSavePack(syncedPack).catch(() => {});
          setPacks(prev => prev.map(p => p.id === syncedPack.id ? syncedPack : p));
        }
      }).catch((err) => {
        console.warn('Supabase pack upload failed:', err);
      }).finally(() => {
        savingPackIdsRef.current.delete(finalPack.id);
      });
    } else {
      savingPackIdsRef.current.delete(finalPack.id);
    }

    return finalPack;
  };

  const publishPack = async (pack: PackSeries) => {
    const updated: PackSeries = {
      ...pack,
      isPublished: true,
      authorId: pack.authorId || currentUser?.id || undefined,
    };
    await savePack(updated, true); // silent = true to avoid double toast
    addToast(language === 'th' ? 'เผยแพร่ชุดการ์ดแล้ว' : 'Pack published', 'success');
  };

  // Requirement 6: Toggle Publish / Hide across all machines without using word "ร่าง"
  const togglePackPublished = async (packId: string) => {
    const target = packs.find(p => p.id === packId);
    if (!target) return;
    const nextPublished = !target.isPublished;
    const updated: PackSeries = {
      ...target,
      isPublished: nextPublished,
    };
    await savePack(updated, true);
    addToast(
      nextPublished
        ? (language === 'th' ? 'เปิดเผยแพร่ Pack สู่สาธารณะแล้ว' : 'Pack is now published')
        : (language === 'th' ? 'ซ่อน Pack เรียบร้อยแล้ว' : 'Pack is now hidden'),
      'success'
    );
  };

  // Requirement 2, 7 & 8: Update Member Coins (+ / -) in real time
  const updateMemberCoins = async (username: string, newCoins: number, memberId?: string, memberEmail?: string) => {
    const finalCoins = Math.max(0, newCoins);
    lastLocalCoinChangeTimeRef.current = Date.now();

    // 1. Update in-memory currentUser if matched by username, memberId, or email
    setCurrentUser(prev => {
      if (!prev) return null;
      const isMatch =
        (username && prev.username.toLowerCase() === username.toLowerCase()) ||
        (memberId && prev.id === memberId) ||
        (memberEmail && prev.email && prev.email.toLowerCase() === memberEmail.toLowerCase());
      if (isMatch) {
        const updated = { ...prev, coins: finalCoins };
        try {
          localStorage.setItem(LOCAL_STORAGE_KEY_USER, JSON.stringify(updated));
        } catch {}
        return updated;
      }
      return prev;
    });

    // 2. Update Supabase profiles
    if (isSupabaseConfigured && supabase) {
      try {
        if (memberId && !memberId.startsWith('local-')) {
          await supabase.from('profiles').update({ coins: finalCoins }).eq('id', memberId);
        } else {
          await supabase.from('profiles').update({ coins: finalCoins }).ilike('username', username);
        }
      } catch (err) {
        console.warn('Error updating Supabase profile coins:', err);
      }
    }

    // 3. Update localStorage accounts
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY_ACCOUNTS);
      if (stored) {
        const accs = JSON.parse(stored);
        if (accs[username.toLowerCase()]) {
          accs[username.toLowerCase()].coins = finalCoins;
          localStorage.setItem(LOCAL_STORAGE_KEY_ACCOUNTS, JSON.stringify(accs));
        }
      }
    } catch {}

    // 4. Broadcast in real time across tabs and machines
    broadcastRealtimeEvent('member_coins_updated', {
      username,
      coins: finalCoins,
      memberId,
      email: memberEmail,
    });
  };

  // Requirement 1 & Constraint: Update Member Role with Head Admin immutability
  const updateMemberRole = async (username: string, newRole: 'Admin' | 'User', memberId?: string) => {
    // Constraint: เหตุใดๆก็ตาม จะไม่มี Admin คนไหนก็ตามปรับ role ของ หัว Admin ได้
    if (isMainAdmin(username)) {
      addToast(
        language === 'th'
          ? 'ไม่อนุญาตให้แก้ไข Role ของหัว Admin โดยเด็ดขาด'
          : 'Cannot modify Head Admin role',
        'error'
      );
      return;
    }

    // 1. Update remote roles and local roles map
    const roles = await fetchRemoteRoles();
    roles[username.toLowerCase()] = newRole;
    await saveRemoteRoles(roles);

    // 2. Update in-memory currentUser if matched
    setCurrentUser(prev => {
      if (!prev) return null;
      if (prev.username.toLowerCase() === username.toLowerCase() || (memberId && prev.id === memberId)) {
        const updated = { ...prev, role: newRole };
        try {
          localStorage.setItem(LOCAL_STORAGE_KEY_USER, JSON.stringify(updated));
        } catch {}
        return updated;
      }
      return prev;
    });

    // 3. Update localStorage accounts
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY_ACCOUNTS);
      if (stored) {
        const accs = JSON.parse(stored);
        if (accs[username.toLowerCase()]) {
          accs[username.toLowerCase()].role = newRole;
          localStorage.setItem(LOCAL_STORAGE_KEY_ACCOUNTS, JSON.stringify(accs));
        }
      }
    } catch {}

    // 4. Broadcast in real time
    broadcastRealtimeEvent('member_role_updated', { username, role: newRole, memberId });
  };

  const deletePack = async (id: string): Promise<boolean> => {
    // 1. Record in tombstone blacklist so polling & refresh NEVER resurrect it
    addDeletedPackId(id);

    // 2. Remove from IndexedDB
    idbDeletePack(id).catch(() => {});

    // 3. In-memory and localStorage IMMEDIATELY (0ms)
    setPacks(prev => {
      const next = prev.filter(p => p.id !== id);
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY_PACKS, JSON.stringify(next));
      } catch {}
      return next;
    });

    if (editingPack?.id === id) {
      setEditingPack(null);
      localStorage.removeItem('mygacha_creator_draft');
    }

    // 4. Real-time broadcast deletion IMMEDIATELY
    broadcastRealtimeEvent('pack_deleted', { packId: id });

    // 5. Supabase deletion in database & storage
    let deleteSuccess = true;
    if (isSupabaseConfigured && supabase) {
      try {
        const res = await deletePackFromSupabase(id);
        if (!res.success) {
          deleteSuccess = false;
          console.warn('Supabase delete returned error:', res.error);
          addToast(
            language === 'th'
              ? 'ลบในเครื่องเรียบร้อย (หมายเหตุ: Supabase ปฏิเสธการลบ กรุณารัน SQL RLS Policy)'
              : 'Deleted locally (Note: Supabase denied delete. Please run SQL RLS in Supabase)',
            'warning'
          );
        }
      } catch (err) {
        deleteSuccess = false;
        console.warn('Failed to delete pack from Supabase:', err);
      }
    }

    // 6. Toast Notification
    if (deleteSuccess) {
      addToast(language === 'th' ? 'ลบชุดการ์ดออกจากระบบและฐานข้อมูลเรียบร้อยแล้ว' : 'Pack deleted from system and database', 'info');
    }

    return deleteSuccess;
  };

  return (
    <GachaContext.Provider
      value={{
        currentUser,
        packs,
        theme,
        toggleTheme,
        language,
        toggleLanguage,
        toasts,
        addToast,
        removeToast,
        searchQuery,
        setSearchQuery,
        currentPath,
        navigate,
        login,
        register,
        logout,
        claimDailyReward,
        canClaimDailyReward,
        spendCoins,
        addCardsToInventory,
        savePack,
        publishPack,
        deletePack,
        editingPack,
        setEditingPack,
        dontAskDeleteAgain,
        setDontAskDeleteAgain,
        updateUserAvatar,
        updateUsername,
        updateMemberCoins,
        updateMemberRole,
        togglePackPublished,
        refreshPacks,
        tags,
        addTag,
        editTag,
        deleteTag,
        refreshTags,
        startNewPackCreation,
        reports,
        submitReport,
        resolveReport,
        deleteReport,
        refreshReports,
      }}
    >
      {children}
    </GachaContext.Provider>
  );
};

export const useGacha = () => {
  const context = useContext(GachaContext);
  if (!context) {
    throw new Error('useGacha must be used within GachaProvider');
  }
  return context;
};
