import { createClient } from '@supabase/supabase-js';
import { CardItem, PackSeries, UserProfile, ContentReport } from '../types';
import { toCleanSlug } from '../utils/slug';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  !supabaseUrl.includes('placeholder') &&
  supabaseUrl.startsWith('http')
);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Convert base64 Data URL to Blob for Supabase storage upload
export const dataUrlToBlob = async (dataUrl: string): Promise<Blob> => {
  const res = await fetch(dataUrl);
  return await res.blob();
};

export interface ConflictCheckResult {
  hasConflict: boolean;
  diffMessage?: string; // e.g. 'ชื่อการ์ด' or 'ซีรีย์' or 'การ์ดในซอง'
}

/**
 * ตรวจสอบความขัดแย้งของข้อมูลกับฐานข้อมูล Supabase
 * กฎ: "เก็บข้อมูลของการ์ดในซองของ การ์ดนั้นๆ ให้อิงข้อมูลตามชื่อการ์ด หากมีการปรับเปลี่ยนจากเดิม 
 * แล้วมีการ save ให้กลับมาแจ้งว่า 'ข้อมูล [สิ่งที่แตกต่างจากปกติ] ไม่ตรงกับฐานข้อมูล'"
 */
export const checkPackConflictWithDatabase = async (
  pack: PackSeries,
  existingLocalPacks: PackSeries[] = []
): Promise<ConflictCheckResult> => {
  if (!pack.seriesName?.trim() || !pack.franchiseName?.trim()) {
    return { hasConflict: false };
  }

  const lang = (typeof localStorage !== 'undefined' && localStorage.getItem('mygacha_language')) || 'th';
  const isTh = lang === 'th';

  // 1. Instant in-memory check with existing local packs (0ms delay!)
  const otherLocalSeries = existingLocalPacks.find(
    p =>
      p.seriesName.trim().toLowerCase() === pack.seriesName.trim().toLowerCase() &&
      p.franchiseName.trim().toLowerCase() !== pack.franchiseName.trim().toLowerCase() &&
      p.id !== pack.id
  );

  if (otherLocalSeries) {
    return {
      hasConflict: true,
      diffMessage: isTh
        ? `ชื่อการ์ด (เดิมซีรีย์ "${pack.seriesName}" ผูกกับ "${otherLocalSeries.franchiseName}")`
        : `Franchise Name (Series "${pack.seriesName}" bound to "${otherLocalSeries.franchiseName}")`,
    };
  }

  // 2. Quick remote check with 350ms timeout to prevent save button latency
  if (supabase) {
    try {
      const dbQueryPromise = supabase
        .from('card_packs')
        .select('*')
        .eq('series_name', pack.seriesName.trim());

      const timeoutPromise = new Promise<{ data: null; error: null }>(resolve =>
        setTimeout(() => resolve({ data: null, error: null }), 350)
      );

      const res = await Promise.race([dbQueryPromise, timeoutPromise]);
      const dbPacks = (res as any)?.data;

      if (dbPacks && Array.isArray(dbPacks) && dbPacks.length > 0) {
        const otherFranchisePack = dbPacks.find(
          (p: any) => p.franchise_name?.trim().toLowerCase() !== pack.franchiseName.trim().toLowerCase() && p.id !== pack.id
        );

        if (otherFranchisePack) {
          return {
            hasConflict: true,
            diffMessage: isTh
              ? `ชื่อการ์ด (เดิมซีรีย์ "${pack.seriesName}" อยู่ใน "${otherFranchisePack.franchise_name}")`
              : `Franchise Name (Series "${pack.seriesName}" previously belonged to "${otherFranchisePack.franchise_name}")`,
          };
        }
      }
    } catch (err) {
      console.warn('Database conflict check skipped due to network/config:', err);
    }
  }

  return { hasConflict: false };
};

/**
 * อัปโหลดข้อมูล Pack ลง Supabase Storage ตามโครงสร้างโฟลเดอร์ที่ระบุ:
 * - {ชื่อการ์ด}/{ชื่อซีรีย์}/cover.png
 * - {ชื่อการ์ด}/{ชื่อซีรีย์}/rarities.json (ข้อมูลรายละเอียดการ์ดแต่ล่ะเรท)
 * - {ชื่อการ์ด}/{ชื่อซีรีย์}/cards/{rarity}/{card_id}/image.png
 * - {ชื่อการ์ด}/{ชื่อซีรีย์}/cards/{rarity}/{card_id}/card.json
 */
