import React, { useState, useEffect, useRef } from 'react';
import { CardItem, CardRarity, CardField, PackSeries, PackTearConfig } from '../types';
import { useGacha } from '../context/GachaContext';
import { toCleanSlug } from '../utils/slug';
import { ImageCropperModal } from './ImageCropperModal';
import { checkPackConflictWithDatabase } from '../lib/supabase';
import { compressImageFile, idbGetPack, idbGetActiveDraft } from '../utils/storage';
import { getTranslation } from '../i18n/translations';
import { PackCoverConfigurator } from './PackCoverConfigurator';
import { NeoColorPicker } from './NeoColorPicker';
import { ModernImageLightbox } from './ModernImageLightbox';
import {
  getCardDisplayName,
  findDuplicateCardNameGroups,
  prepareCardsForDatabase,
  sortCardsByRarityOrder,
} from '../utils/cardName';
import {
  ArrowLeft,
  Upload,
  Plus,
  Play,
  Save,
  FolderOpen,
  Send,
  X,
  Edit2,
  ChevronDown,
  Maximize2,
  ZoomIn,
  ZoomOut,
  Check,
  Crop,
  AlertTriangle,
  PartyPopper,
  RotateCcw,
  Sun,
  Moon
} from 'lucide-react';

interface CreatorStudioProps {
  initialStep?: 1 | 2 | 3;
}

