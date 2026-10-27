import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useGacha } from '../context/GachaContext';
import { CardItem, MarketListing, MarketHistoryItem } from '../types';
import { getCardDisplayName } from '../utils/cardName';
import { NeoDropdown, NeoDropdownOption } from './NeoDropdown';
import {
  fetchMarketListingsFromSupabase,
  saveMarketListingsToSupabase,
  fetchMarketHistoryFromSupabase,
  saveMarketHistoryToSupabase,
  broadcastRealtimeEvent,
  localBroadcastChannel,
  getSharedRealtimeChannel,
  REALTIME_CHANNEL_NAME,
  supabase,
} from '../lib/supabase';
import { sound } from '../utils/sound';
import {
  Store,
  Search,
  Filter,
  Coins,
  Plus,
  Layers,
  ShoppingBag,
  Trash2,
  Sparkles,
  X,
  History,
  Tag,
} from 'lucide-react';

const STORAGE_MARKET_LISTINGS = 'mygacha_market_listings';
const STORAGE_MARKET_HISTORY = 'mygacha_market_history';

export const MarketplacePage: React.FC = () => {
  const {
    currentUser,
    packs,
    spendCoins,
    addCardsToInventory,
    removeCardFromInventory,
    refreshUserInventory,
    refreshPacks,
    addToast,
    language,
    navigate,
  } = useGacha();

  // Auto-sync user inventory and published packs on mount
  useEffect(() => {
    if (currentUser?.id) {
      refreshUserInventory();
    }
    refreshPacks();
  }, [currentUser?.id, refreshUserInventory, refreshPacks]);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'market' | 'my-listings' | 'history'>('market');

  // Search & Filters
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedFranchise, setSelectedFranchise] = useState<string>('ALL');
  const [selectedPackId, setSelectedPackId] = useState<string>('ALL'); // Filter by Pack Series in dropdown
  const [selectedRarity, setSelectedRarity] = useState<string>('ALL');
  const [filterFoilOnly, setFilterFoilOnly] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<'price-asc' | 'price-desc' | 'newest'>('newest');

  // Modals
  const [isSellModalOpen, setIsSellModalOpen] = useState(false);
  const [selectedListingToBuy, setSelectedListingToBuy] = useState<MarketListing | null>(null);

  // In-flight processing tracking to prevent double-click and duplication race conditions
  const [cancellingListingIds, setCancellingListingIds] = useState<Set<string>>(new Set());
  const [buyingListingIds, setBuyingListingIds] = useState<Set<string>>(new Set());
  const [isSubmittingSell, setIsSubmittingSell] = useState<boolean>(false);

  // Sell form state
  const [selectedCardToSell, setSelectedCardToSell] = useState<CardItem | null>(null);
  const [sellPrice, setSellPrice] = useState<number>(500);

  // STRICT REQUIREMENT: Only PUBLISHED packs are public in the marketplace!
  const publishedPacks = useMemo(() => {
    return (packs || []).filter(p => p && p.isPublished === true);
  }, [packs]);

  const publishedPackIds = useMemo(() => {
    return new Set(publishedPacks.map(p => p.id));
  }, [publishedPacks]);

  // Clean state with ZERO mock data
  const [listings, setListings] = useState<MarketListing[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_MARKET_LISTINGS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  const [history, setHistory] = useState<MarketHistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_MARKET_HISTORY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  // Real-time synchronization with Supabase Storage
  const refreshMarketData = useCallback(async () => {
    try {
      const [remoteListings, remoteHistory] = await Promise.all([
        fetchMarketListingsFromSupabase(),
        fetchMarketHistoryFromSupabase(),
      ]);
      setListings(prev => {
        const map = new Map<string, MarketListing>();
        remoteListings.forEach(l => { if (l?.id) map.set(l.id, l); });
        // Preserve any listings in state that are not yet on remote
        prev.forEach(l => { if (l?.id && !map.has(l.id)) map.set(l.id, l); });
        const merged = Array.from(map.values());
        try { localStorage.setItem(STORAGE_MARKET_LISTINGS, JSON.stringify(merged)); } catch {}
        return merged;
      });
      setHistory(remoteHistory);
    } catch (err) {
      console.warn('Error refreshing market data:', err);
    }
  }, []);

  useEffect(() => {
    refreshMarketData();

    // 1. Direct Supabase Realtime broadcast listener (instant cross-machine & cross-browser sync!)
    const sharedChannel = getSharedRealtimeChannel();
    if (sharedChannel) {
      sharedChannel
        .on('broadcast', { event: 'market_card_bought' }, (payload: any) => {
          const data = payload?.payload || payload;
          const listingId = data?.listingId;
          if (listingId) {
            setListings(prev => {
              const next = prev.filter(l => l.id !== listingId);
              try { localStorage.setItem(STORAGE_MARKET_LISTINGS, JSON.stringify(next)); } catch {}
              return next;
            });
          }
        })
        .on('broadcast', { event: 'market_listing_cancelled' }, (payload: any) => {
          const data = payload?.payload || payload;
          const listingId = data?.listingId;
          if (listingId) {
            setListings(prev => {
              const next = prev.filter(l => l.id !== listingId);
              try { localStorage.setItem(STORAGE_MARKET_LISTINGS, JSON.stringify(next)); } catch {}
              return next;
            });
          }
        })
        .on('broadcast', { event: 'market_listing_created' }, (payload: any) => {
          const data = payload?.payload || payload;
          const newListing = data?.listing;
          if (newListing) {
            setListings(prev => {
              const next = [newListing, ...prev.filter(l => l.id !== newListing.id)];
              try { localStorage.setItem(STORAGE_MARKET_LISTINGS, JSON.stringify(next)); } catch {}
              return next;
            });
          }
        })
        .on('broadcast', { event: 'marketplace_updated' }, () => {
          refreshMarketData();
        });
    }

    // 2. Cross-tab local broadcast listener (instant same-machine tab sync!)
    const handleBroadcast = (e: MessageEvent) => {
      const { event, payload } = e.data || {};
      if (event === 'market_card_bought') {
        const listingId = payload?.listingId;
        if (listingId) {
          setListings(prev => {
            const next = prev.filter(l => l.id !== listingId);
            try { localStorage.setItem(STORAGE_MARKET_LISTINGS, JSON.stringify(next)); } catch {}
            return next;
          });
        }
      } else if (event === 'market_listing_cancelled') {
        const listingId = payload?.listingId;
        if (listingId) {
          setListings(prev => {
            const next = prev.filter(l => l.id !== listingId);
            try { localStorage.setItem(STORAGE_MARKET_LISTINGS, JSON.stringify(next)); } catch {}
            return next;
          });
        }
      } else if (event === 'market_listing_created') {
        const newListing = payload?.listing;
        if (newListing) {
          setListings(prev => {
            const next = [newListing, ...prev.filter(l => l.id !== newListing.id)];
            try { localStorage.setItem(STORAGE_MARKET_LISTINGS, JSON.stringify(next)); } catch {}
            return next;
          });
        }
      } else if (
        event === 'marketplace_updated' ||
        event === 'member_avatar_updated'
      ) {
        refreshMarketData();
      }
    };

    if (localBroadcastChannel) {
      localBroadcastChannel.addEventListener('message', handleBroadcast);
    }

    // 3. Fallback polling every 3.5 seconds
    const pollTimer = setInterval(refreshMarketData, 3500);

    return () => {
      if (localBroadcastChannel) {
        localBroadcastChannel.removeEventListener('message', handleBroadcast);
      }
      clearInterval(pollTimer);
    };
  }, [refreshMarketData]);

  // All unique franchises available from PUBLISHED packs only
  const franchiseOptions = useMemo(() => {
    const set = new Set<string>();
    publishedPacks.forEach(p => {
      if (p.franchiseName?.trim()) set.add(p.franchiseName.trim());
    });
    listings.forEach(l => {
      if (publishedPackIds.has(l.packId) && l.franchiseName?.trim()) {
        set.add(l.franchiseName.trim());
      }
    });
    return Array.from(set);
  }, [publishedPacks, publishedPackIds, listings]);

  // Pack options for dropdown (filtered by selectedFranchise, from PUBLISHED packs only)
  const packOptions = useMemo(() => {
    const map = new Map<string, string>(); // packId -> seriesName

    publishedPacks.forEach(p => {
      if (
        selectedFranchise === 'ALL' ||
        p.franchiseName.trim().toLowerCase() === selectedFranchise.trim().toLowerCase()
      ) {
        map.set(p.id, p.seriesName);
      }
    });

    listings.forEach(l => {
      if (publishedPackIds.has(l.packId)) {
        if (
          selectedFranchise === 'ALL' ||
          l.franchiseName.trim().toLowerCase() === selectedFranchise.trim().toLowerCase()
        ) {
          if (l.packId && l.packName) {
            map.set(l.packId, l.packName);
          }
        }
      }
    });

    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [publishedPacks, publishedPackIds, listings, selectedFranchise]);

  // All unique rarities available from PUBLISHED packs only
  const rarityOptions = useMemo(() => {
    const map = new Map<string, string>();

    publishedPacks.forEach(p => {
      p.rarities?.forEach(r => {
        if (r.name && !map.has(r.name)) {
          map.set(r.name, r.color || '#facc15');
        }
      });
    });

    listings.forEach(l => {
      if (publishedPackIds.has(l.packId) && l.rarity && !map.has(l.rarity)) {
        map.set(l.rarity, l.rarityColor || '#facc15');
      }
    });

    return Array.from(map.entries()).map(([name, color]) => ({ name, color }));
  }, [publishedPacks, publishedPackIds, listings]);

  const franchiseDropdownOptions: NeoDropdownOption<string>[] = useMemo(() => [
    { value: 'ALL', label: language === 'th' ? 'ทุกแฟรนไชส์' : 'All Franchises' },
    ...franchiseOptions.map(f => ({ value: f, label: f }))
  ], [franchiseOptions, language]);

  const packDropdownOptions: NeoDropdownOption<string>[] = useMemo(() => [
    { value: 'ALL', label: language === 'th' ? 'ทุกชุด Pack' : 'All Packs' },
    ...packOptions.map(p => ({ value: p.id, label: p.name }))
  ], [packOptions, language]);

  const rarityDropdownOptions: NeoDropdownOption<string>[] = useMemo(() => [
    { value: 'ALL', label: language === 'th' ? 'ทุกระดับความหายาก' : 'All Rarities' },
    ...rarityOptions.map(r => ({ value: r.name, label: r.name, color: r.color }))
  ], [rarityOptions, language]);

  const sortDropdownOptions: NeoDropdownOption<string>[] = useMemo(() => [
    { value: 'newest', label: language === 'th' ? 'มาใหม่ล่าสุด' : 'Newest Listed' },
    { value: 'price-asc', label: language === 'th' ? 'ราคาต่ำสุดไปสูงสุด' : 'Price: Low to High' },
    { value: 'price-desc', label: language === 'th' ? 'ราคาสูงสุดไปต่ำสุด' : 'Price: High to Low' },
  ], [language]);

  // Filtered & Sorted listings for the main browse tab (ONLY PUBLISHED PACKS)
  const filteredListings = useMemo(() => {
    return listings
      .filter((item) => {
        // Filter by published packs safely without dropping valid listings when packs are loading
        if (publishedPacks.length > 0) {
          const isPublished =
            (item.packId && publishedPackIds.has(item.packId)) ||
            publishedPacks.some(
              (p) =>
                (item.packName && p.seriesName.trim().toLowerCase() === item.packName.trim().toLowerCase()) ||
                (item.franchiseName && p.franchiseName.trim().toLowerCase() === item.franchiseName.trim().toLowerCase()) ||
                p.cards.some(c => c.id === item.cardId)
            );
          if (!isPublished) {
            return false;
          }
        }

        if (filterFoilOnly && !item.isFoil) {
          return false;
        }

        if (searchKeyword.trim()) {
          const kw = searchKeyword.toLowerCase();
          const cleanName = getCardDisplayName(item.cardName).toLowerCase();
          const series = (item.packName || '').toLowerCase();
          const fran = (item.franchiseName || '').toLowerCase();
          if (!cleanName.includes(kw) && !series.includes(kw) && !fran.includes(kw)) {
            return false;
          }
        }

        if (selectedFranchise !== 'ALL' && item.franchiseName !== selectedFranchise) {
          return false;
        }

        // Filter by selected Pack
        if (selectedPackId !== 'ALL') {
          const matchPackId = item.packId === selectedPackId;
          const matchPackName = item.packName === selectedPackId;
          if (!matchPackId && !matchPackName) {
            return false;
          }
        }

        if (selectedRarity !== 'ALL' && item.rarity !== selectedRarity) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'price-asc') return a.price - b.price;
        if (sortBy === 'price-desc') return b.price - a.price;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [listings, currentUser, searchKeyword, selectedFranchise, selectedPackId, selectedRarity, filterFoilOnly, sortBy, publishedPackIds, publishedPacks]);

  // User's own listings
  const myListings = useMemo(() => {
    if (!currentUser) return [];
    return listings.filter((item) =>
      item.sellerId === currentUser.id ||
      (item.sellerUsername && currentUser.username && item.sellerUsername.toLowerCase() === currentUser.username.toLowerCase())
    );
  }, [listings, currentUser]);

  // User's inventory cards that can be listed for sale (PUBLISHED PACKS ONLY)
  // Cards currently on sale have already been transferred into escrow, so currentUser.inventory
  // represents the available cards remaining in hand.
  const userOwnedCards = useMemo(() => {
    if (!currentUser || !currentUser.inventory) return [];
    const list: { card: CardItem; pack: (typeof packs)[0]; count: number }[] = [];

    // ONLY allow listing cards from published packs!
    publishedPacks.forEach((p) => {
      p.cards.forEach((c) => {
        const totalCount = currentUser.inventory[c.id] || 0;
        const foilCount = currentUser.inventory[`${c.id}_foil`] || 0;
        const normalCount = Math.max(0, totalCount - foilCount);

        if (normalCount > 0) {
          list.push({ card: { ...c, packId: p.id, isFoil: false }, pack: p, count: normalCount });
        }
        if (foilCount > 0) {
          list.push({ card: { ...c, packId: p.id, isFoil: true }, pack: p, count: foilCount });
        }
      });
    });

    return list;
  }, [currentUser, publishedPacks]);

  // 0ms INSTANT OPTIMISTIC BUY: Zero UI lag with background Supabase sync & Anti-duplication check
  const handleConfirmBuy = async () => {
    if (!selectedListingToBuy) return;
    if (!currentUser) {
      addToast(language === 'th' ? 'กรุณาเข้าสู่ระบบก่อนซื้อการ์ด' : 'Please login to buy cards', 'warning');
      navigate('/Login');
      return;
    }

    if (currentUser.id === selectedListingToBuy.sellerId) {
      addToast(
        language === 'th' ? 'คุณไม่สามารถซื้อการ์ดที่คุณตั้งขายเองได้' : 'You cannot buy your own card',
        'warning'
      );
      return;
    }

    if (currentUser.coins < selectedListingToBuy.price) {
      addToast(
        language === 'th'
          ? `เหรียญไม่เพียงพอ ขาดอีก ${(selectedListingToBuy.price - currentUser.coins).toLocaleString()} เหรียญ`
          : 'Not enough coins to purchase this card',
        'error'
      );
      return;
    }

    const targetListing = selectedListingToBuy;
    const buyerUser = currentUser;

    if (buyingListingIds.has(targetListing.id)) return;
    setBuyingListingIds(prev => new Set(prev).add(targetListing.id));

    try {
      // 1. Anti-race condition / anti-duplication check: Verify card is still available
      const freshListings = await fetchMarketListingsFromSupabase();
      const stillAvailable = freshListings.some(l => l.id === targetListing.id);

      if (!stillAvailable) {
        setListings(prev => prev.filter(l => l.id !== targetListing.id));
        setSelectedListingToBuy(null);
        addToast(
          language === 'th'
            ? 'การ์ดใบนี้ถูกซื้อหรือถูกยกเลิกไปแล้ว'
            : 'This card is no longer available.',
          'warning'
        );
        return;
      }

      // 2. Remove listing from remote Supabase storage FIRST
      const synced = freshListings.filter(l => l.id !== targetListing.id);
      await saveMarketListingsToSupabase(synced);

      // 3. Instant 0ms Optimistic Update for buyer
      spendCoins(targetListing.price);

      let targetCard: CardItem | undefined;
      for (const p of packs) {
        const found = p.cards.find(c => c.id === targetListing.cardId);
        if (found) {
          targetCard = found;
          break;
        }
      }

      const purchasedCard: CardItem = {
        ...(targetCard || {
          id: targetListing.cardId,
          packId: targetListing.packId,
          name: targetListing.cardName,
          imageUrl: targetListing.cardImageUrl,
          rarity: targetListing.rarity,
          fields: [],
        }),
        isFoil: targetListing.isFoil,
      };

      addCardsToInventory(targetListing.packId, [purchasedCard]);

      setListings(synced);
      try {
        localStorage.setItem(STORAGE_MARKET_LISTINGS, JSON.stringify(synced));
      } catch {}

      const buyerHistory: MarketHistoryItem = {
        id: `trade_${Date.now()}_buy`,
        cardName: targetListing.cardName,
        cardImageUrl: targetListing.cardImageUrl,
        rarity: targetListing.rarity,
        rarityColor: targetListing.rarityColor,
        price: targetListing.price,
        type: 'buy',
        buyerId: buyerUser.id,
        sellerId: targetListing.sellerId,
        counterparty: targetListing.sellerUsername,
        timestamp: new Date().toISOString(),
        isFoil: targetListing.isFoil,
      };

      const sellerHistory: MarketHistoryItem = {
        id: `trade_${Date.now()}_sell`,
        cardName: targetListing.cardName,
        cardImageUrl: targetListing.cardImageUrl,
        rarity: targetListing.rarity,
        rarityColor: targetListing.rarityColor,
        price: targetListing.price,
        type: 'sell',
        buyerId: buyerUser.id,
        sellerId: targetListing.sellerId,
        counterparty: buyerUser.username,
        timestamp: new Date().toISOString(),
        isFoil: targetListing.isFoil,
      };

      setHistory(prev => [buyerHistory, ...prev]);

      // Close modal & give instant audio/toast feedback
      setSelectedListingToBuy(null);
      try { sound.playRareFanfare(); } catch {}

      addToast(
        language === 'th'
          ? `ซื้อการ์ด ${getCardDisplayName(targetListing.cardName)}${targetListing.isFoil ? ' (ฟอยล์)' : ''} สำเร็จ!`
          : `Successfully purchased ${getCardDisplayName(targetListing.cardName)}${targetListing.isFoil ? ' (Foil)' : ''}!`,
        'success'
      );

      // 4. Background Sync: Credit seller and record history
      (async () => {
        try {
          if (supabase && targetListing.sellerId) {
            const { data: sProf } = await supabase
              .from('profiles')
              .select('coins')
              .eq('id', targetListing.sellerId)
              .maybeSingle();

            const curSellerCoins = Number(sProf?.coins || 0);
            const newSellerCoins = curSellerCoins + targetListing.price;
            await supabase
              .from('profiles')
              .update({ coins: newSellerCoins, updated_at: new Date().toISOString() })
              .eq('id', targetListing.sellerId);
          }

          try {
            const rawAccounts = localStorage.getItem('mygacha_accounts_v2');
            if (rawAccounts) {
              const accounts = JSON.parse(rawAccounts);
              if (Array.isArray(accounts)) {
                const updated = accounts.map((a: any) => {
                  if (
                    a.id === targetListing.sellerId ||
                    a.username?.toLowerCase() === targetListing.sellerUsername.toLowerCase()
                  ) {
                    return { ...a, coins: (a.coins || 0) + targetListing.price };
                  }
                  return a;
                });
                localStorage.setItem('mygacha_accounts_v2', JSON.stringify(updated));
              } else if (typeof accounts === 'object') {
                Object.values(accounts).forEach((a: any) => {
                  if (
                    a.id === targetListing.sellerId ||
                    a.username?.toLowerCase() === targetListing.sellerUsername.toLowerCase()
                  ) {
                    a.coins = (a.coins || 0) + targetListing.price;
                  }
                });
                localStorage.setItem('mygacha_accounts_v2', JSON.stringify(accounts));
              }
            }
          } catch {}

          const freshHistory = await fetchMarketHistoryFromSupabase();
          const syncedHistory = [buyerHistory, sellerHistory, ...freshHistory].slice(0, 100);
          await saveMarketHistoryToSupabase(syncedHistory);

          broadcastRealtimeEvent('market_card_bought', {
            listingId: targetListing.id,
            sellerId: targetListing.sellerId,
            sellerUsername: targetListing.sellerUsername,
            buyerId: buyerUser.id,
            buyerUsername: buyerUser.username,
            cardId: targetListing.cardId,
            cardName: targetListing.cardName,
            price: targetListing.price,
            isFoil: targetListing.isFoil,
          });

          if (localBroadcastChannel) {
            localBroadcastChannel.postMessage({
              event: 'market_card_bought',
              payload: { listingId: targetListing.id },
            });
          }

          broadcastRealtimeEvent('member_coins_updated', {
            username: targetListing.sellerUsername,
            memberId: targetListing.sellerId,
          });
        } catch (err) {
          console.warn('Background purchase sync error:', err);
        }
      })();
    } catch (err) {
      console.error('Buy error:', err);
      addToast(language === 'th' ? 'เกิดข้อผิดพลาดในการซื้อการ์ด' : 'Error purchasing card', 'error');
    } finally {
      setBuyingListingIds(prev => {
        const next = new Set(prev);
        next.delete(targetListing.id);
        return next;
      });
    }
  };

  // 0ms INSTANT OPTIMISTIC DELIST: With Anti-Duplication Protection
  const handleDelist = async (listing: MarketListing) => {
    if (!currentUser) return;
    if (currentUser.id !== listing.sellerId && currentUser.role !== 'Admin') {
      addToast(language === 'th' ? 'คุณไม่มีสิทธิ์ยกเลิกการขายการ์ดนี้' : 'You cannot cancel this listing', 'error');
      return;
    }

    if (cancellingListingIds.has(listing.id)) return;
    setCancellingListingIds(prev => new Set(prev).add(listing.id));

    try {
      // 1. Anti-duplication check: verify listing is still active in Supabase before returning card!
      const freshListings = await fetchMarketListingsFromSupabase();
      const isActive = freshListings.some(l => l.id === listing.id);

      if (!isActive) {
        // Card was already bought by someone else or cancelled!
        setListings(prev => prev.filter(l => l.id !== listing.id));
        try {
          localStorage.setItem(STORAGE_MARKET_LISTINGS, JSON.stringify(freshListings));
        } catch {}

        addToast(
          language === 'th'
            ? 'การ์ดใบนี้ถูกซื้อไปแล้วหรือถูกยกเลิกแล้ว ไม่สามารถยกเลิกการขายซ้ำได้'
            : 'This card has already been sold or cancelled.',
          'warning'
        );
        return;
      }

      // 2. Remove listing from Supabase storage FIRST
      const synced = freshListings.filter(l => l.id !== listing.id);
      await saveMarketListingsToSupabase(synced);

      // 3. Update local state
      setListings(synced);
      try {
        localStorage.setItem(STORAGE_MARKET_LISTINGS, JSON.stringify(synced));
      } catch {}

      // 4. Safely return card to seller inventory
      const targetPack = packs.find(p => p.id === listing.packId);
      const targetCard: CardItem = {
        ...(targetPack?.cards.find(c => c.id === listing.cardId) || {
          id: listing.cardId,
          packId: listing.packId,
          name: listing.cardName,
          imageUrl: listing.cardImageUrl,
          rarity: listing.rarity,
          fields: [],
        }),
        isFoil: listing.isFoil,
      };

      addCardsToInventory(listing.packId, [targetCard]);

      // 5. Broadcast to all machines and tabs
      broadcastRealtimeEvent('market_listing_cancelled', { listingId: listing.id });
      if (localBroadcastChannel) {
        localBroadcastChannel.postMessage({
          event: 'market_listing_cancelled',
          payload: { listingId: listing.id },
        });
      }

      addToast(
        language === 'th'
          ? `ยกเลิกการขายการ์ด ${getCardDisplayName(listing.cardName)}${listing.isFoil ? ' (ฟอยล์)' : ''} และคืนเข้าคลังเรียบร้อย`
          : `Cancelled listing and returned card to your inventory`,
        'info'
      );
    } catch (err) {
      console.warn('Delist error:', err);
      addToast(language === 'th' ? 'เกิดข้อผิดพลาดในการยกเลิกการขาย' : 'Error cancelling listing', 'error');
    } finally {
      setCancellingListingIds(prev => {
        const next = new Set(prev);
        next.delete(listing.id);
        return next;
      });
    }
  };

  // 0ms INSTANT OPTIMISTIC LISTING: Zero UI lag with background Supabase sync
  const handleCreateListing = async () => {
    if (isSubmittingSell) return;

    if (!selectedCardToSell) {
      addToast(language === 'th' ? 'กรุณาเลือกการ์ดที่ต้องการตั้งขาย' : 'Please select a card to list', 'warning');
      return;
    }

    if (!sellPrice || sellPrice <= 0) {
      addToast(language === 'th' ? 'กรุณาระบุราคาที่ถูกต้อง' : 'Please enter a valid price', 'warning');
      return;
    }

    if (!currentUser) {
      addToast(language === 'th' ? 'กรุณาเข้าสู่ระบบ' : 'Please login', 'warning');
      return;
    }

    const cardToSell = selectedCardToSell;
    const isFoil = Boolean(cardToSell.isFoil);
    const foilKey = `${cardToSell.id}_foil`;

    // Verify ownership in inventory
    const foilCount = currentUser.inventory?.[foilKey] || 0;
    const totalCount = currentUser.inventory?.[cardToSell.id] || 0;
    const normalCount = Math.max(0, totalCount - foilCount);

    if (isFoil) {
      if (foilCount <= 0) {
        addToast(language === 'th' ? 'คุณไม่มีการ์ดฟอยล์ใบนี้อยู่ในคลัง' : 'You do not own this foil card', 'error');
        return;
      }
    } else {
      if (normalCount <= 0) {
        addToast(language === 'th' ? 'คุณไม่มีการ์ดใบนี้อยู่ในคลัง' : 'You do not own this card', 'error');
        return;
      }
    }

    setIsSubmittingSell(true);

    // 1. Create listing object immediately
    const packObj =
      publishedPacks.find(p => p.id === cardToSell.packId) ||
      publishedPacks.find(p => p.cards.some(c => c.id === cardToSell.id));
    const rColor = packObj?.rarities?.find(r => r.name === cardToSell.rarity)?.color || '#facc15';
    const targetPackId = packObj?.id || cardToSell.packId || '';

    const newListing: MarketListing = {
      id: `list_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      cardId: cardToSell.id,
      cardName: cardToSell.name,
      cardImageUrl: cardToSell.imageUrl,
      rarity: cardToSell.rarity,
      rarityColor: rColor,
      packId: targetPackId,
      packName: packObj?.seriesName || '',
      franchiseName: packObj?.franchiseName || '',
      sellerId: currentUser.id,
      sellerUsername: currentUser.username,
      sellerAvatarUrl: currentUser.avatarUrl,
      price: Math.round(sellPrice),
      createdAt: new Date().toISOString(),
      isFoil,
    };

    // 2. 0ms Instant Optimistic Update in State and LocalStorage
    const nextListings = [newListing, ...listings.filter(l => l.id !== newListing.id)];
    setListings(nextListings);
    try {
      localStorage.setItem(STORAGE_MARKET_LISTINGS, JSON.stringify(nextListings));
    } catch {}

    // Deduct from in-memory user inventory safely via removeCardFromInventory
    await removeCardFromInventory(cardToSell.id, isFoil, currentUser.id);

    // Close modal & reset form in 0ms!
    setIsSellModalOpen(false);
    setSelectedCardToSell(null);
    setSellPrice(500);

    addToast(
      language === 'th'
        ? `ตั้งขายการ์ด ${getCardDisplayName(newListing.cardName)}${newListing.isFoil ? ' (ฟอยล์)' : ''} ในราคา ${newListing.price.toLocaleString()} เหรียญ เรียบร้อย`
        : `Successfully listed ${getCardDisplayName(newListing.cardName)}${newListing.isFoil ? ' (Foil)' : ''} for ${newListing.price.toLocaleString()} Coins!`,
      'success'
    );

    // 3. Non-blocking Background Sync
    (async () => {
      try {
        const freshListings = await fetchMarketListingsFromSupabase();
        const synced = [newListing, ...freshListings.filter(l => l.id !== newListing.id)];
        setListings(synced);
        await saveMarketListingsToSupabase(synced);
        broadcastRealtimeEvent('market_listing_created', { listing: newListing });
      } catch (err) {
        console.warn('Background listing sync error:', err);
      } finally {
        setIsSubmittingSell(false);
      }
    })();
  };

  const closeSellModal = () => {
    setIsSellModalOpen(false);
    setSelectedCardToSell(null);
    setSellPrice(500);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 font-['Prompt']">
      {/* Header Banner */}
      <div className="bg-white dark:bg-zinc-800 border-3 border-black dark:border-white rounded-3xl p-5 sm:p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 bg-yellow-300 border-2 border-black rounded-2xl flex items-center justify-center shrink-0 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            <Store size={26} className="text-black" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black font-['Mali'] text-zinc-900 dark:text-white">
              {language === 'th' ? 'ตลาดการ์ด' : 'Card Marketplace'}
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              {language === 'th'
                ? 'ซื้อขายแลกเปลี่ยนการ์ดสะสมกับผู้เล่นอื่นในระบบด้วยเหรียญ'
                : 'Trade and purchase collectible cards from other players using Coins'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          {currentUser && (
            <div className="px-3.5 py-1.5 bg-amber-50 dark:bg-amber-950/40 border-2 border-black dark:border-amber-400 rounded-xl flex items-center gap-1.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <Coins size={16} className="text-amber-500" />
              <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
                {language === 'th' ? 'เหรียญของคุณ:' : 'Coins:'}
              </span>
              <span className="text-sm font-black text-amber-600 dark:text-amber-400">
                {(currentUser.coins || 0).toLocaleString()}
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              if (!currentUser) {
                addToast(language === 'th' ? 'กรุณาเข้าสู่ระบบก่อนตั้งขายการ์ด' : 'Please login first', 'warning');
                navigate('/Login');
                return;
              }
              setIsSellModalOpen(true);
            }}
            className="px-4 py-2 text-xs sm:text-sm font-bold bg-yellow-400 hover:bg-yellow-300 text-black border-2 border-black rounded-xl sketch-btn shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] flex items-center gap-1.5 font-['Mali']"
          >
            <Plus size={16} />
            <span>{language === 'th' ? 'ตั้งขายการ์ด' : 'List Card'}</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b-2 border-black dark:border-white mb-6 pb-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('market')}
          className={`px-4 py-2 text-xs sm:text-sm font-bold rounded-xl border-2 border-black transition-all flex items-center gap-1.5 ${
            activeTab === 'market'
              ? 'bg-yellow-400 text-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
              : 'bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700'
          }`}
        >
          <Store size={15} />
          <span>{language === 'th' ? 'ซื้อการ์ด' : 'Browse Market'}</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black text-white">
            {filteredListings.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('my-listings')}
          className={`px-4 py-2 text-xs sm:text-sm font-bold rounded-xl border-2 border-black transition-all flex items-center gap-1.5 ${
            activeTab === 'my-listings'
              ? 'bg-yellow-400 text-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
              : 'bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700'
          }`}
        >
          <Tag size={15} />
          <span>{language === 'th' ? 'การ์ดที่ฉันลงขาย' : 'My Listings'}</span>
          {myListings.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black text-white">
              {myListings.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 text-xs sm:text-sm font-bold rounded-xl border-2 border-black transition-all flex items-center gap-1.5 ${
            activeTab === 'history'
              ? 'bg-yellow-400 text-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
              : 'bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700'
          }`}
        >
          <History size={15} />
          <span>{language === 'th' ? 'ประวัติการซื้อขาย' : 'Trade History'}</span>
        </button>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: BROWSE MARKET                                     */}
      {/* ======================================================== */}
      {activeTab === 'market' && (
        <div className="space-y-5">
          {/* Search & Filter Toolbar with Pack Series Dropdown (Public Packs Only) */}
          <div className="bg-white dark:bg-zinc-800 border-2 border-black dark:border-white rounded-2xl p-3 sm:p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {/* Search by Card Name */}
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  placeholder={language === 'th' ? 'ค้นหาชื่อการ์ด / ชุด...' : 'Search card / series...'}
                  className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm font-bold bg-zinc-50 dark:bg-zinc-700 border-2 border-black dark:border-white rounded-xl focus:outline-none"
                />
              </div>

              {/* Franchise Filter */}
              <div>
                <NeoDropdown
                  value={selectedFranchise}
                  onChange={(val) => {
                    setSelectedFranchise(val);
                    setSelectedPackId('ALL');
                  }}
                  options={franchiseDropdownOptions}
                />
              </div>

              {/* Pack Series Filter (ชุด Pack - Public Packs Only) */}
              <div>
                <NeoDropdown
                  value={selectedPackId}
                  onChange={(val) => setSelectedPackId(val)}
                  options={packDropdownOptions}
                />
              </div>

              {/* Sort By */}
              <div>
                <NeoDropdown
                  value={sortBy}
                  onChange={(val) => setSortBy(val as any)}
                  options={sortDropdownOptions}
                />
              </div>
            </div>

            {/* Clean Sub-Bar (Removed extra Pack Pills row as requested!) */}
            <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-zinc-200 dark:border-zinc-700">
              {/* Quick Rarity Pills */}
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-[11px] font-bold text-zinc-400 mr-1 flex items-center gap-1">
                  <Filter size={12} />
                  <span>{language === 'th' ? 'ระดับ:' : 'Rarity:'}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedRarity('ALL')}
                  className={`px-2.5 py-0.5 text-xs font-bold rounded-lg border border-black ${
                    selectedRarity === 'ALL'
                      ? 'bg-black text-white dark:bg-white dark:text-black'
                      : 'bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300'
                  }`}
                >
                  {language === 'th' ? 'ทั้งหมด' : 'ALL'}
                </button>
                {rarityOptions.map((r) => (
                  <button
                    key={r.name}
                    type="button"
                    onClick={() => setSelectedRarity(r.name)}
                    className={`px-2.5 py-0.5 text-xs font-bold rounded-lg border border-black flex items-center gap-1 ${
                      selectedRarity === r.name ? 'ring-2 ring-black font-black' : 'opacity-85'
                    }`}
                    style={{ background: r.color, color: '#000' }}
                  >
                    <span>{r.name}</span>
                  </button>
                ))}
              </div>

              {/* Foil Filter Toggle */}
              <button
                type="button"
                onClick={() => setFilterFoilOnly(prev => !prev)}
                className={`ml-auto px-2.5 py-0.5 text-xs font-black rounded-lg border border-black flex items-center gap-1 transition-all ${
                  filterFoilOnly
                    ? 'foil-badge ring-2 ring-amber-400 shadow-xs'
                    : 'bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200'
                }`}
              >
                <Sparkles size={12} className={filterFoilOnly ? 'text-amber-600' : 'text-zinc-400'} />
                <span>{language === 'th' ? 'เฉพาะการ์ดฟอยล์' : 'Foil Only'}</span>
              </button>
            </div>
          </div>

          {/* Cards Marketplace Grid Preview */}
          {filteredListings.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-zinc-800 border-2 border-dashed border-zinc-400 rounded-3xl p-8 space-y-3">
              <div className="w-16 h-16 bg-yellow-100 dark:bg-zinc-700 border-2 border-black dark:border-white rounded-2xl flex items-center justify-center mx-auto shadow-sm">
                <Store size={32} className="text-yellow-600 dark:text-yellow-400" />
              </div>
              <p className="text-lg font-bold text-zinc-600 dark:text-zinc-300">
                {searchKeyword.trim() || selectedFranchise !== 'ALL' || selectedPackId !== 'ALL' || selectedRarity !== 'ALL' || filterFoilOnly
                  ? (language === 'th' ? 'ไม่พบการ์ดที่ค้นหาในตลาด' : 'No matching cards found in market')
                  : (language === 'th' ? 'ยังไม่มีการ์ดที่วางขายในตลาดขณะนี้' : 'No cards listed in the marketplace yet')}
              </p>
              <p className="text-xs text-zinc-400 max-w-md mx-auto">
                {searchKeyword.trim() || selectedFranchise !== 'ALL' || selectedPackId !== 'ALL' || selectedRarity !== 'ALL' || filterFoilOnly
                  ? (language === 'th' ? 'ลองเปลี่ยนคำค้นหา หรือรีเซ็ตตัวกรองเพื่อดูการ์ดอื่น' : 'Try clearing filters or search term to see other cards')
                  : (language === 'th' ? 'คุณสามารถเป็นคนแรกที่ลงขายการ์ดได้โดยกดปุ่มด้านล่าง' : 'Be the first to list a card by clicking the button below')}
              </p>
              <button
                type="button"
                onClick={() => {
                  if (!currentUser) {
                    addToast(language === 'th' ? 'กรุณาเข้าสู่ระบบก่อนตั้งขายการ์ด' : 'Please login first', 'warning');
                    navigate('/Login');
                    return;
                  }
                  setIsSellModalOpen(true);
                }}
                className="mt-2 px-5 py-2 text-xs font-bold rounded-xl bg-yellow-300 hover:bg-yellow-400 border-2 border-black text-black sketch-btn shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] inline-flex items-center gap-1.5"
              >
                <Plus size={14} />
                <span>{language === 'th' ? 'ตั้งขายการ์ดของฉัน' : 'List My Card for Sale'}</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5 sm:gap-4">
              {filteredListings.map((listing) => {
                const ownedCount = currentUser?.inventory?.[listing.cardId] || 0;
                const isOwnListing = Boolean(
                  currentUser &&
                  (listing.sellerId === currentUser.id ||
                    (listing.sellerUsername && currentUser.username && listing.sellerUsername.toLowerCase() === currentUser.username.toLowerCase()))
                );
                const isCancelling = cancellingListingIds.has(listing.id);
                const isBuying = buyingListingIds.has(listing.id);

                return (
                  <div
                    key={listing.id}
                    className={`group bg-white dark:bg-zinc-800 border-2 border-black dark:border-white rounded-2xl overflow-hidden shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] transition-all flex flex-col ${
                      listing.isFoil ? 'border-amber-400 dark:border-amber-400' : ''
                    }`}
                  >
                    {/* Card Image Container */}
                    <div
                      className={`relative aspect-[3/4] bg-zinc-100 dark:bg-zinc-700/60 overflow-hidden flex items-center justify-center p-1.5 border-b-2 border-black dark:border-zinc-700 ${
                        listing.isFoil ? 'foil-card' : ''
                      }`}
                    >
                      {/* Rarity Badge */}
                      <span
                        className="absolute top-2 left-2 z-10 px-2 py-0.5 text-[10px] font-black rounded border border-black shadow-xs"
                        style={{ background: listing.rarityColor || '#facc15', color: '#000' }}
                      >
                        {listing.rarity}
                      </span>

                      {/* Top Right Badges */}
                      <div className="absolute top-2 right-2 z-10 flex flex-col items-end gap-1">
                        {listing.isFoil && (
                          <span className="px-1.5 py-0.5 text-[8px] sm:text-[9px] font-black rounded foil-badge flex items-center gap-0.5 shadow-xs">
                            <Sparkles size={9} className="text-yellow-950" />
                            <span>FOIL</span>
                          </span>
                        )}
                        {isOwnListing ? (
                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-blue-600 text-white border border-black shadow-xs">
                            {language === 'th' ? 'การ์ดของคุณ' : 'Your Listing'}
                          </span>
                        ) : (
                          !listing.isFoil && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-black/60 text-white backdrop-blur-xs">
                              {language === 'th' ? `มีแล้ว ${ownedCount}` : `Owned: ${ownedCount}`}
                            </span>
                          )
                        )}
                      </div>

                      {listing.cardImageUrl ? (
                        <img
                          src={listing.cardImageUrl}
                          alt={listing.cardName}
                          className="max-h-full max-w-full object-contain rounded-lg group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="text-xs font-bold text-zinc-400">No Image</div>
                      )}
                    </div>

                    {/* Card Details */}
                    <div className="p-2.5 sm:p-3 flex-1 flex flex-col justify-between space-y-2">
                      <div>
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[9px] font-bold uppercase text-zinc-400 truncate block">
                            {listing.franchiseName} · {listing.packName}
                          </span>
                          {listing.isFoil && (
                            <span className="text-[9px] font-black text-amber-500 shrink-0">FOIL</span>
                          )}
                        </div>
                        <h4 className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white truncate mt-0.5">
                          {getCardDisplayName(listing.cardName)}
                        </h4>
                      </div>

                      <div className="pt-2 border-t border-dashed border-zinc-200 dark:border-zinc-700 space-y-2">
                        {/* Price & Seller */}
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-zinc-400 truncate max-w-[70px]">
                            {listing.sellerUsername}
                          </span>
                          <span className="flex items-center gap-1 text-xs sm:text-sm font-black text-amber-600 dark:text-amber-400">
                            <Coins size={14} className="text-amber-500" />
                            <span>{listing.price.toLocaleString()}</span>
                          </span>
                        </div>

                        {/* Action Button: Delist if own card, Buy if other's card */}
                        {isOwnListing ? (
                          <button
                            type="button"
                            onClick={() => handleDelist(listing)}
                            disabled={isCancelling}
                            className="w-full py-1.5 text-xs font-bold bg-red-100 hover:bg-red-200 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-black rounded-lg sketch-btn shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center gap-1 font-['Mali'] disabled:opacity-50"
                          >
                            <Trash2 size={13} />
                            <span>
                              {isCancelling
                                ? (language === 'th' ? 'กำลังยกเลิก...' : 'Cancelling...')
                                : (language === 'th' ? 'ยกเลิกการขาย (การ์ดของคุณ)' : 'Cancel Listing')}
                            </span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setSelectedListingToBuy(listing)}
                            disabled={isBuying}
                            className="w-full py-1.5 text-xs font-bold bg-yellow-400 hover:bg-yellow-300 text-black border border-black rounded-lg sketch-btn shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center gap-1 font-['Mali'] disabled:opacity-50"
                          >
                            <ShoppingBag size={13} />
                            <span>
                              {isBuying
                                ? (language === 'th' ? 'กำลังซื้อ...' : 'Buying...')
                                : (language === 'th' ? 'ซื้อการ์ด' : 'Buy Card')}
                            </span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: MY LISTINGS                                       */}
      {/* ======================================================== */}
      {activeTab === 'my-listings' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-bold font-['Mali']">
              {language === 'th' ? 'รายการการ์ดที่ฉันกำลังวางขาย' : 'My Active Listings'}
            </h2>
            <span className="text-xs text-zinc-400">
              {language === 'th' ? `ทั้งหมด ${myListings.length} รายการ` : `Total ${myListings.length} items`}
            </span>
          </div>

          {myListings.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-zinc-800 border-2 border-dashed border-zinc-400 rounded-3xl p-6 space-y-3">
              <p className="text-sm font-bold text-zinc-400">
                {language === 'th' ? 'คุณยังไม่มีการ์ดที่ตั้งขายอยู่ในตลาดขณะนี้' : 'You do not have any cards on sale.'}
              </p>
              <button
                type="button"
                onClick={() => setIsSellModalOpen(true)}
                className="px-4 py-2 text-xs font-bold bg-yellow-400 hover:bg-yellow-300 text-black border-2 border-black rounded-xl sketch-btn shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] inline-flex items-center gap-1.5 font-['Mali']"
              >
                <Plus size={14} />
                <span>{language === 'th' ? 'ตั้งขายการ์ด' : 'List Card'}</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {myListings.map((listing) => (
                <div
                  key={listing.id}
                  className="bg-white dark:bg-zinc-800 border-2 border-black dark:border-white rounded-2xl p-3 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-16 rounded-lg border border-black overflow-hidden bg-zinc-100 dark:bg-zinc-700 shrink-0 flex items-center justify-center p-0.5 relative">
                      {listing.cardImageUrl ? (
                        <img src={listing.cardImageUrl} alt={listing.cardName} className="max-h-full max-w-full object-contain" />
                      ) : (
                        <Layers size={16} />
                      )}
                      <span
                        className="absolute top-0.5 left-0.5 px-1 text-[8px] font-black rounded border border-black"
                        style={{ background: listing.rarityColor || '#facc15', color: '#000' }}
                      >
                        {listing.rarity}
                      </span>
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-zinc-400 uppercase truncate">
                          {listing.packName}
                        </span>
                        {listing.isFoil && (
                          <span className="text-[8px] font-black px-1 rounded foil-badge">FOIL</span>
                        )}
                      </div>
                      <h4 className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                        {getCardDisplayName(listing.cardName)}
                      </h4>
                      <div className="flex items-center gap-1 text-xs font-black text-amber-600 dark:text-amber-400 mt-1">
                        <Coins size={12} className="text-amber-500" />
                        <span>{listing.price.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className="text-[9px] text-zinc-400">
                      {new Date(listing.createdAt).toLocaleDateString()}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDelist(listing)}
                      disabled={cancellingListingIds.has(listing.id)}
                      className="px-2.5 py-1 text-[11px] font-bold bg-red-100 hover:bg-red-200 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-black rounded-lg flex items-center gap-1 transition-all disabled:opacity-50"
                      title={language === 'th' ? 'ยกเลิกการขายและคืนการ์ดเข้าคลัง' : 'Delist and return card'}
                    >
                      <Trash2 size={13} />
                      <span>
                        {cancellingListingIds.has(listing.id)
                          ? (language === 'th' ? 'กำลังยกเลิก...' : 'Cancelling...')
                          : (language === 'th' ? 'ยกเลิกการขาย' : 'Delist')}
                      </span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: TRADE HISTORY                                     */}
      {/* ======================================================== */}
      {activeTab === 'history' && (
        <div className="bg-white dark:bg-zinc-800 border-2 border-black dark:border-white rounded-2xl p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] space-y-4">
          <h2 className="text-base sm:text-lg font-bold font-['Mali']">
            {language === 'th' ? 'ประวัติการซื้อขาย' : 'Trade History'}
          </h2>

          {history.length === 0 ? (
            <div className="text-center py-12 text-zinc-400 text-xs">
              {language === 'th' ? 'ยังไม่มีประวัติการซื้อขายในระบบ' : 'No trade history recorded yet'}
            </div>
          ) : (
            <div className="divide-y divide-zinc-200 dark:divide-zinc-700">
              {history.map((h) => (
                <div key={h.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-12 rounded border border-black overflow-hidden bg-zinc-100 shrink-0 flex items-center justify-center">
                      {h.cardImageUrl ? (
                        <img src={h.cardImageUrl} alt={h.cardName} className="w-full h-full object-contain" />
                      ) : (
                        <Layers size={14} />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-zinc-900 dark:text-white truncate flex items-center gap-1.5">
                        <span>{getCardDisplayName(h.cardName)}</span>
                        {h.isFoil && (
                          <span className="text-[9px] font-black px-1.5 py-0.2 rounded foil-badge">FOIL</span>
                        )}
                      </div>
                      <div className="text-[10px] text-zinc-400">
                        {h.type === 'buy'
                          ? (language === 'th' ? 'ซื้อจาก:' : 'Bought from:')
                          : (language === 'th' ? 'ขายให้:' : 'Sold to:')} {h.counterparty}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className={`font-black ${h.type === 'buy' ? 'text-red-500' : 'text-emerald-500'}`}>
                      {h.type === 'buy' ? '-' : '+'}{h.price.toLocaleString()} {language === 'th' ? 'เหรียญ' : 'Coin'}
                    </span>
                    <div className="text-[9px] text-zinc-400">
                      {new Date(h.timestamp).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 1: SELL CARD MODAL                                 */}
      {/* ======================================================== */}
      {isSellModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeSellModal();
          }}
        >
          <div
            className="relative bg-white dark:bg-zinc-800 border-3 border-black dark:border-white rounded-3xl max-w-xl w-full p-4 sm:p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] space-y-4 max-h-[90vh] flex flex-col font-['Prompt']"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b-2 border-black dark:border-white">
              <div className="flex items-center gap-2">
                <Store size={20} className="text-amber-500" />
                <h3 className="font-black text-base sm:text-lg font-['Mali']">
                  {language === 'th' ? 'ตั้งขายการ์ดสะสม' : 'List Card for Sale'}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeSellModal}
                className="p-1 rounded-full border border-black hover:bg-zinc-100 dark:hover:bg-zinc-700"
              >
                <X size={16} />
              </button>
            </div>

            {/* Inventory Card Selector (PUBLISHED PACKS ONLY) */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300">
                {language === 'th' ? '1. เลือกการ์ดในคลังของคุณ:' : '1. Select a card from your inventory:'}
              </label>

              {userOwnedCards.length === 0 ? (
                <div className="text-center py-8 text-zinc-400 text-xs border border-dashed rounded-xl">
                  {language === 'th'
                    ? 'คุณยังไม่มีการ์ดในคลังที่พร้อมวางขาย (ต้องเป็นการ์ดจากชุดการ์ดที่เผยแพร่แล้ว)'
                    : 'No sellable cards in your inventory (must be from published packs).'}
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 max-h-56 overflow-y-auto p-1 bg-zinc-50 dark:bg-zinc-900/60 rounded-xl border border-zinc-200 dark:border-zinc-700">
                  {userOwnedCards.map(({ card, pack, count }) => {
                    const isSelected =
                      selectedCardToSell?.id === card.id && !!selectedCardToSell?.isFoil === !!card.isFoil;
                    const rColor = pack.rarities?.find(r => r.name === card.rarity)?.color || '#facc15';

                    return (
                      <button
                        key={`${card.id}_${card.isFoil ? 'foil' : 'normal'}`}
                        type="button"
                        onClick={() => setSelectedCardToSell(card)}
                        className={`p-1.5 rounded-xl border text-left flex flex-col items-center relative transition-all ${
                          isSelected
                            ? 'border-black dark:border-white ring-2 ring-yellow-400 bg-yellow-50 dark:bg-yellow-950/40 shadow-sm scale-102'
                            : card.isFoil
                            ? 'border-amber-300 hover:border-amber-500 bg-amber-50/20'
                            : 'border-zinc-300 dark:border-zinc-700 hover:border-black'
                        }`}
                      >
                        <span
                          className="absolute top-1 left-1 z-10 px-1 py-0.2 text-[8px] font-black rounded border border-black"
                          style={{ background: rColor, color: '#000' }}
                        >
                          {card.rarity}
                        </span>

                        {card.isFoil ? (
                          <span className="absolute top-1 right-1 z-10 px-1 text-[8px] font-black foil-badge rounded">
                            FOIL x{count}
                          </span>
                        ) : (
                          <span className="absolute top-1 right-1 z-10 px-1 text-[8px] font-bold bg-black/60 text-white rounded">
                            x{count}
                          </span>
                        )}

                        <div
                          className={`w-full aspect-[3/4] bg-zinc-200 dark:bg-zinc-700 rounded-lg overflow-hidden flex items-center justify-center p-0.5 mb-1 ${
                            card.isFoil ? 'foil-card ring-1 ring-amber-300' : ''
                          }`}
                        >
                          {card.imageUrl ? (
                            <img src={card.imageUrl} alt={card.name} className="max-h-full max-w-full object-contain" />
                          ) : (
                            <Layers size={14} />
                          )}
                        </div>

                        <span className="text-[10px] font-bold truncate w-full text-center">
                          {getCardDisplayName(card.name)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Price Input */}
              {selectedCardToSell && (
                <div className="pt-2 border-t border-dashed border-zinc-200 dark:border-zinc-700 space-y-2">
                  <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300">
                    {language === 'th' ? '2. ระบุราคาขาย (เหรียญ):' : '2. Set selling price (Coins):'}
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Coins size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-500" />
                      <input
                        type="number"
                        min={50}
                        max={1000000}
                        step={50}
                        value={sellPrice}
                        onChange={(e) => setSellPrice(Number(e.target.value))}
                        className="w-full pl-9 pr-3 py-2 text-sm font-bold bg-zinc-50 dark:bg-zinc-700 border-2 border-black dark:border-white rounded-xl focus:outline-none"
                      />
                    </div>
                    {/* Quick Price Buttons */}
                    <button
                      type="button"
                      onClick={() => setSellPrice(500)}
                      className="px-2.5 py-1.5 text-xs font-bold bg-zinc-100 dark:bg-zinc-700 border border-black rounded-lg"
                    >
                      500
                    </button>
                    <button
                      type="button"
                      onClick={() => setSellPrice(1000)}
                      className="px-2.5 py-1.5 text-xs font-bold bg-zinc-100 dark:bg-zinc-700 border border-black rounded-lg"
                    >
                      1,000
                    </button>
                    <button
                      type="button"
                      onClick={() => setSellPrice(2500)}
                      className="px-2.5 py-1.5 text-xs font-bold bg-zinc-100 dark:bg-zinc-700 border border-black rounded-lg"
                    >
                      2,500
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t-2 border-black dark:border-white">
              <button
                type="button"
                onClick={closeSellModal}
                className="px-4 py-2 text-xs font-bold bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 border-2 border-black rounded-xl sketch-btn"
              >
                {language === 'th' ? 'ยกเลิก' : 'Cancel'}
              </button>
              <button
                type="button"
                disabled={!selectedCardToSell || isSubmittingSell}
                onClick={handleCreateListing}
                className="px-6 py-2 text-xs font-black bg-yellow-400 hover:bg-yellow-300 text-black border-2 border-black rounded-xl sketch-btn shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] disabled:opacity-50"
              >
                {isSubmittingSell
                  ? (language === 'th' ? 'กำลังตั้งขาย...' : 'Listing...')
                  : (language === 'th' ? 'ยืนยันการตั้งขาย' : 'Confirm Listing')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: BUY CONFIRM MODAL                               */}
      {/* ======================================================== */}
      {selectedListingToBuy && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedListingToBuy(null);
          }}
        >
          <div
            className="relative bg-white dark:bg-zinc-800 border-3 border-black dark:border-white rounded-3xl max-w-sm w-full p-5 sm:p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] space-y-4 font-['Prompt']"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b-2 border-black dark:border-white">
              <h3 className="font-black text-base sm:text-lg font-['Mali']">
                {language === 'th' ? 'ยืนยันการซื้อการ์ด' : 'Confirm Purchase'}
              </h3>
              <button
                type="button"
                onClick={() => setSelectedListingToBuy(null)}
                className="p-1 rounded-full border border-black hover:bg-zinc-100 dark:hover:bg-zinc-700"
              >
                <X size={16} />
              </button>
            </div>

            {/* Card Preview */}
            <div className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-700/60 rounded-2xl border border-zinc-200 dark:border-zinc-700">
              <div
                className={`w-14 h-20 bg-zinc-200 dark:bg-zinc-700 rounded-xl overflow-hidden flex items-center justify-center p-1 border border-black shrink-0 relative ${
                  selectedListingToBuy.isFoil ? 'foil-card' : ''
                }`}
              >
                {selectedListingToBuy.cardImageUrl ? (
                  <img
                    src={selectedListingToBuy.cardImageUrl}
                    alt={selectedListingToBuy.cardName}
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <Layers size={18} />
                )}
                <span
                  className="absolute top-1 left-1 px-1 text-[8px] font-black rounded border border-black"
                  style={{ background: selectedListingToBuy.rarityColor || '#facc15', color: '#000' }}
                >
                  {selectedListingToBuy.rarity}
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <span className="text-[10px] text-zinc-400 block truncate">
                  {selectedListingToBuy.franchiseName} · {selectedListingToBuy.packName}
                </span>
                <h4 className="font-bold text-sm text-zinc-900 dark:text-white truncate">
                  {getCardDisplayName(selectedListingToBuy.cardName)}
                </h4>
                {selectedListingToBuy.isFoil && (
                  <span className="inline-block text-[9px] font-black px-1.5 py-0.2 rounded foil-badge mt-1">
                    FOIL
                  </span>
                )}
                <div className="text-[10px] text-zinc-400 mt-1">
                  {language === 'th' ? 'ผู้ขาย:' : 'Seller:'} {selectedListingToBuy.sellerUsername}
                </div>
              </div>
            </div>

            {/* Price Breakdown */}
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-300 dark:border-amber-700 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-zinc-600 dark:text-zinc-300">
                  {language === 'th' ? 'ราคาการ์ด:' : 'Card Price:'}
                </span>
                <span className="font-black text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <Coins size={13} />
                  <span>{selectedListingToBuy.price.toLocaleString()}</span>
                </span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-amber-200 dark:border-amber-800">
                <span className="text-zinc-600 dark:text-zinc-300">
                  {language === 'th' ? 'เหรียญคงเหลือหลังซื้อ:' : 'Coins remaining after purchase:'}
                </span>
                <span
                  className={`font-black ${
                    (currentUser?.coins || 0) - selectedListingToBuy.price < 0 ? 'text-red-500' : 'text-zinc-800 dark:text-zinc-200'
                  }`}
                >
                  {((currentUser?.coins || 0) - selectedListingToBuy.price).toLocaleString()} {language === 'th' ? 'เหรียญ' : 'Coins'}
                </span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedListingToBuy(null)}
                className="flex-1 py-2 text-xs font-bold bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 border-2 border-black rounded-xl sketch-btn"
              >
                {language === 'th' ? 'ยกเลิก' : 'Cancel'}
              </button>
              <button
                type="button"
                disabled={(currentUser?.coins || 0) < selectedListingToBuy.price}
                onClick={handleConfirmBuy}
                className="flex-1 py-2 text-xs font-black bg-yellow-400 hover:bg-yellow-300 text-black border-2 border-black rounded-xl sketch-btn shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] disabled:opacity-50"
              >
                {language === 'th' ? 'ยืนยันการซื้อ' : 'Confirm Purchase'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