export const uploadPackToSupabaseStorage = async (pack: PackSeries): Promise<PackSeries> => {
  if (!supabase) return pack;

  try {
    const bucket = 'mygacha';
    let updatedPack = { ...pack };

    const folderFranchise = toCleanSlug(pack.franchiseName) || 'pack_franchise';
    const folderSeries = toCleanSlug(pack.seriesName) || 'pack_series';

    // 1. บันทึกชื่อการ์ดลงตาราง franchises
    try {
      await supabase.from('franchises').upsert(
        { name: pack.franchiseName },
        { onConflict: 'name' }
      );
    } catch (fErr) {
      console.warn('Franchise upsert warning:', fErr);
    }

    // 2. อัปโหลด Cover Image
    if (pack.coverImageUrl && pack.coverImageUrl.startsWith('data:')) {
      const coverBlob = await dataUrlToBlob(pack.coverImageUrl);
      const coverPath = `${folderFranchise}/${folderSeries}/cover.png`;
      const { data: uploadRes, error: coverErr } = await supabase.storage
        .from(bucket)
        .upload(coverPath, coverBlob, { upsert: true, contentType: 'image/png' });

      if (!coverErr && uploadRes) {
        const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(coverPath);
        updatedPack.coverImageUrl = publicUrlData.publicUrl;
      }
    }

    // 3. บันทึก rarities.json
    const raritiesBlob = new Blob([JSON.stringify(pack.rarities, null, 2)], {
      type: 'application/json',
    });
    await supabase.storage
      .from(bucket)
      .upload(`${folderFranchise}/${folderSeries}/rarities.json`, raritiesBlob, {
        upsert: true,
        contentType: 'application/json',
      });

    // 4. อัปโหลดการ์ดแบบ batch (5 ใบต่อครั้ง) เพื่อป้องกัน rate-limit และข้อมูลสูญหาย
    //    KEY FIX: ใช้ card.id เป็น folder name (unique เสมอ) แทน card.name ที่อาจซ้ำกัน
    const CONCURRENCY = 5;
    const RETRY_ATTEMPTS = 3;
    const RETRY_DELAY_MS = 800;

    const uploadSingleCard = async (card: CardItem, attempt = 1): Promise<CardItem> => {
      try {
        let finalImageUrl = card.imageUrl;
        const cleanRarity = toCleanSlug(card.rarity) || 'c';
        // ใช้ card.id เป็น unique key ป้องกันชนกัน แม้ชื่อการ์ดซ้ำ
        const safeCardId = toCleanSlug(card.id) || card.id.replace(/[^a-z0-9]/gi, '_');
        const cardFolderPath = `${folderFranchise}/${folderSeries}/cards/${cleanRarity}/${safeCardId}`;

        if (card.imageUrl && card.imageUrl.startsWith('data:')) {
          const cardBlob = await dataUrlToBlob(card.imageUrl);
          const cardImagePath = `${cardFolderPath}/image.png`;
          const { data: cRes, error: cErr } = await supabase!.storage
            .from(bucket)
            .upload(cardImagePath, cardBlob, { upsert: true, contentType: 'image/png' });

          if (!cErr && cRes) {
            const { data: publicUrlData } = supabase!.storage.from(bucket).getPublicUrl(cardImagePath);
            finalImageUrl = publicUrlData.publicUrl;
          } else if (cErr) {
            console.warn(`Card image upload error (${card.id}):`, cErr.message);
            // ถ้า error ไม่ใช่ duplicate/already exists ให้ retry
            if (!cErr.message?.includes('already exists') && attempt < RETRY_ATTEMPTS) {
              await new Promise(r => setTimeout(r, RETRY_DELAY_MS * attempt));
              return uploadSingleCard(card, attempt + 1);
            }
          }
        }

        const updatedCardItem: CardItem = { ...card, imageUrl: finalImageUrl };

        // บันทึก card.json
        const cardMetaBlob = new Blob([JSON.stringify(updatedCardItem, null, 2)], {
          type: 'application/json',
        });
        await supabase!.storage
          .from(bucket)
          .upload(`${cardFolderPath}/card.json`, cardMetaBlob, {
            upsert: true,
            contentType: 'application/json',
          });

        return updatedCardItem;
      } catch (err) {
        console.warn(`uploadSingleCard failed attempt ${attempt} for card ${card.id}:`, err);
        if (attempt < RETRY_ATTEMPTS) {
          await new Promise(r => setTimeout(r, RETRY_DELAY_MS * attempt));
          return uploadSingleCard(card, attempt + 1);
        }
        // คืนการ์ดดั้งเดิมถ้า retry หมดแล้ว ไม่ให้หายไป
        return card;
      }
    };

    // Process cards in batches of CONCURRENCY to avoid Supabase rate limit
    const updatedCards: CardItem[] = [];
    for (let i = 0; i < pack.cards.length; i += CONCURRENCY) {
      const batch = pack.cards.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.all(batch.map(card => uploadSingleCard(card)));
      updatedCards.push(...batchResults);
    }

    updatedPack.cards = updatedCards;

    // 5. บันทึกข้อมูลแพ็กหลักลงตาราง card_packs ก่อน (เพื่อให้ row มีอยู่ใน card_packs ก่อนที่ cards จะอ้างอิง foreign key)
    const basePayload: any = {
      id: updatedPack.id,
      franchise_name: updatedPack.franchiseName,
      series_name: updatedPack.seriesName,
      tag: updatedPack.tag,
      cover_image_url: updatedPack.coverImageUrl,
      cards_per_pack: updatedPack.cardsPerPack,
      price: updatedPack.price,
      rarities: updatedPack.rarities,
      cards: updatedPack.cards,
      is_published: updatedPack.isPublished,
      author_id: (updatedPack.authorId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(updatedPack.authorId)) ? updatedPack.authorId : null,
      updated_at: new Date().toISOString(),
    };

    const fullPayload = {
      ...basePayload,
      cover_aspect_ratio: updatedPack.coverAspectRatio || 'auto',
      tear_config: updatedPack.tearConfig || { direction: 'up' },
    };

    const { error: upsertErr } = await supabase.from('card_packs').upsert(fullPayload);
    if (upsertErr) {
      console.warn('Upsert with tear_config/cover_aspect_ratio column failed, falling back to basePayload:', upsertErr.message);
      const { error: baseErr } = await supabase.from('card_packs').upsert(basePayload);
      if (baseErr) {
        console.error('Upsert card_packs failed:', baseErr.message);
      }
    }

    // 6. บันทึกลงตาราง cards แบบ chunked (25 rows ต่อครั้ง) หลัง card_packs มีอยู่แล้ว
    const DB_CHUNK = 25;
    for (let i = 0; i < updatedCards.length; i += DB_CHUNK) {
      const chunk = updatedCards.slice(i, i + DB_CHUNK);
      const rows = chunk.map(card => ({
        id: card.id,
        pack_id: updatedPack.id,
        franchise_name: updatedPack.franchiseName,
        series_name: updatedPack.seriesName,
        rarity: card.rarity,
        name: card.dbName || card.name,
        description: card.description || '',
        image_url: card.imageUrl || '',
        fields: card.fields,
      }));
      const { error: cardsUpsertErr } = await supabase.from('cards').upsert(rows);
      if (cardsUpsertErr) {
        console.warn(`Cards table upsert chunk ${i}-${i + DB_CHUNK} failed:`, cardsUpsertErr.message);
      }
    }

    // 7. บันทึก Full Pack JSON ไว้ใน Supabase Storage เพื่อป้องกันข้อมูลสูญหาย 100%
    try {
      const fullPackBlob = new Blob([JSON.stringify(updatedPack, null, 2)], {
        type: 'application/json',
      });
      await supabase.storage
        .from(bucket)
        .upload(`packs/${updatedPack.id}.json`, fullPackBlob, {
          upsert: true,
          contentType: 'application/json',
        });
    } catch (storageErr) {
      console.warn('Backup pack.json to storage failed:', storageErr);
    }

    return updatedPack;
  } catch (err) {
    console.error('Supabase pack upload failed:', err);
    return pack;
  }
};