export const CreatorStudio: React.FC<CreatorStudioProps> = () => {
  const {
    currentUser,
    savePack,
    publishPack,
    packs,
    editingPack,
    setEditingPack,
    navigate,
    currentPath,
    language,
    addToast,
    dontAskDeleteAgain,
    setDontAskDeleteAgain,
    tags,
    addTag,
    theme,
    toggleTheme,
    toggleLanguage,
    startNewPackCreation,
  } = useGacha();

  const t = getTranslation(language);

  // Gentle one-time warning if not logged in (NEVER kick/redirect)
  const hasWarnedAuthRef = useRef(false);
  useEffect(() => {
    if (!currentUser && !hasWarnedAuthRef.current) {
      hasWarnedAuthRef.current = true;
      addToast(
        language === 'th' ? 'กรุณาเข้าสู่ระบบก่อนสร้างการ์ด' : 'Please log in to create cards',
        'warning'
      );
    }
  }, [currentUser, language, addToast]);

  // Derive current step directly from currentPath to support continuous navigation
  const lowerPath = currentPath.toLowerCase();
  const currentStep: 1 | 2 | 3 =
    lowerPath === '/createcardsdata' || lowerPath.endsWith('/createcardsdata')
      ? 3
      : lowerPath === '/createcards' || lowerPath.endsWith('/createcards')
      ? 2
      : 1;

  // Sync real browser URL when step changes
  const goToStep = (step: 1 | 2 | 3) => {
    if (step === 1) navigate('/CreateCardsPack');
    if (step === 2) navigate('/CreateCards');
    if (step === 3) navigate('/CreateCardsData');
  };

  // Franchise & Series Database mapping
  // Build mapping dynamically from user's created packs: Franchise -> Set of Series
  const [franchiseSeriesMap, setFranchiseSeriesMap] = useState<Record<string, string[]>>(() => {
    const map: Record<string, string[]> = {};
    packs.forEach(p => {
      if (p.franchiseName) {
        if (!map[p.franchiseName]) map[p.franchiseName] = [];
        if (p.seriesName && !map[p.franchiseName].includes(p.seriesName)) {
          map[p.franchiseName].push(p.seriesName);
        }
      }
    });
    return map;
  });

  const franchiseList = Object.keys(franchiseSeriesMap);

  // Requirement: เมื่อเข้า Create ให้ทำการเคลียร์ไว้ ไม่มีการเลือกใดๆ หรือ แนบใดๆรอไว้
  const [franchiseName, setFranchiseName] = useState(() => {
    if (editingPack?.franchiseName) return editingPack.franchiseName;
    return '';
  });

  const [seriesName, setSeriesName] = useState(() => {
    if (editingPack?.seriesName) return editingPack.seriesName;
    return '';
  });

  // Series available for selected franchise
  const availableSeries = franchiseName ? (franchiseSeriesMap[franchiseName] || []) : [];

  // Keep franchiseSeriesMap dynamically updated with newly created or saved packs
  useEffect(() => {
    setFranchiseSeriesMap(prev => {
      const next: Record<string, string[]> = { ...prev };
      packs.forEach(p => {
        if (p.franchiseName) {
          if (!next[p.franchiseName]) next[p.franchiseName] = [];
          if (p.seriesName && !next[p.franchiseName].includes(p.seriesName)) {
            next[p.franchiseName] = [...next[p.franchiseName], p.seriesName];
          }
        }
      });
      if (franchiseName) {
        if (!next[franchiseName]) next[franchiseName] = [];
        if (seriesName && !next[franchiseName].includes(seriesName)) {
          next[franchiseName] = [...next[franchiseName], seriesName];
        }
      }
      return next;
    });
  }, [packs, franchiseName, seriesName]);

  // Multi-tag selection for Step 1
  const [selectedTags, setSelectedTags] = useState<string[]>(() => {
    if (editingPack?.tags && Array.isArray(editingPack.tags) && editingPack.tags.length > 0) {
      return editingPack.tags;
    }
    if (editingPack?.tag) {
      return editingPack.tag.split(',').map(s => s.trim()).filter(Boolean);
    }
    return [];
  });
  const tag = selectedTags.join(', ');
  const [isTagDropdownOpen, setIsTagDropdownOpen] = useState(false);
  const [isNewTagInput, setIsNewTagInput] = useState(false);
  const [newTagValue, setNewTagValue] = useState('');

  const toggleTag = (item: string) => {
    setSelectedTags(prev => {
      const exists = prev.some(t => t.toLowerCase() === item.toLowerCase());
      if (exists) {
        return prev.filter(t => t.toLowerCase() !== item.toLowerCase());
      } else {
        return [...prev, item];
      }
    });
  };

  // Update series selection if franchise changes
  const handleSelectFranchise = (newFran: string) => {
    setFranchiseName(newFran);
    setIsFranchiseDropdownOpen(false);
    const seriesForFran = franchiseSeriesMap[newFran] || [];
    setSeriesName(seriesForFran[0] || '');

    // Auto-link default rarities from existing pack in this franchise
    const existingPack = packs.find(p => p.franchiseName.toLowerCase() === newFran.toLowerCase());
    if (existingPack) {
      if (cards.length === 0 && existingPack.rarities && existingPack.rarities.length > 0) {
        setRarities(existingPack.rarities.map(r => ({ ...r, cardCount: 0 })));
      }
    }
  };

  const [cardsPerPack, setCardsPerPack] = useState<number>(() => {
    if (editingPack?.cardsPerPack) return editingPack.cardsPerPack;
    return 5;
  });

  const [price, setPrice] = useState<number>(() => {
    if (editingPack?.price !== undefined) return editingPack.price;
    return 500;
  });

  const [coverImageUrl, setCoverImageUrl] = useState<string>(() => {
    if (editingPack?.coverImageUrl) return editingPack.coverImageUrl;
    return '';
  });

  const [originalCoverImageUrl, setOriginalCoverImageUrl] = useState<string>(() => {
    if (editingPack?.originalCoverImageUrl) return editingPack.originalCoverImageUrl;
    if (editingPack?.coverImageUrl) return editingPack.coverImageUrl;
    return '';
  });

  const [coverAspectRatio, setCoverAspectRatio] = useState<string>(() => {
    if (editingPack?.coverAspectRatio) return editingPack.coverAspectRatio;
    return 'auto';
  });

  const [tearConfig, setTearConfig] = useState<PackTearConfig>(() => {
    if (editingPack?.tearConfig) return editingPack.tearConfig;
    return { direction: 'up' };
  });

  // Dropdown states with mutually exclusive open state
  const [isFranchiseDropdownOpen, setIsFranchiseDropdownOpen] = useState(false);
  const [isSeriesDropdownOpen, setIsSeriesDropdownOpen] = useState(false);
  const [isNewFranchiseInput, setIsNewFranchiseInput] = useState(false);
  const [isNewSeriesInput, setIsNewSeriesInput] = useState(false);
  const [newFranchiseValue, setNewFranchiseValue] = useState('');
  const [newSeriesValue, setNewSeriesValue] = useState('');

  // Rarities & Cards - default cardCount starts at 0, no pre-attached items
  const [rarities, setRarities] = useState<CardRarity[]>(() => {
    if (editingPack?.rarities && editingPack.rarities.length > 0) return editingPack.rarities;
    return [
      { id: 'rarity-c', name: 'C', color: '#94a3b8', cardCount: 0, hasConfetti: false },
      { id: 'rarity-r', name: 'R', color: '#38bdf8', cardCount: 0, hasConfetti: false },
    ];
  });

  const [cards, setCards] = useState<CardItem[]>(() => {
    if (editingPack?.cards && editingPack.cards.length > 0) return editingPack.cards;
    return [];
  });

  // Keep pack ID stable throughout creation and editing sessions
  const currentPackIdRef = useRef<string>(editingPack?.id || `pack-${Date.now()}`);
  useEffect(() => {
    if (editingPack?.id) {
      currentPackIdRef.current = editingPack.id;
    }
  }, [editingPack?.id]);

  // Clean slate when entering Create afresh, or recover draft ONLY when editing an existing pack
  useEffect(() => {
    if (!editingPack) {
      setFranchiseName('');
      setSeriesName('');
      setSelectedTags([]);
      setCardsPerPack(5);
      setPrice(500);
      setCoverImageUrl('');
      setOriginalCoverImageUrl('');
      setCoverAspectRatio('auto');
      setTearConfig({ direction: 'up' });
      setRarities([
        { id: 'rarity-c', name: 'C', color: '#94a3b8', cardCount: 0, hasConfetti: false },
        { id: 'rarity-r', name: 'R', color: '#38bdf8', cardCount: 0, hasConfetti: false },
      ]);
      setCards([]);
      currentPackIdRef.current = `pack-${Date.now()}`;
      return;
    }

    // Only recover full cards list if we are actively editing an existing pack
    idbGetActiveDraft().then((draft) => {
      if (draft && draft.id === editingPack.id && draft.cards && draft.cards.length > 0) {
        setCards(prev => {
          if (prev.length === 0 || draft.cards.length > prev.length) {
            return draft.cards;
          }
          return prev;
        });
        if (draft.rarities && draft.rarities.length > 0) {
          setRarities(prev => (prev.length <= 2 ? draft.rarities : prev));
        }
      }
    }).catch(() => {});
  }, [editingPack]);

  // UI state for image preview modal
  const [expandedImageUrl, setExpandedImageUrl] = useState<string | null>(null);

  // 9-Grid Interactive Cropper state (Requirement 2 & 3)
  const [cropperState, setCropperState] = useState<{
    isOpen: boolean;
    imageUrl: string;
    onCrop: (croppedDataUrl: string) => void;
    title: string;
  }>({
    isOpen: false,
    imageUrl: '',
    onCrop: () => {},
    title: '',
  });

  // Inline Rarity creation state (No Web Popup as requested in Requirement 4)
  const [isAddingRarity, setIsAddingRarity] = useState(false);
  const [newRarityInputName, setNewRarityInputName] = useState('');
  const [newRarityConfetti, setNewRarityConfetti] = useState(false);

  // Delete confirmation modal state
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [pendingDeleteAction, setPendingDeleteAction] = useState<(() => void) | null>(null);
  const [rememberDontAsk, setRememberDontAsk] = useState(false);

  // Database mismatch conflict modal state (Requirement: ข้อมูล [...] ไม่ตรงกับฐานข้อมูล)
  const [conflictModal, setConflictModal] = useState<{
    isOpen: boolean;
    diffMessage: string;
    onConfirm: () => void;
  } | null>(null);

  // Overwrite Confirmation Modal (Requirement 1: แทนการบล็อก ให้มี Popup ถาม "ต้องการจะ..." เลือกระหว่าง "ยกเลิก" หรือ "Save ข้อมูลทับ")
  const [overwriteModal, setOverwriteModal] = useState<{
    isOpen: boolean;
    existingPack: PackSeries;
    packToSave: PackSeries;
    isPublish: boolean;
    isContributor?: boolean;
  } | null>(null);

  // Duplicate Card Names Modal (Requirement: ไม่มีการ์ดชื่อซ้ำ/มีชื่อซ้ำแต่ไม่ปรากฎ/มีชื่อซ้ำปรากฎแล้ว ถามยกเลิกหรือบันทึกทับ/เปลี่ยนชื่อการ์ดซ้ำ)
  const [duplicateCardNameModal, setDuplicateCardNameModal] = useState<{
    isOpen: boolean;
    duplicateGroups: Map<string, CardItem[]>;
    packToSave: PackSeries;
    isPublish: boolean;
  } | null>(null);

  // Inline renaming for duplicate cards only
  const [isRenamingDuplicates, setIsRenamingDuplicates] = useState(false);
  const [duplicateNameEdits, setDuplicateNameEdits] = useState<Record<string, string>>({});

  // Drag over tracking
  const [isCoverDraggingOver, setIsCoverDraggingOver] = useState(false);
  const [draggingOverRarity, setDraggingOverRarity] = useState<string | null>(null);

  // Cover file name tracking for hover inspection (Requirement 3)
  const [coverFileName, setCoverFileName] = useState<string>('');

  // Load Pack Modal
  const [isLoadModalOpen, setIsLoadModalOpen] = useState(false);

  // Bulk Add Field Modal state (Requirement 2)
  const [isBulkFieldModalOpen, setIsBulkFieldModalOpen] = useState(false);
  const [bulkFieldNameInput, setBulkFieldNameInput] = useState('');
  const [bulkFieldValueInput, setBulkFieldValueInput] = useState('');

  // Edit Rarity Modal
  const [editingRarityId, setEditingRarityId] = useState<string | null>(null);
  const [editRarityName, setEditRarityName] = useState('');

  // Drag-and-drop reordering for rarities - only draggable when grabbing drag handle '::'
  const [draggedRarityIdx, setDraggedRarityIdx] = useState<number | null>(null);
  const [draggingHandleRarityId, setDraggingHandleRarityId] = useState<string | null>(null);

  const handleDragStartRarity = (e: React.DragEvent, index: number) => {
    const target = e.target as HTMLElement;
    if (target.closest('input, button, [data-no-drag], .neo-color-picker, .neo-color-slider')) {
      e.preventDefault();
      return;
    }
    const targetRarity = rarities[index];
    if (!targetRarity || draggingHandleRarityId !== targetRarity.id) {
      e.preventDefault();
      return;
    }
    setDraggedRarityIdx(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOverRarity = (e: React.DragEvent, _index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDropRarity = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedRarityIdx === null || draggedRarityIdx === targetIndex) {
      setDraggedRarityIdx(null);
      return;
    }
    setRarities(prev => {
      const next = [...prev];
      const [moved] = next.splice(draggedRarityIdx, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
    setDraggedRarityIdx(null);
  };

  // Request Delete with "ไม่ถามซ้ำ" check
  const requestDelete = (action: () => void) => {
    if (dontAskDeleteAgain) {
      action();
      return;
    }
    setPendingDeleteAction(() => action);
    setDeleteModalVisible(true);
  };

  const confirmDelete = () => {
    if (pendingDeleteAction) {
      pendingDeleteAction();
    }
    if (rememberDontAsk) {
      setDontAskDeleteAgain(true);
    }
    setDeleteModalVisible(false);
    setPendingDeleteAction(null);
  };

  // Drag & drop file reader helper with automatic compression (preserves quality while avoiding quota limits)
  const readFileAsDataUrl = (file: File): Promise<string> => {
    return compressImageFile(file);
  };

  // Cover Image upload handler
  const handleCoverFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setCoverImageUrl(dataUrl);
      setCoverFileName(file.name);
      addToast(language === 'th' ? 'แนบภาพสำเร็จ' : 'Cover attached', 'success');
    } catch {
      addToast(language === 'th' ? 'แนบภาพล้มเหลว' : 'Upload failed', 'error');
    }
  };

  // Cards batch upload per rarity
  const handleCardsUploadForRarity = async (rarityName: string, files: FileList | null) => {
    if (!files || files.length === 0) return;

    let hasDuplicate = false;
    const newItems: CardItem[] = [];

    // Requirement 8: Inherit template field names from existing cards in pack or franchise
    const existingFieldNames: string[] = cards.length > 0
      ? cards[0].fields.map(f => f.name)
      : (() => {
          const existingPack = packs.find(p => p.franchiseName.toLowerCase() === franchiseName.toLowerCase());
          if (existingPack && existingPack.cards && existingPack.cards.length > 0) {
            return existingPack.cards[0].fields.map(f => f.name);
          }
          return language === 'th' ? ['ชื่อการ์ด', 'ความสามารถการ์ด'] : ['Card Name', 'Card Ability'];
        })();

    for (const file of Array.from(files)) {
      const baseName = file.name.replace(/\.[^/.]+$/, '');
      const finalCardName = baseName;
      try {
        const dataUrl = await readFileAsDataUrl(file);
        newItems.push({
          id: `card-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          packId: editingPack?.id || `pack-${Date.now()}`,
          name: finalCardName,
          fileName: file.name,
          rarity: rarityName,
          imageUrl: dataUrl,
          description: '',
          fields: existingFieldNames.map((fName, fIdx) => ({
            id: `f-${Date.now()}-${fIdx}-${Math.random().toString(36).substr(2, 4)}`,
            name: fName,
            value: (fName === 'ชื่อการ์ด' || fName === 'Card Name') ? finalCardName : '',
          })),
        });
      } catch {
        // ignore
      }
    }

    if (newItems.length > 0) {
      setCards(prev => [...prev, ...newItems]);

      if (hasDuplicate) {
        addToast(language === 'th' ? 'แนบภาพสำเร็จ (ลบและข้ามไฟล์ซ้ำออกแล้ว)' : 'Attached (duplicates skipped)', 'info');
      } else {
        addToast(language === 'th' ? 'แนบภาพสำเร็จ' : 'Cards attached', 'success');
      }
    } else if (hasDuplicate) {
      addToast(language === 'th' ? 'ไฟล์ทั้งหมดที่เลือกมีอยู่ในการ์ดแล้ว' : 'All selected files already exist', 'warning');
    }
  };

  // Rarity management - Inline form (No Web Popup as requested in Requirement 4)
  const handleConfirmAddRarity = () => {
    if (!newRarityInputName.trim()) return;
    const clean = newRarityInputName.trim().toUpperCase();
    if (rarities.some(r => r.name === clean)) {
      addToast(language === 'th' ? 'ระดับความแรร์นี้มีอยู่แล้ว' : 'Rarity exists', 'warning');
      return;
    }
    const newRarity: CardRarity = {
      id: `rarity-${Date.now()}`,
      name: clean,
      color: '#a855f7',
      cardCount: 0,
      hasConfetti: newRarityConfetti,
    };
    setRarities(prev => [...prev, newRarity]);
    setIsAddingRarity(false);
    setNewRarityInputName('');
    setNewRarityConfetti(false);
    addToast(language === 'th' ? `เพิ่มระดับ ${clean} สำเร็จ` : `Added rarity ${clean}`, 'success');
  };

  // 9-Grid Cropper Openers (Requirement 2 & 3)
  const handleOpenCoverCropper = () => {
    if (!coverImageUrl) return;
    setCropperState({
      isOpen: true,
      imageUrl: coverImageUrl,
      onCrop: (cropped) => setCoverImageUrl(cropped),
      title: language === 'th' ? 'ปรับการครอบภาพซอง (ตาราง 9 ช่อง)' : 'Crop Pack Cover (9-Grid)',
    });
  };

  const handleOpenCardCropper = (card: CardItem) => {
    if (!card.imageUrl) return;
    setCropperState({
      isOpen: true,
      imageUrl: card.imageUrl,
      onCrop: (cropped) => {
        setCards(prev => prev.map(c => c.id === card.id ? { ...c, imageUrl: cropped } : c));
      },
      title: language === 'th' ? 'ปรับการครอบภาพการ์ด (ตาราง 9 ช่อง)' : 'Crop Card Image (9-Grid)',
    });
  };

  const handleSaveRarityRename = (id: string) => {
    if (!editRarityName.trim()) return;
    const oldName = rarities.find(r => r.id === id)?.name;
    const newName = editRarityName.trim().toUpperCase();
    setRarities(prev => prev.map(r => r.id === id ? { ...r, name: newName } : r));
    if (oldName) {
      setCards(prev => prev.map(c => c.rarity === oldName ? { ...c, rarity: newName } : c));
    }
    setEditingRarityId(null);
    setEditRarityName('');
  };

  const handleDeleteRarity = (id: string) => {
    const target = rarities.find(r => r.id === id);
    if (!target) return;
    requestDelete(() => {
      setRarities(prev => prev.filter(r => r.id !== id));
      setCards(prev => prev.filter(c => c.rarity !== target.name));
    });
  };

  // Requirement 10: Synchronous Header Deletion - delete fields with that name from all cards
  const handleDeleteFieldFromCard = (cardId: string, fieldId: string) => {
    const currentCard = cards.find(c => c.id === cardId);
    const targetField = currentCard?.fields.find(f => f.id === fieldId);
    const fieldNameToDelete = targetField?.name;

    setCards(prev => prev.map(c => {
      const remainingFields = c.fields.filter(f => {
        if (f.id === fieldId) return false;
        if (fieldNameToDelete && f.name === fieldNameToDelete) return false;
        return true;
      });
      const nameField = remainingFields.find(f => f.name === 'ชื่อการ์ด' || f.name === 'Card Name');
      const descField = remainingFields.find(f => f.name === 'ความสามารถการ์ด' || f.name === 'Card Ability');
      return {
        ...c,
        fields: remainingFields,
        name: nameField ? nameField.value : '',
        description: descField ? descField.value : '',
      };
    }));
  };

  const handleUpdateFieldValue = (cardId: string, fieldId: string, newValue: string) => {
    setCards(prev => prev.map(c => {
      if (c.id === cardId) {
        const updatedFields = c.fields.map(f => f.id === fieldId ? { ...f, value: newValue } : f);
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
    }));
  };

  // Requirement 9: Synchronous Header Rename - rename field title across all cards simultaneously
  const handleUpdateFieldName = (cardId: string, fieldId: string, newName: string) => {
    const currentCard = cards.find(c => c.id === cardId);
    const targetField = currentCard?.fields.find(f => f.id === fieldId);
    const oldName = targetField?.name;

    setCards(prev => prev.map(c => {
      const updatedFields = c.fields.map(f => {
        if (f.id === fieldId || (oldName && f.name === oldName)) {
          return { ...f, name: newName };
        }
        return f;
      });
      return {
        ...c,
        fields: updatedFields,
      };
    }));
  };

  const handleAddFieldToCard = (cardId: string) => {
    const defaultFieldName = language === 'th' ? 'ข้อมูลใหม่' : 'New Field';
    setCards(prev => prev.map(c => {
      if (c.id === cardId) {
        return {
          ...c,
          fields: [
            ...c.fields,
            { id: `f-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`, name: defaultFieldName, value: '' }
          ]
        };
      }
      return c;
    }));
  };

  // Add field across all cards in the same franchise (Requirement 2)
  const handleAddFieldToAllCards = (fieldName?: string, defaultValue = '') => {
    if (cards.length === 0) {
      addToast(language === 'th' ? 'ยังไม่มีการ์ดในระบบ' : 'No cards available', 'warning');
      return;
    }
    const defaultFieldName = language === 'th' ? 'ข้อมูลใหม่' : 'New Field';
    const cleanName = (fieldName && fieldName.trim()) || defaultFieldName;
    setCards(prev => prev.map(c => ({
      ...c,
      fields: [
        ...c.fields,
        { id: `f-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`, name: cleanName, value: defaultValue }
      ]
    })));
    addToast(
      language === 'th' ? `เพิ่มช่อง "${cleanName}" ให้การ์ดทั้งหมด ${cards.length} ใบแล้ว` : `Added "${cleanName}" to all ${cards.length} cards`,
      'success'
    );
  };

  // Build current pack object (Never default to Untitled Vol. 1 - Requirement 5)
  const buildCurrentPack = (): PackSeries => {
    return {
      id: editingPack?.id || currentPackIdRef.current,
      authorId: editingPack?.authorId || currentUser?.id,
      franchiseName: franchiseName.trim(),
      seriesName: seriesName.trim(),
      tag: selectedTags.join(', '),
      tags: selectedTags,
      coverImageUrl: coverImageUrl || '',
      originalCoverImageUrl: originalCoverImageUrl || coverImageUrl || '',
      coverAspectRatio,
      tearConfig,
      cardsPerPack,
      price,
      rarities,
      cards: sortCardsByRarityOrder(cards, rarities),
      createdAt: editingPack?.createdAt || new Date().toISOString(),
      isPublished: editingPack?.isPublished || false,
    };
  };

  // Keep local draft and editingPack synchronized when user creates content
  useEffect(() => {
    if (franchiseName || seriesName || cards.length > 0 || coverImageUrl) {
      const draft = buildCurrentPack();
      setEditingPack(draft);
      try {
        localStorage.setItem('mygacha_creator_draft', JSON.stringify(draft));
      } catch {}
    }
  }, [cards, rarities, coverImageUrl, originalCoverImageUrl, coverAspectRatio, tearConfig, franchiseName, seriesName, selectedTags, cardsPerPack, price]);

  // Helper to deduplicate cards strictly by unique ID, never drop cards due to name collision or duplicate images!
  const deduplicateCards = (items: CardItem[]): CardItem[] => {
    const seenIds = new Set<string>();
    const unique: CardItem[] = [];
    for (const item of items) {
      if (seenIds.has(item.id)) continue;
      seenIds.add(item.id);
      unique.push(item);
    }
    return unique;
  };

  // Load existing pack cleanly into the editor (preserves all cards, rarities, and settings)
  const loadPackIntoEditor = async (p: PackSeries) => {
    let target = p;
    try {
      const idbPack = await idbGetPack(p.id);
      if (idbPack && idbPack.cards && idbPack.cards.length > (target.cards?.length || 0)) {
        target = idbPack;
      }
    } catch {}

    // Ensure all cards have clean display name (strip any -1, -2 database suffix)
    const cleanCards = (target.cards || []).map(c => ({
      ...c,
      name: getCardDisplayName(c.name),
      fields: (c.fields || []).map(f => ({
        ...f,
        value: (f.name === 'ชื่อการ์ด' || f.name === 'Card Name') ? getCardDisplayName(f.value) : f.value,
      })),
    }));

    // Ensure all rarities present on cards are in rarities array so they appear in Step 2!
    const existingRarityNames = new Set((target.rarities || []).map(r => r.name.trim().toLowerCase()));
    const missingRarities: CardRarity[] = [];
    cleanCards.forEach(c => {
      const rName = (c.rarity || 'Common').trim().toUpperCase();
      if (!existingRarityNames.has(rName.toLowerCase())) {
        existingRarityNames.add(rName.toLowerCase());
        missingRarities.push({
          id: `r-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          name: rName,
          color: '#facc15',
          cardCount: 10, // Fixed default drop rate, never stack rate by card count
        });
      }
    });

    const finalRarities = [...(target.rarities || []), ...missingRarities];

    setEditingPack({ ...target, cards: cleanCards, rarities: finalRarities });
    currentPackIdRef.current = target.id;
    setFranchiseName(target.franchiseName);
    setSeriesName(target.seriesName);
    if (target.tags && Array.isArray(target.tags) && target.tags.length > 0) {
      setSelectedTags(target.tags);
    } else if (target.tag) {
      setSelectedTags(target.tag.split(',').map(s => s.trim()).filter(Boolean));
    } else {
      setSelectedTags([]);
    }
    setCardsPerPack(target.cardsPerPack || 5);
    setPrice(target.price || 500);
    setCoverImageUrl(target.coverImageUrl || '');
    setOriginalCoverImageUrl(target.originalCoverImageUrl || target.coverImageUrl || '');
    setCoverAspectRatio((target.coverAspectRatio as any) || 'auto');
    setTearConfig(target.tearConfig || { direction: 'up' });
    setRarities(finalRarities);
    setCards(cleanCards);
    addToast(
      language === 'th'
        ? `โหลดข้อมูลชุด "${target.franchiseName} - ${target.seriesName}" เรียบร้อยแล้ว (พบการ์ด ${cleanCards.length} ใบ)`
        : `Loaded pack "${target.franchiseName} - ${target.seriesName}" (${cleanCards.length} cards)`,
      'success'
    );
  };

  // Helper to merge newly added cards into existing pack without losing any existing cards
  const handleMergeWithExistingPack = async (
    existingPack: PackSeries,
    currentPack: PackSeries,
    isPublish: boolean
  ) => {
    // 1. Merge cards: retain all existing cards, and append new cards that don't share the exact same ID
    const existingIds = new Set(existingPack.cards.map(c => c.id));
    const newCards = currentPack.cards.filter(c => !existingIds.has(c.id));
    const mergedCards: CardItem[] = [...existingPack.cards, ...newCards];

    // 2. Merge rarities: preserve user-defined drop rate weights without stacking
    const rarityMap = new Map<string, CardRarity>();
    (existingPack.rarities || []).forEach(r => rarityMap.set(r.name.toLowerCase(), { ...r }));
    (currentPack.rarities || []).forEach(r => {
      if (!rarityMap.has(r.name.toLowerCase())) {
        rarityMap.set(r.name.toLowerCase(), { ...r });
      }
    });

    const mergedRarities = Array.from(rarityMap.values());

    // 3. Merge tags:
    const existingTags = existingPack.tags || (existingPack.tag ? existingPack.tag.split(',').map(s => s.trim()).filter(Boolean) : []);
    const currentTags = currentPack.tags || (currentPack.tag ? currentPack.tag.split(',').map(s => s.trim()).filter(Boolean) : []);
    const mergedTags = Array.from(new Set([...existingTags, ...currentTags]));

    const mergedPack: PackSeries = {
      ...existingPack,
      cards: mergedCards,
      rarities: mergedRarities,
      tag: mergedTags.join(', '),
      tags: mergedTags,
      coverImageUrl: currentPack.coverImageUrl || existingPack.coverImageUrl,
      originalCoverImageUrl: currentPack.originalCoverImageUrl || existingPack.originalCoverImageUrl,
      cardsPerPack: currentPack.cardsPerPack || existingPack.cardsPerPack,
      price: currentPack.price || existingPack.price,
      isPublished: isPublish ? true : existingPack.isPublished,
    };

    setOverwriteModal(null);

    if (isPublish) {
      await publishPack(mergedPack);
      try {
        localStorage.removeItem('mygacha_creator_draft');
      } catch {}
      addToast(
        language === 'th'
          ? `ผสานรวมการ์ดเข้าชุดเดิมสำเร็จ รวมทั้งหมด ${mergedCards.length} ใบและเผยแพร่แล้ว`
          : `Merged into existing pack with ${mergedCards.length} total cards and published!`,
        'success'
      );
      navigate('/');
    } else {
      await savePack(mergedPack);
      setEditingPack(mergedPack);
      setCards(mergedCards);
      setRarities(mergedRarities);
      setSelectedTags(mergedTags);
      addToast(
        language === 'th'
          ? `ผสานรวมการ์ดเข้าชุดเดิมสำเร็จ รวมทั้งหมด ${mergedCards.length} ใบ (การ์ดเดิมไม่สูญหาย)`
          : `Merged into existing pack with ${mergedCards.length} total cards (no cards lost)!`,
        'success'
      );
    }
  };

  const handleSave = async (forceOverwriteDuplicateNames = false) => {
    if (!franchiseName.trim()) {
      addToast(language === 'th' ? 'กรุณาระบุชื่อแฟรนไชส์ก่อนบันทึก' : 'Please specify franchise name', 'warning');
      goToStep(1);
      return;
    }
    if (!seriesName.trim()) {
      addToast(language === 'th' ? 'กรุณาระบุชื่อซองสุ่มก่อนบันทึก' : 'Please specify pack name', 'warning');
      goToStep(1);
      return;
    }

    // Deduplicate cards strictly by ID (never drop duplicate images or names)
    const cleanCards = deduplicateCards(cards);
    if (cleanCards.length !== cards.length) {
      setCards(cleanCards);
    }

    // Duplicate card names validation & overwrite flow:
    // (Item 3: ในหน้า CreateCardsData ตรงส่วนของชื่อการ์ด จะเป็นสิ่งเดียวที่ไม่ต้องตรวจเช็คการซ้ำ เพราะชื่อการ์ดเป็นเพียงตัวแสดงผลเท่านั้น)
    const duplicateGroups = currentStep === 3 ? new Map() : findDuplicateCardNameGroups(cleanCards);
    if (duplicateGroups.size > 0 && !forceOverwriteDuplicateNames) {
      const pack = buildCurrentPack();
      pack.cards = cleanCards;
      setDuplicateCardNameModal({
        isOpen: true,
        duplicateGroups,
        packToSave: pack,
        isPublish: false,
      });
      return;
    }

    const preparedCards = prepareCardsForDatabase(cleanCards);
    const pack = buildCurrentPack();
    pack.cards = preparedCards;

    // Requirement 1: แทนการบล็อก เมื่อมีข้อมูลเดิมอยู่ ให้มี Popup ถาม "ต้องการจะ..." เลือกระหว่าง "ยกเลิก" หรือ "Save ข้อมูลทับ" (ห้ามใช้ Web Popup)
    const duplicatePack = packs.find(p => {
      if (p.id === editingPack?.id) return false;
      const isSameNames =
        p.franchiseName.trim().toLowerCase() === franchiseName.trim().toLowerCase() &&
        p.seriesName.trim().toLowerCase() === seriesName.trim().toLowerCase();

      const existingCardNames = new Set(p.cards.map(c => c.name.trim().toLowerCase()));
      const currentCardNames = cleanCards.map(c => c.name.trim().toLowerCase());
      const hasOnlySameItems = currentCardNames.length > 0 && currentCardNames.every(name => existingCardNames.has(name));

      return isSameNames || hasOnlySameItems;
    });

    if (duplicatePack) {
      const isOwnerOrAdmin = !duplicatePack.authorId ||
                             duplicatePack.authorId === currentUser?.id ||
                             currentUser?.role === 'Admin';
      if (!isOwnerOrAdmin) {
        if (!duplicatePack.isPublished) {
          addToast(
            language === 'th'
              ? 'ไม่สามารถบันทึกทับฉบับร่างส่วนตัวของผู้ใช้อื่นได้ กรุณาตั้งชื่อชุดใหม่ของคุณเอง'
              : 'Cannot modify this private draft: It belongs to another author.',
            'error'
          );
          return;
        }

        // Published pack: allow contributor to merge new cards!
        setOverwriteModal({
          isOpen: true,
          existingPack: duplicatePack,
          packToSave: { ...pack, id: duplicatePack.id },
          isPublish: false,
          isContributor: true,
        });
        return;
      }

      setOverwriteModal({
        isOpen: true,
        existingPack: duplicatePack,
        packToSave: { ...pack, id: duplicatePack.id },
        isPublish: false,
        isContributor: false,
      });
      return;
    }

    // Check conflict against database:
    const conflict = await checkPackConflictWithDatabase(pack, packs);
    if (conflict.hasConflict && conflict.diffMessage) {
      setConflictModal({
        isOpen: true,
        diffMessage: conflict.diffMessage,
        onConfirm: () => {
          setConflictModal(null);
          goToStep(1);
          setIsFranchiseDropdownOpen(true);
        },
      });
      return;
    }

    await savePack(pack);
    setEditingPack(pack);
    currentPackIdRef.current = pack.id;

    // Ensure franchise and series are immediately registered into dropdown map
    setFranchiseSeriesMap(prev => {
      const existingSeries = prev[pack.franchiseName] || [];
      const updatedSeries = existingSeries.includes(pack.seriesName) ? existingSeries : [...existingSeries, pack.seriesName];
      return {
        ...prev,
        [pack.franchiseName]: updatedSeries,
      };
    });
  };

  const handlePublish = async (forceOverwriteDuplicateNames = false) => {
    // Validation: ห้ามไม่ให้ผู้ใช้ Publish งานเปล่าๆ ที่ไม่ได้ใส่ข้อมูลใดๆ
    if (!franchiseName.trim()) {
      addToast(language === 'th' ? 'ไม่สามารถเผยแพร่งานเปล่าได้: กรุณาระบุชื่อแฟรนไชส์' : 'Cannot publish empty pack: Please specify franchise name', 'warning');
      goToStep(1);
      return;
    }
    if (!seriesName.trim()) {
      addToast(language === 'th' ? 'ไม่สามารถเผยแพร่งานเปล่าได้: กรุณาระบุชื่อซองสุ่ม' : 'Cannot publish empty pack: Please specify pack name', 'warning');
      goToStep(1);
      return;
    }
    if (!coverImageUrl || !coverImageUrl.trim()) {
      addToast(language === 'th' ? 'ไม่สามารถเผยแพร่งานเปล่าได้: กรุณาแนบภาพหน้าปกซอง' : 'Cannot publish empty pack: Please attach a pack cover image', 'warning');
      goToStep(1);
      return;
    }

    const cleanCards = deduplicateCards(cards);
    if (cleanCards.length !== cards.length) {
      setCards(cleanCards);
    }

    if (cleanCards.length === 0) {
      addToast(language === 'th' ? 'ไม่สามารถเผยแพร่งานเปล่าได้: กรุณาแนบการ์ดอย่างน้อย 1 ใบ' : 'Cannot publish empty pack: Please attach at least 1 card', 'warning');
      goToStep(2);
      return;
    }

    const hasValidCards = cleanCards.some(c => Boolean(c.imageUrl?.trim()) || Boolean(c.name?.trim()));
    if (!hasValidCards) {
      addToast(language === 'th' ? 'ไม่สามารถเผยแพร่งานเปล่าได้: การ์ดต้องมีรูปภาพหรือชื่ออย่างน้อย 1 ใบ' : 'Cannot publish empty pack: Cards must have at least 1 image or name', 'warning');
      goToStep(2);
      return;
    }

    if (!rarities || rarities.length === 0) {
      addToast(language === 'th' ? 'ไม่สามารถเผยแพร่งานเปล่าได้: กรุณากำหนดระดับความแรร์อย่างน้อย 1 ระดับ' : 'Cannot publish empty pack: Please define at least 1 rarity', 'warning');
      goToStep(2);
      return;
    }

    const totalOdds = rarities.reduce((sum, r) => sum + (Number(r.cardCount) || 0), 0);
    if (totalOdds <= 0) {
      addToast(language === 'th' ? 'ไม่สามารถเผยแพร่งานเปล่าได้: กรุณากำหนดจำนวนใบต่อระดับความแรร์ (โอกาสออก)' : 'Cannot publish empty pack: Please specify card count per rarity', 'warning');
      goToStep(2);
      return;
    }

    // Duplicate card names validation & overwrite flow for publish:
    // (Item 3: ในหน้า CreateCardsData ตรงส่วนของชื่อการ์ด จะเป็นสิ่งเดียวที่ไม่ต้องตรวจเช็คการซ้ำ เพราะชื่อการ์ดเป็นเพียงตัวแสดงผลเท่านั้น)
    const duplicateGroups = currentStep === 3 ? new Map() : findDuplicateCardNameGroups(cleanCards);
    if (duplicateGroups.size > 0 && !forceOverwriteDuplicateNames) {
      const pack = buildCurrentPack();
      pack.cards = cleanCards;
      setDuplicateCardNameModal({
        isOpen: true,
        duplicateGroups,
        packToSave: pack,
        isPublish: true,
      });
      return;
    }

    const preparedCards = prepareCardsForDatabase(cleanCards);
    const pack = buildCurrentPack();
    pack.cards = preparedCards;

    // Requirement 1: แทนการบล็อก เมื่อมีข้อมูลเดิมอยู่ ให้มี Popup ถาม "ต้องการจะ..." เลือกระหว่าง "ยกเลิก" หรือ "Save ข้อมูลทับ"
    const duplicatePack = packs.find(p => {
      if (p.id === editingPack?.id) return false;
      const isSameNames =
        p.franchiseName.trim().toLowerCase() === franchiseName.trim().toLowerCase() &&
        p.seriesName.trim().toLowerCase() === seriesName.trim().toLowerCase();

      const existingCardNames = new Set(p.cards.map(c => c.name.trim().toLowerCase()));
      const currentCardNames = cleanCards.map(c => c.name.trim().toLowerCase());
      const hasOnlySameItems = currentCardNames.length > 0 && currentCardNames.every(name => existingCardNames.has(name));

      return isSameNames || hasOnlySameItems;
    });

    if (duplicatePack) {
      const isOwnerOrAdmin = !duplicatePack.authorId ||
                             duplicatePack.authorId === currentUser?.id ||
                             currentUser?.role === 'Admin';
      if (!isOwnerOrAdmin) {
        if (!duplicatePack.isPublished) {
          addToast(
            language === 'th'
              ? 'ไม่สามารถเผยแพร่ทับฉบับร่างส่วนตัวของผู้ใช้อื่นได้ กรุณาตั้งชื่อชุดใหม่ของคุณเอง'
              : 'Cannot publish over private draft of another author.',
            'error'
          );
          return;
        }

        // Published pack: allow contributor to merge new cards!
        setOverwriteModal({
          isOpen: true,
          existingPack: duplicatePack,
          packToSave: { ...pack, id: duplicatePack.id },
          isPublish: true,
          isContributor: true,
        });
        return;
      }

      setOverwriteModal({
        isOpen: true,
        existingPack: duplicatePack,
        packToSave: { ...pack, id: duplicatePack.id },
        isPublish: true,
        isContributor: false,
      });
      return;
    }

    await publishPack(pack);
    try {
      localStorage.removeItem('mygacha_creator_draft');
    } catch {}
    navigate('/');
  };

  const handleTest = () => {
    if (!franchiseName.trim() || !seriesName.trim()) {
      addToast(language === 'th' ? 'กรุณาระบุชื่อการ์ดและซีรีย์ก่อนทดสอบเปิดซอง' : 'Please specify card name and series name to test', 'warning');
      goToStep(1);
      return;
    }
    if (cards.length === 0) {
      addToast(language === 'th' ? 'กรุณาแนบการ์ดอย่างน้อย 1 ใบก่อนทดสอบเปิดซอง' : 'Please attach at least 1 card before testing', 'warning');
      goToStep(2);
      return;
    }
    const pack = buildCurrentPack();
    setEditingPack(pack);
    navigate(`/Create/Test/${toCleanSlug(pack.franchiseName)}/${toCleanSlug(pack.seriesName)}`);
  };

  // Helper to start fresh pack creation with completely clean slate (Item 4)
  const handleStartNewPack = () => {
    startNewPackCreation();
    setFranchiseName('');
    setSeriesName('');
    setSelectedTags([]);
    setCardsPerPack(5);
    setPrice(500);
    setCoverImageUrl('');
    setOriginalCoverImageUrl('');
    setCoverAspectRatio('auto');
    setTearConfig({ direction: 'up' });
    setRarities([
      { id: 'rarity-c', name: 'C', color: '#94a3b8', cardCount: 0, hasConfetti: false },
      { id: 'rarity-r', name: 'R', color: '#38bdf8', cardCount: 0, hasConfetti: false },
    ]);
    setCards([]);
    currentPackIdRef.current = `pack-${Date.now()}`;
    addToast(
      language === 'th' ? 'ล้างหน้าข้อมูลเรียบร้อย พร้อมสำหรับเริ่มสร้างชุดใหม่' : 'Form cleared, ready for new pack',
      'info'
    );
  };

  // Duplicate rename handlers (Item 3)
  const handleStartRenamingDuplicates = () => {
    if (!duplicateCardNameModal) return;
    const initialEdits: Record<string, string> = {};
    duplicateCardNameModal.duplicateGroups.forEach(groupCards => {
      groupCards.forEach(c => {
        initialEdits[c.id] = c.name;
      });
    });
    setDuplicateNameEdits(initialEdits);
    setIsRenamingDuplicates(true);
  };

  const handleUpdateDuplicateCardName = (cardId: string, newName: string) => {
    setDuplicateNameEdits(prev => ({ ...prev, [cardId]: newName }));
  };

  const handleApplyDuplicateNameRenames = async () => {
    if (!duplicateCardNameModal) return;

    // 1. Apply name changes to cards in editor
    const updatedCards = cards.map(c => {
      if (duplicateNameEdits[c.id] !== undefined) {
        const cleanNewName = duplicateNameEdits[c.id].trim();
        if (cleanNewName) {
          return {
            ...c,
            name: cleanNewName,
            fields: (c.fields || []).map(f =>
              (f.name === 'ชื่อการ์ด' || f.name === 'Card Name') ? { ...f, value: cleanNewName } : f
            ),
          };
        }
      }
      return c;
    });

    setCards(updatedCards);

    // 2. Check if duplicate card names still remain
    const remainingDuplicateGroups = findDuplicateCardNameGroups(updatedCards);
    if (remainingDuplicateGroups.size > 0) {
      const pack = buildCurrentPack();
      pack.cards = updatedCards;
      setDuplicateCardNameModal({
        isOpen: true,
        duplicateGroups: remainingDuplicateGroups,
        packToSave: pack,
        isPublish: duplicateCardNameModal.isPublish,
      });
      const nextEdits: Record<string, string> = {};
      remainingDuplicateGroups.forEach(groupCards => {
        groupCards.forEach(c => {
          nextEdits[c.id] = duplicateNameEdits[c.id] || c.name;
        });
      });
      setDuplicateNameEdits(nextEdits);
      addToast(
        language === 'th'
          ? `ยังมีชื่อการ์ดซ้ำอยู่ ${remainingDuplicateGroups.size} รายการ กรุณาแก้ไขชื่อให้ต่างกัน`
          : `Still ${remainingDuplicateGroups.size} duplicate group(s) remaining, please adjust.`,
        'warning'
      );
      return;
    }

    // 3. Duplicates resolved cleanly! Close modal and proceed to save/publish
    const isPub = duplicateCardNameModal.isPublish;
    setDuplicateCardNameModal(null);
    setIsRenamingDuplicates(false);
    setDuplicateNameEdits({});

    addToast(
      language === 'th' ? 'เปลี่ยนชื่อการ์ดซ้ำเรียบร้อย กำลังดำเนินการบันทึก...' : 'Renamed duplicate cards, proceeding to save...',
      'success'
    );

    setTimeout(() => {
      if (isPub) {
        handlePublish(true);
      } else {
        handleSave(true);
      }
    }, 100);
  };

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-['Prompt']">
      {/* Top Header - Navbar ส่วนที่วงสีแดงเท่านั้น ติดบนสุดของหน้าจอ (Sticky top-0 z-40) */}
      <div className="sticky top-0 z-40 w-full bg-white dark:bg-zinc-900 border-b-2 border-black dark:border-white px-6 py-3 flex items-center justify-between shadow-sm">
        <button
          onClick={() => navigate('/')}
          className="p-1.5 rounded-xl border-2 border-black dark:border-white hover:bg-zinc-100 dark:hover:bg-zinc-800 sketch-btn"
          title={t.common.back}
        >
          <ArrowLeft size={18} />
        </button>

        {/* Action Buttons: Clear/New, Test, Save, Load, Publish */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          <button
            type="button"
            onClick={handleStartNewPack}
            className="px-3 py-1.5 text-xs sm:text-sm font-bold border-2 border-black dark:border-white rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 sketch-btn shadow-[2px_2px_0px_0px_rgba(0,0,0,0.8)] flex items-center gap-1.5"
            title={language === 'th' ? 'ล้างหน้าเพื่อเริ่มสร้างชุดใหม่' : 'Clear form and start new pack'}
          >
            <RotateCcw size={14} />
            <span className="hidden sm:inline">{language === 'th' ? 'เริ่มสร้างใหม่' : 'New Pack'}</span>
          </button>
          <button
            onClick={handleTest}
            className="px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-bold border-2 border-black dark:border-white rounded-xl bg-white dark:bg-zinc-800 hover:bg-zinc-100 sketch-btn shadow-[2px_2px_0px_0px_rgba(0,0,0,0.8)]"
          >
            {t.common.test}
          </button>
          <button
            onClick={() => handleSave()}
            className="px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-bold border-2 border-black dark:border-white rounded-xl bg-white dark:bg-zinc-800 hover:bg-zinc-100 sketch-btn shadow-[2px_2px_0px_0px_rgba(0,0,0,0.8)]"
          >
            {t.common.save}
          </button>
          <button
            onClick={() => setIsLoadModalOpen(true)}
            className="px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-bold border-2 border-black dark:border-white rounded-xl bg-white dark:bg-zinc-800 hover:bg-zinc-100 sketch-btn shadow-[2px_2px_0px_0px_rgba(0,0,0,0.8)]"
          >
            {t.common.load}
          </button>
          <button
            onClick={() => handlePublish()}
            className="px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-bold border-2 border-black dark:border-white rounded-xl bg-emerald-200 dark:bg-emerald-700 text-black dark:text-white hover:bg-emerald-300 sketch-btn shadow-[2px_2px_0px_0px_rgba(0,0,0,0.8)]"
          >
            {t.common.publish}
          </button>

          {/* Dark / Light Toggle */}
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-xl border-2 border-black dark:border-white bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 sketch-btn shadow-[2px_2px_0px_0px_rgba(0,0,0,0.8)]"
            title="Theme Toggle"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {/* Language Toggle */}
          <button
            onClick={toggleLanguage}
            className="px-3 py-1.5 text-xs font-bold rounded-xl border-2 border-black dark:border-white bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-700 sketch-btn shadow-[2px_2px_0px_0px_rgba(0,0,0,0.8)]"
          >
            {language === 'th' ? 'TH' : 'ENG'}
          </button>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* ======================================================== */}
        {/* STEP 1: Create Cards Pack (Wireframe 5-1 & 5.2)          */}
        {/* ======================================================== */}
        {currentStep === 1 && (
          <div className="bg-white dark:bg-zinc-800 border-3 border-black dark:border-white rounded-3xl p-6 sm:p-8 shadow-[7px_7px_0px_0px_rgba(0,0,0,1)] dark:shadow-[7px_7px_0px_0px_rgba(255,255,255,0.9)] space-y-8">
            <h1 className="text-3xl font-black text-center font-['Mali']">
              {t.createPack.step1Title}
            </h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Left Column: ชื่อแฟรนไชส์, ชื่อซองสุ่ม, และ แท็ก (Tags) */}
              <div className="space-y-6">
                {/* 1. ชื่อแฟรนไชส์ Dropdown */}
                <div className="relative">
                  <label className="block text-sm font-bold mb-1.5">
                    {t.createPack.franchiseLabel}
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsFranchiseDropdownOpen(!isFranchiseDropdownOpen);
                      setIsSeriesDropdownOpen(false);
                      setIsTagDropdownOpen(false);
                    }}
                    className="w-full flex items-center justify-between px-3.5 py-2 text-sm bg-white dark:bg-zinc-700 border-2 border-black dark:border-white rounded-xl shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-left font-semibold"
                  >
                    <span className={franchiseName ? '' : 'text-zinc-500 dark:text-zinc-400'}>
                      {franchiseName || t.createPack.franchisePlaceholder}
                    </span>
                    <ChevronDown size={16} />
                  </button>

                  {/* Dropdown Options */}
                  {isFranchiseDropdownOpen && (
                    <div className="absolute left-0 right-0 mt-1 bg-white dark:bg-zinc-800 border-2 border-black dark:border-white rounded-xl shadow-2xl z-50 py-1.5 text-xs max-h-56 overflow-y-auto">
                      {franchiseList.map((fran) => (
                        <div
                          key={fran}
                          onClick={() => handleSelectFranchise(fran)}
                          className={`px-3.5 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 cursor-pointer font-medium ${
                            franchiseName === fran ? 'bg-yellow-100 dark:bg-yellow-900/30 font-bold' : ''
                          }`}
                        >
                          {fran}
                        </div>
                      ))}
                      <div
                        onClick={() => {
                          setIsNewFranchiseInput(true);
                          setIsFranchiseDropdownOpen(false);
                        }}
                        className="px-3.5 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 cursor-pointer font-bold text-blue-600 dark:text-blue-400 border-t border-zinc-200 dark:border-zinc-700"
                      >
                        {t.createPack.franchiseAddNew}
                      </div>
                    </div>
                  )}

                  {isNewFranchiseInput && (
                    <div className="mt-2 flex gap-2">
                      <input
                        type="text"
                        value={newFranchiseValue}
                        onChange={(e) => setNewFranchiseValue(e.target.value)}
                        placeholder={t.createPack.franchiseInputPlaceholder}
                        className="flex-1 px-3 py-1.5 text-xs bg-white dark:bg-zinc-700 border-2 border-black dark:border-white rounded-lg focus:outline-none"
                        autoFocus
                      />
                      <button
                        onClick={() => {
                          if (newFranchiseValue.trim()) {
                            const val = newFranchiseValue.trim();
                            setFranchiseSeriesMap(prev => ({ ...prev, [val]: [] }));
                            setFranchiseName(val);
                            setSeriesName('');
                            setNewFranchiseValue('');
                            setIsNewFranchiseInput(false);
                          }
                        }}
                        className="px-3 py-1 text-xs font-bold bg-yellow-300 text-black border-2 border-black rounded-lg sketch-btn"
                      >
                        {t.createPack.franchiseSave}
                      </button>
                      <button
                        onClick={() => {
                          setIsNewFranchiseInput(false);
                          setNewFranchiseValue('');
                        }}
                        className="px-2 py-1 text-xs font-bold bg-zinc-200 dark:bg-zinc-600 border-2 border-black dark:border-white rounded-lg"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  )}
                </div>

                {/* 2. ชื่อซองสุ่ม Dropdown */}
                <div className="relative">
                  <label className="block text-sm font-bold mb-1.5">
                    {t.createPack.packNameLabel}
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsSeriesDropdownOpen(!isSeriesDropdownOpen);
                      setIsFranchiseDropdownOpen(false);
                      setIsTagDropdownOpen(false);
                    }}
                    className="w-full flex items-center justify-between px-3.5 py-2 text-sm bg-white dark:bg-zinc-700 border-2 border-black dark:border-white rounded-xl shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-left font-semibold"
                  >
                    <span className={seriesName ? '' : 'text-zinc-500 dark:text-zinc-400'}>
                      {seriesName || t.createPack.packNamePlaceholder}
                    </span>
                    <ChevronDown size={16} />
                  </button>

                  {isSeriesDropdownOpen && (
                    <div className="absolute left-0 right-0 mt-1 bg-white dark:bg-zinc-800 border-2 border-black dark:border-white rounded-xl shadow-2xl z-50 py-1.5 text-xs max-h-56 overflow-y-auto">
                      {availableSeries.length > 0 ? (
                        availableSeries.map((s) => (
                          <div
                            key={s}
                            onClick={() => {
                              setSeriesName(s);
                              setIsSeriesDropdownOpen(false);
                            }}
                            className={`px-3.5 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 cursor-pointer font-medium ${
                              seriesName === s ? 'bg-yellow-100 dark:bg-yellow-900/30 font-bold' : ''
                            }`}
                          >
                            {s}
                          </div>
                        ))
                      ) : (
                        <div className="px-3.5 py-2 text-zinc-400 italic">
                          {t.createPack.packNameEmpty} {franchiseName || ''}
                        </div>
                      )}
                      <div
                        onClick={() => {
                          setIsNewSeriesInput(true);
                          setIsSeriesDropdownOpen(false);
                        }}
                        className="px-3.5 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 cursor-pointer font-bold text-blue-600 dark:text-blue-400 border-t border-zinc-200 dark:border-zinc-700"
                      >
                        {t.createPack.packNameAddNew}
                      </div>
                    </div>
                  )}

                  {isNewSeriesInput && (
                    <div className="mt-2 flex gap-2">
                      <input
                        type="text"
                        value={newSeriesValue}
                        onChange={(e) => setNewSeriesValue(e.target.value)}
                        placeholder={t.createPack.packNameInputPlaceholder}
                        className="flex-1 px-3 py-1.5 text-xs bg-white dark:bg-zinc-700 border-2 border-black dark:border-white rounded-lg focus:outline-none"
                        autoFocus
                      />
                      <button
                        onClick={() => {
                          if (newSeriesValue.trim()) {
                            const val = newSeriesValue.trim();
                            setFranchiseSeriesMap(prev => {
                              const existing = prev[franchiseName] || [];
                              return {
                                ...prev,
                                [franchiseName]: [...existing, val]
                              };
                            });
                            setSeriesName(val);
                            setNewSeriesValue('');
                            setIsNewSeriesInput(false);
                          }
                        }}
                        className="px-3 py-1 text-xs font-bold bg-yellow-300 text-black border-2 border-black rounded-lg sketch-btn"
                      >
                        {t.createPack.packNameSave}
                      </button>
                      <button
                        onClick={() => {
                          setIsNewSeriesInput(false);
                          setNewSeriesValue('');
                        }}
                        className="px-2 py-1 text-xs font-bold bg-zinc-200 dark:bg-zinc-600 border-2 border-black dark:border-white rounded-lg"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  )}

                  {/* Inform user if this franchise/series already exists in system, allow 1-click loading */}
                  {(() => {
                    const match = packs.find(
                      p => p.franchiseName.trim().toLowerCase() === franchiseName.trim().toLowerCase() &&
                           p.seriesName.trim().toLowerCase() === seriesName.trim().toLowerCase()
                    );
                    if (!match || match.id === editingPack?.id) return null;
                    const isOwnerOrAdmin = !match.authorId || match.authorId === currentUser?.id || currentUser?.role === 'Admin';
                    if (!isOwnerOrAdmin) {
                      if (!match.isPublished) {
                        return (
                          <div className="mt-2.5 p-3 bg-red-50 dark:bg-red-950/40 border-2 border-red-400 dark:border-red-600 rounded-xl text-xs shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] text-red-900 dark:text-red-200">
                            <p className="font-bold">
                              {language === 'th' ? 'ชื่อชุดนี้เป็นฉบับร่างส่วนตัวของผู้ใช้อื่น' : 'This pack is another user private draft'}
                            </p>
                            <p className="text-[11px] text-red-700 dark:text-red-300 mt-0.5">
                              {language === 'th' ? 'คุณไม่สามารถเข้าถึงหรือเขียนทับฉบับร่างส่วนตัวได้ กรุณาระบุชื่อชุดใหม่' : 'Private drafts cannot be modified. Please choose another name.'}
                            </p>
                          </div>
                        );
                      }
                      return (
                        <div className="mt-2.5 p-3 bg-emerald-50 dark:bg-emerald-950/40 border-2 border-emerald-400 dark:border-emerald-600 rounded-xl flex items-center justify-between text-xs gap-3 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
                          <div>
                            <p className="font-bold text-emerald-900 dark:text-emerald-200">
                              {language === 'th' ? `พบชุดที่เผยแพร่อยู่ในระบบ (มีการ์ดอยู่ ${match.cards.length} ใบ)` : `Published pack found in system (${match.cards.length} cards)`}
                            </p>
                            <p className="text-[11px] text-emerald-700 dark:text-emerald-300 mt-0.5">
                              {language === 'th' ? 'ต้องการโหลดชุดนี้เพื่อร่วมเพิ่มการ์ดใหม่เข้าชุดนี้หรือไม่? (การ์ดเดิมจะไม่สูญหาย)' : 'Load to contribute new cards to this pack? (Existing cards will not be lost)'}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => loadPackIntoEditor(match)}
                            className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-lg border border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] text-xs shrink-0 sketch-btn"
                          >
                            {language === 'th' ? 'ร่วมเพิ่มการ์ด' : 'Contribute Cards'}
                          </button>
                        </div>
                      );
                    }
                    return (
                      <div className="mt-2.5 p-3 bg-blue-50 dark:bg-blue-950/40 border-2 border-blue-400 dark:border-blue-600 rounded-xl flex items-center justify-between text-xs gap-3 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
                        <div>
                          <p className="font-bold text-blue-900 dark:text-blue-200">
                            {language === 'th' ? `พบชุดนี้ของคุณในระบบแล้ว (มีการ์ดอยู่ ${match.cards.length} ใบ)` : `Found your existing pack (${match.cards.length} cards)`}
                          </p>
                          <p className="text-[11px] text-blue-700 dark:text-blue-300 mt-0.5">
                            {language === 'th' ? 'ต้องการโหลดการ์ดเดิมทั้งหมดมาแก้ไขหรือเพิ่มการ์ดต่อหรือไม่?' : 'Load existing cards to edit or add more?'}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => loadPackIntoEditor(match)}
                          className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-lg border border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] text-xs shrink-0 sketch-btn"
                        >
                          {language === 'th' ? 'โหลดข้อมูลเดิม' : 'Load Pack'}
                        </button>
                      </div>
                    );
                  })()}
                </div>

                {/* 3. แท็ก (Tags) Custom Multi-Select Dropdown ข้างล่าง ชื่อซองสุ่ม */}
                <div className="relative">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-sm font-bold">
                      {t.createPack.tagsLabel}
                    </label>
                    {selectedTags.length > 0 && (
                      <span className="text-xs text-zinc-500 dark:text-zinc-400 font-semibold">
                        {language === 'th' ? `เลือกแล้ว ${selectedTags.length} แท็ก` : `${selectedTags.length} tags selected`}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsTagDropdownOpen(!isTagDropdownOpen);
                      setIsFranchiseDropdownOpen(false);
                      setIsSeriesDropdownOpen(false);
                    }}
                    className="w-full min-h-[42px] flex items-center justify-between px-3 py-1.5 text-sm bg-white dark:bg-zinc-700 border-2 border-black dark:border-white rounded-xl shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-left font-semibold gap-2"
                  >
                    {selectedTags.length === 0 ? (
                      <span className="text-zinc-500 dark:text-zinc-400">
                        {t.createPack.tagsPlaceholder}
                      </span>
                    ) : (
                      <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0 py-0.5">
                        {selectedTags.map((item) => (
                          <span
                            key={item}
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-yellow-300 text-black text-xs font-bold rounded-lg border border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]"
                          >
                            <span>{item}</span>
                            <span
                              role="button"
                              tabIndex={0}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleTag(item);
                              }}
                              className="hover:text-red-700 p-0.5 rounded cursor-pointer transition-colors"
                              title={language === 'th' ? 'คลิกเพื่อยกเลิกแท็กนี้' : 'Click to remove tag'}
                            >
                              <X size={12} />
                            </span>
                          </span>
                        ))}
                      </div>
                    )}
                    <ChevronDown size={16} className={`shrink-0 transition-transform ${isTagDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isTagDropdownOpen && (
                    <div className="absolute left-0 right-0 mt-1 bg-white dark:bg-zinc-800 border-2 border-black dark:border-white rounded-xl shadow-2xl z-50 py-1.5 text-xs max-h-56 overflow-y-auto">
                      <div className="px-3.5 py-1 text-[11px] font-bold text-zinc-400 uppercase tracking-wider border-b border-zinc-100 dark:border-zinc-700 mb-1">
                        {language === 'th' ? 'เลือกแท็กที่ต้องการ' : 'Select tags'}
                      </div>
                      {tags.map((item) => {
                        const isSelected = selectedTags.some(t => t.toLowerCase() === item.toLowerCase());
                        return (
                          <div
                            key={item}
                            onClick={() => toggleTag(item)}
                            className={`px-3.5 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 cursor-pointer font-medium flex items-center justify-between transition-colors ${
                              isSelected
                                ? 'bg-yellow-100 dark:bg-yellow-900/30 font-bold text-yellow-900 dark:text-yellow-300 border-l-4 border-yellow-500'
                                : ''
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              <span
                                className={`w-4 h-4 rounded border border-black dark:border-white flex items-center justify-center text-[10px] ${
                                  isSelected ? 'bg-yellow-400 text-black font-bold' : 'bg-white dark:bg-zinc-700'
                                }`}
                              >
                                {isSelected && <Check size={11} strokeWidth={3} />}
                              </span>
                              <span>{item}</span>
                            </span>
                            {isSelected && (
                              <span className="text-[11px] text-yellow-700 dark:text-yellow-400 font-semibold">
                                {t.createPack.tagsSelected}
                              </span>
                            )}
                          </div>
                        );
                      })}
                      <div
                        onClick={() => {
                          setIsNewTagInput(true);
                          setIsTagDropdownOpen(false);
                        }}
                        className="px-3.5 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 cursor-pointer font-bold text-blue-600 dark:text-blue-400 border-t border-zinc-200 dark:border-zinc-700"
                      >
                        {t.createPack.tagsAddNew}
                      </div>
                    </div>
                  )}

                  {isNewTagInput && (
                    <div className="mt-2 flex gap-2">
                      <input
                        type="text"
                        value={newTagValue}
                        onChange={(e) => setNewTagValue(e.target.value)}
                        placeholder={t.createPack.tagsInputPlaceholder}
                        className="flex-1 px-3 py-1.5 text-xs bg-white dark:bg-zinc-700 border-2 border-black dark:border-white rounded-lg focus:outline-none"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (newTagValue.trim()) {
                            const val = newTagValue.trim();
                            addTag(val);
                            setSelectedTags(prev => {
                              if (prev.some(t => t.toLowerCase() === val.toLowerCase())) return prev;
                              return [...prev, val];
                            });
                            setNewTagValue('');
                            setIsNewTagInput(false);
                            addToast(language === 'th' ? `สร้างแท็ก "${val}" สำเร็จ` : `Tag "${val}" created`, 'success');
                          }
                        }}
                        className="px-3 py-1 text-xs font-bold bg-yellow-300 text-black border-2 border-black rounded-lg sketch-btn"
                      >
                        {t.createPack.tagsSave}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsNewTagInput(false);
                          setNewTagValue('');
                        }}
                        className="px-2 py-1 text-xs font-bold bg-zinc-200 dark:bg-zinc-600 border-2 border-black dark:border-white rounded-lg"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: จำนวนการ์ดในซอง & ราคาต่อ Pack */}
              <div className="space-y-6">
                <div className="p-4 border-2 border-black dark:border-white rounded-2xl bg-zinc-50 dark:bg-zinc-900/40">
                  <div className="flex justify-between items-center mb-2.5">
                    <label className="text-sm font-bold">{t.createPack.cardsPerPack}</label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={cardsPerPack}
                      onChange={(e) => setCardsPerPack(Number(e.target.value))}
                      className="w-20 px-2 py-1 text-sm text-center font-bold bg-white dark:bg-zinc-700 border-2 border-black dark:border-white rounded-lg"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-zinc-500">{t.common.preset}</span>
                    {[3, 4, 5].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setCardsPerPack(val)}
                        className={`px-3 py-1 text-xs font-bold border-2 border-black dark:border-white rounded-lg sketch-btn ${
                          cardsPerPack === val ? 'bg-yellow-300 text-black' : 'bg-white dark:bg-zinc-800'
                        }`}
                      >
                        {val}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-4 border-2 border-black dark:border-white rounded-2xl bg-zinc-50 dark:bg-zinc-900/40">
                  <div className="flex justify-between items-center mb-2.5">
                    <label className="text-sm font-bold">{t.createPack.pricePerPack}</label>
                    <input
                      type="number"
                      min={0}
                      step={50}
                      value={price}
                      onChange={(e) => setPrice(Number(e.target.value))}
                      className="w-24 px-2 py-1 text-sm text-center font-bold bg-white dark:bg-zinc-700 border-2 border-black dark:border-white rounded-lg"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-zinc-500">{t.common.preset}</span>
                    {[150, 300, 500].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setPrice(val)}
                        className={`px-3 py-1 text-xs font-bold border-2 border-black dark:border-white rounded-lg sketch-btn ${
                          price === val ? 'bg-yellow-300 text-black' : 'bg-white dark:bg-zinc-800'
                        }`}
                      >
                        {val}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Pack Cover Drop Zone & Preview with Tear Cut Line Configurator */}
            <div className="pt-6 border-t-2 border-dashed border-zinc-300 dark:border-zinc-700">
              <label className="block text-base font-black mb-3">
                {t.createPack.coverImageTitle} ({t.createPack.coverSubtitle})
              </label>
              <PackCoverConfigurator
                coverImageUrl={coverImageUrl}
                originalCoverImageUrl={originalCoverImageUrl}
                coverAspectRatio={coverAspectRatio}
                tearConfig={tearConfig}
                onChangeCover={(url, origUrl) => {
                  setCoverImageUrl(url);
                  if (origUrl) setOriginalCoverImageUrl(origUrl);
                  else if (!originalCoverImageUrl) setOriginalCoverImageUrl(url);
                }}
                onChangeAspectRatio={(ratio) => setCoverAspectRatio(ratio)}
                onChangeTearConfig={(config) => setTearConfig(config)}
                franchiseName={franchiseName}
                seriesName={seriesName}
              />
            </div>

            {/* Step 1 Actions: Next */}
            <div className="pt-4 flex justify-end items-center">
              <button
                type="button"
                onClick={() => goToStep(2)}
                className="px-8 py-2 bg-white dark:bg-zinc-700 hover:bg-zinc-100 font-bold border-2 border-black dark:border-white rounded-xl shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(255,255,255,0.9)] sketch-btn"
              >
                {t.common.next}
              </button>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* STEP 2: Create Cards (Wireframe 6-1 & 6-2)                */}
        {/* ======================================================== */}
        {currentStep === 2 && (
          <div className="bg-white dark:bg-zinc-800 border-3 border-black dark:border-white rounded-3xl p-6 sm:p-8 shadow-[7px_7px_0px_0px_rgba(0,0,0,1)] dark:shadow-[7px_7px_0px_0px_rgba(255,255,255,0.9)] space-y-8">
            <div className="flex justify-between items-center border-b pb-4 border-zinc-200 dark:border-zinc-700">
              <h1 className="text-3xl font-black font-['Mali']">
                {t.createCards.title}
              </h1>
              <span className="text-sm font-bold text-zinc-600 dark:text-zinc-400">
                {t.createCards.attachedTotal.replace('{total}', String(cards.length))}
              </span>
            </div>

            {/* Rarity Drop Rates Configuration */}
            <div className="p-5 border-2 border-black dark:border-white rounded-2xl bg-zinc-50 dark:bg-zinc-900/40">
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-sm font-bold">{t.createCards.raritiesTitle}</h2>
                {!isAddingRarity && (
                  <button
                    type="button"
                    onClick={() => setIsAddingRarity(true)}
                    className="px-3 py-1 text-xs font-bold border-2 border-black dark:border-white rounded-lg bg-yellow-300 text-black sketch-btn"
                  >
                    {t.createCards.addRarity}
                  </button>
                )}
              </div>

              {isAddingRarity && (
                <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-950/20 border-2 border-black dark:border-white rounded-xl flex items-center gap-2">
                  <input
                    type="text"
                    value={newRarityInputName}
                    onChange={(e) => setNewRarityInputName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleConfirmAddRarity();
                      if (e.key === 'Escape') {
                        setIsAddingRarity(false);
                        setNewRarityInputName('');
                      }
                    }}
                    placeholder={t.createCards.addRarityPlaceholder}
                    className="flex-1 px-3 py-1.5 text-xs font-bold uppercase bg-white dark:bg-zinc-800 border-2 border-black dark:border-white rounded-lg"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setNewRarityConfetti(!newRarityConfetti)}
                    className={`p-1.5 rounded-lg border-2 border-black dark:border-white transition-all sketch-btn ${
                      newRarityConfetti
                        ? 'bg-amber-400 text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                        : 'bg-zinc-100 dark:bg-zinc-700 text-zinc-400 hover:text-zinc-600 opacity-60'
                    }`}
                    title={newRarityConfetti ? t.createCards.confettiOnHint : t.createCards.confettiOffHint}
                  >
                    <PartyPopper size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmAddRarity}
                    className="px-3.5 py-1.5 text-xs font-bold bg-yellow-400 text-black border-2 border-black rounded-lg sketch-btn"
                  >
                    {t.createCards.addRarityConfirm}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingRarity(false);
                      setNewRarityInputName('');
                      setNewRarityConfetti(false);
                    }}
                    className="px-2.5 py-1.5 text-xs font-bold bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-white border-2 border-black dark:border-white rounded-lg"
                  >
                    {t.common.cancel}
                  </button>
                </div>
              )}

              <div className="space-y-3">
                {rarities.map((r, idx) => {
                  const attachedCount = cards.filter(c => c.rarity?.trim().toLowerCase() === r.name?.trim().toLowerCase()).length;
                  const chancePerCard = attachedCount > 0 ? (100 / attachedCount).toFixed(1) : '0';

                  return (
                    <div
                      key={r.id}
                      draggable={editingRarityId !== r.id && draggingHandleRarityId === r.id}
                      onDragStart={(e) => handleDragStartRarity(e, idx)}
                      onDragOver={(e) => handleDragOverRarity(e, idx)}
                      onDrop={(e) => handleDropRarity(e, idx)}
                      onDragEnd={() => {
                        setDraggedRarityIdx(null);
                        setDraggingHandleRarityId(null);
                      }}
                      className={`flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-2.5 bg-white dark:bg-zinc-800 border-2 border-black dark:border-white rounded-xl transition-all ${
                        draggedRarityIdx === idx ? 'opacity-40 border-dashed scale-[0.98]' : ''
                      }`}
                    >
                      {/* Left: Drag Handle :: + Rarity Name / Rename (Requirement 16) */}
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div
                          onMouseDown={() => setDraggingHandleRarityId(r.id)}
                          onMouseUp={() => setDraggingHandleRarityId(null)}
                          onTouchStart={() => setDraggingHandleRarityId(r.id)}
                          onTouchEnd={() => setDraggingHandleRarityId(null)}
                          className="cursor-grab active:cursor-grabbing text-zinc-400 hover:text-black dark:hover:text-white px-1 select-none font-mono font-black text-sm shrink-0 tracking-tighter"
                          title={t.createCards.dragReorderHint}
                        >
                          ::
                        </div>

                        {editingRarityId === r.id ? (
                          <div className="flex items-center gap-2 flex-wrap">
                            <input
                              type="text"
                              value={editRarityName}
                              onChange={(e) => setEditRarityName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveRarityRename(r.id);
                                if (e.key === 'Escape') setEditingRarityId(null);
                              }}
                              className="min-w-[4rem] max-w-xs px-2 py-1 text-xs font-bold border-2 border-black rounded-lg uppercase"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveRarityRename(r.id)}
                              className="p-1 bg-green-300 hover:bg-green-400 rounded-lg border border-black shrink-0"
                              title={t.common.save}
                            >
                              <Check size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingRarityId(null)}
                              className="p-1 bg-zinc-200 hover:bg-zinc-300 rounded-lg border border-black shrink-0"
                              title={t.common.cancel}
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 min-w-0 flex-wrap">
                            <span className="font-bold text-sm break-all select-all">
                              {r.name}
                            </span>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingRarityId(r.id);
                                  setEditRarityName(r.name);
                                }}
                                className="p-1 text-zinc-500 hover:text-black dark:hover:text-white rounded hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors shrink-0"
                                title={t.createCards.renameRarityHint}
                              >
                                <Edit2 size={14} />
                              </button>
                              {rarities.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteRarity(r.id)}
                                  className="p-1 text-red-500 hover:text-red-700 rounded hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors shrink-0"
                                  title={t.createCards.deleteRarityHint}
                                >
                                  <X size={15} />
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Center: Color Picker with Neo-Brutalist Popover & HexCode */}
                      <div className="flex items-center gap-2 shrink-0">
                        <NeoColorPicker
                          color={r.color || '#94a3b8'}
                          onChange={(newColor) => {
                            setRarities(prev => prev.map(item => item.id === r.id ? { ...item, color: newColor } : item));
                          }}
                          language={language}
                          title={t.createCards.colorWheelHint}
                        />

                        <input
                          type="text"
                          value={r.color || '#94a3b8'}
                          onChange={(e) => {
                            let val = e.target.value;
                            if (val.length > 0 && !val.startsWith('#')) {
                              val = '#' + val;
                            }
                            setRarities(prev => prev.map(item => item.id === r.id ? { ...item, color: val } : item));
                          }}
                          placeholder="#HEX"
                          maxLength={7}
                          className="w-20 px-2 py-1 text-xs font-mono font-bold bg-white dark:bg-zinc-700 border-2 border-black dark:border-white rounded-lg uppercase focus:outline-none"
                          title={t.createCards.hexCodeHint}
                        />
                      </div>

                      {/* Right: Attached count, Card Chance % & Drop rate count */}
                      <div className="flex items-center gap-2 shrink-0 justify-between sm:justify-end">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-zinc-500 dark:text-zinc-400 font-semibold hidden sm:inline">
                            {language === 'th' ? `แนบแล้ว ${attachedCount} ใบ` : `${attachedCount} attached`}
                          </span>
                          {attachedCount > 0 && (
                            <span
                              className="text-[10px] font-bold px-1.5 py-0.5 bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 rounded border border-sky-300 dark:border-sky-700"
                              title={language === 'th' ? `โอกาสออกการ์ดแต่ล่ะใบในเรทนี้คือ 100/${attachedCount} = ${chancePerCard}%` : `Drop chance per card: ${chancePerCard}%`}
                            >
                              ~{chancePerCard}%/{language === 'th' ? 'ใบ' : 'card'}
                            </span>
                          )}
                        </div>
                        <input
                          type="number"
                          min={0}
                          max={attachedCount}
                          value={Math.max(0, Math.min(attachedCount, r.cardCount ?? 0))}
                          onChange={(e) => {
                            const parsed = parseInt(e.target.value, 10);
                            const val = isNaN(parsed) ? 0 : Math.max(0, Math.min(attachedCount, parsed));
                            setRarities(prev => {
                              const next = [...prev];
                              next[idx] = { ...next[idx], cardCount: val };
                              return next;
                            });
                          }}
                          className="w-16 px-1.5 py-1 text-center font-bold bg-zinc-50 dark:bg-zinc-700 border-2 border-black dark:border-white rounded-lg text-sm"
                          title={language === 'th' ? `จำนวนใบที่จะออกต่อ 1 ซอง (0 ถึง ${attachedCount} ใบ)` : `Cards to drop per pack (0 to ${attachedCount})`}
                        />
                        <span className="text-xs font-bold">{t.createCards.cardsUnit}</span>

                        {/* Confetti Party Popper Toggle Button */}
                        <button
                          type="button"
                          onClick={() => {
                            setRarities(prev => prev.map(item => item.id === r.id ? { ...item, hasConfetti: !item.hasConfetti } : item));
                          }}
                          className={`p-1.5 rounded-lg border-2 border-black dark:border-white transition-all sketch-btn shrink-0 ${
                            r.hasConfetti
                              ? 'bg-amber-400 text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                              : 'bg-zinc-100 dark:bg-zinc-700 text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 hover:bg-zinc-200 opacity-60'
                          }`}
                          title={r.hasConfetti ? t.createCards.confettiOnHint : t.createCards.confettiOffHint}
                        >
                          <PartyPopper size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* SEPARATE UPLOAD DROP ZONE & PREVIEW PER RARITY (Requirement 6 & 14) */}
            <div className="space-y-8">
              {rarities.map((r) => {
                const rarityCards = cards.filter(c => c.rarity?.trim().toLowerCase() === r.name?.trim().toLowerCase());
                const isDragging = draggingOverRarity === r.name;

                return (
                  <div
                    key={r.id}
                    className="p-5 border-2 border-black dark:border-white rounded-2xl bg-white dark:bg-zinc-800 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.85)] space-y-4"
                  >
                    <div className="flex justify-between items-center border-b pb-2 border-zinc-200 dark:border-zinc-700">
                      <h2 className="text-base font-black flex items-center gap-2">
                        <span>{t.createCards.raritySectionTitle.replace('{name}', r.name)}</span>
                        <span className="text-xs font-normal text-zinc-500">
                          {t.createCards.rarityConfiguredHint.replace('{count}', String(r.cardCount))}
                        </span>
                      </h2>
                      <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400">
                        {t.createCards.rarityAttachedHint.replace('{count}', String(rarityCards.length))}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                      <div>
                        <div
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setDraggingOverRarity(r.name);
                          }}
                          onDragLeave={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setDraggingOverRarity(null);
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setDraggingOverRarity(null);
                            handleCardsUploadForRarity(r.name, e.dataTransfer.files);
                          }}
                          className={`border-3 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition-colors text-center min-h-[160px] ${
                            isDragging
                              ? 'border-yellow-400 bg-yellow-50 dark:bg-yellow-950/20'
                              : 'border-black dark:border-white hover:bg-zinc-50 dark:hover:bg-zinc-700/40'
                          }`}
                        >
                          <label className="cursor-pointer w-full flex flex-col items-center">
                            <Upload size={26} className="text-zinc-500 mb-1.5" />
                            <span className="text-xs font-bold">
                              {t.createCards.dropZoneTitle.replace('{name}', r.name)}
                            </span>
                            <span className="text-[11px] text-zinc-400 mt-0.5">
                              {t.createCards.dropZoneSub}
                            </span>
                            <input
                              type="file"
                              multiple
                              accept="image/*"
                              onChange={(e) => handleCardsUploadForRarity(r.name, e.target.files)}
                              className="hidden"
                            />
                          </label>
                        </div>
                      </div>

                      {/* Preview Cards for this specific rarity */}
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-xs font-bold">
                            {t.createCards.previewTitle.replace('{count}', String(rarityCards.length))}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-56 overflow-y-auto p-2 border-2 border-zinc-200 dark:border-zinc-700 rounded-xl">
                          {rarityCards.map((card, idx) => (
                            <div
                              key={card.id}
                              title={card.fileName || `${card.name}.png`}
                              className="group relative border-2 border-black dark:border-white rounded-xl overflow-visible bg-white dark:bg-zinc-900 p-1 flex items-center justify-center shadow-sm"
                            >
                              {/* Index circle in top-left matching wireframe 6-1 */}
                              <div className="absolute -top-2 -left-2 w-5 h-5 bg-black text-white text-[10px] font-bold rounded-full flex items-center justify-center z-10 border border-white">
                                {idx + 1}
                              </div>

                              {/* Card image with natural aspect ratio (Requirement 3) */}
                              <img
                                src={card.imageUrl}
                                alt={card.name}
                                className="max-h-36 max-w-full w-auto h-auto object-contain rounded-lg block cursor-pointer"
                                onClick={() => {
                                  setExpandedImageUrl(card.imageUrl);
                                }}
                              />

                              {/* Hover Filename Badge (Requirement 3) */}
                              <div className="absolute bottom-1 left-1 right-1 z-20 px-1.5 py-0.5 text-[9px] font-bold bg-black/85 text-white rounded backdrop-blur-sm pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity truncate text-center shadow border border-white/20">
                                {card.fileName || `${card.name}.png`}
                              </div>

                              {/* Floating Maximize button at bottom-left */}
                              <button
                                type="button"
                                onClick={() => {
                                  setExpandedImageUrl(card.imageUrl);
                                }}
                                className="absolute -bottom-2 -left-2 w-6 h-6 bg-white dark:bg-zinc-800 border-2 border-black dark:border-white rounded-full flex items-center justify-center text-zinc-900 dark:text-white z-10 shadow hover:bg-yellow-300 sketch-btn"
                                title={t.createCards.zoomCard}
                              >
                                <Maximize2 size={12} />
                              </button>

                              {/* Floating Crop button at bottom-right matching wireframe 6-1 ↖↘ (Requirement 2) */}
                              <button
                                type="button"
                                onClick={() => handleOpenCardCropper(card)}
                                className="absolute -bottom-2 -right-2 w-6 h-6 bg-white dark:bg-zinc-800 border-2 border-black dark:border-white rounded-full flex items-center justify-center text-zinc-900 dark:text-white z-10 shadow hover:bg-yellow-300 sketch-btn"
                                title={t.createCards.cropCard}
                              >
                                <Crop size={12} />
                              </button>

                              {/* Floating (X) delete button at top-right matching wireframe 6-1 */}
                              <button
                                type="button"
                                onClick={() => {
                                  requestDelete(() => {
                                    setCards(prev => prev.filter(c => c.id !== card.id));
                                    setRarities(prev => prev.map(item => {
                                      if (item.name === card.rarity) {
                                        const count = cards.filter(c => c.rarity === card.rarity).length;
                                        return { ...item, cardCount: Math.max(0, count - 1) };
                                      }
                                      return item;
                                    }));
                                  });
                                }}
                                className="absolute -top-2 -right-2 w-5 h-5 bg-white dark:bg-zinc-800 border-2 border-red-500 rounded-full flex items-center justify-center text-red-500 font-bold z-20 shadow hover:bg-red-50"
                                title={t.createCards.deleteCard}
                              >
                                <X size={11} />
                              </button>
                            </div>
                          ))}

                          {rarityCards.length === 0 && (
                            <div className="col-span-full py-8 text-center text-xs text-zinc-400">
                              {t.createCards.noImagesInRarity.replace('{name}', r.name)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Unassigned / Other Cards so duplicate or missing-rarity cards are NEVER hidden */}
              {(() => {
                const unassignedCards = cards.filter(c => !rarities.some(r => r.name.trim().toLowerCase() === (c.rarity || '').trim().toLowerCase()));
                if (unassignedCards.length === 0) return null;
                return (
                  <div className="p-5 border-2 border-black dark:border-white rounded-2xl bg-amber-50 dark:bg-amber-950/30 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] space-y-4">
                    <div className="flex justify-between items-center border-b pb-2 border-zinc-200 dark:border-zinc-700">
                      <h2 className="text-base font-black flex items-center gap-2">
                        <span>{language === 'th' ? 'การ์ดระดับอื่นๆ / การ์ดที่รอจัดหมวดหมู่' : 'Unassigned / Other Cards'}</span>
                        <span className="text-xs font-normal text-zinc-500">
                          ({unassignedCards.length} {language === 'th' ? 'ใบ' : 'cards'})
                        </span>
                      </h2>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3 p-2">
                      {unassignedCards.map((card) => (
                        <div
                          key={card.id}
                          className="group relative border-2 border-black dark:border-white rounded-xl bg-white dark:bg-zinc-900 p-1 flex items-center justify-center shadow-sm"
                        >
                          <img
                            src={card.imageUrl}
                            alt={card.name}
                            className="max-h-36 max-w-full w-auto h-auto object-contain rounded-lg block cursor-pointer"
                            onClick={() => setExpandedImageUrl(card.imageUrl)}
                          />
                          <div className="absolute bottom-1 left-1 right-1 z-20 px-1.5 py-0.5 text-[9px] font-bold bg-black/85 text-white rounded truncate text-center">
                            {card.name}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Step 2 Actions: ย้อนกลับ & Next */}
            <div className="pt-4 flex justify-between items-center">
              <button
                type="button"
                onClick={() => goToStep(1)}
                className="px-6 py-2 bg-white dark:bg-zinc-700 hover:bg-zinc-100 font-bold border-2 border-black dark:border-white rounded-xl sketch-btn"
              >
                {t.createCards.backToPack}
              </button>
              <button
                type="button"
                onClick={() => goToStep(3)}
                className="px-8 py-2 bg-white dark:bg-zinc-700 hover:bg-zinc-100 font-bold border-2 border-black dark:border-white rounded-xl shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(255,255,255,0.9)] sketch-btn"
              >
                {t.createCards.nextToData}
              </button>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* STEP 3: Create Cards Data (Wireframe 7)                  */}
        {/* ======================================================== */}
        {currentStep === 3 && (
          <div className="bg-white dark:bg-zinc-800 border-3 border-black dark:border-white rounded-3xl p-6 sm:p-8 shadow-[7px_7px_0px_0px_rgba(0,0,0,1)] dark:shadow-[7px_7px_0px_0px_rgba(255,255,255,0.9)] space-y-8">
            <div className="flex flex-wrap justify-between items-center border-b pb-4 border-zinc-200 dark:border-zinc-700 gap-3">
              <div>
                <h1 className="text-3xl font-black font-['Mali']">
                  {t.createData.title}
                </h1>
                <span className="text-sm font-bold text-zinc-600 dark:text-zinc-400">
                  {t.createData.totalInFranchise.replace('{count}', String(cards.length)).replace('{franchise}', franchiseName || t.createPack.franchisePlaceholder)}
                </span>
              </div>
              {/* Button to add field across all cards in the same franchise (Requirement 2) */}
              <button
                type="button"
                onClick={() => setIsBulkFieldModalOpen(true)}
                className="px-4 py-2 text-xs font-bold bg-yellow-300 hover:bg-yellow-400 text-black rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] sketch-btn flex items-center gap-1.5"
                title={t.modals.bulkField.title}
              >
                <Plus size={16} />
                <span>{t.createData.addAllCardsField}</span>
              </button>
            </div>

            <div className="space-y-6">
              {sortCardsByRarityOrder(cards, rarities).map((card) => (
                <div
                  key={card.id}
                  className="p-5 border-2 border-black dark:border-white rounded-2xl flex flex-col md:flex-row gap-6 items-start bg-zinc-50 dark:bg-zinc-900/40"
                >
                  <div className="flex flex-col items-center shrink-0">
                    <span
                      className="text-xs font-black mb-1.5 px-2.5 py-0.5 border border-black rounded-md text-black shadow-sm"
                      style={{ backgroundColor: rarities.find(r => r.name === card.rarity)?.color || '#facc15' }}
                    >
                      {card.rarity}
                    </span>
                    <div
                      title={card.fileName || `${card.name}.png`}
                      className="group relative max-w-[180px] max-h-48 min-w-[90px] min-h-[110px] border-2 border-black dark:border-white rounded-xl overflow-hidden bg-white dark:bg-zinc-900 shadow-sm flex items-center justify-center p-1 cursor-pointer"
                      onClick={() => {
                        setExpandedImageUrl(card.imageUrl);
                      }}
                    >
                      <img
                        src={card.imageUrl}
                        alt={card.name}
                        className="max-h-44 max-w-[170px] w-auto h-auto object-contain block rounded-lg"
                      />
                      {/* Hover Filename Badge (Requirement 3) */}
                      <div className="absolute bottom-1 left-1 right-1 z-20 px-1.5 py-0.5 text-[9px] font-bold bg-black/85 text-white rounded backdrop-blur-sm pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity truncate text-center shadow border border-white/20">
                        {card.fileName || `${card.name}.png`}
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedImageUrl(card.imageUrl);
                        }}
                        className="absolute top-1.5 right-1.5 p-1 bg-black/75 hover:bg-black text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity z-10"
                        title={t.createCards.zoomCard}
                      >
                        <Maximize2 size={12} />
                      </button>
                    </div>
                  </div>

                  {/* Right: Dynamic Fields with Working Deletion (Requirement 2 & 16) */}
                  <div className="flex-1 w-full space-y-3">
                    {card.fields.map((field) => (
                      <div key={field.id} className="space-y-1">
                        <div className="flex items-center justify-between">
                          {/* Field name (either editable or fixed label) */}
                          <div className="flex items-center gap-1 text-xs font-bold">
                            <input
                              type="text"
                              value={field.name}
                              onChange={(e) => handleUpdateFieldName(card.id, field.id, e.target.value)}
                              className="bg-transparent border-b border-dashed border-zinc-400 focus:outline-none focus:border-black font-bold"
                            />
                            <Edit2 size={11} className="text-zinc-400" />
                          </div>

                          {/* Red (X) button that ACTUALLY deletes the field (Requirement 2) */}
                          <button
                            type="button"
                            onClick={() => handleDeleteFieldFromCard(card.id, field.id)}
                            className="p-0.5 text-red-500 hover:text-red-700"
                            title={t.createData.deleteFieldHint}
                          >
                            <X size={15} />
                          </button>
                        </div>

                        {/* Field Value Textarea (Requirement 4: รองรับกด Enter เพื่อเพิ่มบรรทัดใหม่) */}
                        <textarea
                          rows={Math.min(6, Math.max(1, (field.value || '').split('\n').length))}
                          value={field.value}
                          onChange={(e) => handleUpdateFieldValue(card.id, field.id, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.stopPropagation();
                            }
                          }}
                          placeholder={t.createData.optionalPlaceholder}
                          className="w-full px-3 py-1.5 text-xs bg-white dark:bg-zinc-700 border-2 border-black dark:border-white rounded-lg focus:outline-none resize-y min-h-[36px] font-['Prompt']"
                        />
                      </div>
                    ))}

                    {/* Add Field Buttons: per card or across all cards (Requirement 2) */}
                    <div className="flex items-center gap-4 pt-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => handleAddFieldToCard(card.id)}
                        className="flex items-center gap-1 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:underline"
                      >
                        <Plus size={14} />
                        <span>{t.createData.addFieldThisCardOnly}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsBulkFieldModalOpen(true)}
                        className="flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
                        title={t.modals.bulkField.title}
                      >
                        <Plus size={14} />
                        <span>{t.createData.addFieldAllCardsSimultaneously}</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {cards.length === 0 && (
                <div className="text-center py-10 text-zinc-400 text-xs">
                  {t.createData.noCardsYet}
                </div>
              )}
            </div>

            {/* Step 3 Bottom Actions: ย้อนกลับ & เผยแพร่ Pack */}
            <div className="pt-4 flex justify-between items-center">
              <button
                type="button"
                onClick={() => goToStep(2)}
                className="px-6 py-2 bg-white dark:bg-zinc-700 hover:bg-zinc-100 font-bold border-2 border-black dark:border-white rounded-xl sketch-btn"
              >
                {t.createData.backToCards}
              </button>
              <button
                type="button"
                onClick={() => handlePublish()}
                className="px-8 py-2 bg-emerald-300 dark:bg-emerald-600 hover:bg-emerald-400 text-black dark:text-white font-black border-2 border-black dark:border-white rounded-xl shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] sketch-btn"
              >
                {t.createData.publishPack}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modern Lightbox (Wheel Zoom, Touch Pinch, Drag-to-Pan, Zero Scrollbars) */}
      <ModernImageLightbox
        isOpen={Boolean(expandedImageUrl)}
        imageUrl={expandedImageUrl || ''}
        title={t.modals.lightbox.title}
        onClose={() => setExpandedImageUrl(null)}
      />

      {/* DELETE CONFIRMATION MODAL WITH "ไม่ถามซ้ำ" */}
      {deleteModalVisible && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDeleteModalVisible(false);
          }}
        >
          <div className="bg-white dark:bg-zinc-800 border-3 border-black dark:border-white rounded-3xl p-6 shadow-[7px_7px_0px_0px_rgba(0,0,0,1)] max-w-sm w-full text-center relative">
            <button
              onClick={() => setDeleteModalVisible(false)}
              className="absolute top-3 right-3 text-zinc-500 hover:text-black dark:hover:text-white"
            >
              <X size={16} />
            </button>
            <p className="font-bold text-base mb-4 font-['Mali'] text-zinc-900 dark:text-white">
              {t.modals.confirmDeleteCard.title}
            </p>

            <div className="flex items-center justify-center gap-2 mb-6 text-xs font-semibold text-zinc-600 dark:text-zinc-300">
              <input
                type="checkbox"
                id="dontAskAgain"
                checked={rememberDontAsk}
                onChange={(e) => setRememberDontAsk(e.target.checked)}
                className="w-4 h-4 border-2 border-black rounded"
              />
              <label htmlFor="dontAskAgain" className="cursor-pointer">
                {t.modals.confirmDeleteCard.dontAskAgain}
              </label>
            </div>

            <div className="flex justify-center gap-4">
              <button
                type="button"
                onClick={() => setDeleteModalVisible(false)}
                className="px-5 py-2 font-bold border-2 border-black dark:border-white rounded-xl bg-white dark:bg-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-600 sketch-btn text-xs"
              >
                {t.common.cancel}
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-5 py-2 font-bold border-2 border-black rounded-xl bg-red-500 hover:bg-red-600 text-white sketch-btn text-xs shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
              >
                {t.modals.confirmDeleteCard.confirmBtn}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LOAD PACK MODAL */}
      {isLoadModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsLoadModalOpen(false);
          }}
        >
          <div className="bg-white dark:bg-zinc-800 border-3 border-black dark:border-white rounded-3xl p-6 shadow-[7px_7px_0px_0px_rgba(0,0,0,1)] max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-base font-['Mali']">{t.modals.loadTemplate.title}</h3>
              <button
                onClick={() => setIsLoadModalOpen(false)}
                className="p-1 rounded-lg border border-black dark:border-white hover:bg-zinc-100 dark:hover:bg-zinc-700"
              >
                <X size={16} />
              </button>
            </div>
            {/* Saved Packs List */}
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {(() => {
                const myPacks = packs.filter((p) => {
                  if (currentUser?.role === 'Admin') return true;
                  if (currentUser) {
                    return p.authorId === currentUser.id || !p.authorId || p.authorId === 'guest' || p.authorId === 'admin';
                  }
                  return true;
                });

                if (myPacks.length === 0) {
                  return (
                    <div className="text-center py-8 text-zinc-500 font-medium text-xs">
                      {t.modals.loadTemplate.noPacks}
                    </div>
                  );
                }
                return myPacks.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => {
                      loadPackIntoEditor(p);
                      setIsLoadModalOpen(false);
                    }}
                    className="p-3 border-2 border-black dark:border-white rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-700 cursor-pointer flex items-center justify-between text-xs transition-colors"
                  >
                    <div>
                      <p className="font-bold">{p.franchiseName}</p>
                      <p className="text-zinc-500">{p.seriesName} ({p.cards.length} {t.modals.loadTemplate.cardsUnit})</p>
                    </div>
                    <span className="px-2.5 py-1 bg-yellow-300 text-black font-bold rounded-lg border border-black">
                      {t.modals.loadTemplate.loadBtn}
                    </span>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      )}

      {/* DATABASE CONFLICT MODAL */}
      {conflictModal && conflictModal.isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setConflictModal(null);
          }}
        >
          <div className="bg-white dark:bg-zinc-800 border-3 border-black dark:border-white rounded-3xl p-6 shadow-[7px_7px_0px_0px_rgba(0,0,0,1)] max-w-md w-full text-center relative space-y-4">
            <div className="w-12 h-12 mx-auto rounded-full bg-amber-100 dark:bg-amber-950/40 border-2 border-black flex items-center justify-center text-amber-600">
              <AlertTriangle size={24} />
            </div>

            <h3 className="font-bold text-lg text-zinc-900 dark:text-white font-['Mali']">
              {t.modals.conflict.title}
            </h3>

            <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
              {t.modals.conflict.diffMessage.replace('{diff}', conflictModal.diffMessage)}
            </p>

            <p className="text-xs text-zinc-500">
              {t.modals.conflict.instruction}
            </p>

            <div className="pt-2 flex justify-center gap-3">
              <button
                type="button"
                onClick={() => setConflictModal(null)}
                className="px-4 py-2 text-xs font-bold bg-zinc-200 dark:bg-zinc-700 rounded-xl border-2 border-black dark:border-white sketch-btn"
              >
                {t.common.cancel}
              </button>
              <button
                type="button"
                onClick={conflictModal.onConfirm}
                className="px-6 py-2 text-xs font-bold bg-yellow-400 hover:bg-yellow-300 text-black rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] sketch-btn"
              >
                {t.common.confirm}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OVERWRITE CONFIRMATION MODAL (Requirement 1: Popup ถาม "ต้องการจะ..." เลือกระหว่าง "ยกเลิก" หรือ "Save ข้อมูลทับ") */}
      {overwriteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOverwriteModal(null);
          }}
        >
          <div className="bg-white dark:bg-zinc-800 border-3 border-black dark:border-white rounded-3xl p-6 sm:p-8 shadow-[7px_7px_0px_0px_rgba(0,0,0,1)] dark:shadow-[7px_7px_0px_0px_rgba(255,255,255,0.9)] max-w-md w-full relative space-y-4 animate-in fade-in zoom-in-95">
            <button
              onClick={() => setOverwriteModal(null)}
              className="absolute top-4 right-4 p-1.5 rounded-xl border-2 border-black dark:border-white hover:bg-zinc-100 dark:hover:bg-zinc-700 sketch-btn"
              title={t.common.close}
            >
              <X size={16} />
            </button>

            <div>
              <h3 className="text-2xl font-black font-['Mali'] text-zinc-900 dark:text-white">
                {overwriteModal.isContributor
                  ? (language === 'th' ? 'ร่วมเสริมข้อมูลชุดการ์ด' : 'Contribute to Card Pack')
                  : (language === 'th' ? 'พบชุดการ์ดนี้อยู่ในระบบแล้ว' : 'Existing Pack Found')}
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-300 font-medium mt-2 leading-relaxed">
                {overwriteModal.isContributor
                  ? (language === 'th'
                      ? `ชุด "${overwriteModal.existingPack.franchiseName} - ${overwriteModal.existingPack.seriesName}" เป็นผลงานที่เผยแพร่อยู่ในระบบ (เดิมมี ${overwriteModal.existingPack.cards.length} ใบ, คุณเพิ่มการ์ดใหม่ ${overwriteModal.packToSave.cards.length} ใบ)`
                      : `Pack "${overwriteModal.existingPack.franchiseName} - ${overwriteModal.existingPack.seriesName}" is published (${overwriteModal.existingPack.cards.length} cards, you added ${overwriteModal.packToSave.cards.length} cards)`)
                  : (language === 'th'
                      ? `ชุด "${overwriteModal.existingPack.franchiseName} - ${overwriteModal.existingPack.seriesName}" มีอยู่ในระบบแล้ว (เดิมมีการ์ดอยู่ ${overwriteModal.existingPack.cards.length} ใบ, ในแบบร่างนี้มี ${overwriteModal.packToSave.cards.length} ใบ)`
                      : `Pack "${overwriteModal.existingPack.franchiseName} - ${overwriteModal.existingPack.seriesName}" exists (currently ${overwriteModal.existingPack.cards.length} cards, draft has ${overwriteModal.packToSave.cards.length} cards)`)}
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                {overwriteModal.isContributor
                  ? (language === 'th'
                      ? 'ระบบจะนำการ์ดใหม่ของคุณรวมเข้ากับชุดเดิม โดยการ์ดเดิมทั้งหมดของผู้สร้างจะไม่สูญหาย'
                      : 'Your new cards will be safely merged into the pack. All existing cards of the author will be preserved.')
                  : (language === 'th'
                      ? 'คุณต้องการรวมการ์ดเข้าชุดเดิม (เสริมข้อมูลโดยไม่ลบการ์ดเก่า) หรือต้องการเขียนทับทั้งหมด?'
                      : 'Would you like to merge into the existing pack (safely preserving existing cards) or overwrite all?')}
              </p>
            </div>

            <div className="pt-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5 border-t-2 border-dashed border-zinc-200 dark:border-zinc-700">
              <button
                type="button"
                onClick={() => setOverwriteModal(null)}
                className="order-3 sm:order-1 px-4 py-2 text-xs font-bold bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 text-zinc-800 dark:text-zinc-200 rounded-xl border-2 border-black dark:border-white sketch-btn"
              >
                {t.common.cancel}
              </button>

              {!overwriteModal.isContributor && (
                <button
                  type="button"
                  onClick={async () => {
                    const { packToSave, isPublish } = overwriteModal;
                    setOverwriteModal(null);
                    if (isPublish) {
                      await publishPack(packToSave);
                      try {
                        localStorage.removeItem('mygacha_creator_draft');
                      } catch {}
                      navigate('/');
                    } else {
                      await savePack(packToSave);
                      setEditingPack(packToSave);
                    }
                  }}
                  className="order-2 sm:order-2 px-4 py-2 text-xs font-bold bg-yellow-200 dark:bg-yellow-900/40 hover:bg-yellow-300 text-yellow-900 dark:text-yellow-200 rounded-xl border-2 border-black dark:border-white sketch-btn"
                >
                  {language === 'th' ? 'เขียนทับทั้งหมด' : 'Overwrite All'}
                </button>
              )}

              <button
                type="button"
                onClick={() => handleMergeWithExistingPack(overwriteModal.existingPack, overwriteModal.packToSave, overwriteModal.isPublish)}
                className="order-1 sm:order-3 px-5 py-2.5 text-xs font-bold bg-emerald-400 hover:bg-emerald-300 text-black rounded-xl border-2 border-black dark:border-white sketch-btn shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center gap-1.5"
              >
                <span>
                  {overwriteModal.isContributor
                    ? (language === 'th' ? 'ร่วมเพิ่มการ์ดเข้าชุดเดิม (+)' : 'Contribute & Merge Cards (+)')
                    : (language === 'th' ? 'รวมการ์ดเข้าชุดเดิม (เสริมข้อมูล)' : 'Merge & Append Cards')}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BULK ADD FIELD MODAL ACROSS ALL CARDS IN FRANCHISE (Requirement 2) */}
      {isBulkFieldModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsBulkFieldModalOpen(false);
          }}
        >
          <div className="bg-white dark:bg-zinc-800 border-3 border-black dark:border-white rounded-3xl p-6 shadow-[7px_7px_0px_0px_rgba(0,0,0,1)] max-w-md w-full relative">
            <button
              onClick={() => setIsBulkFieldModalOpen(false)}
              className="absolute top-4 right-4 p-1 rounded-lg border border-black dark:border-white hover:bg-zinc-100 dark:hover:bg-zinc-700"
            >
              <X size={16} />
            </button>

            <h3 className="font-bold text-lg font-['Mali'] mb-1">
              {t.modals.bulkField.title}
            </h3>
            <p className="text-xs text-zinc-500 mb-4">
              {t.modals.bulkField.subtitle.replace('{count}', String(cards.length)).replace('{franchise}', franchiseName || '')}
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold mb-1">
                  {t.modals.bulkField.nameLabel}
                </label>
                <input
                  type="text"
                  value={bulkFieldNameInput}
                  onChange={(e) => setBulkFieldNameInput(e.target.value)}
                  placeholder={t.modals.bulkField.namePlaceholder}
                  className="w-full px-3.5 py-2 text-sm bg-white dark:bg-zinc-700 border-2 border-black dark:border-white rounded-xl focus:outline-none"
                  autoFocus
                />
              </div>

              {/* Quick suggestion presets */}
              <div>
                <span className="text-[11px] font-bold text-zinc-500 block mb-1.5">
                  {t.modals.bulkField.popularLabel}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {t.modals.bulkField.popularPresets.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setBulkFieldNameInput(preset)}
                      className="px-2.5 py-1 text-xs font-bold bg-zinc-100 dark:bg-zinc-700 hover:bg-yellow-300 hover:text-black rounded-lg border border-black dark:border-white transition-colors"
                    >
                      +{preset}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">
                  {t.modals.bulkField.valueLabel}
                </label>
                <input
                  type="text"
                  value={bulkFieldValueInput}
                  onChange={(e) => setBulkFieldValueInput(e.target.value)}
                  placeholder={t.modals.bulkField.valuePlaceholder}
                  className="w-full px-3.5 py-2 text-sm bg-white dark:bg-zinc-700 border-2 border-black dark:border-white rounded-xl focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsBulkFieldModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold bg-zinc-200 dark:bg-zinc-700 rounded-xl border-2 border-black dark:border-white sketch-btn"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const clean = bulkFieldNameInput.trim() || t.modals.bulkField.defaultName;
                    handleAddFieldToAllCards(clean, bulkFieldValueInput.trim());
                    setBulkFieldNameInput('');
                    setBulkFieldValueInput('');
                    setIsBulkFieldModalOpen(false);
                  }}
                  className="px-5 py-2 text-xs font-bold bg-yellow-400 hover:bg-yellow-300 text-black rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] sketch-btn"
                >
                  {t.modals.bulkField.applyBtn}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DUPLICATE CARD NAMES CONFIRMATION MODAL (Requirement: ยกเลิกการบันทึก / เปลี่ยนชื่อการ์ดซ้ำ / บันทึกทับ) */}
      {duplicateCardNameModal?.isOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-800 border-3 border-black dark:border-white rounded-3xl p-6 sm:p-8 max-w-xl w-full shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,0.9)] space-y-5 animate-in fade-in zoom-in-95 duration-150">
            {isRenamingDuplicates ? (
              /* Inline Rename View for Duplicate Cards Only (Item 3) */
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b-2 border-black dark:border-white pb-3">
                  <div>
                    <h3 className="text-lg font-black font-['Mali'] text-zinc-900 dark:text-white">
                      {language === 'th' ? 'เปลี่ยนชื่อการ์ดซ้ำ (เฉพาะกลุ่มที่ซ้ำ)' : 'Rename Duplicate Cards'}
                    </h3>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
                      {language === 'th'
                        ? 'แก้ไขชื่อเฉพาะการ์ดที่ซ้ำกันให้ต่างกัน โดยไม่ต้องแก้ชื่อการ์ดอื่นที่ไม่ซ้ำ'
                        : 'Edit only the duplicate cards without changing other unique cards'}
                    </p>
                  </div>
                  <span className="text-xs font-bold px-2 py-0.5 bg-yellow-300 text-black border border-black rounded-lg shrink-0">
                    {Object.keys(duplicateNameEdits).length} {language === 'th' ? 'ใบ' : 'cards'}
                  </span>
                </div>

                <div className="max-h-64 overflow-y-auto space-y-3 p-2.5 border-2 border-zinc-200 dark:border-zinc-700 rounded-xl bg-zinc-50 dark:bg-zinc-900/50">
                  {Array.from(duplicateCardNameModal.duplicateGroups.entries()).map(([cleanKey, groupCards]) => (
                    <div key={cleanKey} className="p-2.5 bg-white dark:bg-zinc-800 border-2 border-black dark:border-zinc-700 rounded-xl space-y-2 shadow-sm">
                      <div className="flex items-center justify-between text-xs font-bold text-zinc-700 dark:text-zinc-300 border-b border-zinc-200 dark:border-zinc-700 pb-1">
                        <span>{language === 'th' ? `กลุ่มชื่อซ้ำ: "${cleanKey}"` : `Duplicate Group: "${cleanKey}"`}</span>
                        <span className="text-[10px] text-amber-600 dark:text-amber-400 font-mono font-bold">({groupCards.length} {language === 'th' ? 'ใบ' : 'cards'})</span>
                      </div>
                      <div className="space-y-2">
                        {groupCards.map((c, i) => (
                          <div key={c.id || i} className="flex items-center gap-2">
                            <img
                              src={c.imageUrl}
                              alt={c.name}
                              className="w-9 h-9 object-cover rounded-lg border border-black shrink-0 bg-zinc-100"
                            />
                            <span className="text-[10px] font-black px-1.5 py-0.5 bg-zinc-200 dark:bg-zinc-700 border border-black rounded shrink-0">
                              {c.rarity || 'Common'}
                            </span>
                            <input
                              type="text"
                              value={duplicateNameEdits[c.id] ?? c.name}
                              onChange={(e) => handleUpdateDuplicateCardName(c.id, e.target.value)}
                              placeholder={language === 'th' ? 'ตั้งชื่อใหม่' : 'New Card Name'}
                              className="flex-1 px-2.5 py-1 text-xs font-bold bg-white dark:bg-zinc-700 border-2 border-black dark:border-white rounded-lg focus:outline-none"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end gap-3 pt-2 border-t-2 border-dashed border-zinc-200 dark:border-zinc-700">
                  <button
                    type="button"
                    onClick={() => setIsRenamingDuplicates(false)}
                    className="px-4 py-2 text-xs font-bold border-2 border-black dark:border-white rounded-xl bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 sketch-btn shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                  >
                    {language === 'th' ? 'ย้อนกลับ' : 'Back'}
                  </button>
                  <button
                    type="button"
                    onClick={handleApplyDuplicateNameRenames}
                    className="px-5 py-2 text-xs font-black border-2 border-black dark:border-white rounded-xl bg-emerald-400 hover:bg-emerald-300 text-black sketch-btn shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
                  >
                    {language === 'th' ? 'บันทึกชื่อใหม่และบันทึกซอง' : 'Save Names & Proceed'}
                  </button>
                </div>
              </div>
            ) : (
              /* Overview and Choice View */
              <>
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
                    ? 'ระบบตรวจพบการ์ดที่มีชื่อซ้ำกัน ท่านสามารถเลือก "เปลี่ยนชื่อการ์ดซ้ำ" เพื่อแก้ไขเฉพาะการ์ดที่ซ้ำ หรือเลือก "บันทึกทับ" เพื่อให้ระบบเก็บรักษาการ์ดทุกใบไว้ 100% โดยบันทึกแบบแบ่งดัชนี (-1, -2) ในฐานข้อมูล และแสดงผลเฉพาะชื่อแรกของการ์ด'
                    : 'Duplicate card names detected. You can select "Rename Duplicate Cards" to adjust only the duplicates, or "Overwrite & Save" to preserve all cards with indexed keys (-1, -2) in database while displaying only the clean original name.'}
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

                <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2 border-t-2 border-dashed border-zinc-200 dark:border-zinc-700">
                  <button
                    type="button"
                    onClick={() => setDuplicateCardNameModal(null)}
                    className="px-3.5 py-2 text-xs font-bold border-2 border-black dark:border-white rounded-xl bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 sketch-btn shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                  >
                    {language === 'th' ? 'ยกเลิกการบันทึก' : 'Cancel Save'}
                  </button>
                  <button
                    type="button"
                    onClick={handleStartRenamingDuplicates}
                    className="px-4 py-2 text-xs font-bold border-2 border-black dark:border-white rounded-xl bg-sky-300 hover:bg-sky-200 text-black sketch-btn shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center gap-1.5"
                  >
                    <Edit2 size={13} />
                    <span>{language === 'th' ? 'เปลี่ยนชื่อการ์ดซ้ำ' : 'Rename Duplicates'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const isPub = duplicateCardNameModal.isPublish;
                      setDuplicateCardNameModal(null);
                      if (isPub) {
                        await handlePublish(true);
                      } else {
                        await handleSave(true);
                      }
                    }}
                    className="px-4 py-2 text-xs font-black border-2 border-black dark:border-white rounded-xl bg-yellow-400 hover:bg-yellow-300 text-black sketch-btn shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
                  >
                    {language === 'th' ? 'บันทึกทับ' : 'Overwrite & Save'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* 9-GRID INTERACTIVE IMAGE CROPPER MODAL (Requirement 2 & 3) */}
      <ImageCropperModal
        isOpen={cropperState.isOpen}
        imageUrl={cropperState.imageUrl}
        onClose={() => setCropperState(prev => ({ ...prev, isOpen: false }))}
        onCropComplete={cropperState.onCrop}
        title={cropperState.title}
      />
    </div>
  );
};
