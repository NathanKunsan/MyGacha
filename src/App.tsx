import React, { useState } from 'react';
import { useGacha } from './context/GachaContext';
import { Navbar } from './components/Navbar';
import { HomePage } from './components/HomePage';
import { CreatorStudio } from './components/CreatorStudio';
import { GalleryPage } from './components/GalleryPage';
import { SignInPage } from './components/SignInPage';
import { LoginPage } from './components/LoginPage';
import { SettingsPage } from './components/SettingsPage';
import { AdminConsolePage } from './components/AdminConsolePage';
import { PackOpeningModal } from './components/PackOpeningModal';
import { MarketsModal } from './components/MarketsModal';
import { ToastContainer } from './components/ToastContainer';
import { PackSeries } from './types';
import { toCleanSlug } from './utils/slug';

export const App: React.FC = () => {
  const { currentPath, navigate, packs, currentUser, editingPack } = useGacha();
  const [marketsModalOpen, setMarketsModalOpen] = useState(false);

  const lowerPath = currentPath.toLowerCase();

  // If path is /SignIn
  if (lowerPath === '/signin' || lowerPath.endsWith('/signin')) {
    return (
      <>
        <SignInPage />
        <ToastContainer />
      </>
    );
  }

  // If path is /Login
  if (lowerPath === '/login' || lowerPath.endsWith('/login')) {
    return (
      <>
        <LoginPage />
        <ToastContainer />
      </>
    );
  }

  const pathParts = currentPath.split('/').filter(Boolean);

  // Settings Route: /:username/Setting (Requirement 2)
  const isSettingRoute = pathParts.length === 2 && pathParts[1].toLowerCase() === 'setting';
  if (isSettingRoute) {
    const urlUsername = decodeURIComponent(pathParts[0]);
    if (!currentUser) {
      return (
        <>
          <LoginPage />
          <ToastContainer />
        </>
      );
    }
    // Privacy protection: redirect to home if URL does not match logged-in user
    if (urlUsername.toLowerCase() !== currentUser.username.toLowerCase()) {
      navigate('/');
      return null;
    }
    return (
      <>
        <SettingsPage />
        <ToastContainer />
      </>
    );
  }

  // Admin Console Route: /Admin or /AdminConsole
  const isAdminRoute = lowerPath === '/admin' || lowerPath === '/adminconsole' || lowerPath.endsWith('/admin') || lowerPath.endsWith('/adminconsole');
  if (isAdminRoute) {
    if (!currentUser) {
      return (
        <>
          <LoginPage />
          <ToastContainer />
        </>
      );
    }
    // Only Admin role can access
    if (currentUser.role !== 'Admin') {
      navigate('/');
      return null;
    }
    return (
      <div className="min-h-screen flex flex-col bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 transition-colors">
        <Navbar onOpenMarkets={() => setMarketsModalOpen(true)} />
        <main className="flex-1">
          <AdminConsolePage />
        </main>
        <ToastContainer />
      </div>
    );
  }

  // Creator studio subpages
  const isCreateStep1 =
    lowerPath === '/createcardspack' ||
    lowerPath.endsWith('/createcardspack') ||
    lowerPath === '/create' ||
    lowerPath === '/create/';
  const isCreateStep2 = lowerPath === '/createcards' || lowerPath.endsWith('/createcards');
  const isCreateStep3 = lowerPath === '/createcardsdata' || lowerPath.endsWith('/createcardsdata');
  const isCreatorPage = isCreateStep1 || isCreateStep2 || isCreateStep3;
  const isGallery = lowerPath === '/gallery' || lowerPath.endsWith('/gallery');

  // Test Pack Opening: /Create/Test/:cleanFranchise/:cleanSeries
  const isTestOpeningMatch = lowerPath.startsWith('/create/test/') || lowerPath.includes('/create/test/');

  // Requirement 2: Anyone with URL of create has NO WAY to enter create if not logged in
  const isAnyCreateRoute =
    lowerPath.startsWith('/create') ||
    lowerPath.includes('/createcardspack') ||
    lowerPath.includes('/createcards') ||
    lowerPath.includes('/createcardsdata') ||
    isCreatorPage ||
    isTestOpeningMatch;

  if (isAnyCreateRoute && !currentUser) {
    return (
      <>
        <LoginPage />
        <ToastContainer />
      </>
    );
  }

  // Live Pack Opening: /:cleanFranchise/:cleanSeries (exactly 2 segments and not any known page)
  const isLiveOpening =
    !isGallery &&
    !isCreatorPage &&
    !isTestOpeningMatch &&
    !isSettingRoute &&
    pathParts.length === 2;

  // Requirement 11: Non-logged in users cannot open packs
  if (isLiveOpening && !currentUser) {
    return (
      <>
        <LoginPage />
        <ToastContainer />
      </>
    );
  }

  // Find pack being opened
  let openingPack: PackSeries | undefined;
  if (isTestOpeningMatch) {
    const rawCardParam = pathParts[2] || '';
    const rawSeriesParam = pathParts[3] || '';
    const cleanCard = toCleanSlug(decodeURIComponent(rawCardParam)).toLowerCase();
    const cleanSeries = toCleanSlug(decodeURIComponent(rawSeriesParam)).toLowerCase();

    openingPack = (
      editingPack && (
        !rawCardParam ||
        toCleanSlug(editingPack.franchiseName).toLowerCase() === cleanCard ||
        toCleanSlug(editingPack.seriesName).toLowerCase() === cleanSeries
      ) ? editingPack : null
    ) || packs.find(
      p =>
        toCleanSlug(p.franchiseName).toLowerCase() === cleanCard &&
        toCleanSlug(p.seriesName).toLowerCase() === cleanSeries
    ) || packs.find(
      p =>
        toCleanSlug(p.franchiseName).toLowerCase() === cleanCard ||
        toCleanSlug(p.seriesName).toLowerCase() === cleanSeries
    ) || editingPack || packs[0];
  } else if (isLiveOpening) {
    const rawCardParam = pathParts[0] || '';
    const rawSeriesParam = pathParts[1] || '';
    const cleanCard = toCleanSlug(decodeURIComponent(rawCardParam)).toLowerCase();
    const cleanSeries = toCleanSlug(decodeURIComponent(rawSeriesParam)).toLowerCase();

    openingPack = packs.find(
      p =>
        toCleanSlug(p.franchiseName).toLowerCase() === cleanCard &&
        toCleanSlug(p.seriesName).toLowerCase() === cleanSeries
    ) || packs.find(
      p =>
        toCleanSlug(p.franchiseName).toLowerCase() === cleanCard ||
        toCleanSlug(p.seriesName).toLowerCase() === cleanSeries
    ) || packs[0];
  }

  return (
    <div className="min-h-screen flex flex-col bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 transition-colors">
      {/* Top Navbar (ซ่อนในหน้า Create ตามภาพที่ระบุ: หน้า Create เอาแค่ Navbar ส่วนที่วงสีแดงเท่านั้น) */}
      {!isCreatorPage && <Navbar onOpenMarkets={() => setMarketsModalOpen(true)} />}

      {/* Main Content Router */}
      <main className="flex-1 pb-16">
        {/* Gallery */}
        {isGallery && <GalleryPage />}

        {/* Creator Studio Steps (Single persistent instance across all 3 steps so attached cards are never lost) */}
        {isCreatorPage && <CreatorStudio />}

        {/* Home / Index (Do NOT render behind pack opening modal to avoid background buttons shining through) */}
        {!isGallery && !isCreatorPage && (!isLiveOpening || !openingPack) && (
          <HomePage
            onOpenPack={(pack) => {
              navigate(`/${toCleanSlug(pack.franchiseName)}/${toCleanSlug(pack.seriesName)}`);
            }}
          />
        )}
      </main>

      {/* Markets Modal */}
      <MarketsModal
        isOpen={marketsModalOpen}
        onClose={() => setMarketsModalOpen(false)}
      />

      {/* Test Pack Opening Modal */}
      {isTestOpeningMatch && openingPack && (
        <PackOpeningModal
          pack={openingPack}
          isTestMode={true}
          onClose={() => {
            if (window.history.length > 1) {
              window.history.back();
            } else {
              navigate('/CreateCards');
            }
          }}
        />
      )}

      {/* Live Pack Opening Modal */}
      {isLiveOpening && openingPack && (
        <PackOpeningModal
          pack={openingPack}
          isTestMode={false}
          onClose={() => navigate('/')}
        />
      )}

      {/* Global Toast Container */}
      <ToastContainer />
    </div>
  );
};