/**
 * ลบ Pack ออกจาก Supabase Database และ Storage อย่างสมบูรณ์
 */
export const deletePackFromSupabase = async (packId: string): Promise<{ success: boolean; error?: string }> => {
  if (!supabase) return { success: true };

  try {
    // 0. ลบ inventory ที่อิงกับการ์ดใน pack นี้ก่อน (เพื่อป้องกัน Foreign Key Constraint)
    try {
      const { data: cardsInPack } = await supabase.from('cards').select('id').eq('pack_id', packId);
      if (cardsInPack && cardsInPack.length > 0) {
        const cardIds = cardsInPack.map(c => c.id);
        await supabase.from('user_inventory').delete().in('card_id', cardIds);
      }
    } catch (invErr) {
      console.warn('Supabase inventory cleanup before pack delete:', invErr);
    }

    // 1. ลบการ์ดทั้งหมดที่เกี่ยวข้องในตาราง cards
    const { error: cardsErr } = await supabase.from('cards').delete().eq('pack_id', packId);
    if (cardsErr) {
      console.warn('Supabase cards delete error:', cardsErr.message);
    }

    // 2. ลบแพ็กออกจากตาราง card_packs
    const { error: packErr } = await supabase.from('card_packs').delete().eq('id', packId);
    if (packErr) {
      console.error('Supabase card_packs delete error:', packErr.message);
      return { success: false, error: packErr.message };
    }

    // 3. ลบไฟล์ JSON backup ใน storage bucket 'mygacha'
    try {
      await supabase.storage.from('mygacha').remove([`packs/${packId}.json`]);
    } catch (sErr) {
      console.warn('Storage pack json remove warning:', sErr);
    }

    return { success: true };
  } catch (err: any) {
    console.error('Delete pack from Supabase failed:', err);
    return { success: false, error: err?.message || 'Unknown error' };
  }
};

