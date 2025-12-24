# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Tooling & Common Commands

This is a Vite + React SPA using npm.

- **Install dependencies**: `npm install`
- **Run dev server** (default Vite port 5173): `npm run dev`
- **Build for production**: `npm run build`
- **Preview production build**: `npm run preview`
- **Lint all JS/JSX** (flat config, ignores `dist`): `npm run lint`

There is currently **no test runner or `test` script** configured in `package.json`; before running single tests, a test framework (e.g. Vitest/Jest) must be added.

## High-Level Architecture

### 1. Frontend shell & routing

- Entry: `src/main.jsx` mounts React into `#root`, wraps with `BrowserRouter`, and applies global Tailwind-driven styles from `index.css`.
- Top-level router: `src/App.jsx` defines routes:
  - `/login` → `pages/auth/LoginPage`
  - `/dashboard` → `pages/dashboard/Dashboard`
  - `/order-stock`, `/received-stock`, `/pending-stock` → standalone stock pages
  - `/` and unknown routes redirect to `/login`.

### 2. Authentication & user model

- **Login flow**: `pages/auth/LoginPage.jsx`
  - Collects `userType` (CEO/employee), `name`, `mobile`, `password`.
  - Calls `services/userService.validateCredentials`, which delegates to `api/userAPI.validateCredentials` hitting a Google Apps Script endpoint.
  - On success, navigates to `/dashboard` with `{ state: { user } }` where `user` comes from the backend (includes at least `name` and `role`).
- **User service layer**: `src/services/userService.js`
  - Caches users fetched from `api/userAPI.getUsers` with a short TTL to reduce network calls.
  - Provides higher-level helpers: `getEmployees`, `addUser`, `updateUser`, `deleteUser`, `toggleUserStatus`, all delegating to `api/userAPI` and clearing cache on mutation.
  - Provides a **fallback CEO user** if the API is unreachable so the app remains usable in degraded mode.
- **Role-based behavior**:
  - `Sidebar` (in `src/components/Sidebar.jsx`) shows a **Settings** tab only when `user.role === 'ceo'`.
  - `StockManagement` only enables stock cards for `user.role === 'employee'`; others see a placeholder.
  - Most navigation between dashboard and stock pages passes the `user` object via React Router location state, so breaking that contract will log users out or redirect.

### 3. Dashboard & PMS integration (Google Sheets)

The dashboard is tightly coupled to a Google Sheets-based **PMS** workbook and Google Apps Script web app.

- **Dashboard container**: `pages/dashboard/Dashboard.jsx`
  - Receives `user` via router state; redirects to `/login` if missing.
  - Manages `activeTab` and renders tab-specific components for production plan, production summary, stock, orders, employees, menu items, financials, and (for CEO) settings.
  - Fetches high-level sheet data on mount using `api/restaurantAPI.fetchPMSData` and `fetchRecipeData` and stores it in local `data` for child components.
- **PMS/Recipe APIs**:
  - `src/api/restaurantAPI.js` is a shim re-exporting from `restaurantAPI2` (current primary implementation). Some legacy logic exists in `restaurantAPI3` but is not wired through this alias.
  - `src/api/restaurantAPI2.js` talks to a **Google Apps Script web app** (`APPS_SCRIPT_URL`) that in turn reads from sheets like `PMS`, `P Vs A (Recipe)`, and `MENU`.
  - Core exports:
    - `fetchPMSData`, `fetchRecipeData`: array-of-arrays representing raw sheet rows.
    - `fetchMenuOptions`: derives `{ meals, clients, dates }` from the `MENU` sheet.
    - `updatePMSCells`, `updatePMSDropdown`, `updateCell`: low-level mutation helpers that update specific cells or ranges via Apps Script.
    - `fetchDynamicClients`, `fetchDynamicDates`, `fetchDynamicMeals`: higher-level endpoints exposing dynamic filter options built on top of the MENU + PMS data.
