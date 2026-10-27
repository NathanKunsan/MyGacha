import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useGacha } from '../context/GachaContext';
import { isMainAdmin } from '../utils/admin';
import { supabase, isSupabaseConfigured, fetchRemoteRoles, fetchSystemResetState, localBroadcastChannel } from '../lib/supabase';
import { PackSeries, CardItem, CardRarity, CardField, PackTearConfig } from '../types';
import { PackCoverConfigurator } from './PackCoverConfigurator';
import { ConfirmModal } from './ConfirmModal';
import { ModernImageLightbox } from './ModernImageLightbox';
import { CardParityDrawer } from './CardParityDrawer';
import { NeoColorPicker } from './NeoColorPicker';
import { NeoDropdown, NeoDropdownOption } from './NeoDropdown';
import { NeoDateTimePicker } from './NeoDateTimePicker';
import { CardPickerModal, SelectedCardReward } from './CardPickerModal';
import { compressImageFile } from '../utils/storage';
import {
  getCardDisplayName,
  findDuplicateCardNameGroups,
  prepareCardsForDatabase,
  sortCardsByRarityOrder,
} from '../utils/cardName';
import {
  Edit2,
  Trash2,
  Check,
  X,
  Plus,
  ChevronDown,
  ChevronUp,
  Coins,
  Shield,
  Search,
  MessageSquare,
  AlertTriangle,
  Upload,
  Save,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Flag,
  PartyPopper,
  Scale,
  Ticket,
  Calendar,
  Clock,
  Sparkles,
  Layers,
  RotateCcw,
  CheckSquare,
  Square,
  User,
  Users,
  AlertOctagon,
  ShoppingBag,
  Tag,
} from 'lucide-react';
import { ContentReport, RedeemRewardType } from '../types';
import { getTranslation } from '../i18n/translations';

type AdminTab = 'queue' | 'reports' | 'members' | 'stats' | 'chat' | 'tags' | 'codes' | 'reset';

interface MemberData {
  id: string;
  username: string;
  email: string;
  avatarUrl?: string;
  coins: number;
  role: 'Admin' | 'User';
  isHeadAdmin: boolean;
}

