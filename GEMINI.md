# MyGacha Project Rules & Constraints (MANDATORY)

These rules are permanent and MUST be followed strictly at all times. Never deviate from them.

## 1. UI Components: Absolute Prohibition of Native HTML Select ("Dropbox")
- **NEVER use `<select>` or `<option>` tags anywhere in this project.**
- **ALWAYS use `<NeoDropdown>`** (`from './NeoDropdown'` or `'../components/NeoDropdown'`).
- Every dropdown, filter, and selector in the application MUST use `NeoDropdown`.

## 2. Component Conventions & Reusability
- **Date & Time Picker**: ALWAYS use `<NeoDateTimePicker>` (`from './NeoDateTimePicker'`).
- **Color Picker**: ALWAYS use `<NeoColorPicker>` (`from './NeoColorPicker'`).
- **Confirmation Modals**: ALWAYS use `<ConfirmModal>` or custom in-app modals.
  - **NEVER use native browser popups** (`alert()`, `confirm()`, `prompt()`).
- **Buttons**: ALWAYS follow Neo-Brutalist aesthetics:
  - Classes: `border-2 border-black dark:border-white rounded-xl sketch-btn shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]`
- **Image Lightbox**: ALWAYS use `<ModernImageLightbox>`.
- **Card Selection**: ALWAYS use `<CardPickerModal>`.

## 3. Strict Style & Language Constraints
- **ZERO EMOJIS**: Strictly NO emojis anywhere in UI text, code comments, toast notifications, or model responses.
- **NO AI SLOP**:
  - Do not introduce unnecessary artificial terminology (e.g. "Tier", "AI", generic placeholders). Keep terms clean, authentic to real physical TCGs (e.g. Card Series, Rarity, Foil).
  - **NO Unsolicited UI Elements**: Never add helper note boxes, explanatory tutorial cards, countdown badges, or unsolicited hint banners unless explicitly commanded by the user.
  - **NO Metaphor Literalism**: Analogies used by the user to explain behavior (e.g. "เหมือนตะกร้า") describe mechanics, not literal branding. Never inject e-commerce or out-of-context terms into a TCG tool.
  - **NO Verbose Debug Logs in UI**: Never dump matching/pass loops, normalized internal keys, or developer telemetry into user-facing views.
- **Language Purity**:
  - Pure Thai in Thai mode, clean English in English mode.
  - **NEVER mix Thai and English in the same UI text or button** (e.g. NO "เริ่มตรวจสอบ (Run Parity Check)").

## 4. State & Lifecycle Hygiene
- **Strict State Cleanup**:
  - Whenever a modal, drawer, or panel closes, all temporary reports, calculation results, and executed states MUST be reset to null/initial state immediately.
  - Whenever selection inputs change, are cleared, or fall below minimum requirements, previous execution results MUST be wiped immediately. Never leave stale results lingering under disabled controls.

## 4. Performance & Responsiveness
- **0ms Instant Optimistic Updates**:
  - All user actions (saving cards, listing, buying, cancelling, delisting) must update local state and IndexedDB in 0ms immediately.
  - Network and Supabase operations MUST run non-blocking in the background.
- **No Keystroke Lag**:
  - Never run `JSON.stringify` on large base64 card arrays or synchronous disk writes on every keystroke. Use debounced saving (500ms).
- **Parallel Image Processing**:
  - Always compress images using `compressImageFile` in parallel (`Promise.all`).