/**
 * Account: บันทึกไฟล์ภาพโปรไฟล์ User เอาไว้ใน Folder แยก (avatars/{userId}/)
 */
export const uploadUserAvatarToSupabase = async (
  userId: string,
  avatarDataUrl: string
): Promise<string | null> => {
  if (!supabase) return null;
  try {
    const bucket = 'mygacha';
    const blob = await dataUrlToBlob(avatarDataUrl);
    const avatarPath = `avatars/${userId}/avatar_${Date.now()}.png`;

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(avatarPath, blob, { upsert: true, contentType: 'image/png' });

    if (error || !data) return null;
    const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(avatarPath);
    return publicUrlData.publicUrl;
  } catch (err) {
    console.error('Failed to upload user avatar:', err);
    return null;
  }
};

/**
 * หน้า Home: ดึงข้อมูล Pack ที่พร้อมแล้ว (is_published = true) ออกมาแสดงผล
 */
export const fetchPublishedPacksFromSupabase = async (): Promise<PackSeries[]> => {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('card_packs')
      .select('*')
      .eq('is_published', true)
      .order('created_at', { ascending: false });

    if (error || !data) return [];
    const validRows = data.filter((row: any) =>
      row.id !== 'test-pack-001' &&
      row.id !== 'pack-1791291048286' &&
      Boolean(row.franchise_name)
    );
    return validRows.map((row) => ({
      id: row.id,
      franchiseName: row.franchise_name,
      seriesName: row.series_name,
      tag: row.tag || '',
      coverImageUrl: row.cover_image_url || '',
      coverAspectRatio: row.cover_aspect_ratio || 'auto',
      tearConfig: row.tear_config || { direction: 'up' },
      cardsPerPack: row.cards_per_pack || 5,
      price: row.price || 500,
      rarities: row.rarities || [],
      cards: row.cards || [],
      createdAt: row.created_at,
      isPublished: row.is_published,
      authorId: row.author_id,
    }));
  } catch (err) {
    console.error('Failed to fetch published packs from Supabase:', err);
    return [];
  }
};

/**
 * จัดการ Roles จาก Supabase Storage เพื่อเชื่อมโยงทุกเครื่อง
 */