export const AdminConsolePage: React.FC = () => {
  const {
    currentUser,
    packs,
    savePack,
    deletePack,
    navigate,
    addToast,
    updateMemberCoins,
    updateMemberRole,
    togglePackPublished,
    tags,
    addTag,
    editTag,
    deleteTag,
    language,
    reports,
    resolveReport,
    deleteReport,
    refreshReports,
    redeemCodes,
    addRedeemCode,
    deleteRedeemCode,
    toggleRedeemCodeActive,
    clearUserCards,
    resetAllCoins,
    clearAllPacksAndCards,
    clearAllTagsFromSystem,
    clearAllReportsFromSystem,
    clearMarketplace,
  } = useGacha();

  const t = getTranslation(language);

  // Active Admin Tab
  const [activeTab, setActiveTab] = useState<AdminTab>('queue');

  // Gift Codes Management State
  const [newCodeString, setNewCodeString] = useState('');
  const [newRewardType, setNewRewardType] = useState<RedeemRewardType>('coins');
  const [newCoinsAmount, setNewCoinsAmount] = useState<number>(1000);
  const [selectedFranchiseForCode, setSelectedFranchiseForCode] = useState<string>('ALL');
  const [selectedPackForCode, setSelectedPackForCode] = useState<string>(packs[0]?.id || '');
  const [selectedCardsForCode, setSelectedCardsForCode] = useState<SelectedCardReward[]>(() => {
    const firstPack = packs[0];
    if (firstPack && firstPack.cards && firstPack.cards.length > 0) {
      return [{ card: firstPack.cards[0], pack: firstPack }];
    }
    return [];
  });
  const [isFoilCardReward, setIsFoilCardReward] = useState<boolean>(false);
  const [enableExpiry, setEnableExpiry] = useState<boolean>(false);
  const [expiryDateTime, setExpiryDateTime] = useState<string>('');
  const [maxClaimsInput, setMaxClaimsInput] = useState<string>('');
  const [codeSearchQuery, setCodeSearchQuery] = useState('');
  const [isCardPickerModalOpen, setIsCardPickerModalOpen] = useState<boolean>(false);

  // System Reset & Clearance Management State
  const [clearUserCardsCheck, setClearUserCardsCheck] = useState<boolean>(false);
  const [userCardScope, setUserCardScope] = useState<'all' | 'specific'>('all');
  const [selectedUserToClear, setSelectedUserToClear] = useState<string>('');
  const [clearCoinsCheck, setClearCoinsCheck] = useState<boolean>(false);
  const [clearCardsSystemCheck, setClearCardsSystemCheck] = useState<boolean>(false);
  const [clearTagsCheck, setClearTagsCheck] = useState<boolean>(false);
  const [clearReportsCheck, setClearReportsCheck] = useState<boolean>(false);
  const [clearMarketCheck, setClearMarketCheck] = useState<boolean>(false);
  const [clearAllSystemCheck, setClearAllSystemCheck] = useState<boolean>(false);
  const [isClearConfirmModalOpen, setIsClearConfirmModalOpen] = useState<boolean>(false);
  const [isClearingInProgress, setIsClearingInProgress] = useState<boolean>(false);

  // Toggle "Clear Entire System"
  const handleToggleClearAllSystem = (checked: boolean) => {
    setClearAllSystemCheck(checked);
    setClearUserCardsCheck(checked);
    setUserCardScope('all');
    setClearCoinsCheck(checked);
    setClearCardsSystemCheck(checked);
    setClearTagsCheck(checked);
    setClearReportsCheck(checked);
    setClearMarketCheck(checked);
  };

  const handleToggleUserCards = (checked: boolean) => {
    setClearUserCardsCheck(checked);
    if (!checked) {
      setClearAllSystemCheck(false);
    }
  };

  const handleToggleCoins = (checked: boolean) => {
    setClearCoinsCheck(checked);
    if (!checked) {
      setClearAllSystemCheck(false);
    }
  };

  const handleToggleCardsSystem = (checked: boolean) => {
    setClearCardsSystemCheck(checked);
    if (!checked) {
      setClearAllSystemCheck(false);
    }
  };

  const handleToggleTags = (checked: boolean) => {
    setClearTagsCheck(checked);
    if (!checked) {
      setClearAllSystemCheck(false);
    }
  };

  const handleToggleReports = (checked: boolean) => {
    setClearReportsCheck(checked);
    if (!checked) {
      setClearAllSystemCheck(false);
    }
  };

  const handleToggleMarket = (checked: boolean) => {
    setClearMarketCheck(checked);
    if (!checked) {
      setClearAllSystemCheck(false);
    }
  };

  // Sync: If all 6 items are checked, clearAllSystemCheck turns true
  useEffect(() => {
    const allChecked =
      clearUserCardsCheck &&
      clearCoinsCheck &&
      clearCardsSystemCheck &&
      clearTagsCheck &&
      clearReportsCheck &&
      clearMarketCheck;
    if (allChecked && !clearAllSystemCheck) {
      setClearAllSystemCheck(true);
    } else if (!allChecked && clearAllSystemCheck) {
      setClearAllSystemCheck(false);
    }
  }, [
    clearUserCardsCheck,
    clearCoinsCheck,
    clearCardsSystemCheck,
    clearTagsCheck,
    clearReportsCheck,
    clearMarketCheck,
    clearAllSystemCheck,
  ]);

  const selectedClearCount = useMemo(() => {
    let count = 0;
    if (clearUserCardsCheck) count++;
    if (clearCoinsCheck) count++;
    if (clearCardsSystemCheck) count++;
    if (clearTagsCheck) count++;
    if (clearReportsCheck) count++;
    if (clearMarketCheck) count++;
    return count;
  }, [
    clearUserCardsCheck,
    clearCoinsCheck,
    clearCardsSystemCheck,
    clearTagsCheck,
    clearReportsCheck,
    clearMarketCheck,
  ]);

  const handleDeselectAllClear = () => {
    setClearAllSystemCheck(false);
    setClearUserCardsCheck(false);
    setClearCoinsCheck(false);
    setClearCardsSystemCheck(false);
    setClearTagsCheck(false);
    setClearReportsCheck(false);
    setClearMarketCheck(false);
    setSelectedUserToClear('');
    setUserCardScope('all');
  };

  const handleOpenClearConfirmModal = () => {
    if (selectedClearCount === 0) {
      addToast(t.adminConsole.reset.noItemSelectedWarning, 'warning');
      return;
    }
    if (clearUserCardsCheck && userCardScope === 'specific' && !selectedUserToClear) {
      addToast(t.adminConsole.reset.noUserSelectedWarning, 'warning');
      return;
    }
    setIsClearConfirmModalOpen(true);
  };

  const handleExecuteClear = async () => {
    setIsClearingInProgress(true);
    try {
      if (clearUserCardsCheck) {
        let targetId = userCardScope === 'specific' ? selectedUserToClear : undefined;
        let targetUsername: string | undefined = undefined;
        if (userCardScope === 'specific' && selectedUserToClear) {
          const targetMember = members.find(m => m.id === selectedUserToClear || m.username.toLowerCase() === selectedUserToClear.toLowerCase());
          if (targetMember) {
            targetId = targetMember.id;
            targetUsername = targetMember.username;
          }
        }
        await clearUserCards(targetId, targetUsername);
      }
      if (clearCoinsCheck) {
        setMembers(prev => prev.map(m => ({ ...m, coins: 5000 })));
        await resetAllCoins(5000);
      }
      if (clearCardsSystemCheck) {
        await clearAllPacksAndCards();
        setSelectedPackId('');
        setPackDraft(null);
        setHasUnsavedChanges(false);
      }
      if (clearTagsCheck) {
        await clearAllTagsFromSystem();
      }
      if (clearReportsCheck) {
        await clearAllReportsFromSystem();
      }
      if (clearMarketCheck) {
        clearMarketplace();
      }

      await fetchMembers();
      await refreshReports();

      addToast(t.adminConsole.reset.clearSuccessToast, 'success');
      setIsClearConfirmModalOpen(false);
      handleDeselectAllClear();
    } catch (err) {
      console.error('Error during data clearance:', err);
      addToast(
        language === 'th'
          ? 'เกิดข้อผิดพลาดในการเคลียร์ข้อมูล'
          : 'An error occurred during data clearance',
        'error'
      );
    } finally {
      setIsClearingInProgress(false);
    }
  };

  // All unique franchises available in packs
  const adminFranchiseList = useMemo(() => {
    const set = new Set<string>();
    packs.forEach((p) => {
      const f = (p.franchiseName || '').trim();
      if (f) set.add(f);
    });
    return Array.from(set);
  }, [packs]);

  // Packs available filtered by selected franchise
  const availablePacksForCode = useMemo(() => {
    if (selectedFranchiseForCode === 'ALL') return packs;
    return packs.filter((p) => (p.franchiseName || '').trim() === selectedFranchiseForCode);
  }, [packs, selectedFranchiseForCode]);

  // Reports Management state
  const [reportFilter, setReportFilter] = useState<'all' | 'pending' | 'resolved'>('all');
  const [reportSearchQuery, setReportSearchQuery] = useState('');
  const [processingReportId, setProcessingReportId] = useState<string | null>(null);

  // Tag Management Tab state
  const [newTagInput, setNewTagInput] = useState('');
  const [editingTagName, setEditingTagName] = useState<string | null>(null);
  const [editingTagValue, setEditingTagValue] = useState('');
  const [tagSearchQuery, setTagSearchQuery] = useState('');

  // Selected pack in Queue tab
  const [selectedPackId, setSelectedPackId] = useState<string>(packs[0]?.id || '');
  const [isPackDropdownOpen, setIsPackDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsPackDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Clear unread reports count for this admin and refresh reports on mount (Item 7)
  useEffect(() => {
    if (currentUser?.role === 'Admin') {
      const adminId = currentUser.id || currentUser.username.toLowerCase();
      const adminStorageKey = `mygacha_admin_last_read_${adminId}`;
      try {
        localStorage.setItem(adminStorageKey, new Date().toISOString());
      } catch {}
      refreshReports();
    }
  }, [currentUser, refreshReports]);

  // Synchronize selectedPackId if packs change or pack was deleted
  useEffect(() => {
    if (packs.length > 0) {
      if (!packs.some(p => p.id === selectedPackId)) {
        const nextPack = packs[0];
        setSelectedPackId(nextPack.id);
        setPackDraft(JSON.parse(JSON.stringify(nextPack)));
        setHasUnsavedChanges(false);
      }
    } else {
      setSelectedPackId('');
      setPackDraft(null);
      setHasUnsavedChanges(false);
    }
  }, [packs, selectedPackId]);

  // Current pack from store
  const currentPack = packs.find(p => p.id === selectedPackId) || packs[0];

  // Point 3: In-memory Pack Draft - NO AUTO SAVE without user clicking Save!
  const [packDraft, setPackDraft] = useState<PackSeries | null>(() => {
    return currentPack ? JSON.parse(JSON.stringify(currentPack)) : null;
  });
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);

  // Auto-save every 5 minutes if there are unsaved changes
  const packDraftRef = useRef(packDraft);
  const hasUnsavedChangesRef = useRef(hasUnsavedChanges);
  useEffect(() => {
    packDraftRef.current = packDraft;
    hasUnsavedChangesRef.current = hasUnsavedChanges;
  }, [packDraft, hasUnsavedChanges]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      if (hasUnsavedChangesRef.current && packDraftRef.current) {
        const preparedCards = prepareCardsForDatabase(packDraftRef.current.cards || []);
        const updatedDraft: PackSeries = {
          ...packDraftRef.current,
          cards: preparedCards,
        };
        setHasUnsavedChanges(false);
        setIsEditingFranchise(false);
        setIsEditingSeries(false);
        savePack(updatedDraft);
        setPackDraft(updatedDraft);
        addToast(
          language === 'th' ? 'บันทึกข้อมูลอัตโนมัติเรียบร้อยแล้ว (ทุก 5 นาที)' : 'Auto-saved changes (every 5 mins)',
          'info'
        );
      }
    }, 5 * 60 * 1000);

    return () => clearInterval(intervalId);
  }, [savePack, language]);

  // Re-initialize packDraft when selected pack changes
  useEffect(() => {
    if (currentPack) {
      setPackDraft(JSON.parse(JSON.stringify(currentPack)));
      setHasUnsavedChanges(false);
      setIsEditingFranchise(false);
      setIsEditingSeries(false);
    }
  }, [selectedPackId]);

  // Keep packDraft in sync if currentPack receives external/realtime updates and no local unsaved edits
  const currentPackSerialized = currentPack ? JSON.stringify(currentPack) : '';
  useEffect(() => {
    if (currentPack && !hasUnsavedChanges) {
      setPackDraft(JSON.parse(JSON.stringify(currentPack)));
    }
  }, [currentPackSerialized, hasUnsavedChanges]);

  // Lightbox state for expanding card / pack preview images in high resolution
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);

  // Point 2: Custom In-App Confirmation Modal state (NO BROWSER POPUPS)
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  // Duplicate Card Names Modal (Requirement: ยกเลิกการบันทึก / บันทึกทับ)
  const [duplicateCardNameModal, setDuplicateCardNameModal] = useState<{
    isOpen: boolean;
    duplicateGroups: Map<string, CardItem[]>;
  } | null>(null);

  // Inline edit modes for Pack header
  // Card Parity Drawer state
  const [isParityDrawerOpen, setIsParityDrawerOpen] = useState(false);
  const [selectedParityRarities, setSelectedParityRarities] = useState<string[]>([]);

  const handleToggleParityRarity = (rarityName: string) => {
    setSelectedParityRarities(prev =>
      prev.includes(rarityName) ? prev.filter(n => n !== rarityName) : [...prev, rarityName]
    );
  };

  const handleClearParitySelection = () => {
    setSelectedParityRarities([]);
  };

  const [isEditingFranchise, setIsEditingFranchise] = useState(false);
  const [isEditingSeries, setIsEditingSeries] = useState(false);

  // Section 2: Rarities edit mode
  const [editingRarityId, setEditingRarityId] = useState<string | null>(null);
  const [rarityEditName, setRarityEditName] = useState('');
  const [rarityEditColor, setRarityEditColor] = useState('');
  const [rarityEditCount, setRarityEditCount] = useState<number>(0);
  const [rarityEditConfetti, setRarityEditConfetti] = useState(false);
  const [rarityEditEqualRate, setRarityEditEqualRate] = useState<string>('');

  // Add Rarity state
  const [isAddingRarity, setIsAddingRarity] = useState(false);
  const [newRarityName, setNewRarityName] = useState('');
  const [newRarityColor, setNewRarityColor] = useState('#f59e0b');
  const [newRarityCount, setNewRarityCount] = useState<number>(10);
  const [newRarityConfetti, setNewRarityConfetti] = useState(false);
  const [newRarityEqualRate, setNewRarityEqualRate] = useState<string>('');

  // Point 1: File input ref to trigger file picker DIRECTLY without choosing rarity first
  const filePickerRef = useRef<HTMLInputElement>(null);

  // Section 2 Overview Rarity Filter
  const [selectedRarityFilter, setSelectedRarityFilter] = useState<string>('ALL');

  // Section 3: Card Data filtering
  const [cardDataSearchQuery, setCardDataSearchQuery] = useState('');
  const [cardDataRarityFilter, setCardDataRarityFilter] = useState('ALL');

  // Bulk field addition modal state
  const [isBulkFieldModalOpen, setIsBulkFieldModalOpen] = useState(false);
  const [bulkFieldName, setBulkFieldName] = useState('');
  const [bulkFieldValue, setBulkFieldValue] = useState('');

  // Members state
  const [members, setMembers] = useState<MemberData[]>([]);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [editingCoinsMemberId, setEditingCoinsMemberId] = useState<string | null>(null);
  const [customCoinsInput, setCustomCoinsInput] = useState<string>('');

  // Dropdown options for selective user clearance
  const memberDropdownOptions: NeoDropdownOption<string>[] = useMemo(() => {
    return members.map((m) => ({
      value: m.id,
      label: m.username,
      sublabel: m.email || m.role,
      badge: `${m.coins.toLocaleString()} ${language === 'th' ? 'เหรียญ' : 'coins'}`,
      icon: m.avatarUrl ? (
        <img
          src={m.avatarUrl}
          alt={m.username}
          className="w-4 h-4 rounded-full border border-black object-cover shrink-0"
        />
      ) : (
        <User size={13} className="text-zinc-600 dark:text-zinc-400 shrink-0" />
      ),
    }));
  }, [members, language]);

  // Fetch real members from Supabase & local storage
  const fetchMembers = async () => {
    const list: MemberData[] = [];
    const seenUsernames = new Set<string>();

    let remoteRoles: Record<string, 'Admin' | 'User'> = {};
    try {
      remoteRoles = await fetchRemoteRoles();
    } catch {}

    let resetState = { resetAllCoinsAt: 0, defaultCoins: 5000 };
    try {
      resetState = (await fetchSystemResetState()) as any;
    } catch {}

    // Load local accounts for avatar fallback and offline accounts
    let localAccs: Record<string, any> = {};
    try {
      const stored = localStorage.getItem('mygacha_accounts_v2');
      if (stored) {
        localAccs = JSON.parse(stored);
      }
    } catch {}

    // 1. Supabase profiles
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && data) {
          data.forEach((p: any) => {
            const isHead = isMainAdmin(p.username, p.email);
            let role: 'Admin' | 'User' = isHead ? 'Admin' : 'User';
            if (!isHead && remoteRoles[p.username.toLowerCase()]) {
              role = remoteRoles[p.username.toLowerCase()];
            }

            const uKey = (p.username || '').toLowerCase();
            const localAcc = localAccs[uKey];
            const isCurrent = currentUser?.username?.toLowerCase() === uKey;

            // Merge effective avatar: currentUser > local storage > supabase profile
            const effectiveAvatar =
              (isCurrent && currentUser?.avatarUrl) ||
              localAcc?.avatarUrl ||
              localAcc?.avatar_url ||
              p.avatar_url ||
              p.avatarUrl ||
              '';

            let memberCoins = p.coins ?? 5000;
            if (resetState?.resetAllCoinsAt) {
              const updatedAtMs = p.updated_at ? new Date(p.updated_at).getTime() : 0;
              if (updatedAtMs <= resetState.resetAllCoinsAt) {
                memberCoins = resetState.defaultCoins ?? 5000;
              }
            }

            seenUsernames.add(uKey);
            list.push({
              id: p.id,
              username: p.username,
              email: p.email,
              avatarUrl: effectiveAvatar,
              coins: memberCoins,
              role,
              isHeadAdmin: isHead,
            });
          });
        }
      } catch (err) {
        console.warn('Error fetching Supabase profiles:', err);
      }
    }

    // 2. Local accounts fallback
    try {
      Object.keys(localAccs).forEach((key) => {
        const acc = localAccs[key];
        const uKey = (acc.username || key).toLowerCase();
        if (!seenUsernames.has(uKey)) {
          const isHead = isMainAdmin(acc.username, acc.email);
          let role: 'Admin' | 'User' = isHead ? 'Admin' : (acc.role || 'User');
          if (!isHead && remoteRoles[uKey]) {
            role = remoteRoles[uKey];
          }

          const isCurrent = currentUser?.username?.toLowerCase() === uKey;
          const effectiveAvatar =
            (isCurrent && currentUser?.avatarUrl) ||
            acc.avatarUrl ||
            acc.avatar_url ||
            '';

          let memberCoins = acc.coins ?? 5000;
          if (resetState?.resetAllCoinsAt) {
            memberCoins = resetState.defaultCoins ?? 5000;
          }

          seenUsernames.add(uKey);
          list.push({
            id: acc.id || `local-${key}`,
            username: acc.username,
            email: acc.email || `${uKey}@gmail.com`,
            avatarUrl: effectiveAvatar,
            coins: memberCoins,
            role,
            isHeadAdmin: isHead,
          });
        }
      });
    } catch {}

    // Ensure NathanKunsan (Head Admin) is always in list with valid avatar
    if (!seenUsernames.has('nathankunsan')) {
      const isCurrent = currentUser?.username?.toLowerCase() === 'nathankunsan';
      const localNathan = localAccs['nathankunsan'];
      const effectiveAvatar =
        (isCurrent && currentUser?.avatarUrl) ||
        localNathan?.avatarUrl ||
        localNathan?.avatar_url ||
        '';

      list.unshift({
        id: 'cff953ba-e896-4f6f-b769-54ef218d1480',
        username: 'NathanKunsan',
        email: '6nathan.dev@gmail.com',
        avatarUrl: effectiveAvatar,
        coins: 5000,
        role: 'Admin',
        isHeadAdmin: true,
      });
    }

    setMembers(list);
  };

  useEffect(() => {
    fetchMembers();
  }, [activeTab, currentUser?.avatarUrl]);

  // Realtime member avatar sync for ANY user
  useEffect(() => {
    if (!localBroadcastChannel) return;
    const handleMsg = (e: MessageEvent) => {
      if (e.data?.event === 'member_avatar_updated') {
        const { username, avatarUrl, userId } = e.data.payload || {};
        if (avatarUrl) {
          setMembers((prev) =>
            prev.map((m) => {
              if (
                (userId && m.id === userId) ||
                (username && m.username.toLowerCase() === username.toLowerCase())
              ) {
                return { ...m, avatarUrl };
              }
              return m;
            })
          );
        }
      }
    };
    const ch = localBroadcastChannel;
    ch.addEventListener('message', handleMsg);
    return () => {
      ch.removeEventListener('message', handleMsg);
    };
  }, []);

  // Handle Role Change
  const handleToggleMemberRole = async (member: MemberData) => {
    if (member.isHeadAdmin || isMainAdmin(member.username, member.email)) {
      addToast(language === 'th' ? 'ไม่อนุญาตให้แก้ไข Role ของหัว Admin โดยเด็ดขาด' : 'Cannot modify Head Admin role', 'error');
      return;
    }

    const nextRole: 'Admin' | 'User' = member.role === 'Admin' ? 'User' : 'Admin';

    setMembers(prev =>
      prev.map(m => m.id === member.id ? { ...m, role: nextRole } : m)
    );

    await updateMemberRole(member.username, nextRole, member.id);
    addToast(
      language === 'th'
        ? `เปลี่ยน Role ของ ${member.username} เป็น ${nextRole} เรียบร้อย`
        : `Updated ${member.username}'s role to ${nextRole}`,
      'success'
    );
  };

  // Handle Coin Modifier
  const handleModifyMemberCoins = async (member: MemberData, delta: number) => {
    const updatedCoins = Math.max(0, member.coins + delta);

    setMembers(prev =>
      prev.map(m => m.id === member.id ? { ...m, coins: updatedCoins } : m)
    );

    await updateMemberCoins(member.username, updatedCoins, member.id, member.email);

    setEditingCoinsMemberId(null);
    setCustomCoinsInput('');
    addToast(
      delta >= 0
        ? (language === 'th'
            ? `เพิ่ม Coin ให้ ${member.username}: +${delta.toLocaleString()} Coin`
            : `Added ${delta.toLocaleString()} Coins to ${member.username}`)
        : (language === 'th'
            ? `ลด Coin ของ ${member.username}: ${delta.toLocaleString()} Coin`
            : `Deducted ${Math.abs(delta).toLocaleString()} Coins from ${member.username}`),
      'success'
    );
  };

  // Report Management Handlers
  const handleAcknowledgeReport = async (report: ContentReport) => {
    setProcessingReportId(report.id);
    try {
      const ok = await resolveReport(report.id);
      if (ok) {
        addToast(t.adminConsole.reports.acknowledgedToast, 'success');
      } else {
        addToast(language === 'th' ? 'เกิดข้อผิดพลาดในการอนุมัติคำร้อง' : 'Error acknowledging report', 'error');
      }
    } finally {
      setProcessingReportId(null);
    }
  };

  const handleDeleteReport = (reportId: string) => {
    setConfirmModal({
      isOpen: true,
      title: t.adminConsole.reports.deleteReportBtn,
      message: language === 'th' ? 'คุณยืนยันที่จะลบรายงานนี้ออกจากระบบจริงไหม?' : 'Are you sure you want to delete this report?',
      onConfirm: async () => {
        const ok = await deleteReport(reportId);
        if (ok) {
          addToast(t.adminConsole.reports.deleteToast, 'info');
        }
        setConfirmModal(null);
      },
    });
  };

  // Point 3: Explicit Save Pack Changes - ONLY saves when clicking this button!
  const handleSavePackChanges = async () => {
    if (!packDraft) return;

    const preparedCards = prepareCardsForDatabase(packDraft.cards || []);
    const updatedDraft: PackSeries = {
      ...packDraft,
      cards: preparedCards,
    };

    setHasUnsavedChanges(false);
    setIsEditingFranchise(false);
    setIsEditingSeries(false);
    await savePack(updatedDraft);
    setPackDraft(updatedDraft);
  };

  // Point 6: Update Pack Cover & Configuration
  const handleUpdateCoverImage = (url: string, origUrl?: string) => {
    if (!packDraft) return;
    setPackDraft({
      ...packDraft,
      coverImageUrl: url,
      originalCoverImageUrl: origUrl || packDraft.originalCoverImageUrl || url,
    });
    setHasUnsavedChanges(true);
  };

  const handleUpdateCoverAspectRatio = (ratio: string) => {
    if (!packDraft) return;
    setPackDraft({ ...packDraft, coverAspectRatio: ratio });
    setHasUnsavedChanges(true);
  };

  const handleUpdateTearConfig = (config: PackTearConfig) => {
    if (!packDraft) return;
    setPackDraft({ ...packDraft, tearConfig: config });
    setHasUnsavedChanges(true);
  };

  // Point 6: Toggle publish/hide
  const handleTogglePublish = async () => {
    if (!currentPack) return;
    await togglePackPublished(currentPack.id);
  };

  // Point 2: Delete Pack with Confirmation
  const handleDeleteCurrentPack = () => {
    if (!packDraft) return;
    setConfirmModal({
      isOpen: true,
      title: t.adminConsole.sections.deletePackConfirmTitle,
      message: t.adminConsole.sections.deletePackConfirmMessage.replace('{name}', `${packDraft.franchiseName} - ${packDraft.seriesName}`),
      onConfirm: async () => {
        const targetId = packDraft.id;
        await deletePack(targetId);

        // Immediately update Admin Console draft so deleted pack is instantly cleared!
        const remainingPacks = packs.filter(p => p.id !== targetId);
        if (remainingPacks.length > 0) {
          setSelectedPackId(remainingPacks[0].id);
          setPackDraft(JSON.parse(JSON.stringify(remainingPacks[0])));
        } else {
          setSelectedPackId('');
          setPackDraft(null);
        }
        setHasUnsavedChanges(false);
        setConfirmModal(null);
      },
    });
  };

  // --- Rarity Management (In Draft) ---
  const handleStartEditRarity = (rarity: CardRarity) => {
    setEditingRarityId(rarity.id);
    setRarityEditName(rarity.name);
    setRarityEditColor(rarity.color);
    setRarityEditCount(rarity.cardCount || 0);
    setRarityEditConfetti(Boolean(rarity.hasConfetti));
    setRarityEditEqualRate(rarity.equalRateWith || '');
  };

  const handleMoveRarityInAdmin = (index: number, direction: -1 | 1) => {
    if (!packDraft?.rarities) return;
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= packDraft.rarities.length) return;
    const nextRarities = [...packDraft.rarities];
    const [moved] = nextRarities.splice(index, 1);
    nextRarities.splice(targetIndex, 0, moved);
    const nextPack = { ...packDraft, rarities: nextRarities };
    setPackDraft(nextPack);
    setHasUnsavedChanges(true);
  };

  const handleSaveRarityDraft = async () => {
    if (!packDraft || !editingRarityId) return;
    const updatedRarities = packDraft.rarities.map(r => {
      if (r.id === editingRarityId) {
        return {
          ...r,
          name: rarityEditName.trim().toUpperCase() || r.name,
          color: rarityEditColor || r.color,
          cardCount: Number(rarityEditCount) || 0,
          hasConfetti: rarityEditConfetti,
          equalRateWith: rarityEditEqualRate || undefined,
        };
      }
      return r;
    });
    const updatedDraft = { ...packDraft, rarities: updatedRarities };
    setPackDraft(updatedDraft);
    setHasUnsavedChanges(true);
    setEditingRarityId(null);
    await savePack(updatedDraft, true);
    addToast(
      language === 'th'
        ? 'บันทึกระดับความแรร์เรียบร้อยแล้ว'
        : 'Rarity saved successfully',
      'success'
    );
  };

  // Point 2: Delete Rarity with Confirmation
  const handleDeleteRarity = (rarityId: string) => {
    if (!packDraft) return;
    const target = packDraft.rarities.find(r => r.id === rarityId);
    setConfirmModal({
      isOpen: true,
      title: t.adminConsole.sections.deleteRarityConfirmTitle,
      message: t.adminConsole.sections.deleteRarityConfirmMessage.replace('{name}', target?.name || ''),
      onConfirm: () => {
        const updatedRarities = packDraft.rarities.filter(r => r.id !== rarityId).map(r => {
          if (r.equalRateWith === target?.name || r.equalRateWith === target?.id) {
            const { equalRateWith, ...rest } = r;
            return rest;
          }
          return r;
        });
        setPackDraft({ ...packDraft, rarities: updatedRarities });
        setHasUnsavedChanges(true);
        setConfirmModal(null);
        addToast(
          language === 'th'
            ? `ลบระดับ "${target?.name || ''}" ออกจากฉบับร่างแล้ว`
            : `Rarity "${target?.name || ''}" removed from draft`,
          'info'
        );
      },
    });
  };

  const handleAddNewRarity = () => {
    if (!packDraft) return;
    const cleanName = newRarityName.trim().toUpperCase();
    if (!cleanName) {
      addToast(language === 'th' ? 'กรุณากรอกชื่อระดับ' : 'Please enter rarity name', 'warning');
      return;
    }
    if (packDraft.rarities.some(r => r.name.toUpperCase() === cleanName)) {
      addToast(language === 'th' ? 'มีระดับชื่อนี้อยู่แล้วใน Pack' : 'Rarity already exists in pack', 'warning');
      return;
    }

    const newRarityObj: CardRarity = {
      id: `rarity-${Date.now()}`,
      name: cleanName,
      color: newRarityColor || '#f59e0b',
      cardCount: Number(newRarityCount) || 0,
      hasConfetti: newRarityConfetti,
      equalRateWith: newRarityEqualRate || undefined,
    };

    const updatedRarities = [...packDraft.rarities, newRarityObj];
    setPackDraft({ ...packDraft, rarities: updatedRarities });
    setHasUnsavedChanges(true);
    setIsAddingRarity(false);
    setNewRarityName('');
    setNewRarityColor('#f59e0b');
    setNewRarityCount(10);
    setNewRarityConfetti(false);
    setNewRarityEqualRate('');
    addToast(
      language === 'th'
        ? `เพิ่มระดับ "${cleanName}" ในฉบับร่างแล้ว`
        : `Added rarity "${cleanName}" to draft`,
      'info'
    );
  };

  // Point 1: เพิ่มรูปคือให้เลือกไฟล์ภาพมาได้เลย ไม่ต้องว่าจะเลือกเรทไหน! (บีบอัดและประมวลผลพร้อมกันแบบ Parallel)
  const handleMultipleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !packDraft) return;

    // Default to the first rarity of the pack or 'C'
    const defaultRarity = packDraft.rarities[0]?.name || 'C';
    const fileList = Array.from(files);

    const cardPromises = fileList.map(async (file, idx) => {
      try {
        const compressedUrl = await compressImageFile(file);
        const rawName = file.name.replace(/\.[^/.]+$/, '');
        return {
          id: `card-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`,
          packId: packDraft.id,
          rarity: defaultRarity,
          imageUrl: compressedUrl,
          fileName: file.name,
          name: rawName,
          description: '',
          fields: [
            { id: `f-name-${Date.now()}-${idx}-${Math.random()}`, name: language === 'th' ? 'ชื่อการ์ด' : 'Card Name', value: rawName },
            { id: `f-desc-${Date.now()}-${idx}-${Math.random()}`, name: language === 'th' ? 'ความสามารถการ์ด' : 'Card Ability', value: '' },
          ],
        } as CardItem;
      } catch {
        return null;
      }
    });

    const newCards = (await Promise.all(cardPromises)).filter((c): c is CardItem => c !== null);

    if (newCards.length > 0) {
      const updatedCards = [...packDraft.cards, ...newCards];
      setPackDraft({ ...packDraft, cards: updatedCards });
      setHasUnsavedChanges(true);
      addToast(
        language === 'th'
          ? `เพิ่มรูปภาพการ์ดใหม่ ${newCards.length} ใบในฉบับร่างแล้ว (กดบันทึกเพื่อบันทึกจริง)`
          : `Added ${newCards.length} new card images to draft (Click Save Pack to save)`,
        'info'
      );
    }

    if (e.target) e.target.value = '';
  };

  // Point 2: Delete Card with Confirmation
  const handleDeleteCard = (cardId: string) => {
    if (!packDraft) return;
    const target = packDraft.cards.find(c => c.id === cardId);
    setConfirmModal({
      isOpen: true,
      title: t.adminConsole.sections.deleteCardConfirmTitle,
      message: t.adminConsole.sections.deleteCardConfirmMessage.replace('{name}', target?.name || (language === 'th' ? 'ไม่มีชื่อ' : 'Unnamed')),
      onConfirm: () => {
        const updatedCards = packDraft.cards.filter(c => c.id !== cardId);
        setPackDraft({ ...packDraft, cards: updatedCards });
        setHasUnsavedChanges(true);
        setConfirmModal(null);
        addToast(language === 'th' ? 'ลบการ์ดออกจากฉบับร่างเรียบร้อย' : 'Card removed from draft', 'info');
      },
    });
  };

  // Change Card Image (In Draft with fast compression)
  const handleUpdateCardImage = async (cardId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !packDraft) return;
    try {
      const compressed = await compressImageFile(file);
      const updatedCards = packDraft.cards.map(c => {
        if (c.id === cardId) {
          return {
            ...c,
            imageUrl: compressed,
            fileName: file.name,
          };
        }
        return c;
      });
      setPackDraft({ ...packDraft, cards: updatedCards });
      setHasUnsavedChanges(true);
      addToast(language === 'th' ? 'อัปเดตรูปภาพการ์ดในฉบับร่างแล้ว' : 'Card image updated in draft', 'info');
    } catch {
      addToast(language === 'th' ? 'อัปเดตรูปภาพไม่สำเร็จ' : 'Failed to update image', 'error');
    }
  };

  // Change Card Rarity (In Draft)
  const handleUpdateCardRarity = (cardId: string, newRarity: string) => {
    if (!packDraft) return;
    const updatedCards = packDraft.cards.map(c => {
      if (c.id === cardId) {
        return { ...c, rarity: newRarity };
      }
      return c;
    });
    setPackDraft({ ...packDraft, cards: updatedCards });
    setHasUnsavedChanges(true);
  };

  // --- Card Fields Management (In Draft - NO auto-save) ---
  const handleUpdateCardFieldValue = (cardId: string, fieldId: string, newValue: string) => {
    if (!packDraft) return;
    const updatedCards = packDraft.cards.map(c => {
      if (c.id === cardId) {
        const updatedFields = (c.fields || []).map(f => f.id === fieldId ? { ...f, value: newValue } : f);
        const nameField = updatedFields.find(f => f.name === 'ชื่อการ์ด' || f.name === 'Card Name');
        const descField = updatedFields.find(f => f.name === 'ความสามารถการ์ด' || f.name === 'Card Ability');
        return {
          ...c,
          fields: updatedFields,
          name: nameField ? nameField.value : c.name,
          description: descField ? descField.value : c.description,
        };
      }
      return c;
    });
    setPackDraft({ ...packDraft, cards: updatedCards });
    setHasUnsavedChanges(true);
  };

  const handleUpdateCardFieldName = (cardId: string, fieldId: string, newName: string) => {
    if (!packDraft) return;
    const updatedCards = packDraft.cards.map(c => {
      if (c.id === cardId) {
        const updatedFields = (c.fields || []).map(f => f.id === fieldId ? { ...f, name: newName } : f);
        return { ...c, fields: updatedFields };
      }
      return c;
    });
    setPackDraft({ ...packDraft, cards: updatedCards });
    setHasUnsavedChanges(true);
  };

  // Point 2: Delete Field with Confirmation
  const handleDeleteCardField = (cardId: string, fieldId: string) => {
    if (!packDraft) return;
    setConfirmModal({
      isOpen: true,
      title: t.adminConsole.sections.deleteFieldConfirmTitle,
      message: t.adminConsole.sections.deleteFieldConfirmMessage,
      onConfirm: () => {
        const updatedCards = packDraft.cards.map(c => {
          if (c.id === cardId) {
            const remainingFields = (c.fields || []).filter(f => f.id !== fieldId);
            const nameField = remainingFields.find(f => f.name === 'ชื่อการ์ด' || f.name === 'Card Name');
            const descField = remainingFields.find(f => f.name === 'ความสามารถการ์ด' || f.name === 'Card Ability');
            return {
              ...c,
              fields: remainingFields,
              name: nameField ? nameField.value : c.name,
              description: descField ? descField.value : c.description,
            };
          }
          return c;
        });
        setPackDraft({ ...packDraft, cards: updatedCards });
        setHasUnsavedChanges(true);
        setConfirmModal(null);
        addToast(language === 'th' ? 'ลบช่องข้อมูลในฉบับร่างเรียบร้อย' : 'Field removed from draft', 'info');
      },
    });
  };

  const handleAddFieldToCard = (cardId: string) => {
    if (!packDraft) return;
    const targetCard = packDraft.cards.find(c => c.id === cardId);
    if (!targetCard) return;

    const count = (targetCard.fields || []).length + 1;
    const newField: CardField = {
      id: `field-${Date.now()}-${Math.random()}`,
      name: language === 'th' ? `คุณสมบัติ ${count}` : `Attribute ${count}`,
      value: '',
    };

    const updatedCards = packDraft.cards.map(c => {
      if (c.id === cardId) {
        return {
          ...c,
          fields: [...(c.fields || []), newField],
        };
      }
      return c;
    });
    setPackDraft({ ...packDraft, cards: updatedCards });
    setHasUnsavedChanges(true);
    addToast(language === 'th' ? 'เพิ่มช่องข้อมูลเฉพาะใบนี้ในฉบับร่างแล้ว' : 'Field added to this card in draft', 'info');
  };

  const handleAddFieldToAllCards = () => {
    if (!packDraft) return;
    const fieldNameClean = bulkFieldName.trim();
    if (!fieldNameClean) {
      addToast(language === 'th' ? 'กรุณากรอกชื่อช่องข้อมูล' : 'Please enter field name', 'warning');
      return;
    }

    const updatedCards = packDraft.cards.map(c => {
      const alreadyHas = (c.fields || []).some(f => f.name.toLowerCase() === fieldNameClean.toLowerCase());
      if (alreadyHas) return c;
      const newField: CardField = {
        id: `field-${Date.now()}-${Math.random()}`,
        name: fieldNameClean,
        value: bulkFieldValue,
      };
      return {
        ...c,
        fields: [...(c.fields || []), newField],
      };
    });

    setPackDraft({ ...packDraft, cards: updatedCards });
    setHasUnsavedChanges(true);
    setIsBulkFieldModalOpen(false);
    setBulkFieldName('');
    setBulkFieldValue('');
    addToast(
      language === 'th'
        ? `เพิ่มช่อง "${fieldNameClean}" ให้กับทุกการ์ดในฉบับร่างเรียบร้อย`
        : `Added field "${fieldNameClean}" to all cards in draft`,
      'info'
    );
  };

  // Helper to find exact rarity color
  const getRarityColor = (rarityName: string) => {
    const found = packDraft?.rarities.find(r => r.name.toUpperCase() === rarityName.toUpperCase());
    return found?.color || '#f59e0b';
  };

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-['Prompt'] pb-16">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Title */}
        <div className="text-center">
          <h1 className="text-3xl font-black font-['Mali'] text-zinc-900 dark:text-white tracking-wide">
            Admin Console
          </h1>
        </div>

        {/* 5 Tabs matching user's layout:
            Row 1: คิวทั้งหมด, รายงาน, สมาชิก
            Row 2: สถิติ, แชทช่วยเหลือ
        */}
        <div className="space-y-2.5">
          {/* Row 1 */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <button
              onClick={() => setActiveTab('queue')}
              className={`py-2 px-3 text-xs sm:text-sm font-bold rounded-xl border-2 border-black dark:border-white transition-all sketch-btn ${
                activeTab === 'queue'
                  ? 'bg-yellow-300 dark:bg-yellow-400 text-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
                  : 'bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.7)]'
              }`}
            >
              {t.adminConsole.tabs.queue}
            </button>
            <button
              onClick={() => setActiveTab('reports')}
              className={`py-2 px-3 text-xs sm:text-sm font-bold rounded-xl border-2 border-black dark:border-white transition-all sketch-btn flex items-center justify-center gap-1.5 ${
                activeTab === 'reports'
                  ? 'bg-yellow-300 dark:bg-yellow-400 text-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
                  : 'bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.7)]'
              }`}
            >
              <span>{t.adminConsole.tabs.reports}</span>
              {reports.filter((r) => r.status === 'pending').length > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] font-black bg-red-500 text-white rounded-full leading-none">
                  {reports.filter((r) => r.status === 'pending').length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('members')}
              className={`py-2 px-3 text-xs sm:text-sm font-bold rounded-xl border-2 border-black dark:border-white transition-all sketch-btn ${
                activeTab === 'members'
                  ? 'bg-yellow-300 dark:bg-yellow-400 text-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
                  : 'bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.7)]'
              }`}
            >
              {t.adminConsole.tabs.members}
            </button>
          </div>

          {/* Row 2 */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-3 max-w-3xl mx-auto">
            <button
              onClick={() => setActiveTab('stats')}
              className={`py-2 px-3 text-xs sm:text-sm font-bold rounded-xl border-2 border-black dark:border-white transition-all sketch-btn ${
                activeTab === 'stats'
                  ? 'bg-yellow-300 dark:bg-yellow-400 text-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
                  : 'bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.7)]'
              }`}
            >
              {t.adminConsole.tabs.stats}
            </button>
            <button
              onClick={() => setActiveTab('chat')}
              className={`py-2 px-3 text-xs sm:text-sm font-bold rounded-xl border-2 border-black dark:border-white transition-all sketch-btn ${
                activeTab === 'chat'
                  ? 'bg-yellow-300 dark:bg-yellow-400 text-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
                  : 'bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.7)]'
              }`}
            >
              {t.adminConsole.tabs.chat}
            </button>
            <button
              onClick={() => setActiveTab('tags')}
              className={`py-2 px-3 text-xs sm:text-sm font-bold rounded-xl border-2 border-black dark:border-white transition-all sketch-btn ${
                activeTab === 'tags'
                  ? 'bg-yellow-300 dark:bg-yellow-400 text-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
                  : 'bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.7)]'
              }`}
            >
              {t.adminConsole.tabs.tags}
            </button>
            <button
              onClick={() => setActiveTab('codes')}
              className={`py-2 px-3 text-xs sm:text-sm font-bold rounded-xl border-2 border-black dark:border-white transition-all sketch-btn flex items-center justify-center gap-1.5 ${
                activeTab === 'codes'
                  ? 'bg-yellow-300 dark:bg-yellow-400 text-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
                  : 'bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.7)]'
              }`}
            >
              <Ticket size={14} />
              <span>{t.adminConsole.tabs.codes}</span>
            </button>
            <button
              onClick={() => setActiveTab('reset')}
              className={`col-span-2 sm:col-span-1 py-2 px-3 text-xs sm:text-sm font-bold rounded-xl border-2 border-black dark:border-white transition-all sketch-btn flex items-center justify-center gap-1.5 ${
                activeTab === 'reset'
                  ? 'bg-red-500 text-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
                  : 'bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.7)]'
              }`}
            >
              <RotateCcw size={14} />
              <span>{t.adminConsole.tabs.reset}</span>
            </button>
          </div>
        </div>

        {/* ========================================================
            TAB 1: คิวทั้งหมด (QUEUE TAB)
           ======================================================== */}
        {activeTab === 'queue' && (
          <div className="space-y-8 animate-in fade-in duration-200">
            {/* Custom Sketch Dropbox สำหรับเลือก Pack */}
            {packs.length > 0 && (
              <div className="relative" ref={dropdownRef}>
                <div className="flex items-center justify-between gap-3 bg-white dark:bg-zinc-800 border-2 border-black dark:border-white rounded-2xl p-2.5 sm:p-3 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(255,255,255,0.8)]">
                  {/* Custom Dropdown Trigger */}
                  <button
                    type="button"
                    onClick={() => setIsPackDropdownOpen(!isPackDropdownOpen)}
                    className="flex-1 flex items-center justify-between gap-2.5 px-3 py-2 bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 border-2 border-black dark:border-white rounded-xl transition-all sketch-btn text-left min-w-0"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-10 rounded-lg border border-black overflow-hidden bg-zinc-200 dark:bg-zinc-600 shrink-0 flex items-center justify-center">
                        {packDraft?.coverImageUrl ? (
                          <img src={packDraft.coverImageUrl} alt="Cover" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-[10px] font-black text-zinc-400">P</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-bold truncate">
                          {packDraft?.franchiseName} - {packDraft?.seriesName}
                        </p>
                        <p className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
                          มี {packDraft?.cards.length || 0} ใบ
                        </p>
                      </div>
                    </div>
                    <ChevronDown
                      size={18}
                      className={`text-zinc-600 dark:text-zinc-300 transition-transform ${
                        isPackDropdownOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {/* ปุ่ม เผยแพร่อยู่ / ซ่อนอยู่ (ห้ามใช้คำว่า ร่าง) */}
                  <button
                    onClick={handleTogglePublish}
                    title={currentPack?.isPublished ? 'กดเพื่อซ่อน' : 'กดเพื่อเผยแพร่'}
                    className={`px-3 sm:px-4 py-2 text-xs font-bold rounded-xl border-2 border-black dark:border-white sketch-btn shrink-0 transition-all ${
                      currentPack?.isPublished
                        ? 'bg-emerald-300 hover:bg-emerald-400 text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                        : 'bg-zinc-300 dark:bg-zinc-600 hover:bg-zinc-400 text-zinc-800 dark:text-zinc-200 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.6)]'
                    }`}
                  >
                    {currentPack?.isPublished ? 'เผยแพร่อยู่' : 'ซ่อนอยู่'}
                  </button>
                </div>

                {/* Dropdown Menu List */}
                {isPackDropdownOpen && (
                  <div className="absolute left-0 right-0 mt-2 z-50 bg-white dark:bg-zinc-800 border-3 border-black dark:border-white rounded-2xl shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:shadow-[6px_6px_0px_0px_rgba(255,255,255,0.9)] p-2 space-y-1 max-h-72 overflow-y-auto animate-in fade-in zoom-in-95">
                    {packs.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setSelectedPackId(p.id);
                          setIsPackDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between gap-3 p-2 rounded-xl text-left transition-colors border ${
                          selectedPackId === p.id
                            ? 'bg-yellow-100 dark:bg-yellow-950/40 border-black dark:border-yellow-400 font-bold'
                            : 'hover:bg-zinc-100 dark:hover:bg-zinc-700/60 border-transparent font-medium'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-9 rounded-md border border-black overflow-hidden bg-zinc-200 shrink-0">
                            {p.coverImageUrl ? (
                              <img src={p.coverImageUrl} alt={p.franchiseName} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[10px] text-zinc-400">P</div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold truncate">
                              {p.franchiseName} - {p.seriesName}
                            </p>
                            <span className="text-[10px] text-zinc-500">
                              {p.cards?.length || 0} ใบ
                            </span>
                          </div>
                        </div>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border border-black ${
                            p.isPublished ? 'bg-emerald-200 text-black' : 'bg-zinc-200 text-zinc-700'
                          }`}
                        >
                          {p.isPublished ? 'เผยแพร่' : 'ซ่อน'}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {!packDraft ? (
              <div className="text-center py-12 bg-white dark:bg-zinc-800 border-2 border-dashed border-zinc-400 rounded-3xl p-6">
                <p className="font-bold text-zinc-500 text-sm">
                  {language === 'th' ? 'ยังไม่มี Pack ในระบบ' : 'No card packs in system'}
                </p>
                <button
                  onClick={() => navigate('/CreateCardsPack')}
                  className="mt-4 px-4 py-2 text-xs font-bold rounded-xl bg-yellow-300 border-2 border-black text-black sketch-btn"
                >
                  {language === 'th' ? '+ สร้าง Pack ใหม่' : '+ Create New Pack'}
                </button>
              </div>
            ) : (
              <>
                {/* ----------------------------------------------------
                    SECTION 1: จัดการ หน้าสร้าง Pack
                   ---------------------------------------------------- */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="inline-block px-5 py-1.5 bg-white dark:bg-zinc-900 border-2 border-black dark:border-white rounded-xl font-bold text-xs sm:text-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                      {language === 'th' ? 'จัดการ หน้าสร้าง Pack' : 'Manage Pack Settings'}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSavePackChanges()}
                      className={`px-4 py-1.5 text-xs font-black rounded-xl border-2 border-black dark:border-white flex items-center gap-1.5 sketch-btn shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all ${
                        hasUnsavedChanges
                          ? 'bg-yellow-400 hover:bg-yellow-300 text-black animate-pulse'
                          : 'bg-emerald-300 hover:bg-emerald-400 text-black'
                      }`}
                    >
                      <Save size={14} />
                      <span>
                        {hasUnsavedChanges
                          ? (language === 'th' ? 'บันทึกข้อมูล Pack (มีแก้ค้างอยู่)' : 'Save Pack (Unsaved changes)')
                          : (language === 'th' ? 'บันทึกข้อมูล Pack นี้' : 'Save This Pack')}
                      </span>
                    </button>
                  </div>

                  <div className="bg-zinc-200 dark:bg-zinc-800 border-2 border-black dark:border-white rounded-2xl p-4 sm:p-6 space-y-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.8)]">
                    {/* ชื่อแฟรนไชส์ */}
                    <div className="space-y-1.5">
                      <div className="inline-block px-3 py-0.5 bg-white dark:bg-zinc-900 border-2 border-black dark:border-white rounded-lg text-[11px] font-bold">
                        {t.adminConsole.queue.franchiseName}
                      </div>
                      <div className="flex items-center gap-2">
                        {isEditingFranchise ? (
                          <input
                            type="text"
                            value={packDraft.franchiseName}
                            onChange={(e) => {
                              setPackDraft({ ...packDraft, franchiseName: e.target.value });
                              setHasUnsavedChanges(true);
                            }}
                            className="flex-1 bg-white dark:bg-zinc-700 border-2 border-black dark:border-white rounded-xl py-2 px-3 text-xs sm:text-sm font-bold focus:outline-none"
                            autoFocus
                          />
                        ) : (
                          <div className="flex-1 bg-white dark:bg-zinc-700 border-2 border-black dark:border-white rounded-xl py-2 px-3 text-xs sm:text-sm font-bold truncate">
                            {packDraft.franchiseName || t.adminConsole.sections.noFranchiseName}
                          </div>
                        )}
                        <button
                          onClick={() => setIsEditingFranchise(!isEditingFranchise)}
                          className="w-8 h-8 rounded-full bg-yellow-300 hover:bg-yellow-400 border-2 border-black flex items-center justify-center text-black shrink-0 sketch-btn shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]"
                          title={t.common.edit}
                        >
                          {isEditingFranchise ? <Check size={14} /> : <Edit2 size={14} />}
                        </button>
                        <button
                          onClick={() => {
                            setPackDraft({ ...packDraft, franchiseName: '' });
                            setHasUnsavedChanges(true);
                          }}
                          className="w-8 h-8 rounded-full bg-red-500 hover:bg-red-600 border-2 border-black flex items-center justify-center text-white shrink-0 sketch-btn shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]"
                          title={t.common.clear}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* ชื่อซองสุ่ม */}
                    <div className="space-y-1.5">
                      <div className="inline-block px-3 py-0.5 bg-white dark:bg-zinc-900 border-2 border-black dark:border-white rounded-lg text-[11px] font-bold">
                        {t.adminConsole.queue.packName}
                      </div>
                      <div className="flex items-center gap-2">
                        {isEditingSeries ? (
                          <input
                            type="text"
                            value={packDraft.seriesName}
                            onChange={(e) => {
                              setPackDraft({ ...packDraft, seriesName: e.target.value });
                              setHasUnsavedChanges(true);
                            }}
                            className="flex-1 bg-white dark:bg-zinc-700 border-2 border-black dark:border-white rounded-xl py-2 px-3 text-xs sm:text-sm font-bold focus:outline-none"
                            autoFocus
                          />
                        ) : (
                          <div className="flex-1 bg-white dark:bg-zinc-700 border-2 border-black dark:border-white rounded-xl py-2 px-3 text-xs sm:text-sm font-bold truncate">
                            {packDraft.seriesName || t.adminConsole.sections.noPackName}
                          </div>
                        )}
                        <button
                          onClick={() => setIsEditingSeries(!isEditingSeries)}
                          className="w-8 h-8 rounded-full bg-yellow-300 hover:bg-yellow-400 border-2 border-black flex items-center justify-center text-black shrink-0 sketch-btn shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]"
                          title={t.common.edit}
                        >
                          {isEditingSeries ? <Check size={14} /> : <Edit2 size={14} />}
                        </button>
                        <button
                          onClick={() => {
                            setPackDraft({ ...packDraft, seriesName: '' });
                            setHasUnsavedChanges(true);
                          }}
                          className="w-8 h-8 rounded-full bg-red-500 hover:bg-red-600 border-2 border-black flex items-center justify-center text-white shrink-0 sketch-btn shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]"
                          title={t.common.clear}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* แท็ก (Tags) */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="inline-block px-3 py-0.5 bg-white dark:bg-zinc-900 border-2 border-black dark:border-white rounded-lg text-[11px] font-bold">
                          {t.adminConsole.queue.tag}
                        </div>
                        <button
                          type="button"
                          onClick={() => setActiveTab('tags')}
                          className="px-2.5 py-1 bg-yellow-300 hover:bg-yellow-400 text-black border-2 border-black rounded-lg text-xs font-bold sketch-btn"
                          title={t.adminConsole.sections.manageTagsTooltip}
                        >
                          {t.adminConsole.tabs.tags}
                        </button>
                      </div>

                      {/* Interactive Multi-tag Toggles */}
                      <div className="flex flex-wrap gap-1.5 p-2 bg-zinc-50 dark:bg-zinc-800/60 border-2 border-black dark:border-white rounded-xl">
                        {tags.length === 0 ? (
                          <span className="text-xs text-zinc-400 p-1">ยังไม่มีแท็กในระบบ</span>
                        ) : (
                          tags.map((item) => {
                            const curTags = (packDraft.tags && Array.isArray(packDraft.tags))
                              ? packDraft.tags
                              : (packDraft.tag ? packDraft.tag.split(',').map(s => s.trim()).filter(Boolean) : []);
                            const isSelected = curTags.some(t => t.toLowerCase() === item.toLowerCase());
                            return (
                              <button
                                key={item}
                                type="button"
                                onClick={() => {
                                  const updated = isSelected
                                    ? curTags.filter(t => t.toLowerCase() !== item.toLowerCase())
                                    : [...curTags, item];
                                  setPackDraft({
                                    ...packDraft,
                                    tags: updated,
                                    tag: updated.join(', '),
                                  });
                                  setHasUnsavedChanges(true);
                                }}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold border-2 transition-all flex items-center gap-1.5 ${
                                  isSelected
                                    ? 'bg-yellow-300 text-black border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]'
                                    : 'bg-white dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 border-zinc-300 dark:border-zinc-600 hover:border-black'
                                }`}
                              >
                                <span>{item}</span>
                                {isSelected && <Check size={12} strokeWidth={3} />}
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* Point 6: ภาพของ Pack & กำหนดขนาด & แนวตัดซอง */}
                    <div className="space-y-2 pt-2 border-t border-zinc-300 dark:border-zinc-700">
                      <div className="inline-block px-3 py-0.5 bg-white dark:bg-zinc-900 border-2 border-black dark:border-white rounded-lg text-[11px] font-bold">
                        {t.adminConsole.sections.packCover}
                      </div>

                      <PackCoverConfigurator
                        coverImageUrl={packDraft.coverImageUrl || ''}
                        originalCoverImageUrl={packDraft.originalCoverImageUrl || packDraft.coverImageUrl || ''}
                        coverAspectRatio={packDraft.coverAspectRatio || 'auto'}
                        tearConfig={packDraft.tearConfig || { direction: 'up' }}
                        onChangeCover={handleUpdateCoverImage}
                        onChangeAspectRatio={handleUpdateCoverAspectRatio}
                        onChangeTearConfig={handleUpdateTearConfig}
                        franchiseName={packDraft.franchiseName}
                        seriesName={packDraft.seriesName}
                      />
                    </div>
                  </div>
                </div>

                {/* ----------------------------------------------------
                    SECTION 2: จัดการ หน้าสร้าง Card (โอกาสที่ออก & เพิ่มรูป)
                   ---------------------------------------------------- */}
                <div className="space-y-2.5">
                  <div className="inline-block px-5 py-1.5 bg-white dark:bg-zinc-900 border-2 border-black dark:border-white rounded-xl font-bold text-xs sm:text-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                    {t.adminConsole.sections.manageCards}
                  </div>

                  <div className="bg-zinc-200 dark:bg-zinc-800 border-2 border-black dark:border-white rounded-2xl p-4 sm:p-6 space-y-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.8)]">
                    {/* โอกาสที่ออก (Rarities & Rates) */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="inline-block px-3 py-0.5 bg-white dark:bg-zinc-900 border-2 border-black dark:border-white rounded-lg text-[11px] font-bold">
                          {t.adminConsole.sections.dropRates}
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            onClick={() => setIsAddingRarity(true)}
                            className="px-3 py-1 bg-yellow-300 hover:bg-yellow-400 text-black border-2 border-black rounded-xl text-xs font-bold sketch-btn flex items-center gap-1 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]"
                          >
                            <Plus size={13} />
                            <span>{t.adminConsole.sections.addRarity}</span>
                          </button>
                        </div>
                      </div>

                      {/* Add Rarity Form (Inline) */}
                      {isAddingRarity && (
                        <div className="bg-yellow-50 dark:bg-zinc-900/80 border-2 border-black dark:border-white rounded-xl p-3 space-y-2 animate-in fade-in">
                          <p className="text-xs font-bold">{t.adminConsole.sections.addNewRarityTitle}</p>
                          <div className="flex flex-wrap items-center gap-2">
                            <input
                              type="text"
                              value={newRarityName}
                              onChange={(e) => setNewRarityName(e.target.value)}
                              placeholder={t.adminConsole.sections.rarityNamePlaceholder}
                              className="w-24 px-2 py-1 text-xs font-bold bg-white dark:bg-zinc-700 border-2 border-black rounded-lg"
                            />
                            <div className="flex items-center gap-1.5">
                              <NeoColorPicker
                                color={newRarityColor}
                                onChange={(val) => setNewRarityColor(val)}
                                language={language}
                              />
                              <input
                                type="text"
                                value={newRarityColor}
                                onChange={(e) => {
                                  let val = e.target.value;
                                  if (val.length > 0 && !val.startsWith('#')) val = '#' + val;
                                  setNewRarityColor(val);
                                }}
                                className="w-20 px-1.5 py-1 text-xs font-mono uppercase bg-white dark:bg-zinc-700 border-2 border-black dark:border-white rounded-lg font-bold"
                              />
                            </div>
                            <input
                              type="number"
                              value={newRarityCount}
                              onChange={(e) => setNewRarityCount(Number(e.target.value))}
                              placeholder={t.adminConsole.sections.rarityCountPlaceholder}
                              className="w-20 px-2 py-1 text-xs font-bold bg-white dark:bg-zinc-700 border-2 border-black rounded-lg"
                            />
                            {packDraft.rarities && packDraft.rarities.length > 0 && (
                              <div className="w-40">
                                <NeoDropdown<string>
                                  value={newRarityEqualRate}
                                  onChange={(val) => setNewRarityEqualRate(val)}
                                  options={[
                                    { value: '', label: language === 'th' ? 'โอกาสออก: ปกติ' : 'Rate: Normal' },
                                    ...packDraft.rarities
                                      .filter(o => !o.equalRateWith)
                                      .map(o => ({
                                        value: o.name,
                                        label: language === 'th' ? `เท่ากับ ${o.name}` : `Equal to ${o.name}`,
                                        color: o.color,
                                      }))
                                  ]}
                                  size="sm"
                                  fullWidth={true}
                                />
                              </div>
                            )}
                            {/* Party Popper Toggle for new rarity */}
                            <button
                              type="button"
                              onClick={() => setNewRarityConfetti(!newRarityConfetti)}
                              className={`p-1.5 rounded-lg border-2 border-black dark:border-white transition-all sketch-btn flex items-center justify-center ${
                                newRarityConfetti
                                  ? 'bg-amber-300 dark:bg-amber-400 text-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]'
                                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 opacity-60 hover:opacity-100'
                              }`}
                              title={newRarityConfetti ? t.createCards.confettiOnHint : t.createCards.confettiOffHint}
                            >
                              <PartyPopper size={15} />
                            </button>
                            <button
                              onClick={handleAddNewRarity}
                              className="px-3 py-1 bg-yellow-400 hover:bg-yellow-300 text-black border border-black rounded-lg text-xs font-bold"
                            >
                              {t.common.save}
                            </button>
                            <button
                              onClick={() => setIsAddingRarity(false)}
                              className="px-2 py-1 bg-zinc-200 dark:bg-zinc-700 border border-black rounded-lg text-xs"
                            >
                              {t.common.cancel}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Rarities List (Point 5: Removed all brackets) */}
                      <div className="space-y-2">
                        {packDraft.rarities?.map((rarity, rIdx) => (
                          <div key={rarity.id} className="flex items-center gap-2">
                            {/* Move Up/Down in Admin */}
                            <div className="flex items-center gap-0.5 shrink-0">
                              <button
                                type="button"
                                disabled={rIdx === 0}
                                onClick={() => handleMoveRarityInAdmin(rIdx, -1)}
                                className={`p-1 rounded border border-black dark:border-white text-xs ${
                                  rIdx === 0 ? 'opacity-20 cursor-not-allowed' : 'hover:bg-zinc-200 dark:hover:bg-zinc-700 bg-white dark:bg-zinc-800'
                                }`}
                                title={language === 'th' ? 'เลื่อนขึ้น' : 'Move Up'}
                              >
                                <ChevronUp size={12} />
                              </button>
                              <button
                                type="button"
                                disabled={rIdx === (packDraft.rarities?.length || 0) - 1}
                                onClick={() => handleMoveRarityInAdmin(rIdx, 1)}
                                className={`p-1 rounded border border-black dark:border-white text-xs ${
                                  rIdx === (packDraft.rarities?.length || 0) - 1 ? 'opacity-20 cursor-not-allowed' : 'hover:bg-zinc-200 dark:hover:bg-zinc-700 bg-white dark:bg-zinc-800'
                                }`}
                                title={language === 'th' ? 'เลื่อนลง' : 'Move Down'}
                              >
                                <ChevronDown size={12} />
                              </button>
                            </div>
                            {editingRarityId === rarity.id ? (
                              <div className="flex-1 flex flex-wrap items-center gap-2 bg-white dark:bg-zinc-700 border-2 border-black dark:border-white rounded-xl p-2">
                                <input
                                  type="text"
                                  value={rarityEditName}
                                  onChange={(e) => setRarityEditName(e.target.value)}
                                  className="w-16 px-2 py-1 bg-zinc-100 dark:bg-zinc-600 border border-black rounded text-xs font-bold"
                                />
                                <NeoColorPicker
                                  color={rarityEditColor}
                                  onChange={(val) => setRarityEditColor(val)}
                                  language={language}
                                />
                                <input
                                  type="text"
                                  value={rarityEditColor}
                                  onChange={(e) => {
                                    let val = e.target.value;
                                    if (val.length > 0 && !val.startsWith('#')) val = '#' + val;
                                    setRarityEditColor(val);
                                  }}
                                  className="w-20 px-1 py-1 text-xs font-mono uppercase bg-zinc-100 dark:bg-zinc-600 border-2 border-black dark:border-white rounded-lg font-bold"
                                />
                                <input
                                  type="number"
                                  value={rarityEditCount}
                                  onChange={(e) => setRarityEditCount(Number(e.target.value))}
                                  className="w-16 px-2 py-1 bg-zinc-100 dark:bg-zinc-600 border border-black rounded text-xs font-bold"
                                />
                                {packDraft.rarities && packDraft.rarities.length > 1 && (
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[11px] font-bold text-zinc-500">
                                      {language === 'th' ? 'โอกาสออก:' : 'Rate:'}
                                    </span>
                                    <div className="w-36">
                                      <NeoDropdown<string>
                                        value={rarityEditEqualRate}
                                        onChange={(val) => setRarityEditEqualRate(val)}
                                        options={[
                                          { value: '', label: language === 'th' ? 'ปกติ (ตามลำดับ)' : 'Normal' },
                                          ...packDraft.rarities
                                            .filter(o => o.id !== editingRarityId && (!o.equalRateWith || o.name === rarityEditEqualRate))
                                            .map(o => ({
                                              value: o.name,
                                              label: language === 'th' ? `เท่ากับ ${o.name}` : `Equal to ${o.name}`,
                                              color: o.color,
                                            }))
                                        ]}
                                        size="sm"
                                        fullWidth={true}
                                      />
                                    </div>
                                  </div>
                                )}
                                <button
                                  type="button"
                                  onClick={() => setRarityEditConfetti(!rarityEditConfetti)}
                                  className={`p-1 rounded border border-black transition-all ${
                                    rarityEditConfetti
                                      ? 'bg-amber-300 text-black shadow-sm'
                                      : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-400'
                                  }`}
                                  title={rarityEditConfetti ? t.createCards.confettiOnHint : t.createCards.confettiOffHint}
                                >
                                  <PartyPopper size={14} />
                                </button>
                                <button
                                  onClick={handleSaveRarityDraft}
                                  className="px-2 py-1 bg-yellow-400 border border-black rounded text-xs font-bold"
                                >
                                  {t.common.save}
                                </button>
                                <button
                                  onClick={() => setEditingRarityId(null)}
                                  className="px-2 py-1 bg-zinc-200 border border-black rounded text-xs"
                                >
                                  {t.common.cancel}
                                </button>
                              </div>
                            ) : (
                              <div className="flex-1 bg-white dark:bg-zinc-700 border-2 border-black dark:border-white rounded-xl py-2 px-3 text-xs sm:text-sm font-bold flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span
                                    className="w-4 h-4 rounded-full border border-black shrink-0"
                                    style={{ background: rarity.color }}
                                  />
                                  <span>{rarity.name}</span>
                                  {rarity.equalRateWith ? (() => {
                                    const targetIdx = packDraft.rarities.findIndex(
                                      o => o.name?.trim().toLowerCase() === rarity.equalRateWith?.trim().toLowerCase() || o.id === rarity.equalRateWith
                                    );
                                    const targetRank = targetIdx >= 0 ? targetIdx + 1 : undefined;
                                    const baseRarities = packDraft.rarities.filter(o => !o.equalRateWith);
                                    const maxRank = baseRarities.length > 0
                                      ? Math.max(...baseRarities.map(o => packDraft.rarities.findIndex(x => x.id === o.id) + 1))
                                      : packDraft.rarities.length;

                                    let suffix = '';
                                    if (targetRank === 1) {
                                      suffix = language === 'th' ? ' - ยากที่สุด' : ' - Rarest';
                                    } else if (targetRank === maxRank && maxRank > 1) {
                                      suffix = language === 'th' ? ' - ง่ายที่สุด' : ' - Easiest';
                                    }

                                    return (
                                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-200 border border-blue-400">
                                        {targetRank
                                          ? (language === 'th' ? `อันดับ ${targetRank} (ร่วม - เท่ากับ ${rarity.equalRateWith}${suffix})` : `Rank ${targetRank} (Shared - Equal to ${rarity.equalRateWith}${suffix})`)
                                          : (language === 'th' ? `เท่ากับ ${rarity.equalRateWith}` : `Equal to ${rarity.equalRateWith}`)}
                                      </span>
                                    );
                                  })() : (() => {
                                    const baseRarities = packDraft.rarities.filter(o => !o.equalRateWith);
                                    const maxRank = baseRarities.length > 0
                                      ? Math.max(...baseRarities.map(o => packDraft.rarities.findIndex(x => x.id === o.id) + 1))
                                      : packDraft.rarities.length;
                                    const rankNum = rIdx + 1;
                                    const isFirst = rankNum === 1;
                                    const isLast = rankNum === maxRank && maxRank > 1;
                                    const badgeText = isFirst
                                      ? (language === 'th' ? 'อันดับ 1 (ยากที่สุด)' : 'Rank 1 (Rarest)')
                                      : isLast
                                      ? (language === 'th' ? `อันดับ ${rankNum} (ง่ายที่สุด)` : `Rank ${rankNum} (Easiest)`)
                                      : (language === 'th' ? `อันดับ ${rankNum}` : `Rank ${rankNum}`);

                                    return (
                                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                                        isFirst
                                          ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200 border-amber-400'
                                          : isLast
                                          ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 border-emerald-400'
                                          : 'bg-zinc-100 dark:bg-zinc-600 text-zinc-700 dark:text-zinc-200 border-zinc-300'
                                      }`}>
                                        {badgeText}
                                      </span>
                                    );
                                  })()}
                                  <span className="text-zinc-500 font-mono text-xs max-w-[90px] sm:max-w-[120px] truncate">{rarity.color}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="text-zinc-700 dark:text-zinc-300">
                                    {rarity.cardCount || 0} {t.adminConsole.sections.rarityPieces}
                                  </span>
                                  {/* Confetti Party Popper Toggle */}
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      const updated = packDraft.rarities.map(r => r.id === rarity.id ? { ...r, hasConfetti: !r.hasConfetti } : r);
                                      const nextPack = { ...packDraft, rarities: updated };
                                      setPackDraft(nextPack);
                                      setHasUnsavedChanges(true);
                                      await savePack(nextPack, true);
                                      addToast(
                                        language === 'th'
                                          ? `ปรับสถานะพลุของระดับ ${rarity.name} เรียบร้อยแล้ว`
                                          : `Updated confetti for rarity ${rarity.name}`,
                                        'success'
                                      );
                                    }}
                                    className={`p-1.5 rounded-lg border-2 border-black dark:border-white transition-all sketch-btn flex items-center justify-center shrink-0 ${
                                      rarity.hasConfetti
                                        ? 'bg-amber-300 dark:bg-amber-400 text-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]'
                                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 opacity-60 hover:opacity-100'
                                    }`}
                                    title={rarity.hasConfetti ? t.createCards.confettiOnHint : t.createCards.confettiOffHint}
                                  >
                                    <PartyPopper size={14} />
                                  </button>
                                </div>
                              </div>
                            )}

                            <button
                              onClick={() => handleStartEditRarity(rarity)}
                              className="w-8 h-8 rounded-full bg-yellow-300 hover:bg-yellow-400 border-2 border-black flex items-center justify-center text-black shrink-0 sketch-btn shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]"
                              title={t.common.edit}
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => handleDeleteRarity(rarity.id)}
                              className="w-8 h-8 rounded-full bg-red-500 hover:bg-red-600 border-2 border-black flex items-center justify-center text-white shrink-0 sketch-btn shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]"
                              title={t.common.delete}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* ภาพของการ์ดใน Pack & ปุ่มเพิ่มรูปภาพ */}
                    <div className="space-y-3 pt-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="inline-block px-3 py-0.5 bg-white dark:bg-zinc-900 border-2 border-black dark:border-white rounded-lg text-[11px] font-bold">
                          {t.adminConsole.sections.cardImagesCount.replace('{count}', String(packDraft.cards.length))}
                        </div>

                        {/* Point 1: ปุ่ม + เพิ่มรูปภาพ / การ์ด เปิดเลือกไฟล์ภาพได้ทันที! */}
                        <div>
                          <input
                            type="file"
                            multiple
                            accept="image/*"
                            ref={filePickerRef}
                            onChange={handleMultipleFilesSelected}
                            className="hidden"
                          />
                          <button
                            type="button"
                            onClick={() => filePickerRef.current?.click()}
                            className="px-3.5 py-1.5 bg-yellow-300 hover:bg-yellow-400 text-black border-2 border-black rounded-xl text-xs font-bold sketch-btn flex items-center gap-1.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                          >
                            <Upload size={14} />
                            <span>{t.adminConsole.sections.addImageCards}</span>
                          </button>
                        </div>
                      </div>

                      {/* Filter by rarity (Point 5: No brackets) */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          onClick={() => setSelectedRarityFilter('ALL')}
                          className={`px-2.5 py-0.5 text-[11px] font-bold rounded-lg border border-black ${
                            selectedRarityFilter === 'ALL' ? 'bg-yellow-300 text-black' : 'bg-white text-zinc-700'
                          }`}
                        >
                          {t.common.all} ({packDraft.cards.length})
                        </button>
                        {packDraft.rarities?.map((r) => {
                          const count = packDraft.cards.filter(c => c.rarity === r.name).length;
                          return (
                            <button
                              key={r.id}
                              onClick={() => setSelectedRarityFilter(r.name)}
                              className={`px-2.5 py-0.5 text-[11px] font-bold rounded-lg border border-black flex items-center gap-1 ${
                                selectedRarityFilter === r.name ? 'ring-2 ring-black font-black' : 'opacity-85'
                              }`}
                              style={{ background: r.color, color: '#000' }}
                            >
                              <span>{r.name}</span>
                              <span>({count})</span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Cards Grid Preview */}
                      {(() => {
                        const sortedCards = sortCardsByRarityOrder(packDraft.cards || [], packDraft.rarities || []);
                        const filtered = selectedRarityFilter === 'ALL'
                          ? sortedCards
                          : sortedCards.filter(c => c.rarity === selectedRarityFilter);

                        if (filtered.length === 0) {
                          return (
                            <div className="text-center py-6 border-2 border-dashed border-zinc-400 rounded-xl text-xs font-bold text-zinc-500">
                              {t.adminConsole.sections.noCardsInRarity}
                            </div>
                          );
                        }

                        return (
                          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                            {filtered.map((card) => (
                              <div
                                key={card.id}
                                className="flex flex-col items-center p-2 rounded-xl border-2 border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-700/40 relative group"
                              >
                                <div
                                  className="w-full min-h-[110px] max-h-44 bg-zinc-100 dark:bg-zinc-800 border border-black rounded-lg overflow-hidden relative flex items-center justify-center p-1 cursor-pointer"
                                  onClick={() => card.imageUrl && setPreviewImage({ url: card.imageUrl, title: getCardDisplayName(card.name) || t.adminConsole.sections.unnamedCard })}
                                >
                                  {card.imageUrl ? (
                                    <img src={card.imageUrl} alt={getCardDisplayName(card.name)} className="max-h-40 max-w-full w-auto h-auto object-contain rounded" />
                                  ) : (
                                    <div className="text-[10px] text-zinc-400">Card</div>
                                  )}
                                  <span
                                    className="absolute top-1 left-1 px-1.5 py-0.2 text-[9px] font-black border border-black rounded shadow-sm text-black"
                                    style={{ backgroundColor: getRarityColor(card.rarity) }}
                                  >
                                    {card.rarity}
                                  </span>
                                  {card.imageUrl && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setPreviewImage({ url: card.imageUrl, title: getCardDisplayName(card.name) || t.adminConsole.sections.unnamedCard });
                                      }}
                                      className="absolute top-1 right-1 p-1 bg-black/75 hover:bg-black text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                      title={t.common.zoom}
                                    >
                                      <Maximize2 size={10} />
                                    </button>
                                  )}
                                </div>
                                <span className="text-[10px] font-bold text-zinc-700 dark:text-zinc-300 truncate max-w-full mt-1">
                                  {getCardDisplayName(card.name) || t.adminConsole.sections.unnamedCard}
                                </span>
                                <button
                                  onClick={() => handleDeleteCard(card.id)}
                                  className="w-5 h-5 rounded-full bg-red-500 hover:bg-red-600 border border-black flex items-center justify-center text-white mt-1"
                                  title={t.common.delete}
                                >
                                  <Trash2 size={10} />
                                </button>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                {/* ----------------------------------------------------
                    SECTION 3: จัดการ หน้าสร้าง Card Data
                    แสดงการ์ดแต่ละใบแยกกันชัดเจน ตรงกับ Create
                   ---------------------------------------------------- */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="inline-block px-5 py-1.5 bg-white dark:bg-zinc-900 border-2 border-black dark:border-white rounded-xl font-bold text-xs sm:text-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                      {t.adminConsole.sections.manageCardsData}
                    </div>

                    <button
                      onClick={() => setIsBulkFieldModalOpen(true)}
                      className="px-3 py-1 bg-blue-300 hover:bg-blue-400 text-black border-2 border-black rounded-xl text-xs font-bold sketch-btn flex items-center gap-1 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]"
                    >
                      <Plus size={13} />
                      <span>{t.adminConsole.sections.addFieldToAll}</span>
                    </button>
                  </div>

                  <div className="bg-zinc-200 dark:bg-zinc-800 border-2 border-black dark:border-white rounded-2xl p-4 sm:p-6 space-y-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.8)]">
                    {/* Search and Rarity Filter Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-zinc-300 dark:border-zinc-700">
                      <div className="relative flex-1 min-w-[180px]">
                        <input
                          type="text"
                          value={cardDataSearchQuery}
                          onChange={(e) => setCardDataSearchQuery(e.target.value)}
                          placeholder={t.adminConsole.sections.searchCardPlaceholder}
                          className="w-full pl-8 pr-3 py-1.5 text-xs font-bold bg-white dark:bg-zinc-700 border-2 border-black dark:border-white rounded-xl focus:outline-none"
                        />
                        <Search size={13} className="absolute left-2.5 top-2.5 text-zinc-400" />
                      </div>

                      {/* Rarity filter pills (Point 5: No brackets) */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          onClick={() => setCardDataRarityFilter('ALL')}
                          className={`px-2 py-1 text-[11px] font-bold rounded-lg border border-black ${
                            cardDataRarityFilter === 'ALL' ? 'bg-yellow-300 text-black' : 'bg-white text-zinc-700'
                          }`}
                        >
                          {t.common.all}
                        </button>
                        {packDraft.rarities?.map((r) => (
                          <button
                            key={r.id}
                            onClick={() => setCardDataRarityFilter(r.name)}
                            className={`px-2 py-1 text-[11px] font-bold rounded-lg border border-black ${
                              cardDataRarityFilter === r.name ? 'ring-2 ring-black font-black' : 'opacity-85'
                            }`}
                            style={{ background: r.color, color: '#000' }}
                          >
                            {r.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Cards Individual List */}
                    {(() => {
                      const sortedCards = sortCardsByRarityOrder(packDraft.cards || [], packDraft.rarities || []);
                      const list = sortedCards.filter((card) => {
                        const matchRarity = cardDataRarityFilter === 'ALL' || card.rarity === cardDataRarityFilter;
                        const matchSearch =
                          !cardDataSearchQuery.trim() ||
                          card.name.toLowerCase().includes(cardDataSearchQuery.toLowerCase()) ||
                          (card.fileName && card.fileName.toLowerCase().includes(cardDataSearchQuery.toLowerCase()));
                        return matchRarity && matchSearch;
                      });

                      if (list.length === 0) {
                        return (
                          <div className="text-center py-8 border-2 border-dashed border-zinc-400 rounded-2xl text-xs font-bold text-zinc-500">
                            {t.adminConsole.sections.noCardsMatching}
                          </div>
                        );
                      }

                      return (
                        <div className="space-y-4">
                          {list.map((card) => (
                            <div
                              key={card.id}
                              className="p-4 sm:p-5 bg-white dark:bg-zinc-700/60 border-2 border-black dark:border-white rounded-2xl flex flex-col md:flex-row gap-5 items-start shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
                            >
                              {/* Left: Card Preview, Rarity, Image Change, Delete */}
                              <div className="flex flex-col items-center shrink-0 w-full md:w-32">
                                <span
                                  className="text-xs font-black mb-1.5 px-3 py-0.5 border border-black rounded-md text-black shadow-sm"
                                  style={{ backgroundColor: getRarityColor(card.rarity) }}
                                >
                                  {card.rarity}
                                </span>

                                <div
                                  title={card.fileName || getCardDisplayName(card.name)}
                                  className="group relative max-w-[180px] max-h-48 min-w-[90px] min-h-[110px] border-2 border-black dark:border-white rounded-xl overflow-hidden bg-zinc-100 dark:bg-zinc-800 shadow-sm flex items-center justify-center p-1 cursor-pointer"
                                  onClick={() => card.imageUrl && setPreviewImage({ url: card.imageUrl, title: getCardDisplayName(card.name) || t.adminConsole.sections.unnamedCard })}
                                >
                                  <img src={card.imageUrl} alt={getCardDisplayName(card.name)} className="max-h-44 max-w-[170px] w-auto h-auto object-contain rounded-lg block" />
                                  <div className="absolute bottom-1 left-1 right-1 z-20 px-1 py-0.5 text-[9px] font-bold bg-black/85 text-white rounded pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity truncate text-center">
                                    {card.fileName || getCardDisplayName(card.name)}
                                  </div>
                                  {card.imageUrl && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setPreviewImage({ url: card.imageUrl, title: getCardDisplayName(card.name) || t.adminConsole.sections.unnamedCard });
                                      }}
                                      className="absolute top-1.5 right-1.5 p-1 bg-black/75 hover:bg-black text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                      title={t.common.zoom}
                                    >
                                      <Maximize2 size={12} />
                                    </button>
                                  )}
                                </div>

                                <div className="flex items-center gap-2 mt-2">
                                  <label className="px-2 py-1 text-[10px] font-bold bg-yellow-300 hover:bg-yellow-400 border border-black rounded-lg cursor-pointer sketch-btn text-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
                                    {t.adminConsole.sections.changeImage}
                                    <input
                                      type="file"
                                      accept="image/*"
                                      className="hidden"
                                      onChange={(e) => handleUpdateCardImage(card.id, e)}
                                    />
                                  </label>
                                  <button
                                    onClick={() => handleDeleteCard(card.id)}
                                    className="p-1 text-red-500 hover:text-red-700 border border-black rounded-lg bg-red-50 hover:bg-red-100"
                                    title={t.adminConsole.sections.deleteThisCard}
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>

                                <div className="mt-2 w-full">
                                  <NeoDropdown
                                    value={card.rarity}
                                    onChange={(val) => handleUpdateCardRarity(card.id, val)}
                                    options={(packDraft.rarities || []).map(r => ({
                                      value: r.name,
                                      label: `${t.adminConsole.sections.rarityPrefix} ${r.name}`,
                                      color: r.color,
                                    }))}
                                    size="sm"
                                  />
                                </div>
                              </div>

                              {/* Right: Dynamic Fields matching Create */}
                              <div className="flex-1 w-full space-y-3">
                                {(card.fields || []).map((field) => (
                                  <div key={field.id} className="space-y-1">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-1 text-xs font-bold">
                                        <input
                                          type="text"
                                          value={field.name}
                                          onChange={(e) => handleUpdateCardFieldName(card.id, field.id, e.target.value)}
                                          className="bg-transparent border-b border-dashed border-zinc-400 focus:outline-none focus:border-black font-bold text-xs"
                                        />
                                        <Edit2 size={11} className="text-zinc-400" />
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteCardField(card.id, field.id)}
                                        className="p-0.5 text-red-500 hover:text-red-700"
                                        title={t.adminConsole.sections.deleteField}
                                      >
                                        <X size={14} />
                                      </button>
                                    </div>

                                    {field.name === 'ความสามารถการ์ด' || field.name === 'Card Ability' ? (
                                      <textarea
                                        rows={2}
                                        value={field.value}
                                        onChange={(e) => handleUpdateCardFieldValue(card.id, field.id, e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter' && !e.shiftKey) {
                                            e.stopPropagation();
                                          }
                                        }}
                                        placeholder={t.adminConsole.sections.abilityPlaceholder}
                                        className="w-full px-3 py-1.5 text-xs bg-white dark:bg-zinc-800 border-2 border-black dark:border-white rounded-lg focus:outline-none resize-y min-h-[44px] font-medium"
                                      />
                                    ) : (
                                      <textarea
                                        rows={Math.min(6, Math.max(1, (field.value || '').split('\n').length))}
                                        value={field.value}
                                        onChange={(e) => handleUpdateCardFieldValue(card.id, field.id, e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter' && !e.shiftKey) {
                                            e.stopPropagation();
                                          }
                                        }}
                                        placeholder={t.adminConsole.sections.valuePlaceholder}
                                        className="w-full px-3 py-1.5 text-xs bg-white dark:bg-zinc-800 border-2 border-black dark:border-white rounded-lg focus:outline-none resize-y min-h-[34px] font-medium"
                                      />
                                    )}
                                  </div>
                                ))}

                                <div className="flex items-center gap-3 pt-1.5 flex-wrap">
                                  <button
                                    type="button"
                                    onClick={() => handleAddFieldToCard(card.id)}
                                    className="flex items-center gap-1 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:underline"
                                  >
                                    <Plus size={13} />
                                    <span>{t.adminConsole.sections.addThisCardOnly}</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setIsBulkFieldModalOpen(true)}
                                    className="flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
                                  >
                                    <Plus size={13} />
                                    <span>{t.adminConsole.sections.addFieldToAll}</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Point 3: Bottom Global Pack Actions - Explicit Save Pack Button */}
                <div className="flex items-center justify-between pt-2">
                  <div>
                    {hasUnsavedChanges && (
                      <span className="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-3 py-1 rounded-lg border border-amber-300">
                        {t.adminConsole.queue.unsavedChanges}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleDeleteCurrentPack}
                      className="px-4 py-2 text-xs font-bold rounded-xl border-2 border-black dark:border-white bg-red-100 hover:bg-red-200 dark:bg-red-950/40 text-red-700 dark:text-red-300 sketch-btn shadow-[2px_2px_0px_0px_rgba(0,0,0,0.8)]"
                    >
                      {t.adminConsole.queue.deletePack}
                    </button>
                    <button
                      onClick={() => handleSavePackChanges()}
                      className="px-6 py-2.5 text-xs font-black rounded-xl border-2 border-black dark:border-white bg-yellow-400 hover:bg-yellow-300 text-black sketch-btn shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                    >
                      {t.adminConsole.queue.saveChanges}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ========================================================
            TAB 2: รายงาน (REPORTS)
           ======================================================== */}
        {activeTab === 'reports' && (
          <div className="bg-white dark:bg-zinc-800 border-2 border-black dark:border-white rounded-3xl p-5 sm:p-6 shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] space-y-6 animate-in fade-in duration-200">
            {/* Header & Stats Overview */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-dashed border-zinc-200 dark:border-zinc-700 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 rounded-xl border-2 border-black dark:border-white">
                  <Flag size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-lg font-['Mali'] text-zinc-900 dark:text-white">
                    {t.adminConsole.reports.title}
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {language === 'th'
                      ? 'ตรวจสอบและอนุมัติคำร้องรายงานความไม่เหมาะสมจากผู้ใช้งาน'
                      : 'Review and acknowledge user reports regarding inappropriate content'}
                  </p>
                </div>
              </div>

              {/* Counters Badges */}
              <div className="flex items-center gap-2">
                <div className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-700/60 rounded-xl border border-zinc-300 dark:border-zinc-600 text-xs text-center font-bold">
                  <span className="text-zinc-500 dark:text-zinc-400 text-[10px] block">{t.adminConsole.reports.totalReports}</span>
                  <span className="text-zinc-900 dark:text-white text-sm">{reports.length}</span>
                </div>
                <div className="px-3 py-1.5 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-300 dark:border-amber-700 text-xs text-center font-bold">
                  <span className="text-amber-600 dark:text-amber-400 text-[10px] block">{t.adminConsole.reports.pendingCount}</span>
                  <span className="text-amber-700 dark:text-amber-300 text-sm">
                    {reports.filter((r) => r.status === 'pending').length}
                  </span>
                </div>
                <div className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-300 dark:border-emerald-700 text-xs text-center font-bold">
                  <span className="text-emerald-600 dark:text-emerald-400 text-[10px] block">{t.adminConsole.reports.resolvedCount}</span>
                  <span className="text-emerald-700 dark:text-emerald-300 text-sm">
                    {reports.filter((r) => r.status === 'resolved').length}
                  </span>
                </div>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Filter Pills */}
              <div className="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-700/60 p-1 rounded-xl border border-zinc-300 dark:border-zinc-600">
                <button
                  type="button"
                  onClick={() => setReportFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    reportFilter === 'all'
                      ? 'bg-white dark:bg-zinc-800 text-black dark:text-white shadow-sm border border-black dark:border-white'
                      : 'text-zinc-600 dark:text-zinc-300 hover:text-black dark:hover:text-white'
                  }`}
                >
                  {t.adminConsole.reports.filterAll} ({reports.length})
                </button>
                <button
                  type="button"
                  onClick={() => setReportFilter('pending')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    reportFilter === 'pending'
                      ? 'bg-amber-400 text-black shadow-sm border border-black'
                      : 'text-zinc-600 dark:text-zinc-300 hover:text-black dark:hover:text-white'
                  }`}
                >
                  {t.adminConsole.reports.filterPending} ({reports.filter((r) => r.status === 'pending').length})
                </button>
                <button
                  type="button"
                  onClick={() => setReportFilter('resolved')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    reportFilter === 'resolved'
                      ? 'bg-emerald-400 text-black shadow-sm border border-black'
                      : 'text-zinc-600 dark:text-zinc-300 hover:text-black dark:hover:text-white'
                  }`}
                >
                  {t.adminConsole.reports.filterResolved} ({reports.filter((r) => r.status === 'resolved').length})
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <input
                  type="text"
                  value={reportSearchQuery}
                  onChange={(e) => setReportSearchQuery(e.target.value)}
                  placeholder={
                    language === 'th'
                      ? 'ค้นหารายงาน (ซอง, การ์ด, ผู้แจ้ง, ความใน)...'
                      : 'Search reports (pack, card, reporter)...'
                  }
                  className="w-full pl-9 pr-4 py-2 text-xs font-bold bg-zinc-100 dark:bg-zinc-700 border-2 border-black dark:border-white rounded-xl focus:outline-none"
                />
                <Search size={14} className="absolute left-3 top-2.5 text-zinc-400" />
              </div>
            </div>

            {/* Reports List */}
            {(() => {
              const pendingCount = reports.filter((r) => r.status === 'pending').length;
              const resolvedCount = reports.filter((r) => r.status === 'resolved').length;
              const filteredReports = reports.filter((r) => {
                if (reportFilter === 'pending' && r.status !== 'pending') return false;
                if (reportFilter === 'resolved' && r.status !== 'resolved') return false;
                if (reportSearchQuery.trim()) {
                  const q = reportSearchQuery.toLowerCase();
                  const matchFranchise = (r.franchiseName || '').toLowerCase().includes(q);
                  const matchPack = (r.packName || '').toLowerCase().includes(q);
                  const matchCard = (r.cardName || '').toLowerCase().includes(q);
                  const matchUser = (r.reportedByUsername || '').toLowerCase().includes(q);
                  const matchDetails = (r.details || '').toLowerCase().includes(q);
                  const matchCategory = (r.category || '').toLowerCase().includes(q);
                  return matchFranchise || matchPack || matchCard || matchUser || matchDetails || matchCategory;
                }
                return true;
              });

              if (filteredReports.length === 0) {
                return (
                  <div className="text-center py-12 text-zinc-500 font-medium text-xs space-y-2 border-2 border-dashed border-zinc-200 dark:border-zinc-700 rounded-2xl">
                    <AlertTriangle className="mx-auto text-amber-500" size={36} />
                    <p className="text-sm font-bold text-zinc-700 dark:text-zinc-300">{t.adminConsole.reports.empty}</p>
                    <p className="text-xs text-zinc-400">{t.adminConsole.reports.emptyDesc}</p>
                  </div>
                );
              }

              return (
                <div className="space-y-4">
                  {filteredReports.map((report) => {
                    const categoryLabel =
                      (report.categoryKey && t.home.reportModal.categories[report.categoryKey]) ||
                      report.category ||
                      (language === 'th' ? 'ทั่วไป' : 'General');
                    const isPending = report.status === 'pending';
                    const isProcessing = processingReportId === report.id;

                    return (
                      <div
                        key={report.id}
                        className="bg-zinc-50 dark:bg-zinc-900/60 border-2 border-black dark:border-white rounded-2xl p-4 sm:p-5 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(255,255,255,0.8)] space-y-3.5 transition-all"
                      >
                        {/* Top Row: Category, Target, Status */}
                        <div className="flex flex-wrap items-center justify-between gap-2.5">
                          <div className="flex flex-wrap items-center gap-2">
                            {/* Category Badge */}
                            <span className="px-2.5 py-1 text-xs font-black rounded-lg border-2 border-black bg-rose-200 text-rose-900 shadow-sm flex items-center gap-1.5">
                              <Flag size={12} />
                              <span>{categoryLabel}</span>
                            </span>

                            {/* Target Details */}
                            <span className="px-2.5 py-1 text-xs font-bold rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200">
                              {report.cardName ? (
                                <span>
                                  {language === 'th' ? 'การ์ด: ' : 'Card: '}
                                  <strong className="text-red-600 dark:text-red-400">{report.cardName}</strong>
                                  {' '}({report.packName})
                                </span>
                              ) : (
                                <span>
                                  {language === 'th' ? 'ซองสุ่ม: ' : 'Pack: '}
                                  <strong className="text-red-600 dark:text-red-400">{report.packName}</strong>
                                  {' '}({report.franchiseName})
                                </span>
                              )}
                            </span>
                          </div>

                          {/* Status Badge */}
                          <div>
                            {isPending ? (
                              <span className="px-2.5 py-1 text-xs font-bold rounded-full border-2 border-black bg-amber-300 text-amber-950 flex items-center gap-1 shadow-sm">
                                <AlertTriangle size={12} />
                                <span>{t.adminConsole.reports.pendingCount}</span>
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 text-xs font-bold rounded-full border-2 border-black bg-emerald-300 text-emerald-950 flex items-center gap-1 shadow-sm">
                                <Check size={12} />
                                <span>{t.adminConsole.reports.resolvedCount}</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Middle Row: Reporter & Date (Item 8) */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                          <div>
                            <span className="font-bold text-zinc-500">{t.adminConsole.reports.reporterHeader}: </span>
                            <span className="font-bold text-zinc-900 dark:text-white">{report.reportedByUsername}</span>
                          </div>
                          <div className="sm:text-right">
                            <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                              {language === 'th' ? 'ส่งมาเมื่อ ' : 'Submitted at '}
                              {new Date(report.createdAt).toLocaleString(language === 'th' ? 'th-TH' : 'en-US')}
                            </span>
                          </div>
                        </div>

                        {/* Details Box: ความใน / ข้อความ */}
                        <div className="p-3 bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs space-y-1">
                          <span className="font-bold text-zinc-500 dark:text-zinc-400 block">
                            {t.adminConsole.reports.detailsHeader}:
                          </span>
                          <p className="font-medium text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap">
                            {report.details ? (
                              report.details
                            ) : (
                              <span className="italic text-zinc-400">
                                {language === 'th' ? '(ไม่มีข้อความเพิ่มเติม)' : '(No additional details provided)'}
                              </span>
                            )}
                          </p>
                        </div>

                        {/* Resolution note if resolved */}
                        {!isPending && report.resolvedAt && (
                          <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                            <Check size={14} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
                            <span>
                              {language === 'th' ? 'รับทราบโดย: ' : 'Acknowledged by: '}
                              <strong>{report.resolvedBy || 'Admin'}</strong>
                              {' '}
                              {language === 'th' ? 'เมื่อ: ' : 'on: '}
                              {new Date(report.resolvedAt).toLocaleString(language === 'th' ? 'th-TH' : 'en-US')}
                            </span>
                          </div>
                        )}

                        {/* Action Buttons Row */}
                        <div className="flex items-center justify-between gap-3 pt-1 border-t border-zinc-200 dark:border-zinc-700">
                          {/* Delete Report Button */}
                          <button
                            type="button"
                            onClick={() => handleDeleteReport(report.id)}
                            className="px-3 py-1.5 text-xs font-bold rounded-xl border-2 border-black dark:border-white bg-red-100 hover:bg-red-200 dark:bg-red-950/40 text-red-700 dark:text-red-300 sketch-btn flex items-center gap-1.5"
                            title={t.adminConsole.reports.deleteReportBtn}
                          >
                            <Trash2 size={13} />
                            <span>{t.adminConsole.reports.deleteReportBtn}</span>
                          </button>

                          {/* Approve / Acknowledge Button */}
                          {isPending && (
                            <button
                              type="button"
                              onClick={() => handleAcknowledgeReport(report)}
                              disabled={isProcessing}
                              className="px-4 py-2 text-xs font-black rounded-xl border-2 border-black dark:border-white bg-emerald-400 hover:bg-emerald-300 text-black sketch-btn shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] flex items-center gap-1.5 disabled:opacity-50"
                            >
                              <Check size={15} />
                              <span>
                                {isProcessing
                                  ? language === 'th'
                                    ? 'กำลังดำเนินการ...'
                                    : 'Processing...'
                                  : t.adminConsole.reports.acknowledgeBtn}
                              </span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}

        {/* ========================================================
            TAB 3: สมาชิก (MEMBERS)
           ======================================================== */}
        {activeTab === 'members' && (
          <div className="bg-white dark:bg-zinc-800 border-2 border-black dark:border-white rounded-3xl p-5 sm:p-6 shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-bold text-base font-['Mali']">{t.adminConsole.members.title}</h3>
              <span className="text-xs font-bold text-zinc-500">
                {t.adminConsole.members.totalCount.replace('{count}', String(members.length))}
              </span>
            </div>

            {/* Member Search Bar */}
            <div className="relative">
              <input
                type="text"
                value={memberSearchQuery}
                onChange={(e) => setMemberSearchQuery(e.target.value)}
                placeholder={t.adminConsole.members.searchUser}
                className="w-full pl-9 pr-4 py-2 text-xs font-bold bg-zinc-100 dark:bg-zinc-700 border-2 border-black dark:border-white rounded-xl focus:outline-none"
              />
              <Search size={14} className="absolute left-3 top-3 text-zinc-400" />
            </div>

            {/* Members List */}
            <div className="divide-y divide-zinc-200 dark:divide-zinc-700 space-y-3">
              {members
                .filter(m =>
                  !memberSearchQuery.trim() ||
                  m.username.toLowerCase().includes(memberSearchQuery.toLowerCase()) ||
                  m.email.toLowerCase().includes(memberSearchQuery.toLowerCase())
                )
                .map((member) => (
                  <div key={member.id} className="pt-3 space-y-2.5">
                    {/* Member Header Row */}
                    <div className="flex flex-wrap items-center justify-between gap-2.5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full border-2 border-black overflow-hidden bg-zinc-200 dark:bg-zinc-600 flex items-center justify-center font-black text-sm shrink-0 relative">
                          <span>{member.username[0]?.toUpperCase() || 'U'}</span>
                          {member.avatarUrl && (
                            <img
                              src={member.avatarUrl}
                              alt={member.username}
                              draggable={false}
                              onDragStart={(e) => e.preventDefault()}
                              onError={(e) => {
                                (e.currentTarget as HTMLElement).style.display = 'none';
                              }}
                              className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none"
                            />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm">{member.username}</span>
                            {/* Role Badge */}
                            {member.isHeadAdmin ? (
                              <span className="px-2 py-0.5 text-[10px] font-black bg-yellow-400 text-black border border-black rounded-full shadow-sm">
                                {t.adminConsole.members.headAdminLocked}
                              </span>
                            ) : (
                              <span
                                className={`px-2 py-0.5 text-[10px] font-black rounded-full border border-black ${
                                  member.role === 'Admin'
                                    ? 'bg-amber-300 text-black'
                                    : 'bg-blue-200 dark:bg-blue-900 text-blue-900 dark:text-blue-100'
                                }`}
                              >
                                {member.role}
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-zinc-500 truncate block">{member.email}</span>
                        </div>
                      </div>

                      {/* Coins Display */}
                      <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-3 py-1.5 rounded-xl border border-amber-300 dark:border-amber-700">
                        <Coins size={15} />
                        <span>{member.coins.toLocaleString()} Coin</span>
                      </div>
                    </div>

                    {/* Member Controls */}
                    <div className="flex flex-wrap items-center justify-between gap-2 bg-zinc-100 dark:bg-zinc-700/60 p-2.5 rounded-xl border border-zinc-300 dark:border-zinc-600">
                      <div>
                        {member.isHeadAdmin ? (
                          <span className="text-[11px] font-bold text-zinc-500 italic">
                            {t.adminConsole.members.headAdminPerm}
                          </span>
                        ) : (
                          <button
                            onClick={() => handleToggleMemberRole(member)}
                            className={`px-3 py-1 text-xs font-bold rounded-lg border border-black transition-all sketch-btn ${
                              member.role === 'Admin'
                                ? 'bg-amber-300 hover:bg-amber-400 text-black'
                                : 'bg-white hover:bg-zinc-100 text-zinc-800'
                            }`}
                          >
                            {t.adminConsole.members.changeRoleTo.replace('{role}', member.role === 'Admin' ? 'User' : 'Admin')}
                          </button>
                        )}
                      </div>

                      {/* Coin Modifier Buttons */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px] font-bold text-zinc-500 mr-0.5">{t.adminConsole.members.adjustCoins}</span>
                        <button
                          onClick={() => handleModifyMemberCoins(member, 1000)}
                          className="px-2 py-0.5 text-[11px] font-bold bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border border-black rounded-lg transition-colors"
                          title={language === 'th' ? 'เพิ่ม 1,000 Coin' : '+1,000 Coins'}
                        >
                          +1K
                        </button>
                        <button
                          onClick={() => handleModifyMemberCoins(member, -1000)}
                          className="px-2 py-0.5 text-[11px] font-bold bg-red-100 hover:bg-red-200 text-red-800 border border-black rounded-lg transition-colors"
                          title={language === 'th' ? 'ลด 1,000 Coin' : '-1,000 Coins'}
                        >
                          -1K
                        </button>
                        <button
                          onClick={() => handleModifyMemberCoins(member, 5000)}
                          className="px-2 py-0.5 text-[11px] font-bold bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border border-black rounded-lg transition-colors"
                          title={language === 'th' ? 'เพิ่ม 5,000 Coin' : '+5,000 Coins'}
                        >
                          +5K
                        </button>
                        <button
                          onClick={() => handleModifyMemberCoins(member, -5000)}
                          className="px-2 py-0.5 text-[11px] font-bold bg-red-100 hover:bg-red-200 text-red-800 border border-black rounded-lg transition-colors"
                          title={language === 'th' ? 'ลด 5,000 Coin' : '-5,000 Coins'}
                        >
                          -5K
                        </button>
                        <button
                          onClick={() => handleModifyMemberCoins(member, 10000)}
                          className="px-2 py-0.5 text-[11px] font-bold bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border border-black rounded-lg transition-colors"
                          title={language === 'th' ? 'เพิ่ม 10,000 Coin' : '+10,000 Coins'}
                        >
                          +10K
                        </button>
                        <button
                          onClick={() => handleModifyMemberCoins(member, -10000)}
                          className="px-2 py-0.5 text-[11px] font-bold bg-red-100 hover:bg-red-200 text-red-800 border border-black rounded-lg transition-colors"
                          title={language === 'th' ? 'ลด 10,000 Coin' : '-10,000 Coins'}
                        >
                          -10K
                        </button>

                        {/* Custom Input with both + and - actions */}
                        {editingCoinsMemberId === member.id ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              value={customCoinsInput}
                              onChange={(e) => setCustomCoinsInput(e.target.value)}
                              placeholder={t.adminConsole.members.amountPlaceholder}
                              className="w-16 px-1.5 py-0.5 text-xs bg-white dark:bg-zinc-800 border border-black rounded font-bold"
                              autoFocus
                            />
                            <button
                              onClick={() => {
                                const amt = parseInt(customCoinsInput, 10);
                                if (!isNaN(amt) && amt > 0) handleModifyMemberCoins(member, amt);
                              }}
                              className="px-2 py-0.5 text-[11px] font-bold bg-emerald-300 hover:bg-emerald-400 border border-black rounded"
                              title={language === 'th' ? 'เพิ่มตามจำนวนนี้' : 'Add custom coins'}
                            >
                              +
                            </button>
                            <button
                              onClick={() => {
                                const amt = parseInt(customCoinsInput, 10);
                                if (!isNaN(amt) && amt > 0) handleModifyMemberCoins(member, -amt);
                              }}
                              className="px-2 py-0.5 text-[11px] font-bold bg-red-300 hover:bg-red-400 border border-black rounded"
                              title={language === 'th' ? 'ลดตามจำนวนนี้' : 'Deduct custom coins'}
                            >
                              -
                            </button>
                            <button
                              onClick={() => setEditingCoinsMemberId(null)}
                              className="p-0.5 border border-black rounded bg-zinc-200"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setEditingCoinsMemberId(member.id);
                              setCustomCoinsInput('');
                            }}
                            className="px-2 py-0.5 text-[11px] font-bold bg-yellow-300 border border-black rounded-lg hover:bg-yellow-400 transition-colors"
                          >
                            {t.adminConsole.members.custom}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 4: สถิติ (STATISTICS)
           ======================================================== */}
        {activeTab === 'stats' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white dark:bg-zinc-800 border-2 border-black dark:border-white rounded-2xl p-4 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                <p className="text-xs font-bold text-zinc-500">{t.adminConsole.stats.totalPacks}</p>
                <p className="text-2xl font-black mt-1 font-['Mali']">
                  {t.adminConsole.stats.totalPacksCount.replace('{count}', String(packs.length))}
                </p>
              </div>
              <div className="bg-white dark:bg-zinc-800 border-2 border-black dark:border-white rounded-2xl p-4 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                <p className="text-xs font-bold text-zinc-500">{t.adminConsole.stats.totalCards}</p>
                <p className="text-2xl font-black mt-1 font-['Mali']">
                  {t.adminConsole.stats.totalCardsCount.replace('{count}', String(packs.reduce((sum, p) => sum + (p.cards?.length || 0), 0)))}
                </p>
              </div>
              <div className="bg-white dark:bg-zinc-800 border-2 border-black dark:border-white rounded-2xl p-4 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                <p className="text-xs font-bold text-zinc-500">{t.adminConsole.stats.publishedPacks}</p>
                <p className="text-2xl font-black mt-1 font-['Mali'] text-emerald-600">
                  {t.adminConsole.stats.totalPacksCount.replace('{count}', String(packs.filter(p => p.isPublished).length))}
                </p>
              </div>
              <div className="bg-white dark:bg-zinc-800 border-2 border-black dark:border-white rounded-2xl p-4 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                <p className="text-xs font-bold text-zinc-500">{t.adminConsole.stats.unpublishedPacks}</p>
                <p className="text-2xl font-black mt-1 font-['Mali'] text-zinc-500">
                  {t.adminConsole.stats.totalPacksCount.replace('{count}', String(packs.filter(p => !p.isPublished).length))}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 5: แชทช่วยเหลือ (SUPPORT CHAT)
           ======================================================== */}
        {activeTab === 'chat' && (
          <div className="bg-white dark:bg-zinc-800 border-2 border-black dark:border-white rounded-3xl p-6 shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] space-y-4 animate-in fade-in duration-200">
            <h3 className="font-bold text-base font-['Mali']">
              {t.adminConsole.chat.title}
            </h3>
            <div className="text-center py-10 text-zinc-500 font-medium text-xs space-y-2">
              <MessageSquare className="mx-auto text-blue-500" size={32} />
              <p>{t.adminConsole.chat.empty}</p>
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 6: จัดการแท็ก (TAGS MANAGEMENT)
           ======================================================== */}
        {activeTab === 'tags' && (
          <div className="bg-white dark:bg-zinc-800 border-2 border-black dark:border-white rounded-3xl p-5 sm:p-7 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.8)] space-y-6 animate-in fade-in duration-200">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b-2 border-zinc-200 dark:border-zinc-700">
              <div>
                <h2 className="text-xl sm:text-2xl font-black font-['Mali']">
                  <span>{t.adminConsole.tags.title}</span>
                </h2>
              </div>
              <div className="px-3.5 py-1.5 bg-yellow-300 text-black border-2 border-black rounded-xl text-xs font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] self-start sm:self-auto">
                {t.adminConsole.tags.totalTags}: {tags.length}
              </div>
            </div>

            {/* Create New Tag Input */}
            <div className="p-4 bg-zinc-50 dark:bg-zinc-900/50 border-2 border-black dark:border-white rounded-2xl space-y-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.8)]">
              <label className="text-xs font-bold block text-zinc-700 dark:text-zinc-300">
                {t.adminConsole.tags.addTagBtn}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const trimmed = newTagInput.trim();
                      if (!trimmed) {
                        addToast(t.adminConsole.tags.tagEmptyWarning, 'warning');
                        return;
                      }
                      if (tags.some(tg => tg.toLowerCase() === trimmed.toLowerCase())) {
                        addToast(t.adminConsole.tags.tagExists, 'warning');
                        return;
                      }
                      setNewTagInput('');
                      addToast(t.adminConsole.tags.tagCreated, 'success');
                      addTag(trimmed);
                    }
                  }}
                  placeholder={t.adminConsole.tags.newTagPlaceholder}
                  className="flex-1 bg-white dark:bg-zinc-800 border-2 border-black dark:border-white rounded-xl px-3.5 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-yellow-400"
                />
                <button
                  type="button"
                  onClick={() => {
                    const trimmed = newTagInput.trim();
                    if (!trimmed) {
                      addToast(t.adminConsole.tags.tagEmptyWarning, 'warning');
                      return;
                    }
                    if (tags.some(tg => tg.toLowerCase() === trimmed.toLowerCase())) {
                      addToast(t.adminConsole.tags.tagExists, 'warning');
                      return;
                    }
                    setNewTagInput('');
                    addToast(t.adminConsole.tags.tagCreated, 'success');
                    addTag(trimmed);
                  }}
                  className="px-4 py-2 bg-emerald-300 hover:bg-emerald-400 text-black border-2 border-black rounded-xl text-sm font-bold sketch-btn shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center gap-1.5 shrink-0"
                >
                  <Plus size={16} />
                  <span>{t.adminConsole.tags.addTagBtn}</span>
                </button>
              </div>
            </div>

            {/* Tag Search filter */}
            <div className="relative max-w-sm">
              <input
                type="text"
                value={tagSearchQuery}
                onChange={(e) => setTagSearchQuery(e.target.value)}
                placeholder={t.adminConsole.tags.searchPlaceholder}
                className="w-full bg-white dark:bg-zinc-800 border-2 border-black dark:border-white rounded-xl pl-9 pr-3 py-1.5 text-xs font-semibold focus:outline-none"
              />
              <Search size={14} className="absolute left-3 top-2.5 text-zinc-400" />
            </div>

            {/* Tags List Table */}
            <div className="border-2 border-black dark:border-white rounded-2xl overflow-hidden shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(255,255,255,0.8)]">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-zinc-100 dark:bg-zinc-700/80 border-b-2 border-black dark:border-white text-[11px] font-black uppercase">
                  <tr>
                    <th className="p-3 w-12 text-center">#</th>
                    <th className="p-3">{t.adminConsole.tags.tagNameHeader}</th>
                    <th className="p-3 text-center w-36">{t.adminConsole.tags.usageHeader}</th>
                    <th className="p-3 text-right w-36">{t.adminConsole.tags.actionsHeader}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700 font-medium bg-white dark:bg-zinc-800">
                  {tags
                    .filter(tagName => tagName.toLowerCase().includes(tagSearchQuery.toLowerCase()))
                    .length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-zinc-400 italic">
                        {t.adminConsole.tags.emptyTags}
                      </td>
                    </tr>
                  ) : (
                    tags
                      .filter(tagName => tagName.toLowerCase().includes(tagSearchQuery.toLowerCase()))
                      .map((tagName, idx) => {
                        const isEditing = editingTagName === tagName;
                        const usageCount = packs.filter(p => {
                          if (p.tags && Array.isArray(p.tags)) {
                            return p.tags.some(tg => tg.toLowerCase() === tagName.toLowerCase());
                          }
                          if (p.tag) {
                            return p.tag.split(',').some(tg => tg.trim().toLowerCase() === tagName.toLowerCase());
                          }
                          return false;
                        }).length;
                        return (
                          <tr key={tagName} className="hover:bg-zinc-50 dark:hover:bg-zinc-700/30 transition-colors">
                            <td className="p-3 text-center font-bold text-zinc-400">{idx + 1}</td>
                            <td className="p-3">
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={editingTagValue}
                                  onChange={(e) => setEditingTagValue(e.target.value)}
                                  className="bg-white dark:bg-zinc-900 border-2 border-black dark:border-white rounded-lg px-2.5 py-1 text-xs font-bold focus:outline-none"
                                  autoFocus
                                />
                              ) : (
                                <span className="inline-block px-3 py-1 bg-yellow-100 dark:bg-yellow-900/40 text-yellow-900 dark:text-yellow-200 border-2 border-black dark:border-white rounded-xl font-bold shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
                                  {tagName}
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-center">
                              <span className="font-bold text-xs px-2.5 py-1 bg-zinc-100 dark:bg-zinc-700 border border-zinc-300 dark:border-zinc-600 rounded-lg">
                                {usageCount} {language === 'th' ? 'ชุด' : 'packs'}
                              </span>
                            </td>
                            <td className="p-3 text-right">
                              {isEditing ? (
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const trimmedNew = editingTagValue.trim();
                                      if (!trimmedNew) {
                                        addToast(t.adminConsole.tags.tagEmptyWarning, 'warning');
                                        return;
                                      }
                                      if (trimmedNew.toLowerCase() !== tagName.toLowerCase() && tags.some(tg => tg.toLowerCase() === trimmedNew.toLowerCase())) {
                                        addToast(t.adminConsole.tags.tagExists, 'warning');
                                        return;
                                      }
                                      setEditingTagName(null);
                                      setEditingTagValue('');
                                      addToast(t.adminConsole.tags.tagUpdated, 'success');
                                      editTag(tagName, trimmedNew);
                                    }}
                                    className="p-1.5 bg-emerald-300 hover:bg-emerald-400 text-black border-2 border-black rounded-lg sketch-btn shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]"
                                    title={t.adminConsole.tags.saveTag}
                                  >
                                    <Check size={14} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingTagName(null);
                                      setEditingTagValue('');
                                    }}
                                    className="p-1.5 bg-zinc-200 dark:bg-zinc-600 border-2 border-black dark:border-white rounded-lg sketch-btn shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]"
                                    title={t.adminConsole.tags.cancelEdit}
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingTagName(tagName);
                                      setEditingTagValue(tagName);
                                    }}
                                    className="p-1.5 bg-yellow-300 hover:bg-yellow-400 text-black border-2 border-black rounded-lg sketch-btn shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]"
                                    title={t.adminConsole.tags.editTag}
                                  >
                                    <Edit2 size={13} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setConfirmModal({
                                        isOpen: true,
                                        title: t.adminConsole.tags.deleteConfirmTitle,
                                        message: t.adminConsole.tags.deleteConfirmMessage.replace('{name}', tagName),
                                        onConfirm: () => {
                                          setConfirmModal(null);
                                          addToast(t.adminConsole.tags.tagDeleted, 'success');
                                          deleteTag(tagName);
                                        },
                                      });
                                    }}
                                    className="p-1.5 bg-red-400 hover:bg-red-500 text-white border-2 border-black rounded-lg sketch-btn shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]"
                                    title={t.adminConsole.tags.deleteTag}
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Gift Codes Tab */}
        {activeTab === 'codes' && (
          <div className="space-y-6">
            {/* Header & Description */}
            <div className="bg-white dark:bg-zinc-800 border-3 border-black dark:border-white rounded-2xl p-4 md:p-6 shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-yellow-400 border-2 border-black flex items-center justify-center text-black shrink-0 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                    <Ticket size={22} />
                  </div>
                  <div>
                    <h2 className="text-base md:text-lg font-black font-['Mali'] text-zinc-900 dark:text-white">
                      {t.adminConsole.codes.title}
                    </h2>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400">
                      {t.adminConsole.codes.subtitle}
                    </p>
                  </div>
                </div>
                <div className="px-3 py-1 bg-yellow-100 dark:bg-yellow-950/60 border-2 border-black dark:border-white rounded-xl text-xs font-bold text-yellow-800 dark:text-yellow-300">
                  {redeemCodes.length} {t.adminConsole.codes.totalCodes}
                </div>
              </div>

              {/* Code Creation Form */}
              <div className="mt-5 p-4 sm:p-5 bg-yellow-50/70 dark:bg-zinc-900/60 border-2 border-black dark:border-zinc-700 rounded-xl space-y-4">
                <div className="text-xs font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <Plus size={14} className="text-yellow-600" />
                  {t.adminConsole.codes.createCodeBtn}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Code String */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                      {t.adminConsole.codes.codeHeader} *
                    </label>
                    <input
                      type="text"
                      value={newCodeString}
                      onChange={(e) => setNewCodeString(e.target.value.toUpperCase())}
                      placeholder={t.adminConsole.codes.newCodePlaceholder}
                      className="w-full px-3 py-2 text-xs md:text-sm font-mono font-bold bg-white dark:bg-zinc-800 border-2 border-black dark:border-white rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400 uppercase"
                    />
                  </div>

                  {/* Reward Type */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                      {t.adminConsole.codes.rewardType}
                    </label>
                    <NeoDropdown<RedeemRewardType>
                      value={newRewardType}
                      onChange={(val) => setNewRewardType(val)}
                      options={[
                        { value: 'coins', label: t.adminConsole.codes.rewardCoins, icon: <Coins size={14} className="text-yellow-500" /> },
                        { value: 'card', label: t.adminConsole.codes.rewardCard, icon: <Sparkles size={14} className="text-amber-500" /> },
                        { value: 'both', label: t.adminConsole.codes.rewardBoth, icon: <Ticket size={14} className="text-yellow-600" /> },
                      ]}
                    />
                  </div>

                  {/* Coins Amount (if coins or both) */}
                  {(newRewardType === 'coins' || newRewardType === 'both') && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center justify-between">
                        <span>{t.adminConsole.codes.coinsAmount} *</span>
                        <div className="flex gap-1">
                          {[500, 1000, 5000].map(amt => (
                            <button
                              key={amt}
                              type="button"
                              onClick={() => setNewCoinsAmount(amt)}
                              className="px-1.5 py-0.5 text-[10px] font-bold bg-zinc-200 dark:bg-zinc-700 hover:bg-yellow-300 hover:text-black rounded border border-black/40"
                            >
                              +{amt}
                            </button>
                          ))}
                        </div>
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min="1"
                          value={newCoinsAmount}
                          onChange={(e) => setNewCoinsAmount(Math.max(1, parseInt(e.target.value) || 0))}
                          className="w-full pl-8 pr-3 py-2 text-xs md:text-sm font-bold bg-white dark:bg-zinc-800 border-2 border-black dark:border-white rounded-xl focus:outline-none"
                        />
                        <Coins size={15} className="absolute left-2.5 top-2.5 text-yellow-500" />
                      </div>
                    </div>
                  )}

                  {/* Card Selector & Live Preview (if card or both) */}
                  {(newRewardType === 'card' || newRewardType === 'both') && (
                    <div className="md:col-span-2 lg:col-span-2 bg-yellow-50/70 dark:bg-zinc-800/70 border-2 border-black dark:border-white rounded-2xl p-3 sm:p-4 space-y-3.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-black/10 dark:border-white/10 pb-2">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1.5 font-black text-xs sm:text-sm font-['Mali'] text-zinc-900 dark:text-white">
                            <Layers size={16} className="text-yellow-500 shrink-0" />
                            <span>{t.adminConsole.codes.rewardCardsTitle}</span>
                          </div>
                          {selectedCardsForCode.length > 0 && (
                            <span className="px-2 py-0.5 text-[11px] font-black bg-yellow-400 text-black rounded-full border border-black shadow-xs">
                              {language === 'th' ? `${selectedCardsForCode.length} ใบ` : `${selectedCardsForCode.length} cards`}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {/* Foil toggle */}
                          <label className="flex items-center gap-2 cursor-pointer select-none px-2.5 py-1 rounded-xl bg-white dark:bg-zinc-800 border-2 border-black dark:border-white shadow-xs hover:bg-yellow-100 dark:hover:bg-zinc-700 transition-colors">
                            <input
                              type="checkbox"
                              checked={isFoilCardReward}
                              onChange={(e) => setIsFoilCardReward(e.target.checked)}
                              className="w-4 h-4 rounded text-yellow-500 focus:ring-0 cursor-pointer"
                            />
                            <Sparkles size={14} className={isFoilCardReward ? 'text-amber-500 animate-pulse' : 'text-zinc-400'} />
                            <span className="text-xs font-black text-zinc-900 dark:text-white">
                              {t.adminConsole.codes.isFoilReward}
                            </span>
                          </label>

                          {/* Select / Add Cards button */}
                          <button
                            type="button"
                            onClick={() => setIsCardPickerModalOpen(true)}
                            className="px-3 py-1 bg-yellow-400 hover:bg-yellow-300 text-black text-xs font-black rounded-xl border-2 border-black dark:border-white shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)] flex items-center gap-1.5 transition-transform active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
                          >
                            <Plus size={14} strokeWidth={2.5} />
                            <span>
                              {selectedCardsForCode.length === 0
                                ? (language === 'th' ? 'เลือกการ์ด' : 'Select Cards')
                                : (language === 'th' ? 'เลือกการ์ดเพิ่ม' : 'Add Cards')}
                            </span>
                          </button>

                          {selectedCardsForCode.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setSelectedCardsForCode([])}
                              className="p-1.5 bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-950/60 dark:text-red-300 rounded-xl border-2 border-black dark:border-white text-xs font-black shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)] cursor-pointer transition-transform active:translate-x-0.5 active:translate-y-0.5"
                              title={language === 'th' ? 'ล้างการ์ดทั้งหมด' : 'Clear all cards'}
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Selected Cards Display */}
                      {selectedCardsForCode.length === 0 ? (
                        <div className="py-5 text-center text-xs font-bold text-zinc-500 dark:text-zinc-400">
                          {language === 'th' ? 'ยังไม่ได้เลือกการ์ด' : 'No cards selected'}
                        </div>
                      ) : selectedCardsForCode.length === 1 ? (
                        /* Single Card Layout */
                        (() => {
                          const sc = selectedCardsForCode[0];
                          const curCard = sc.card;
                          const curPack = sc.pack;
                          const rColor = curPack?.rarities?.find((r) => r.name === curCard.rarity)?.color || '#facc15';
                          const displayName = getCardDisplayName(curCard.name) || curCard.name;

                          return (
                            <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 bg-white/70 dark:bg-zinc-850/70 p-3 sm:p-4 rounded-xl border border-black/20 dark:border-white/20">
                              <div
                                onClick={() => setIsCardPickerModalOpen(true)}
                                className={`w-32 h-44 rounded-xl border-2 border-black dark:border-white bg-zinc-100 dark:bg-zinc-800 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] relative flex-shrink-0 flex items-center justify-center p-1.5 overflow-hidden transition-all group cursor-pointer ${
                                  isFoilCardReward ? 'foil-card ring-2 ring-yellow-400' : ''
                                }`}
                                title={language === 'th' ? 'คลิกเพื่อเปลี่ยนการ์ด' : 'Click to change card'}
                              >
                                <span
                                  className="absolute top-1.5 left-1.5 z-20 px-1.5 py-0.5 text-[9px] font-black rounded border border-black text-black shadow-xs pointer-events-none"
                                  style={{ background: rColor }}
                                >
                                  {curCard.rarity}
                                </span>

                                {isFoilCardReward && (
                                  <span className="absolute top-1.5 right-1.5 z-20 px-1.5 py-0.5 text-[8px] font-black rounded foil-badge flex items-center gap-0.5 shadow-xs pointer-events-none">
                                    <Sparkles size={8} /> FOIL
                                  </span>
                                )}

                                <img
                                  src={curCard.imageUrl}
                                  alt={curCard.name}
                                  draggable={false}
                                  className="max-h-full max-w-full w-auto h-auto object-contain rounded-lg pointer-events-none select-none transition-transform group-hover:scale-105"
                                />

                                <div className="absolute inset-0 bg-black/65 backdrop-blur-[2px] flex flex-col items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-30 text-white">
                                  <Layers size={22} className="text-yellow-400 animate-bounce" />
                                  <span className="text-xs font-black bg-yellow-400 text-black px-2.5 py-1 rounded-lg border border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] font-['Mali']">
                                    {language === 'th' ? 'เปลี่ยนการ์ด' : 'Change Card'}
                                  </span>
                                </div>
                              </div>

                              <div className="flex-1 space-y-2 text-center sm:text-left">
                                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-yellow-200 dark:bg-yellow-900/60 border border-black text-[10px] font-black text-yellow-900 dark:text-yellow-200">
                                  <Sparkles size={11} />
                                  <span>{t.adminConsole.codes.rewardPreviewTitle}</span>
                                </div>
                                <h4 className="text-base sm:text-lg font-black text-zinc-900 dark:text-white leading-tight font-['Mali']">
                                  {displayName}
                                </h4>
                                <p className="text-xs text-zinc-600 dark:text-zinc-400">
                                  <span className="font-bold">{curPack?.franchiseName}</span> · {curPack?.seriesName} · <span className="font-bold" style={{ color: rColor }}>{curCard.rarity}</span> · {isFoilCardReward ? (
                                    <span className="font-black text-amber-600 dark:text-amber-400">
                                      {language === 'th' ? 'เวอร์ชันฟอยล์' : 'Holographic Foil Edition'}
                                    </span>
                                  ) : (
                                    <span className="font-bold text-zinc-500">
                                      {language === 'th' ? 'เวอร์ชันปกติ' : 'Standard Edition'}
                                    </span>
                                  )}
                                </p>
                                <div className="pt-1 flex items-center justify-center sm:justify-start gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setIsCardPickerModalOpen(true)}
                                    className="px-4 py-2 rounded-xl border-2 border-black dark:border-white bg-yellow-400 hover:bg-yellow-300 text-black text-xs font-black flex items-center gap-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-transform active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
                                  >
                                    <Layers size={14} />
                                    <span>{language === 'th' ? 'เปลี่ยนการ์ด' : 'Change Card'}</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })()
                      ) : (
                        /* Multiple Cards Layout */
                        <div className="space-y-2">
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 max-h-[360px] overflow-y-auto p-2.5 bg-white/60 dark:bg-zinc-850/60 rounded-xl border border-black/20 dark:border-white/20">
                            {selectedCardsForCode.map(({ card, pack }, idx) => {
                              const rColor = pack?.rarities?.find((r) => r.name === card.rarity)?.color || '#facc15';
                              const displayName = getCardDisplayName(card.name) || card.name;
                              return (
                                <div
                                  key={`${card.id}_${idx}`}
                                  className={`relative group aspect-[2.5/3.5] rounded-xl border-2 border-black dark:border-white bg-zinc-100 dark:bg-zinc-800 shadow-[2.5px_2.5px_0px_0px_rgba(0,0,0,1)] flex flex-col justify-between overflow-hidden p-1 transition-all hover:scale-[1.02] ${
                                    isFoilCardReward ? 'foil-card ring-2 ring-yellow-400' : ''
                                  }`}
                                >
                                  <span
                                    className="absolute top-1 left-1 z-20 px-1 py-0.2 text-[8px] font-black rounded border border-black text-black pointer-events-none"
                                    style={{ background: rColor }}
                                  >
                                    {card.rarity}
                                  </span>

                                  <button
                                    type="button"
                                    onClick={() => setSelectedCardsForCode((prev) => prev.filter((sc) => sc.card.id !== card.id))}
                                    className="absolute top-1 right-1 z-30 w-5 h-5 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center font-black cursor-pointer shadow-xs transition-transform hover:scale-110"
                                    title={language === 'th' ? 'ลบออก' : 'Remove'}
                                  >
                                    <X size={11} strokeWidth={3} />
                                  </button>

                                  <div className="w-full h-full flex items-center justify-center p-1 overflow-hidden">
                                    <img
                                      src={card.imageUrl}
                                      alt={card.name}
                                      className="max-h-full max-w-full object-contain rounded"
                                    />
                                  </div>

                                  <div className="relative z-10 bg-black/80 px-1 py-1 text-center border-t border-black/20">
                                    <p className="text-[10px] font-black text-white truncate leading-tight">
                                      {displayName}
                                    </p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Expiration Settings */}
                  <div className="space-y-1.5 md:col-span-2 lg:col-span-2">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={enableExpiry}
                          onChange={(e) => {
                            setEnableExpiry(e.target.checked);
                            if (e.target.checked && !expiryDateTime) {
                              const d = new Date(Date.now() + 7 * 24 * 3600 * 1000);
                              setExpiryDateTime(d.toISOString().slice(0, 16));
                            }
                          }}
                          className="w-4 h-4 rounded text-yellow-500 focus:ring-0 cursor-pointer"
                        />
                        <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                          {t.adminConsole.codes.enableExpiry}
                        </span>
                      </label>

                      {enableExpiry && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              const d = new Date(Date.now() + 24 * 3600 * 1000);
                              setExpiryDateTime(d.toISOString().slice(0, 16));
                            }}
                            className="px-1.5 py-0.5 text-[10px] font-bold bg-zinc-200 dark:bg-zinc-700 hover:bg-yellow-300 hover:text-black rounded border border-black/40"
                          >
                            +24h
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const d = new Date(Date.now() + 7 * 24 * 3600 * 1000);
                              setExpiryDateTime(d.toISOString().slice(0, 16));
                            }}
                            className="px-1.5 py-0.5 text-[10px] font-bold bg-zinc-200 dark:bg-zinc-700 hover:bg-yellow-300 hover:text-black rounded border border-black/40"
                          >
                            +7d
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const d = new Date(Date.now() + 30 * 24 * 3600 * 1000);
                              setExpiryDateTime(d.toISOString().slice(0, 16));
                            }}
                            className="px-1.5 py-0.5 text-[10px] font-bold bg-zinc-200 dark:bg-zinc-700 hover:bg-yellow-300 hover:text-black rounded border border-black/40"
                          >
                            +30d
                          </button>
                        </div>
                      )}
                    </div>

                    {enableExpiry && (
                      <div className="relative">
                        <NeoDateTimePicker
                          value={expiryDateTime}
                          onChange={setExpiryDateTime}
                          language={language}
                          placeholder={t.adminConsole.codes.expiryDateTime}
                        />
                      </div>
                    )}
                  </div>

                  {/* Max claims */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                      {t.adminConsole.codes.maxClaims}
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={maxClaimsInput}
                      onChange={(e) => setMaxClaimsInput(e.target.value)}
                      placeholder="∞ (ไม่จำกัด)"
                      className="w-full px-3 py-2 text-xs md:text-sm font-bold bg-white dark:bg-zinc-800 border-2 border-black dark:border-white rounded-xl focus:outline-none"
                    />
                  </div>
                </div>

                {/* Submit Add Code Button */}
                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      const codeClean = newCodeString.trim().toUpperCase();
                      if (!codeClean) {
                        addToast(t.adminConsole.codes.codeEmptyWarning, 'warning');
                        return;
                      }
                      if (redeemCodes.some(c => c.code.trim().toUpperCase() === codeClean)) {
                        addToast(t.adminConsole.codes.codeExists, 'error');
                        return;
                      }
                      if ((newRewardType === 'coins' || newRewardType === 'both') && (!newCoinsAmount || newCoinsAmount <= 0)) {
                        addToast(language === 'th' ? 'กรุณาระบุจำนวนเหรียญที่มากกว่า 0' : 'Coins amount must be greater than 0', 'warning');
                        return;
                      }

                      const cardsToReward = (newRewardType === 'card' || newRewardType === 'both')
                        ? selectedCardsForCode.map(sc => ({
                            packId: sc.pack.id,
                            cardId: sc.card.id,
                            cardName: sc.card.name,
                            cardImageUrl: sc.card.imageUrl,
                            rarity: sc.card.rarity,
                            isFoil: isFoilCardReward,
                          }))
                        : [];

                      if ((newRewardType === 'card' || newRewardType === 'both') && cardsToReward.length === 0) {
                        addToast(language === 'th' ? 'กรุณาเลือกการ์ดของรางวัลอย่างน้อย 1 ใบ' : 'Please select at least 1 reward card', 'warning');
                        return;
                      }

                      const maxUsesNum = maxClaimsInput.trim() ? parseInt(maxClaimsInput.trim(), 10) : null;

                      addRedeemCode({
                        code: codeClean,
                        rewardType: newRewardType,
                        coinsAmount: (newRewardType === 'coins' || newRewardType === 'both') ? Number(newCoinsAmount) : undefined,
                        cardReward: cardsToReward[0],
                        cardRewards: cardsToReward,
                        expiresAt: enableExpiry && expiryDateTime ? new Date(expiryDateTime).toISOString() : null,
                        isActive: true,
                        maxUses: maxUsesNum && !isNaN(maxUsesNum) && maxUsesNum > 0 ? maxUsesNum : null,
                      });

                      setNewCodeString('');
                      setMaxClaimsInput('');
                      setEnableExpiry(false);
                      setExpiryDateTime('');
                    }}
                    className="px-5 py-2.5 bg-yellow-400 hover:bg-yellow-300 text-black font-bold text-xs md:text-sm border-2 border-black rounded-xl sketch-btn shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] flex items-center gap-2"
                  >
                    <Plus size={16} />
                    {t.adminConsole.codes.createCodeBtn}
                  </button>
                </div>
              </div>

              {/* Codes Search & List Table */}
              <div className="mt-6 space-y-3">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <div className="relative flex-1 max-w-sm">
                    <Search size={15} className="absolute left-3 top-3 text-zinc-400" />
                    <input
                      type="text"
                      value={codeSearchQuery}
                      onChange={(e) => setCodeSearchQuery(e.target.value)}
                      placeholder={t.adminConsole.codes.searchPlaceholder}
                      className="w-full pl-9 pr-3 py-2 text-xs font-bold bg-zinc-100 dark:bg-zinc-700 border-2 border-black dark:border-white rounded-xl focus:outline-none"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto border-2 border-black dark:border-white rounded-xl shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 border-b-2 border-black dark:border-white font-black">
                      <tr>
                        <th className="p-3">{t.adminConsole.codes.codeHeader}</th>
                        <th className="p-3">{t.adminConsole.codes.rewardHeader}</th>
                        <th className="p-3">{t.adminConsole.codes.expiryHeader}</th>
                        <th className="p-3">{t.adminConsole.codes.usageHeader}</th>
                        <th className="p-3 text-center">{t.adminConsole.codes.statusHeader}</th>
                        <th className="p-3 text-right">{t.adminConsole.codes.actionsHeader}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y-2 divide-zinc-200 dark:divide-zinc-700 bg-white dark:bg-zinc-800 font-bold">
                      {redeemCodes
                        .filter(c => {
                          const q = codeSearchQuery.trim().toLowerCase();
                          if (!q) return true;
                          return (
                            c.code.toLowerCase().includes(q) ||
                            (c.cardReward?.cardName.toLowerCase().includes(q)) ||
                            (c.cardRewards?.some(cr => cr.cardName.toLowerCase().includes(q)))
                          );
                        })
                        .map(item => {
                          const isExpired = item.expiresAt ? Date.now() > new Date(item.expiresAt).getTime() : false;
                          return (
                            <tr key={item.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors">
                              {/* Code */}
                              <td className="p-3">
                                <span className="inline-block px-2.5 py-1 font-mono font-black text-xs md:text-sm bg-yellow-200 dark:bg-yellow-900/50 text-yellow-950 dark:text-yellow-200 border border-black dark:border-white rounded-lg">
                                  {item.code}
                                </span>
                              </td>

                              {/* Reward */}
                              <td className="p-3">
                                <div className="flex flex-col gap-1">
                                  {item.coinsAmount && item.coinsAmount > 0 ? (
                                    <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-black">
                                      <Coins size={14} />
                                      <span>+{item.coinsAmount.toLocaleString()} Coins</span>
                                    </div>
                                  ) : null}

                                  {/* Card Reward(s) */}
                                  {(() => {
                                    const codeCards = (item.cardRewards && item.cardRewards.length > 0)
                                      ? item.cardRewards
                                      : (item.cardReward ? [item.cardReward] : []);

                                    if (codeCards.length === 0) return null;

                                    if (codeCards.length === 1) {
                                      const singleCard = codeCards[0];
                                      return (
                                        <div className="flex items-center gap-2">
                                          {singleCard.cardImageUrl && (
                                            <img
                                              src={singleCard.cardImageUrl}
                                              alt={singleCard.cardName}
                                              className="w-7 h-9 object-cover rounded border border-black dark:border-white shrink-0 cursor-pointer"
                                              onClick={() => setPreviewImage({ url: singleCard.cardImageUrl, title: singleCard.cardName })}
                                            />
                                          )}
                                          <div className="flex flex-col">
                                            <span className="font-bold text-zinc-900 dark:text-white truncate max-w-[140px] sm:max-w-[200px]">
                                              {singleCard.cardName}
                                            </span>
                                            <div className="flex items-center gap-1">
                                              <span className="text-[10px] px-1 py-0.2 bg-zinc-200 dark:bg-zinc-700 rounded font-black">
                                                {singleCard.rarity}
                                              </span>
                                              {singleCard.isFoil && (
                                                <span className="text-[10px] px-1.5 py-0.2 bg-amber-400 text-black font-black rounded border border-black flex items-center gap-0.5">
                                                  <Sparkles size={10} /> Foil
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    }

                                    return (
                                      <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-1.5">
                                          <div className="flex -space-x-3 overflow-hidden py-0.5">
                                            {codeCards.slice(0, 4).map((c, idx) => (
                                              <img
                                                key={idx}
                                                src={c.cardImageUrl}
                                                alt={c.cardName}
                                                title={`${c.cardName} (${c.rarity})`}
                                                className="inline-block w-7 h-9 object-cover rounded border-2 border-black dark:border-white shadow-xs cursor-pointer hover:z-10 hover:scale-110 transition-transform"
                                                onClick={() => setPreviewImage({ url: c.cardImageUrl, title: c.cardName })}
                                              />
                                            ))}
                                          </div>
                                          <span className="text-[10px] font-black px-1.5 py-0.2 bg-yellow-400 text-black rounded border border-black shadow-xs">
                                            {language === 'th' ? `${codeCards.length} ใบ` : `${codeCards.length} cards`}
                                          </span>
                                        </div>
                                        <span className="text-[10px] text-zinc-600 dark:text-zinc-400 truncate max-w-[180px]">
                                          {codeCards.map(c => c.cardName).join(', ')}
                                        </span>
                                      </div>
                                    );
                                  })()}
                                </div>
                              </td>

                              {/* Expiry */}
                              <td className="p-3">
                                {item.expiresAt ? (
                                  <div className="flex flex-col">
                                    {isExpired ? (
                                      <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400 font-black">
                                        <Clock size={12} />
                                        {t.adminConsole.codes.expired}
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
                                        <Calendar size={12} />
                                        {new Date(item.expiresAt).toLocaleDateString()} {new Date(item.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-zinc-400 font-medium">
                                    {t.adminConsole.codes.noExpiry}
                                  </span>
                                )}
                              </td>

                              {/* Usage */}
                              <td className="p-3">
                                <span className="font-mono">
                                  {item.usedCount || 0} / {item.maxUses ? item.maxUses : '∞'}
                                </span>
                              </td>

                              {/* Status Toggle */}
                              <td className="p-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => toggleRedeemCodeActive(item.id)}
                                  className={`px-2.5 py-1 text-[11px] font-black rounded-lg border border-black sketch-btn shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] ${
                                    item.isActive
                                      ? 'bg-emerald-300 hover:bg-emerald-400 text-emerald-950'
                                      : 'bg-zinc-300 hover:bg-zinc-400 text-zinc-800'
                                  }`}
                                >
                                  {item.isActive ? t.adminConsole.codes.active : t.adminConsole.codes.disabled}
                                </button>
                              </td>

                              {/* Actions */}
                              <td className="p-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setConfirmModal({
                                      isOpen: true,
                                      title: t.adminConsole.codes.deleteConfirmTitle,
                                      message: t.adminConsole.codes.deleteConfirmMessage.replace('{code}', item.code),
                                      onConfirm: () => {
                                        setConfirmModal(null);
                                        deleteRedeemCode(item.id);
                                      },
                                    });
                                  }}
                                  className="p-1.5 bg-red-400 hover:bg-red-500 text-white border-2 border-black rounded-lg sketch-btn shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]"
                                  title={t.common.delete}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      {redeemCodes.length === 0 && (
                        <tr>
                          <td colSpan={6} className="p-6 text-center text-zinc-500 font-medium">
                            {t.adminConsole.codes.noCodesFound}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 8: เคลียร์ข้อมูล (SYSTEM RESET TAB)
           ======================================================== */}
        {activeTab === 'reset' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Header & Description */}
            <div className="bg-white dark:bg-zinc-800 border-3 border-black dark:border-white rounded-2xl p-4 md:p-6 shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-950/60 border-2 border-black dark:border-white flex items-center justify-center text-red-600 dark:text-red-400 shrink-0 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                    <RotateCcw size={22} />
                  </div>
                  <div>
                    <h2 className="text-base md:text-lg font-black font-['Mali'] text-zinc-900 dark:text-white">
                      {t.adminConsole.reset.title}
                    </h2>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400">
                      {t.adminConsole.reset.subtitle}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 bg-red-100 dark:bg-red-950/60 border-2 border-black dark:border-white rounded-xl text-xs font-bold text-red-700 dark:text-red-300">
                    {selectedClearCount} {t.adminConsole.reset.clearCountSuffix}
                  </span>
                </div>
              </div>

              {/* Safety Warning Banner */}
              <div className="mt-4 p-3.5 bg-red-50 dark:bg-red-950/30 border-2 border-red-500 rounded-xl flex items-start gap-3">
                <AlertTriangle size={18} className="text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                <div className="text-xs space-y-0.5">
                  <span className="font-black text-red-700 dark:text-red-300 block">
                    {t.adminConsole.reset.warningTitle}
                  </span>
                  <p className="text-red-600 dark:text-red-400 font-medium leading-relaxed">
                    {t.adminConsole.reset.warningDesc}
                  </p>
                </div>
              </div>
            </div>

            {/* Clear All System Highlight Option */}
            <div
              onClick={() => handleToggleClearAllSystem(!clearAllSystemCheck)}
              className={`border-3 rounded-2xl p-4 sm:p-5 transition-all cursor-pointer select-none sketch-btn ${
                clearAllSystemCheck
                  ? 'border-red-600 bg-red-50 dark:bg-red-950/50 shadow-[4px_4px_0px_0px_rgba(220,38,38,1)]'
                  : 'border-black dark:border-white bg-white dark:bg-zinc-800 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-zinc-50 dark:hover:bg-zinc-750'
              }`}
            >
              <div className="flex items-start gap-3.5">
                <div
                  className={`w-6 h-6 rounded-lg border-2 border-black dark:border-white flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                    clearAllSystemCheck
                      ? 'bg-red-600 text-white'
                      : 'bg-white dark:bg-zinc-900 text-transparent'
                  }`}
                >
                  <Check size={16} strokeWidth={3} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm sm:text-base font-black text-red-600 dark:text-red-400 font-['Mali']">
                      {t.adminConsole.reset.itemSystemAll}
                    </h3>
                    <span className="text-[10px] font-black px-2 py-0.5 bg-red-600 text-white rounded-full">
                      {language === 'th' ? 'รีเซ็ตทั้งหมด' : 'Factory Reset'}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
                    {t.adminConsole.reset.itemSystemAllDesc}
                  </p>
                </div>
              </div>
            </div>

            {/* Individual Clearance Options List */}
            <div className="bg-white dark:bg-zinc-800 border-3 border-black dark:border-white rounded-2xl p-4 md:p-6 shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] space-y-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                {language === 'th' ? 'เลือกรายการที่ต้องการเคลียร์เฉพาะส่วน' : 'Selective Data Clearance Items'}
              </h3>

              <div className="space-y-3">
                {/* 1. Clear User Cards */}
                <div className={`border-2 rounded-xl p-3.5 transition-all ${
                  clearUserCardsCheck
                    ? 'border-black dark:border-white bg-yellow-50 dark:bg-zinc-900/80 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                    : 'border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-850/50'
                }`}>
                  <div
                    onClick={() => handleToggleUserCards(!clearUserCardsCheck)}
                    className="flex items-start gap-3 cursor-pointer select-none"
                  >
                    <div
                      className={`w-5 h-5 rounded-md border-2 border-black dark:border-white flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                        clearUserCardsCheck
                          ? 'bg-yellow-400 text-black'
                          : 'bg-white dark:bg-zinc-900 text-transparent'
                      }`}
                    >
                      <Check size={14} strokeWidth={3} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Layers size={14} className="text-zinc-700 dark:text-zinc-300" />
                        <span className="text-xs sm:text-sm font-black text-zinc-900 dark:text-white font-['Mali']">
                          {t.adminConsole.reset.itemUserCards}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                        {t.adminConsole.reset.itemUserCardsDesc}
                      </p>
                    </div>
                  </div>

                  {/* Sub-options for User Cards Scope */}
                  {clearUserCardsCheck && (
                    <div className="mt-3 pl-8 pt-3 border-t border-black/10 dark:border-white/10 space-y-2.5 animate-in fade-in">
                      <div className="flex items-center gap-4 text-xs font-bold text-zinc-800 dark:text-zinc-200">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name="userCardScope"
                            value="all"
                            checked={userCardScope === 'all'}
                            onChange={() => setUserCardScope('all')}
                            className="w-3.5 h-3.5 accent-yellow-500"
                          />
                          <Users size={13} className="text-zinc-600 dark:text-zinc-400" />
                          <span>{t.adminConsole.reset.scopeAllUsers}</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name="userCardScope"
                            value="specific"
                            checked={userCardScope === 'specific'}
                            onChange={() => setUserCardScope('specific')}
                            className="w-3.5 h-3.5 accent-yellow-500"
                          />
                          <User size={13} className="text-zinc-600 dark:text-zinc-400" />
                          <span>{t.adminConsole.reset.scopeSpecificUser}</span>
                        </label>
                      </div>

                      {userCardScope === 'specific' && (
                        <div className="pt-1 max-w-md">
                          <NeoDropdown<string>
                            value={selectedUserToClear}
                            onChange={(val) => setSelectedUserToClear(val)}
                            options={memberDropdownOptions}
                            placeholder={t.adminConsole.reset.selectUserPlaceholder}
                            size="sm"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 2. Reset Coins to Default */}
                <div
                  onClick={() => handleToggleCoins(!clearCoinsCheck)}
                  className={`border-2 rounded-xl p-3.5 transition-all cursor-pointer select-none ${
                    clearCoinsCheck
                      ? 'border-black dark:border-white bg-yellow-50 dark:bg-zinc-900/80 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                      : 'border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-850/50 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-5 h-5 rounded-md border-2 border-black dark:border-white flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                        clearCoinsCheck
                          ? 'bg-yellow-400 text-black'
                          : 'bg-white dark:bg-zinc-900 text-transparent'
                      }`}
                    >
                      <Check size={14} strokeWidth={3} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Coins size={14} className="text-amber-500" />
                        <span className="text-xs sm:text-sm font-black text-zinc-900 dark:text-white font-['Mali']">
                          {t.adminConsole.reset.itemCoins}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                        {t.adminConsole.reset.itemCoinsDesc}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 3. Clear All Cards in System */}
                <div
                  onClick={() => handleToggleCardsSystem(!clearCardsSystemCheck)}
                  className={`border-2 rounded-xl p-3.5 transition-all cursor-pointer select-none ${
                    clearCardsSystemCheck
                      ? 'border-black dark:border-white bg-yellow-50 dark:bg-zinc-900/80 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                      : 'border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-850/50 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-5 h-5 rounded-md border-2 border-black dark:border-white flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                        clearCardsSystemCheck
                          ? 'bg-yellow-400 text-black'
                          : 'bg-white dark:bg-zinc-900 text-transparent'
                      }`}
                    >
                      <Check size={14} strokeWidth={3} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Trash2 size={14} className="text-red-500" />
                        <span className="text-xs sm:text-sm font-black text-zinc-900 dark:text-white font-['Mali']">
                          {t.adminConsole.reset.itemCardsSystem}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                        {t.adminConsole.reset.itemCardsSystemDesc}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 4. Clear All Tags */}
                <div
                  onClick={() => handleToggleTags(!clearTagsCheck)}
                  className={`border-2 rounded-xl p-3.5 transition-all cursor-pointer select-none ${
                    clearTagsCheck
                      ? 'border-black dark:border-white bg-yellow-50 dark:bg-zinc-900/80 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                      : 'border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-850/50 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-5 h-5 rounded-md border-2 border-black dark:border-white flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                        clearTagsCheck
                          ? 'bg-yellow-400 text-black'
                          : 'bg-white dark:bg-zinc-900 text-transparent'
                      }`}
                    >
                      <Check size={14} strokeWidth={3} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Tag size={14} className="text-blue-500" />
                        <span className="text-xs sm:text-sm font-black text-zinc-900 dark:text-white font-['Mali']">
                          {t.adminConsole.reset.itemTags}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                        {t.adminConsole.reset.itemTagsDesc}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 5. Clear All Reports */}
                <div
                  onClick={() => handleToggleReports(!clearReportsCheck)}
                  className={`border-2 rounded-xl p-3.5 transition-all cursor-pointer select-none ${
                    clearReportsCheck
                      ? 'border-black dark:border-white bg-yellow-50 dark:bg-zinc-900/80 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                      : 'border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-850/50 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-5 h-5 rounded-md border-2 border-black dark:border-white flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                        clearReportsCheck
                          ? 'bg-yellow-400 text-black'
                          : 'bg-white dark:bg-zinc-900 text-transparent'
                      }`}
                    >
                      <Check size={14} strokeWidth={3} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Flag size={14} className="text-orange-500" />
                        <span className="text-xs sm:text-sm font-black text-zinc-900 dark:text-white font-['Mali']">
                          {t.adminConsole.reset.itemReports}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                        {t.adminConsole.reset.itemReportsDesc}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 6. Clear Marketplace */}
                <div
                  onClick={() => handleToggleMarket(!clearMarketCheck)}
                  className={`border-2 rounded-xl p-3.5 transition-all cursor-pointer select-none ${
                    clearMarketCheck
                      ? 'border-black dark:border-white bg-yellow-50 dark:bg-zinc-900/80 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                      : 'border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-850/50 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-5 h-5 rounded-md border-2 border-black dark:border-white flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                        clearMarketCheck
                          ? 'bg-yellow-400 text-black'
                          : 'bg-white dark:bg-zinc-900 text-transparent'
                      }`}
                    >
                      <Check size={14} strokeWidth={3} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <ShoppingBag size={14} className="text-emerald-500" />
                        <span className="text-xs sm:text-sm font-black text-zinc-900 dark:text-white font-['Mali']">
                          {t.adminConsole.reset.itemMarket}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                        {t.adminConsole.reset.itemMarketDesc}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Action Bar */}
              <div className="pt-4 border-t-2 border-black/10 dark:border-white/10 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400">
                    {language === 'th' ? 'เลือกแล้ว:' : 'Selected:'}
                  </span>
                  <span className="px-2.5 py-0.5 text-xs font-black rounded-lg border border-black dark:border-white bg-yellow-300 dark:bg-yellow-400 text-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
                    {selectedClearCount} {t.adminConsole.reset.clearCountSuffix}
                  </span>
                  {selectedClearCount > 0 && (
                    <button
                      type="button"
                      onClick={handleDeselectAllClear}
                      className="text-xs font-bold text-zinc-500 hover:text-black dark:hover:text-white underline ml-2 cursor-pointer"
                    >
                      {t.adminConsole.reset.deselectAllBtn}
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleOpenClearConfirmModal}
                  disabled={selectedClearCount === 0}
                  className={`px-5 py-2.5 rounded-xl border-2 border-black dark:border-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    selectedClearCount > 0
                      ? 'bg-red-500 hover:bg-red-600 text-white sketch-btn shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5'
                      : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-400 dark:text-zinc-500 border-zinc-300 dark:border-zinc-600 cursor-not-allowed shadow-none'
                  }`}
                >
                  <RotateCcw size={16} />
                  <span>{t.adminConsole.reset.executeClearBtn}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bulk Add Field Modal */}
      {isBulkFieldModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-sm bg-white dark:bg-zinc-800 border-3 border-black dark:border-white rounded-2xl p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] space-y-4">
            <h3 className="text-sm font-bold font-['Mali']">{t.adminConsole.sections.addBulkModalTitle}</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold block mb-1">{t.adminConsole.sections.bulkFieldNameLabel}</label>
                <input
                  type="text"
                  value={bulkFieldName}
                  onChange={(e) => setBulkFieldName(e.target.value)}
                  placeholder={t.adminConsole.sections.bulkFieldNamePlaceholder}
                  className="w-full px-3 py-2 text-xs font-bold bg-zinc-100 dark:bg-zinc-700 border-2 border-black dark:border-white rounded-xl focus:outline-none"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs font-bold block mb-1">{t.adminConsole.sections.bulkFieldDefaultLabel}</label>
                <input
                  type="text"
                  value={bulkFieldValue}
                  onChange={(e) => setBulkFieldValue(e.target.value)}
                  placeholder={t.adminConsole.sections.bulkFieldDefaultPlaceholder}
                  className="w-full px-3 py-2 text-xs font-bold bg-zinc-100 dark:bg-zinc-700 border-2 border-black dark:border-white rounded-xl focus:outline-none"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsBulkFieldModalOpen(false)}
                className="px-3 py-1.5 text-xs font-bold rounded-xl border border-black bg-zinc-200 hover:bg-zinc-300 text-zinc-800"
              >
                {t.common.cancel}
              </button>
              <button
                type="button"
                onClick={handleAddFieldToAllCards}
                className="px-4 py-1.5 text-xs font-bold rounded-xl border-2 border-black bg-yellow-400 hover:bg-yellow-300 text-black sketch-btn shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
              >
                {t.adminConsole.sections.addBulkSubmit}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Point 2: Custom Confirmation Modal */}
      {confirmModal && (
        <ConfirmModal
          isOpen={confirmModal.isOpen}
          title={confirmModal.title}
          message={confirmModal.message}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(null)}
        />
      )}



      {/* DUPLICATE CARD NAMES CONFIRMATION MODAL (Requirement: ยกเลิกการบันทึก / บันทึกทับ) */}
      {duplicateCardNameModal?.isOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-800 border-3 border-black dark:border-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,0.9)] space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 border-b-2 border-black dark:border-white pb-4">
              <div className="p-2.5 bg-yellow-400 border-2 border-black rounded-xl text-black">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black font-['Mali'] text-zinc-900 dark:text-white">
                  {language === 'th' ? 'พบการ์ดที่มีชื่อซ้ำกันในชุดนี้' : 'Duplicate Card Names Detected'}
                </h3>
                <p className="text-xs text-zinc-600 dark:text-zinc-400">
                  {language === 'th'
                    ? `พบชื่อการ์ดซ้ำทั้งหมด ${duplicateCardNameModal.duplicateGroups.size} รายการ`
                    : `Found ${duplicateCardNameModal.duplicateGroups.size} duplicate card name group(s)`}
                </p>
              </div>
            </div>

            <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
              {language === 'th'
                ? 'ระบบตรวจพบการ์ดที่มีชื่อซ้ำกัน หากท่านเลือก "บันทึกทับ" ข้อมูลการ์ดทุกใบจะถูกเก็บรักษาไว้อย่างครบถ้วน 100% โดยในฐานข้อมูลจะบันทึกแบบแบ่งดัชนี (-1, -2, ...) แต่ระบบจะแสดงผลเฉพาะชื่อแรกของการ์ดเสมอ ท่านต้องการยกเลิกการบันทึก หรือบันทึกทับ?'
                : 'Duplicate card names detected. If you choose "Overwrite & Save", all cards are preserved 100% with indexed database keys (-1, -2, ...) while displaying only the clean original name in the app. Do you want to cancel or overwrite?'}
            </p>

            {/* Preview of duplicate cards */}
            <div className="max-h-48 overflow-y-auto space-y-2 p-2 border-2 border-zinc-200 dark:border-zinc-700 rounded-xl bg-zinc-50 dark:bg-zinc-900/50">
              {Array.from(duplicateCardNameModal.duplicateGroups.entries()).map(([cleanKey, groupCards]) => (
                <div key={cleanKey} className="p-2 bg-white dark:bg-zinc-800 border border-black dark:border-zinc-600 rounded-lg flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold">{getCardDisplayName(groupCards[0]?.name)}</span>
                    <span className="text-[10px] px-1.5 py-0.5 bg-yellow-200 dark:bg-yellow-900/60 text-black dark:text-yellow-200 border border-black dark:border-yellow-400 rounded">
                      {groupCards.length} {language === 'th' ? 'ใบ' : 'cards'}
                    </span>
                  </div>
                  <div className="flex -space-x-2 overflow-hidden">
                    {groupCards.slice(0, 4).map((c, i) => (
                      <img
                        key={c.id || i}
                        src={c.imageUrl}
                        alt={c.name}
                        className="w-7 h-7 object-cover rounded-full border border-black bg-white"
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t-2 border-dashed border-zinc-200 dark:border-zinc-700">
              <button
                type="button"
                onClick={() => setDuplicateCardNameModal(null)}
                className="px-4 py-2 text-xs font-bold border-2 border-black dark:border-white rounded-xl bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 sketch-btn shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
              >
                {language === 'th' ? 'ยกเลิกการบันทึก' : 'Cancel Save'}
              </button>
              <button
                type="button"
                onClick={async () => {
                  setDuplicateCardNameModal(null);
                  await handleSavePackChanges();
                }}
                className="px-5 py-2 text-xs font-black border-2 border-black dark:border-white rounded-xl bg-yellow-400 hover:bg-yellow-300 text-black sketch-btn shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
              >
                {language === 'th' ? 'บันทึกทับ' : 'Overwrite & Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Data Clearance */}
      {isClearConfirmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-lg bg-white dark:bg-zinc-800 border-3 border-black dark:border-white rounded-2xl p-5 sm:p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] space-y-4 animate-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-950/60 border-2 border-black dark:border-white flex items-center justify-center text-red-600 dark:text-red-400 shrink-0 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                <AlertOctagon size={22} />
              </div>
              <div>
                <h3 className="text-base font-black font-['Mali'] text-zinc-900 dark:text-white">
                  {t.adminConsole.reset.confirmModalTitle}
                </h3>
                <p className="text-xs text-zinc-600 dark:text-zinc-400">
                  {t.adminConsole.reset.confirmModalDesc}
                </p>
              </div>
            </div>

            {/* List of items that will be cleared */}
            <div className="p-3 bg-red-50 dark:bg-zinc-900/70 border-2 border-red-300 dark:border-red-900 rounded-xl space-y-2 text-xs">
              <span className="font-black text-red-800 dark:text-red-300 block">
                {language === 'th' ? 'รายการข้อมูลที่จะถูกลบหรือรีเซ็ต:' : 'Items to be cleared or reset:'}
              </span>
              <ul className="space-y-1.5 pl-1">
                {clearAllSystemCheck && (
                  <li className="font-black text-red-600 dark:text-red-400 flex items-center gap-1.5">
                    <Check size={14} className="text-red-600 dark:text-red-400 shrink-0" />
                    <span>{t.adminConsole.reset.itemSystemAll} ({language === 'th' ? 'ทุกหมวดหมู่ทั้งหมด' : 'All Categories'})</span>
                  </li>
                )}
                {clearUserCardsCheck && (
                  <li className="font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                    <Check size={14} className="text-amber-500 shrink-0" />
                    <span>
                      {t.adminConsole.reset.itemUserCards}: {userCardScope === 'specific' ? (
                        <span className="font-black text-red-600 dark:text-red-400">
                          {language === 'th' ? 'เฉพาะคน' : 'Specific User'} ({members.find(m => m.id === selectedUserToClear)?.username || selectedUserToClear})
                        </span>
                      ) : (
                        <span className="font-black">
                          {language === 'th' ? 'ทุกคน' : 'All Users'}
                        </span>
                      )}
                    </span>
                  </li>
                )}
                {clearCoinsCheck && (
                  <li className="font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                    <Check size={14} className="text-amber-500 shrink-0" />
                    <span>{t.adminConsole.reset.itemCoins} (5,000)</span>
                  </li>
                )}
                {clearCardsSystemCheck && (
                  <li className="font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                    <Check size={14} className="text-amber-500 shrink-0" />
                    <span>{t.adminConsole.reset.itemCardsSystem}</span>
                  </li>
                )}
                {clearTagsCheck && (
                  <li className="font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                    <Check size={14} className="text-amber-500 shrink-0" />
                    <span>{t.adminConsole.reset.itemTags}</span>
                  </li>
                )}
                {clearReportsCheck && (
                  <li className="font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                    <Check size={14} className="text-amber-500 shrink-0" />
                    <span>{t.adminConsole.reset.itemReports}</span>
                  </li>
                )}
                {clearMarketCheck && (
                  <li className="font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                    <Check size={14} className="text-amber-500 shrink-0" />
                    <span>{t.adminConsole.reset.itemMarket}</span>
                  </li>
                )}
              </ul>
            </div>

            {/* Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={isClearingInProgress}
                onClick={() => setIsClearConfirmModalOpen(false)}
                className="px-4 py-2 text-xs sm:text-sm font-bold rounded-xl border-2 border-black dark:border-white bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 text-zinc-800 dark:text-zinc-200 cursor-pointer sketch-btn"
              >
                {t.adminConsole.reset.confirmModalCancelBtn}
              </button>
              <button
                type="button"
                disabled={isClearingInProgress}
                onClick={handleExecuteClear}
                className="px-5 py-2 text-xs sm:text-sm font-black rounded-xl border-2 border-black dark:border-white bg-red-500 hover:bg-red-600 text-white sketch-btn shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isClearingInProgress ? (
                  <>
                    <RotateCcw size={14} className="animate-spin" />
                    <span>{language === 'th' ? 'กำลังเคลียร์...' : 'Clearing...'}</span>
                  </>
                ) : (
                  <>
                    <RotateCcw size={14} />
                    <span>{t.adminConsole.reset.confirmModalConfirmBtn}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Card Picker Modal */}
      <CardPickerModal
        isOpen={isCardPickerModalOpen}
        onClose={() => setIsCardPickerModalOpen(false)}
        packs={packs}
        selectedPackId={selectedCardsForCode[0]?.pack.id || packs[0]?.id || ''}
        initialSelectedCards={selectedCardsForCode}
        onConfirmSelection={(newSelectedList) => {
          setSelectedCardsForCode(newSelectedList);
        }}
        language={language}
        isFoilPreview={isFoilCardReward}
      />

      {/* Modern Lightbox (Wheel Zoom, Touch Pinch, Drag-to-Pan, Zero Scrollbars) */}
      <ModernImageLightbox
        isOpen={Boolean(previewImage)}
        imageUrl={previewImage?.url || ''}
        title={previewImage?.title}
        onClose={() => setPreviewImage(null)}
      />

      {/* Card Parity Drawer */}
      {packDraft && (
        <CardParityDrawer
          isOpen={isParityDrawerOpen}
          onOpen={() => setIsParityDrawerOpen(true)}
          onClose={() => setIsParityDrawerOpen(false)}
          allRarities={packDraft.rarities || []}
          allCards={packDraft.cards || []}
          selectedRarities={selectedParityRarities}
          onToggleRarity={handleToggleParityRarity}
          onClearSelection={handleClearParitySelection}
          language={language}
        />
      )}
    </div>
  );
};
