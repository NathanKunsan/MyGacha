import React, { useState, useEffect, useRef } from 'react';
import { useGacha } from '../context/GachaContext';
import { isMainAdmin } from '../utils/admin';
import { supabase, isSupabaseConfigured, fetchRemoteRoles } from '../lib/supabase';
import { PackSeries, CardItem, CardRarity, CardField, PackTearConfig } from '../types';
import { PackCoverConfigurator } from './PackCoverConfigurator';
import { ConfirmModal } from './ConfirmModal';
import { ModernImageLightbox } from './ModernImageLightbox';
import { NeoColorPicker } from './NeoColorPicker';
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
} from 'lucide-react';
import { ContentReport } from '../types';
import { getTranslation } from '../i18n/translations';

type AdminTab = 'queue' | 'reports' | 'members' | 'stats' | 'chat' | 'tags';

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
  } = useGacha();

  const t = getTranslation(language);

  // Active Admin Tab
  const [activeTab, setActiveTab] = useState<AdminTab>('queue');

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
  const [isEditingFranchise, setIsEditingFranchise] = useState(false);
  const [isEditingSeries, setIsEditingSeries] = useState(false);

  // Section 2: Rarities edit mode
  const [editingRarityId, setEditingRarityId] = useState<string | null>(null);
  const [rarityEditName, setRarityEditName] = useState('');
  const [rarityEditColor, setRarityEditColor] = useState('');
  const [rarityEditCount, setRarityEditCount] = useState<number>(0);
  const [rarityEditConfetti, setRarityEditConfetti] = useState(false);

  // Add Rarity state
  const [isAddingRarity, setIsAddingRarity] = useState(false);
  const [newRarityName, setNewRarityName] = useState('');
  const [newRarityColor, setNewRarityColor] = useState('#f59e0b');
  const [newRarityCount, setNewRarityCount] = useState<number>(10);
  const [newRarityConfetti, setNewRarityConfetti] = useState(false);

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

  // Fetch real members from Supabase & local storage
  const fetchMembers = async () => {
    const list: MemberData[] = [];
    const seenUsernames = new Set<string>();

    let remoteRoles: Record<string, 'Admin' | 'User'> = {};
    try {
      remoteRoles = await fetchRemoteRoles();
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

            seenUsernames.add(uKey);
            list.push({
              id: p.id,
              username: p.username,
              email: p.email,
              avatarUrl: effectiveAvatar,
              coins: p.coins ?? 5000,
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

          seenUsernames.add(uKey);
          list.push({
            id: acc.id || `local-${key}`,
            username: acc.username,
            email: acc.email || `${uKey}@gmail.com`,
            avatarUrl: effectiveAvatar,
            coins: acc.coins ?? 5000,
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
        const updatedRarities = packDraft.rarities.filter(r => r.id !== rarityId);
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
    };

    const updatedRarities = [...packDraft.rarities, newRarityObj];
    setPackDraft({ ...packDraft, rarities: updatedRarities });
    setHasUnsavedChanges(true);
    setIsAddingRarity(false);
    setNewRarityName('');
    setNewRarityColor('#f59e0b');
    setNewRarityCount(10);
    setNewRarityConfetti(false);
    addToast(
      language === 'th'
        ? `เพิ่มระดับ "${cleanName}" ในฉบับร่างแล้ว`
        : `Added rarity "${cleanName}" to draft`,
      'info'
    );
  };

  // Point 1: เพิ่มรูปคือให้เลือกไฟล์ภาพมาได้เลย ไม่ต้องว่าจะเลือกเรทไหน!
  const handleMultipleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !packDraft) return;

    // Default to the first rarity of the pack or 'C'
    const defaultRarity = packDraft.rarities[0]?.name || 'C';
    const fileList = Array.from(files);

    let loadedCount = 0;
    const newCards: CardItem[] = [];

    fileList.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          const rawName = file.name.replace(/\.[^/.]+$/, '');
          newCards.push({
            id: `card-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            packId: packDraft.id,
            rarity: defaultRarity,
            imageUrl: reader.result,
            fileName: file.name,
            name: rawName,
            description: '',
            fields: [
              { id: `f-name-${Date.now()}-${Math.random()}`, name: language === 'th' ? 'ชื่อการ์ด' : 'Card Name', value: rawName },
              { id: `f-desc-${Date.now()}-${Math.random()}`, name: language === 'th' ? 'ความสามารถการ์ด' : 'Card Ability', value: '' },
            ],
          });
        }
        loadedCount++;
        if (loadedCount === fileList.length) {
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
      };
      reader.readAsDataURL(file);
    });

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

  // Change Card Image (In Draft)
  const handleUpdateCardImage = (cardId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !packDraft) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const updatedCards = packDraft.cards.map(c => {
          if (c.id === cardId) {
            return {
              ...c,
              imageUrl: reader.result as string,
              fileName: file.name,
            };
          }
          return c;
        });
        setPackDraft({ ...packDraft, cards: updatedCards });
        setHasUnsavedChanges(true);
        addToast(language === 'th' ? 'อัปเดตรูปภาพการ์ดในฉบับร่างแล้ว' : 'Card image updated in draft', 'info');
      }
    };
    reader.readAsDataURL(file);
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
          <div className="grid grid-cols-3 gap-2 sm:gap-3 max-w-lg mx-auto">
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
                        {/* ปุ่ม + เพิ่มระดับ */}
                        <button
                          onClick={() => setIsAddingRarity(true)}
                          className="px-3 py-1 bg-yellow-300 hover:bg-yellow-400 text-black border-2 border-black rounded-xl text-xs font-bold sketch-btn flex items-center gap-1 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]"
                        >
                          <Plus size={13} />
                          <span>{t.adminConsole.sections.addRarity}</span>
                        </button>
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
                        {packDraft.rarities?.map((rarity) => (
                          <div key={rarity.id} className="flex items-center gap-2">
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
                                    style={{ backgroundColor: rarity.color }}
                                  />
                                  <span>{rarity.name}</span>
                                  <span className="text-zinc-500 font-mono text-xs">{rarity.color}</span>
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
                              style={{ backgroundColor: r.color, color: '#000' }}
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
                            style={{ backgroundColor: r.color, color: '#000' }}
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
                                  <select
                                    value={card.rarity}
                                    onChange={(e) => handleUpdateCardRarity(card.id, e.target.value)}
                                    className="w-full text-[10px] font-bold py-1 px-1 bg-zinc-100 dark:bg-zinc-800 border border-black rounded text-center focus:outline-none"
                                  >
                                    {packDraft.rarities?.map(r => (
                                      <option key={r.id} value={r.name}>{t.adminConsole.sections.rarityPrefix} {r.name}</option>
                                    ))}
                                  </select>
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

      {/* Sticky Floating Save Bar when user has unsaved draft changes */}
      {hasUnsavedChanges && activeTab === 'queue' && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 bg-zinc-950/95 text-white border-2 border-yellow-400 px-5 py-3 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.6)] animate-in slide-in-from-bottom-5">
          <span className="text-xs font-bold text-yellow-300 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 animate-ping inline-block" />
            {t.adminConsole.sections.unsavedWarning}
          </span>
          <button
            type="button"
            onClick={() => handleSavePackChanges()}
            className="px-4 py-1.5 text-xs font-black bg-yellow-400 hover:bg-yellow-300 text-black border border-black rounded-xl sketch-btn flex items-center gap-1.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
          >
            <Save size={14} />
            <span>{t.adminConsole.sections.savePackNow}</span>
          </button>
        </div>
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

      {/* Modern Lightbox (Wheel Zoom, Touch Pinch, Drag-to-Pan, Zero Scrollbars) */}
      <ModernImageLightbox
        isOpen={Boolean(previewImage)}
        imageUrl={previewImage?.url || ''}
        title={previewImage?.title}
        onClose={() => setPreviewImage(null)}
      />
    </div>
  );
};