export const fetchRemoteRoles = async (): Promise<Record<string, 'Admin' | 'User'>> => {
  if (!supabase) {
    try {
      return JSON.parse(localStorage.getItem('mygacha_user_roles_v2') || '{}');
    } catch {
      return {};
    }
  }
  try {
    const { data, error } = await supabase.storage.from('mygacha').download('system/roles.json');
    if (!error && data) {
      const text = await data.text();
      const parsed = JSON.parse(text);
      localStorage.setItem('mygacha_user_roles_v2', JSON.stringify(parsed));
      return parsed;
    }
  } catch (err) {
    console.warn('Could not fetch remote roles:', err);
  }
  try {
    return JSON.parse(localStorage.getItem('mygacha_user_roles_v2') || '{}');
  } catch {
    return {};
  }
};

export const saveRemoteRoles = async (roles: Record<string, 'Admin' | 'User'>): Promise<void> => {
  localStorage.setItem('mygacha_user_roles_v2', JSON.stringify(roles));
  if (!supabase) return;
  try {
    const blob = new Blob([JSON.stringify(roles, null, 2)], { type: 'application/json' });
    await supabase.storage.from('mygacha').upload('system/roles.json', blob, {
      upsert: true,
      contentType: 'application/json',
    });
  } catch (err) {
    console.error('Failed to save remote roles:', err);
  }
};

export const DEFAULT_TAGS: string[] = [];

const MOCK_TAGS = new Set(['General', 'Anime', 'Gaming', 'Fantasy', 'Sci-Fi', 'Cute', 'Art', 'Action', 'ทั่วไป', 'ทั่วไป (General)']);

/**
 * Fetch Tags from Supabase Database and local cache (No mock tags)
 */
export const fetchTagsFromSupabase = async (): Promise<string[]> => {
  const sanitize = (arr: any[]): string[] => {
    return Array.from(
      new Set(
        arr
          .map((item: any) => (typeof item === 'string' ? item.trim() : item?.name?.trim()))
          .filter((t): t is string => Boolean(t && !MOCK_TAGS.has(t)))
      )
    );
  };

  if (!supabase) {
    try {
      const local = localStorage.getItem('mygacha_tags');
      const parsed = local ? JSON.parse(local) : [];
      const clean = Array.isArray(parsed) ? sanitize(parsed) : [];
      localStorage.setItem('mygacha_tags', JSON.stringify(clean));
      return clean;
    } catch {
      return [];
    }
  }

  try {
    const { data, error } = await supabase
      .from('tags')
      .select('name')
      .order('name');

    if (!error && data && data.length > 0) {
      const list = sanitize(data);
      localStorage.setItem('mygacha_tags', JSON.stringify(list));
      return list;
    }

    const { data: fileData, error: fileErr } = await supabase.storage.from('mygacha').download('system/tags.json');
    if (!fileErr && fileData) {
      const text = await fileData.text();
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        const clean = sanitize(parsed);
        localStorage.setItem('mygacha_tags', JSON.stringify(clean));
        return clean;
      }
    }
  } catch (err) {
    console.warn('Error fetching tags from Supabase:', err);
  }

  try {
    const local = localStorage.getItem('mygacha_tags');
    const parsed = local ? JSON.parse(local) : [];
    const clean = Array.isArray(parsed) ? sanitize(parsed) : [];
    return clean;
  } catch {
    return [];
  }
};

export const saveTagsToSupabaseStorageBackup = async (tags: string[]) => {
  if (!supabase) return;
  try {
    const blob = new Blob([JSON.stringify(tags, null, 2)], { type: 'application/json' });
    await supabase.storage.from('mygacha').upload('system/tags.json', blob, {
      upsert: true,
      contentType: 'application/json',
    });
  } catch {}
};

export const createTagInSupabase = async (name: string): Promise<boolean> => {
  const cleanName = name.trim();
  if (!cleanName) return false;

  if (supabase) {
    try {
      await supabase.from('tags').upsert({ name: cleanName }, { onConflict: 'name' });
    } catch (e) {
      console.warn('Failed to upsert tag in table:', e);
    }
  }

  try {
    const current = await fetchTagsFromSupabase();
    const updated = Array.from(new Set([...current, cleanName]));
    localStorage.setItem('mygacha_tags', JSON.stringify(updated));
    await saveTagsToSupabaseStorageBackup(updated);
  } catch {}

  return true;
};