- **DashboardSummary**: `pages/dashboard/DashboardSummary.jsx`
  - Drives the **Production Plan** UI – effectively a read/write projection of the PMS sheet.
  - **Parsing logic**:
    - `parsePMSSheet` turns raw PMS rows into a structured `menu` model with `client`, `date`, `meal`, `pax`, and `items`, where each item has `ingredients` and edit metadata (`actualCell` with row/col indices).
    - Many numeric and header-detection heuristics depend on fixed row/column offsets (row 0 for dropdowns, rows 1–2 for dish headers, later rows for ingredient blocks). Changing sheet layout will break this parsing.
  - **Filter state** (client / date / meal):
    - Options are fetched via the dynamic APIs (`fetchDynamicClients`, `fetchDynamicDates`, `fetchDynamicMeals`).
    - Current selections are mirrored to `localStorage` to persist between sessions.
  - **Forcing sheet recalculation**:
    - `forceSheetRecalculation` and `fetchWithStrictValidation` coordinate a multi-step process to set dropdown cells in PMS (A1 client, M1 date, Y1 meal) using `updatePMSDropdown` + `updateCell`, then repeatedly refetch and validate that the sheet actually reflects the selected filters.
    - This mechanism is fragile but intentional; be cautious making timing or row/col offset changes because they assume the underlying Apps Script behaves the way `appscript.js` defines.
  - **Autosave of actual quantities**:
    - Inputs for dish- and ingredient-level "Actual" values call `handleAutoSave`, which uses `updateCell` with coordinates recorded in `actualCell`. This writes directly back to PMS, not just local state.

### 4. Stock management flows (Orders, Received, Pending)

All stock flows talk to a separate Google Apps Script endpoint dedicated to **Stock/IMS-O2D** operations. The URL is hard-coded in `src/api/stockAPI.js` and must stay in sync with the backend script.

#### 4.1 Stock API client (`src/api/stockAPI.js`)

- Implements a hardened fetch layer:
  - `fetchWithTimeout` wraps `fetch` with timeouts and simple retry logic, used widely across stock endpoints.
  - `parseResponse` is a defensive parser that trims noise, extracts JSON payloads even when wrapped in extra characters, and gracefully degrades to text.
- Core endpoints:
  - `fetchItems`, `fetchPriorities`: provide dropdown data for ordering UI.
  - `fetchStockOrders`: returns order rows enriched with row numbers and other metadata; used by both `OrderStockPage` and `ReceivedStockPage`.
  - `fetchDiffO2dOrders`: returns a compound object `{ headerRow1, headerRow2, data }` used by `PendingStockPage`.
  - `startOrder`: negotiates available order numbers from the sheet and returns `{ success, orderNumbers, message | error }`; this replaces the older single-`orderNo` model.
  - `addStockOrder`, `updateStockOrder`, `deleteStockOrder`, `saveReceivedStock`: mutation endpoints representing CRUD on the order sheet and associated received-stock columns.
  - Test helpers `testStockAPI`, `testGetPriorities`, `testAllEndpoints` exist for debugging but are not wired into the UI in production.

Any change to how the Apps Script represents order rows (column order, indices where row numbers are appended, etc.) should be reflected in the normalization logic in `OrderStockPage` and `ReceivedStockPage`.

#### 4.2 Order entry (`pages/OrderStockPage.jsx`)

- Only accessible for employees; other roles are redirected back.
- On mount, if `user.role === 'employee'`:
  - Calls `fetchItems`, `fetchPriorities`, `fetchStockOrders` concurrently.
  - Normalizes order rows with `normalizeOrders`, filtering out header and empty rows.
  - Immediately calls `handleStartOrder` to load **available order numbers** via `startOrder` and stores them in `availableOrderNumbers`.
- Flow:
  - User chooses an order number from the "Select Order Number" card → `handleSelectOrderNumber` sets `currentOrderNo` and reveals the order entry form.
  - Form writes new or edited order items through `addStockOrder` or `updateStockOrder`. Responses may echo back authoritative `orderNo` and row numbers which are used to keep local state lined up with the sheet.
  - Delete operations preferentially use `row` for fast deletion on the backend, falling back to `(orderNo, itemName)` matching on older data.
- The table view relies on the normalized `orders` array; any adjustments to server-side columns should be mirrored in `normalizeOrders`.

