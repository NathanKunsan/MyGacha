export interface CardRarity {
  id: string;
  name: string; // e.g. 'C', 'R', 'RR', 'SR', 'UR'
  color: string;
  cardCount: number; // Integer weight in drop pool
  hasConfetti?: boolean; // Whether to trigger confetti fireworks when drawn
  equalRateWith?: string; // ID or name of another rarity to share equal drop probability
}

export interface CardField {
  id: string;
  name: string;  // e.g. 'ชื่อการ์ด', 'ความสามารถการ์ด', 'พลังโจมตี'
  value: string; // user input value
}

export interface CardItem {
  id: string;
  packId: string;
  rarity: string;
  imageUrl: string;
  name: string;
  dbName?: string; // Optional database identifier for duplicates like [name]-1, [name]-2
  fileName?: string; // original uploaded file name
  description?: string;
  fields: CardField[]; // Dynamically editable and deletable fields
  isFoil?: boolean; // Holographic foil variant flag
}

export type TearDirection = 'up' | 'down' | 'left' | 'right' | 'custom';

export interface TearLinePoint {
  x: number; // percentage (0 - 100)
  y: number; // percentage (0 - 100)
}

export interface PackTearConfig {
  direction: TearDirection;
  customStart?: TearLinePoint;
  customEnd?: TearLinePoint;
}

export interface PackSeries {
  id: string;
  franchiseName: string;
  seriesName: string;
  tag: string;
  tags?: string[];
  coverImageUrl: string;
  originalCoverImageUrl?: string;
  coverAspectRatio?: string; // e.g. 'auto', '3:4', '9:16', '1:1', 'custom'
  coverWidth?: number;
  coverHeight?: number;
  tearConfig?: PackTearConfig;
  cardsPerPack: number;
  price: number;
  rarities: CardRarity[];
  cards: CardItem[];
  createdAt: string;
  isPublished: boolean;
  authorId?: string;
}

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  avatarUrl?: string;
  role?: 'User' | 'Admin';
  lastUsernameChangeDate?: string | null;
  coins: number;
  lastDailyRewardDate: string | null;
  inventory: Record<string, number>;
  lastInventoryClearTime?: number;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
}

export type ReportCategory =
  | 'franchise_name'
  | 'pack_name'
  | 'tag'
  | 'card_image'
  | 'card_details'
  | 'other';

export interface ContentReport {
  id: string;
  packId: string;
  packName: string;
  franchiseName: string;
  cardId?: string;
  cardName?: string;
  category: string;
  categoryKey: ReportCategory;
  details: string;
  reportedByUserId: string;
  reportedByUsername: string;
  createdAt: string;
  status: 'pending' | 'resolved';
  resolvedAt?: string;
  resolvedBy?: string;
}

export type RedeemRewardType = 'coins' | 'card' | 'both';

export interface CardRewardDetail {
  packId: string;
  cardId: string;
  cardName: string;
  cardImageUrl: string;
  rarity: string;
  isFoil?: boolean;
}

export interface RedeemCode {
  id: string;
  code: string;
  rewardType: RedeemRewardType;
  coinsAmount?: number;
  cardReward?: CardRewardDetail;
  cardRewards?: CardRewardDetail[];
  expiresAt: string | null;
  isActive: boolean;
  maxUses?: number | null;
  usedCount: number;
  redeemedBy: string[];
  createdAt: string;
}

export interface MarketListing {
  id: string;
  cardId: string;
  cardName: string;
  cardImageUrl: string;
  rarity: string;
  rarityColor?: string;
  packId: string;
  packName: string;
  franchiseName: string;
  sellerId: string;
  sellerUsername: string;
  sellerAvatarUrl?: string;
  price: number;
  createdAt: string;
  isFoil?: boolean;
}

export interface MarketHistoryItem {
  id: string;
  cardName: string;
  cardImageUrl: string;
  rarity: string;
  rarityColor?: string;
  price: number;
  type: 'buy' | 'sell';
  buyerId?: string;
  sellerId?: string;
  counterparty: string;
  timestamp: string;
  isFoil?: boolean;
}