export const updateTagInSupabase = async (oldName: string, newName: string): Promise<boolean> => {
  const cleanOld = oldName.trim();
  const cleanNew = newName.trim();
  if (!cleanOld || !cleanNew) return false;

  if (supabase) {
    try {
      await supabase.from('tags').update({ name: cleanNew }).eq('name', cleanOld);
      await supabase.from('card_packs').update({ tag: cleanNew }).eq('tag', cleanOld);
    } catch (e) {
      console.warn('Failed to update tag in database:', e);
    }
  }

  try {
    const current = await fetchTagsFromSupabase();
    const updated = current.map(t => (t.toLowerCase() === cleanOld.toLowerCase() ? cleanNew : t));
    const unique = Array.from(new Set(updated));
    localStorage.setItem('mygacha_tags', JSON.stringify(unique));
    await saveTagsToSupabaseStorageBackup(unique);
  } catch {}

  return true;
};

export const deleteTagInSupabase = async (name: string): Promise<boolean> => {
  const cleanName = name.trim();
  if (!cleanName) return false;

  if (supabase) {
    try {
      await supabase.from('tags').delete().eq('name', cleanName);
      await supabase.from('card_packs').update({ tag: '' }).eq('tag', cleanName);
    } catch (e) {
      console.warn('Failed to delete tag in database:', e);
    }
  }

  try {
    const current = await fetchTagsFromSupabase();
    const updated = current.filter(t => t.toLowerCase() !== cleanName.toLowerCase());
    localStorage.setItem('mygacha_tags', JSON.stringify(updated));
    await saveTagsToSupabaseStorageBackup(updated);
  } catch {}

  return true;
};

export const REALTIME_CHANNEL_NAME = 'mygacha_realtime_global';

// Instant 0ms cross-tab & cross-window synchronization on the same browser/machine
export const localBroadcastChannel =
  typeof window !== 'undefined' && 'BroadcastChannel' in window
    ? new BroadcastChannel('mygacha_local_channel')
    : null;

let _sharedRealtimeChannel: any = null;
export const getSharedRealtimeChannel = () => {
  if (!supabase) return null;
  if (!_sharedRealtimeChannel) {
    _sharedRealtimeChannel = supabase.channel(REALTIME_CHANNEL_NAME);
  }
  return _sharedRealtimeChannel;
};

export const realtimeChannel = getSharedRealtimeChannel();

export const broadcastRealtimeEvent = async (event: string, payload: any) => {
  // 1. Instant local cross-tab notification
  try {
    localBroadcastChannel?.postMessage({ event, payload });
  } catch (err) {
    console.warn('Local broadcast error:', err);
  }

  // 2. Supabase WebSocket broadcast for cross-machine / remote sync
  try {
    const ch = getSharedRealtimeChannel();
    if (ch) {
      await ch.send({
        type: 'broadcast',
        event,
        payload,
      });
    }
  } catch (err) {
    console.warn('Realtime broadcast error:', err);
  }
};

/**
 * แกลเลอรี่: ดึงข้อมูลรายบัญชีว่าคนนั้นมีการ์ดนั้นแล้วหรือยัง มีกี่ใบ
 */
export const fetchUserInventoryFromSupabase = async (
  userId: string
): Promise<Record<string, number>> => {
  if (!supabase) return {};
  try {
    const { data, error } = await supabase
      .from('user_inventory')
      .select('card_id, quantity')
      .eq('user_id', userId);

    if (error || !data) return {};
    const inventory: Record<string, number> = {};
    data.forEach((row) => {
      inventory[row.card_id] = row.quantity;
    });
    return inventory;
  } catch (err) {
    console.error('Failed to fetch user inventory:', err);
    return {};
  }
};

/**
 * แกลเลอรี่: บันทึกการเพิ่มการ์ดเข้าคลังของบัญชีผู้ใช้ลง Supabase
 */