#### 4.3 Received stock entry (`pages/ReceivedStockPage.jsx`)

- Consumes the same `fetchStockOrders` endpoint but expects extra columns representing received data (P–S in the sheet) at specific indices in the API response.
- `normalizeOrders` maps each row into:
  - Core order fields (order no, timestamp, item code/name, qty, unit, priority, remark, row).
  - Received fields: `receivedQty`, `weight`, `receivedUnit`, `receivedRemark` derived from additional columns.
- `receivedData` component state stores per-row form values keyed by sheet row number and is initialized from the server data.
- On input blur, `handleFieldBlur` auto-saves to the backend by calling `saveReceivedStock` with `{ row, receivedQty, weight, unit, remark }`; `savingRows` tracks rows currently being persisted for inline spinners.

#### 4.4 Pending stock view (`pages/PendingStockPage.jsx`)

- Displays the **Diff-O2d** sheet contents in a read-only table.
- Accepts several backend response shapes for backward compatibility:
  - Preferred: `{ headerRow1, headerRow2, data }`.
  - Fallback: `{ headers, data }`.
  - Legacy: bare array of rows.
- Renders either a two-level header (if both `headerRow1` and `headerRow2` exist) or a single header row, plus a summary info box about row/column counts.

### 5. Layout, styling, and shared UI

- Tailwind CSS v4 is enabled via the `@tailwindcss/vite` plugin in `vite.config.js`; styles live primarily in `src/index.css` and `src/App.css` and are used via utility classes throughout.
- `components/Sidebar.jsx` is the main layout component for `/dashboard` and controls:
  - Mobile/desktop sidebar behavior (`isOpen` state, overlay, transitions).
  - Menu items mapped to `Dashboard` tabs.
  - User avatar and logout actions.
- Individual dashboard subpages (`DashboardSummary`, `ProductionSummary`, `StockManagement`, `OrdersManagement`, `EmployeesManagement`, `MenuItemsManagement`, `FinancialData`, `Settings`) live under `src/pages/dashboard/` and are switched by `Dashboard` based on `activeTab`.

### 6. Google Apps Script backend (`appscript.js`)

This file is not executed in Node/Vite; it is the **server-side Apps Script** published as a web app and backing both the PMS dashboard and stock modules.

Key responsibilities (high level):

- **PMS → reporting & email**: `copyMenuData`, `pasteFullData`, `sendMergedSheetEmail` transform PMS data into summary sheets and email-friendly HTML tables.
- **Web API surface**:
  - `doGet` handles read and update actions for PMS and related sheets:
    - Generic data fetch (default `PMS` sheet).
    - `action=update` to update a single cell with data validation handling and forced formula recalculation.
    - Dynamic filter endpoints: `getClients`, `getDates`, `getMeals`, plus `setFiltersAndVerify` to set all dropdowns (client/date/meal) in one shot.
    - `manualSync` to trigger `syncPMSToFirebase`.
  - `doPost` dispatches between `handleReactRequest` (JSON-style updates from the React app) and `handleEmailRequest` (form posts from email).
- **PMS ↔ Firebase synchronization**:
  - `syncPMSToFirebase` serializes a compressed view of PMS + MENU + client mapping into a Firestore document at a fixed path.
  - `optimizedFullSyncToRTDB` pushes a more detailed plan structure into Firebase Realtime Database under `/plans/{clientKey}/{date}` with a companion `/clients_list` entry.
- **Stock-related helpers**:
  - While stock-specific endpoints are not all visible here, the stock web app URL in `src/api/stockAPI.js` and the PMS URL in `restaurantAPI2.js` must correspond to the deployment(s) of this Apps Script project.

Changes to Apps Script often require synchronized updates in:

- `restaurantAPI2.js` (PMS endpoints and URL).
- `stockAPI.js` (stock endpoints and URL/parameters).
- The parser and autosave logic in `DashboardSummary.jsx`, `OrderStockPage.jsx`, `PendingStockPage.jsx`, and `ReceivedStockPage.jsx` that assume specific sheet layouts and action names.
