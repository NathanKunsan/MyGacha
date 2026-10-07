-- ==============================================================
-- MyGacha: Complete Supabase Database & Storage Schema
-- วิธีใช้งาน:
-- 1. ไปที่ Supabase Dashboard (https://supabase.com)
-- 2. เลือกโปรเจกต์ของคุณ -> เมนูด้านซ้ายไปที่ "SQL Editor"
-- 3. คลิก "New Query", คัดลอกโค้ดทั้งหมดนี้ไปวาง แล้วกดปุ่ม "Run"
-- ==============================================================

-- เปิดส่วนขยาย uuid
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================
-- 1. ตาราง Profiles (เก็บ Username, Gmail, Avatar แยก Folder, และเหรียญ)
-- ==============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,                     -- Gmail หรืออีเมลที่ใช้สมัคร
  avatar_url TEXT,                         -- URL รูปโปรไฟล์ที่เก็บใน avatars/{user_id}/
  coins BIGINT DEFAULT 5000,               -- เหรียญเริ่มต้น
  last_daily_reward_date DATE,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==============================================================
-- 2. ตาราง Franchises (เก็บข้อมูลชื่อการ์ด ของ CreateCardPack)
-- ==============================================================
CREATE TABLE IF NOT EXISTS public.franchises (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,               -- ชื่อการ์ด เช่น Cyber Mythos, How To Fish
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==============================================================
-- 3. ตาราง Card Packs (เก็บข้อมูล ซีรีย์ Pack, ราคาต่อ Pack, เรท)
-- ==============================================================
CREATE TABLE IF NOT EXISTS public.card_packs (
  id TEXT PRIMARY KEY,
  franchise_name TEXT NOT NULL,            -- ชื่อการ์ดหลัก
  series_name TEXT NOT NULL,               -- ชื่อซีรีย์ Pack
  tag TEXT DEFAULT '',
  cover_image_url TEXT,                    -- รูปซอง เก็บใน {franchise}/{series}/cover.png
  cards_per_pack INT DEFAULT 5,            -- จำนวนการ์ดต่อซอง
  price INT DEFAULT 500,                   -- ราคาต่อ Pack (Coin)
  rarities JSONB NOT NULL DEFAULT '[]'::jsonb, -- รายละเอียดเรทการ์ด
  cards JSONB NOT NULL DEFAULT '[]'::jsonb,    -- รายการการ์ดทั้งหมด
  is_published BOOLEAN DEFAULT true,       -- สถานะพร้อมโชว์ในหน้า Home
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT unique_franchise_series UNIQUE (franchise_name, series_name)
);

-- Index สำหรับค้นหาและดึงหน้า Home อย่างรวดเร็ว
CREATE INDEX IF NOT EXISTS idx_card_packs_published ON public.card_packs (is_published, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_card_packs_franchise ON public.card_packs (franchise_name);

-- ==============================================================
-- 3.1 ตาราง Tags (จัดการ Tags ใน CreateCardsPack และ Admin Console)
-- ==============================================================
CREATE TABLE IF NOT EXISTS public.tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==============================================================
-- 4. ตาราง Cards (เก็บข้อมูลการ์ดที่สร้างขึ้นแต่ล่ะใบ อิงตามชื่อการ์ด)
-- ==============================================================
CREATE TABLE IF NOT EXISTS public.cards (
  id TEXT PRIMARY KEY,
  pack_id TEXT NOT NULL REFERENCES public.card_packs(id) ON DELETE CASCADE,
  franchise_name TEXT NOT NULL,            -- อิงข้อมูลตามชื่อการ์ด
  series_name TEXT NOT NULL,               -- ซีรีย์
  rarity TEXT NOT NULL,                    -- ระดับแรร์ (C, R, RR ฯลฯ)
  name TEXT NOT NULL,                      -- ชื่อการ์ด
  description TEXT DEFAULT '',
  image_url TEXT NOT NULL,                 -- เก็บใน {franchise}/{series}/cards/{rarity}/{card_id}/image.png
  fields JSONB DEFAULT '[]'::jsonb,        -- คุณสมบัติการ์ด (เช่น ความสามารถ, พลังโจมตี)
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cards_franchise_series ON public.cards (franchise_name, series_name);
CREATE INDEX IF NOT EXISTS idx_cards_pack_id ON public.cards (pack_id);

-- ==============================================================
-- 5. ตาราง User Inventory (แกลเลอรี่: เก็บรายบัญชีว่ามีการ์ดอะไรบ้าง มีกี่ใบ)
-- ==============================================================
CREATE TABLE IF NOT EXISTS public.user_inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_id TEXT NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  quantity INT NOT NULL DEFAULT 1 CHECK (quantity >= 0), -- จำนวนใบที่ครอบครอง
  acquired_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT unique_user_card UNIQUE (user_id, card_id)
);

CREATE INDEX IF NOT EXISTS idx_user_inventory_user ON public.user_inventory (user_id);

-- ==============================================================
-- 6. Storage Bucket Setup (โฟลเดอร์สำหรับ MyGacha)
-- โครงสร้าง Storage Bucket 'mygacha':
-- 1. {franchise_name}/{series_name}/cover.png
-- 2. {franchise_name}/{series_name}/rarities.json
-- 3. {franchise_name}/{series_name}/cards/{rarity}/{card_id}/image.png
-- 4. {franchise_name}/{series_name}/cards/{rarity}/{card_id}/card.json
-- 5. avatars/{user_id}/avatar.png (Folder แยกสำหรับ Account Avatar)
-- ==============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('mygacha', 'mygacha', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- ==============================================================
-- 7. Row Level Security (RLS) & Security Policies
-- ==============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.franchises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_inventory ENABLE ROW LEVEL SECURITY;

-- 7.0 Tags Policies
DROP POLICY IF EXISTS "Tags viewable by everyone" ON public.tags;
CREATE POLICY "Tags viewable by everyone" ON public.tags
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can insert tags" ON public.tags;
CREATE POLICY "Anyone can insert tags" ON public.tags
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can update tags" ON public.tags;
CREATE POLICY "Anyone can update tags" ON public.tags
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Anyone can delete tags" ON public.tags;
CREATE POLICY "Anyone can delete tags" ON public.tags
  FOR DELETE USING (true);

-- 7.1 Profiles Policies
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- 7.2 Franchises Policies
DROP POLICY IF EXISTS "Franchises viewable by everyone" ON public.franchises;
CREATE POLICY "Franchises viewable by everyone" ON public.franchises
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can create franchises" ON public.franchises;
CREATE POLICY "Users can create franchises" ON public.franchises
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Franchises update" ON public.franchises;
CREATE POLICY "Franchises update" ON public.franchises
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Franchises delete" ON public.franchises;
CREATE POLICY "Franchises delete" ON public.franchises
  FOR DELETE USING (true);

-- 7.3 Card Packs Policies (ดึงข้อมูล, แก้ไข, และลบได้จริงทั้ง Admin และระบบ)
DROP POLICY IF EXISTS "Published card packs viewable by everyone" ON public.card_packs;
DROP POLICY IF EXISTS "Card packs viewable by everyone" ON public.card_packs;
CREATE POLICY "Card packs viewable by everyone" ON public.card_packs
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert card packs" ON public.card_packs;
CREATE POLICY "Users can insert card packs" ON public.card_packs
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update card packs" ON public.card_packs;
CREATE POLICY "Users can update card packs" ON public.card_packs
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Users can delete card packs" ON public.card_packs;
CREATE POLICY "Users can delete card packs" ON public.card_packs
  FOR DELETE USING (true);

-- 7.4 Cards Policies
DROP POLICY IF EXISTS "Cards viewable by everyone" ON public.cards;
CREATE POLICY "Cards viewable by everyone" ON public.cards
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert cards" ON public.cards;
CREATE POLICY "Users can insert cards" ON public.cards
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update cards" ON public.cards;
CREATE POLICY "Users can update cards" ON public.cards
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Users can delete cards" ON public.cards;
CREATE POLICY "Users can delete cards" ON public.cards
  FOR DELETE USING (true);

-- 7.5 User Inventory Policies (แกลเลอรี่ดูของตัวเองเท่านั้น และอัปเดตอัตโนมัติ)
DROP POLICY IF EXISTS "Users can view their own inventory" ON public.user_inventory;
CREATE POLICY "Users can view their own inventory" ON public.user_inventory
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert into their own inventory" ON public.user_inventory;
CREATE POLICY "Users can insert into their own inventory" ON public.user_inventory
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own inventory" ON public.user_inventory;
CREATE POLICY "Users can update their own inventory" ON public.user_inventory
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own inventory" ON public.user_inventory;
CREATE POLICY "Users can delete their own inventory" ON public.user_inventory
  FOR DELETE USING (auth.uid() = user_id);

-- 7.6 Storage Bucket Policies
DROP POLICY IF EXISTS "Public Assets View" ON storage.objects;
CREATE POLICY "Public Assets View" ON storage.objects
  FOR SELECT USING (bucket_id = 'mygacha');

DROP POLICY IF EXISTS "Public Assets Upload" ON storage.objects;
CREATE POLICY "Public Assets Upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'mygacha');

DROP POLICY IF EXISTS "Public Assets Update" ON storage.objects;
CREATE POLICY "Public Assets Update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'mygacha');

DROP POLICY IF EXISTS "Public Assets Delete" ON storage.objects;
CREATE POLICY "Public Assets Delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'mygacha');

-- ==============================================================
-- 8. Trigger: สร้าง Profile อัตโนมัติเมื่อมีการ Register ผ่าน Supabase Auth
-- ==============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, username, email, coins)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    new.email,
    5000
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