export const syncCardsToUserInventory = async (
  userId: string,
  cardId: string,
  newQuantity: number
) => {
  if (!supabase) return;
  try {
    await supabase.from('user_inventory').upsert(
      {
        user_id: userId,
        card_id: cardId,
        quantity: newQuantity,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,card_id' }
    );
  } catch (err) {
    console.error('Failed to sync card to user inventory:', err);
  }
};

/**
 * จัดการข้อมูลรายงานความไม่เหมาะสม (Reports Management) พร้อมระบบ Tombstone ถาวร
 */
const DELETED_REPORTS_TOMBSTONE_KEY = 'mygacha_deleted_reports_tombstone';

export const getDeletedReportIds = (): Set<string> => {
  try {
    const raw = localStorage.getItem(DELETED_REPORTS_TOMBSTONE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
};

export const markReportAsDeleted = (reportId: string): void => {
  try {
    const current = getDeletedReportIds();
    current.add(reportId);
    localStorage.setItem(DELETED_REPORTS_TOMBSTONE_KEY, JSON.stringify(Array.from(current)));
  } catch {}
};

export const fetchReportsFromSupabase = async (): Promise<ContentReport[]> => {
  const tombstone = getDeletedReportIds();

  if (!supabase) {
    try {
      const local = localStorage.getItem('mygacha_reports');
      const parsed: ContentReport[] = local ? JSON.parse(local) : [];
      return parsed.filter(r => !tombstone.has(r.id));
    } catch {
      return [];
    }
  }

  try {
    const { data: fileData, error: fileErr } = await supabase.storage.from('mygacha').download('system/reports.json');
    if (!fileErr && fileData) {
      const text = await fileData.text();
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        const clean = parsed.filter(r => !tombstone.has(r.id));
        localStorage.setItem('mygacha_reports', JSON.stringify(clean));
        return clean;
      }
    }
  } catch (err) {
    console.warn('Error fetching reports from Supabase Storage:', err);
  }

  try {
    const local = localStorage.getItem('mygacha_reports');
    const parsed: ContentReport[] = local ? JSON.parse(local) : [];
    return parsed.filter(r => !tombstone.has(r.id));
  } catch {
    return [];
  }
};

export const saveReportsToSupabase = async (reports: ContentReport[]): Promise<void> => {
  const tombstone = getDeletedReportIds();
  const clean = reports.filter(r => !tombstone.has(r.id));
  localStorage.setItem('mygacha_reports', JSON.stringify(clean));
  if (!supabase) return;
  try {
    const blob = new Blob([JSON.stringify(clean, null, 2)], { type: 'application/json' });
    await supabase.storage.from('mygacha').upload('system/reports.json', blob, {
      upsert: true,
      contentType: 'application/json',
    });
  } catch (err) {
    console.error('Failed to save reports to Supabase Storage:', err);
  }
};

export const submitReportToSupabase = async (report: ContentReport): Promise<boolean> => {
  try {
    const current = await fetchReportsFromSupabase();
    const updated = [report, ...current.filter(r => r.id !== report.id)];
    await saveReportsToSupabase(updated);
    await broadcastRealtimeEvent('report_submitted', report);
    return true;
  } catch (err) {
    console.warn('submitReportToSupabase error:', err);
    return false;
  }
};

export const resolveReportInSupabase = async (reportId: string, resolvedBy?: string): Promise<boolean> => {
  const current = await fetchReportsFromSupabase();
  const target = current.find(r => r.id === reportId);
  const updated = current.map(r => r.id === reportId ? {
    ...r,
    status: 'resolved' as const,
    resolvedAt: new Date().toISOString(),
    resolvedBy: resolvedBy || 'Admin',
  } : r);
  await saveReportsToSupabase(updated);

  if (target) {
    await broadcastRealtimeEvent('report_acknowledged', {
      reportId: target.id,
      userId: target.reportedByUserId,
      category: target.category,
      categoryKey: target.categoryKey,
    });
  }
  return true;
};

export const deleteReportInSupabase = async (reportId: string): Promise<boolean> => {
  markReportAsDeleted(reportId);
  try {
    const current = await fetchReportsFromSupabase();
    const updated = current.filter(r => r.id !== reportId);
    await saveReportsToSupabase(updated);
    await broadcastRealtimeEvent('report_deleted', { reportId });
  } catch (err) {
    console.warn('deleteReportInSupabase error:', err);
  }
  return true;
};

