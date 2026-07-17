/**
 * v1 taxonomy, derived from the live (non-soft-deleted) rows in the legacy
 * Snipe-IT `categories` table - see scripts/parse-legacy-categories.mjs.
 * All 67 active categories carry over unchanged; no reclassification needed.
 * Accessory/Component types had zero active rows in the source system and
 * are intentionally excluded from v1 (deferred to a later phase).
 *
 * One known gap, to resolve during the real data migration (not here): a
 * category literally named "Consumables" exists but is typed `asset` in the
 * source data (likely a miscategorized catch-all). Decide its fate once we
 * can see how many real item rows reference it.
 */

export const seedCategories: { name: string; type: "asset" | "license" | "consumable" }[] = [
  // --- asset (49) ---
  ...[
    "Access Points", "Camera System", "Company Building Maintenance Kit",
    "Computer Components", "Consumables", "E-Token",
    "Electrical Supplies & Accessories", "Electrical Tool", "Electronic Accessories",
    "Employee Cards", "Firewall Devices", "Hard Drive", "Internet USB Adapter",
    "Internet USB Modem", "Key", "Keyboard Stickers", "Laptop", "Laptop Bag",
    "Laptop Stand", "Maintenance Kit", "Maintenance Kit [Shrink & Stretch]",
    "Maintenance Kit [Strap & Tape]", "Maintenance Kit [Warranty]",
    "Material Sales Tool", "Memory Card", "Mobile Phones", "Mouse", "Mouse Pad",
    "Multimedia Devices", "PC Case", "PC Monitor", "Power Supply - UPS",
    "Printers", "Routers", "Safety Equipment", "Scanners", "Server",
    "Shooting Equipment", "SIM Card", "Software Pack", "Switches", "Tablets",
    "Tool", "TV Screens", "USB Flash Drive", "Wi-Fi Rack", "Wired Keyboard",
    "Wireless Keyboard", "Workshop Kit",
  ].map((name) => ({ name, type: "asset" as const })),

  // --- license (15) ---
  ...[
    "Adobe Creative Cloud", "Antivirus Software", "AutoCAD", "Backup Software",
    "Canva", "Endpoint Protection", "ERP and Business Applications",
    "Firewall License", "Google Workspace", "Microsoft Exchange",
    "Microsoft Office", "Microsoft Teams", "Microsoft Windows", "MySQL",
    "SQL Server",
  ].map((name) => ({ name, type: "license" as const })),

  // --- consumable (3) ---
  ...[
    "Cleaning Consumables", "Electrical Consumables", "Printing Consumables",
  ].map((name) => ({ name, type: "consumable" as const })),
];

/**
 * Clean, currently-active status labels from the legacy system (the same
 * parse also surfaced "Deployed Deployed", "Ready for Deploy", etc. - all
 * already soft-deleted duplicates from earlier cleanup passes). "Under
 * Maintenance" is re-added on engineering judgment: a soft-deleted row
 * existed for it, but the concept is clearly useful and matches the
 * maintenance-ticket behavior seen in asset notes.
 */
export const seedStatusLabels = [
  { name: "Pending", deployable: false, pending: true, archived: false, color: null },
  { name: "Ready to Deploy", deployable: true, pending: false, archived: false, color: "#33a5ff" },
  { name: "Deployed", deployable: true, pending: false, archived: false, color: null },
  { name: "Under Maintenance", deployable: false, pending: true, archived: false, color: "#f0f50c" },
  { name: "Archived", deployable: false, pending: false, archived: true, color: null },
];

export const seedRoles = [
  { name: "admin", permissions: ["*"] },
  { name: "it_manager", permissions: ["assets:*", "licenses:*", "consumables:*", "kits:*", "accessories:*", "components:*", "requests:approve_any", "users:manage", "purchase_orders:*"] },
  { name: "department_approver", permissions: ["requests:approve_own_reports", "assets:view_department"] },
  { name: "technician", permissions: ["assets:checkout", "assets:checkin", "assets:edit"] },
  { name: "employee", permissions: ["requests:create_own", "assets:view_own"] },
];
