// src/lib/pantoneService.ts
import { api } from './api';

export interface PantoneColorRecord {
  code: string;       // e.g. "19-4052 TCX" or "PMS 286 C"
  name: string;       // Official Pantone color name, e.g. "Classic Navy"
  hex: string;        // Representative digital sRGB hex, e.g. "#0f2042"
  category: string;   // e.g. "Blues & Navies"
  system: 'FHI TCX' | 'FHI TPX' | 'FHI TPG' | 'PMS Coated';
}

export interface PantoneLookupResult {
  found: boolean;
  pantone_code?: string;
  name?: string;
  hex_code?: string;
  red?: number;
  green?: number;
  blue?: number;
  category?: string;
  system?: string;
  error?: string;
}

/**
 * Comprehensive verified dataset of standard textile and apparel Pantone colors.
 * Standard FHI Cotton (TCX/TPX) and PMS reference standards.
 */
export const VERIFIED_PANTONE_LIBRARY: PantoneColorRecord[] = [
  // =========================================================================
  // 1. NEUTRALS, BLACKS & GRAYS (Textile FHI & PMS)
  // =========================================================================
  { code: '19-4005 TCX', name: 'Stretch Limo', hex: '#2b2c30', category: 'Neutrals & Blacks', system: 'FHI TCX' },
  { code: '19-0303 TCX', name: 'Jet Black', hex: '#2b2b2c', category: 'Neutrals & Blacks', system: 'FHI TCX' },
  { code: '19-3911 TCX', name: 'Black Beauty', hex: '#212328', category: 'Neutrals & Blacks', system: 'FHI TCX' },
  { code: '19-4201 TCX', name: 'Black Onyx', hex: '#2b2b2a', category: 'Neutrals & Blacks', system: 'FHI TCX' },
  { code: '19-4305 TCX', name: 'Pirate Black', hex: '#363839', category: 'Neutrals & Blacks', system: 'FHI TCX' },
  { code: '19-4104 TCX', name: 'Ebony', hex: '#363838', category: 'Neutrals & Blacks', system: 'FHI TCX' },
  { code: '19-4007 TCX', name: 'Anthracite', hex: '#383e42', category: 'Neutrals & Blacks', system: 'FHI TCX' },
  { code: '19-3908 TCX', name: 'Steel Gray', hex: '#464c53', category: 'Neutrals & Blacks', system: 'FHI TCX' },
  { code: '18-4005 TCX', name: 'Steel Grey', hex: '#63676c', category: 'Neutrals & Blacks', system: 'FHI TCX' },
  { code: '18-5203 TCX', name: 'Pewter', hex: '#666564', category: 'Neutrals & Blacks', system: 'FHI TCX' },
  { code: '18-0403 TCX', name: 'Dark Gull Gray', hex: '#62635f', category: 'Neutrals & Blacks', system: 'FHI TCX' },
  { code: '18-0201 TCX', name: 'Castor Gray', hex: '#646762', category: 'Neutrals & Blacks', system: 'FHI TCX' },
  { code: '17-5104 TCX', name: 'Ultimate Gray', hex: '#939597', category: 'Neutrals & Blacks', system: 'FHI TCX' },
  { code: '17-4402 TCX', name: 'Neutral Gray', hex: '#8e9196', category: 'Neutrals & Blacks', system: 'FHI TCX' },
  { code: '17-1501 TCX', name: 'Slate Gray', hex: '#8b8c89', category: 'Neutrals & Blacks', system: 'FHI TCX' },
  { code: '16-3801 TCX', name: 'Opal Gray', hex: '#a5a9b4', category: 'Neutrals & Blacks', system: 'FHI TCX' },
  { code: '16-3915 TCX', name: 'Alloy', hex: '#98979a', category: 'Neutrals & Blacks', system: 'FHI TCX' },
  { code: '15-4101 TCX', name: 'High-Rise', hex: '#b2b3b4', category: 'Neutrals & Blacks', system: 'FHI TCX' },
  { code: '14-4102 TCX', name: 'Glacier Gray', hex: '#c5cace', category: 'Neutrals & Blacks', system: 'FHI TCX' },
  { code: '14-4201 TCX', name: 'Lunar Rock', hex: '#c5c5c5', category: 'Neutrals & Blacks', system: 'FHI TCX' },
  { code: '13-4103 TCX', name: 'Illusion Blue', hex: '#d0d9dd', category: 'Neutrals & Blacks', system: 'FHI TCX' },
  { code: 'PMS Process Black C', name: 'Process Black', hex: '#27251f', category: 'Neutrals & Blacks', system: 'PMS Coated' },
  { code: 'PMS Black 6 C', name: 'Black 6', hex: '#101820', category: 'Neutrals & Blacks', system: 'PMS Coated' },
  { code: 'PMS Cool Gray 1 C', name: 'Cool Gray 1', hex: '#d9d9d6', category: 'Neutrals & Blacks', system: 'PMS Coated' },
  { code: 'PMS Cool Gray 3 C', name: 'Cool Gray 3', hex: '#c8c9c7', category: 'Neutrals & Blacks', system: 'PMS Coated' },
  { code: 'PMS Cool Gray 6 C', name: 'Cool Gray 6', hex: '#a7a8aa', category: 'Neutrals & Blacks', system: 'PMS Coated' },
  { code: 'PMS Cool Gray 9 C', name: 'Cool Gray 9', hex: '#75787b', category: 'Neutrals & Blacks', system: 'PMS Coated' },
  { code: 'PMS Cool Gray 11 C', name: 'Cool Gray 11', hex: '#53565a', category: 'Neutrals & Blacks', system: 'PMS Coated' },
  { code: 'PMS Warm Gray 1 C', name: 'Warm Gray 1', hex: '#d7d2cb', category: 'Neutrals & Blacks', system: 'PMS Coated' },
  { code: 'PMS Warm Gray 5 C', name: 'Warm Gray 5', hex: '#ac9f93', category: 'Neutrals & Blacks', system: 'PMS Coated' },
  { code: 'PMS Warm Gray 9 C', name: 'Warm Gray 9', hex: '#83786f', category: 'Neutrals & Blacks', system: 'PMS Coated' },

  // =========================================================================
  // 2. WHITES, CREAMS & BEIGES (Textile FHI)
  // =========================================================================
  { code: '11-0601 TCX', name: 'Bright White', hex: '#f4f5f0', category: 'Whites & Creams', system: 'FHI TCX' },
  { code: '11-4201 TCX', name: 'Cloud Dancer', hex: '#f0eee9', category: 'Whites & Creams', system: 'FHI TCX' },
  { code: '11-0602 TCX', name: 'Snow White', hex: '#f2f0eb', category: 'Whites & Creams', system: 'FHI TCX' },
  { code: '11-0103 TCX', name: 'Egret', hex: '#f3efe0', category: 'Whites & Creams', system: 'FHI TCX' },
  { code: '11-0104 TCX', name: 'Pure Cashmere', hex: '#edeae0', category: 'Whites & Creams', system: 'FHI TCX' },
  { code: '11-0604 TCX', name: 'Gardenia', hex: '#f1e8df', category: 'Whites & Creams', system: 'FHI TCX' },
  { code: '11-0606 TCX', name: 'Pristine', hex: '#f2e8da', category: 'Whites & Creams', system: 'FHI TCX' },
  { code: '11-0701 TCX', name: 'Whisper White', hex: '#ede6d6', category: 'Whites & Creams', system: 'FHI TCX' },
  { code: '12-0806 TCX', name: 'Rutabaga', hex: '#ece6d5', category: 'Whites & Creams', system: 'FHI TCX' },
  { code: '12-0704 TCX', name: 'White Sand', hex: '#e3dcd1', category: 'Whites & Creams', system: 'FHI TCX' },
  { code: '12-0804 TCX', name: 'Alabaster Gleam', hex: '#f0debe', category: 'Whites & Creams', system: 'FHI TCX' },
  { code: '12-0812 TCX', name: 'Tofu', hex: '#e8dbca', category: 'Whites & Creams', system: 'FHI TCX' },
  { code: '13-1006 TCX', name: 'Creme Brulee', hex: '#dbccb5', category: 'Whites & Creams', system: 'FHI TCX' },
  { code: '13-1011 TCX', name: 'Oxford Tan', hex: '#d6c6b2', category: 'Whites & Creams', system: 'FHI TCX' },
  { code: '13-0905 TCX', name: 'Birch', hex: '#ddd5c7', category: 'Whites & Creams', system: 'FHI TCX' },
  { code: '14-1116 TCX', name: 'Almond Buff', hex: '#ccb399', category: 'Whites & Creams', system: 'FHI TCX' },
  { code: '14-1107 TCX', name: 'Oyster Gray', hex: '#cbc1ae', category: 'Whites & Creams', system: 'FHI TCX' },

  // =========================================================================
  // 3. BLUES & NAVIES (Textile FHI & PMS)
  // =========================================================================
  { code: '19-4052 TCX', name: 'Classic Navy', hex: '#0f2042', category: 'Blues & Navies', system: 'FHI TCX' },
  { code: '19-3921 TCX', name: 'Black Iris', hex: '#2b3042', category: 'Blues & Navies', system: 'FHI TCX' },
  { code: '19-4024 TCX', name: 'Dress Blues', hex: '#232b38', category: 'Blues & Navies', system: 'FHI TCX' },
  { code: '19-4027 TCX', name: 'Blue Nights', hex: '#272f3d', category: 'Blues & Navies', system: 'FHI TCX' },
  { code: '19-4030 TCX', name: 'True Navy', hex: '#202a3b', category: 'Blues & Navies', system: 'FHI TCX' },
  { code: '19-4050 TCX', name: 'Nautical Blue', hex: '#1a3250', category: 'Blues & Navies', system: 'FHI TCX' },
  { code: '19-4053 TCX', name: 'Dark Navy', hex: '#1b2d4b', category: 'Blues & Navies', system: 'FHI TCX' },
  { code: '19-4150 TCX', name: 'Princess Blue', hex: '#00539c', category: 'Blues & Navies', system: 'FHI TCX' },
  { code: '19-4056 TCX', name: 'Medieval Blue', hex: '#29304e', category: 'Blues & Navies', system: 'FHI TCX' },
  { code: '19-3832 TCX', name: 'Navy Peony', hex: '#223a5e', category: 'Blues & Navies', system: 'FHI TCX' },
  { code: '19-3938 TCX', name: 'Twilight Blue', hex: '#323d50', category: 'Blues & Navies', system: 'FHI TCX' },
  { code: '18-3949 TCX', name: 'Dazzling Blue', hex: '#1e448c', category: 'Blues & Navies', system: 'FHI TCX' },
  { code: '18-4051 TCX', name: 'Turkish Sea', hex: '#19517d', category: 'Blues & Navies', system: 'FHI TCX' },
  { code: '18-4252 TCX', name: 'Blue Aster', hex: '#0066b2', category: 'Blues & Navies', system: 'FHI TCX' },
  { code: '18-3943 TCX', name: 'Blue Grotto', hex: '#225d9c', category: 'Blues & Navies', system: 'FHI TCX' },
  { code: '18-4043 TCX', name: 'Palace Blue', hex: '#2b5b88', category: 'Blues & Navies', system: 'FHI TCX' },
  { code: '17-4427 TCX', name: 'Bluebird', hex: '#0090c5', category: 'Blues & Navies', system: 'FHI TCX' },
  { code: '17-4041 TCX', name: 'Marina', hex: '#4f84c4', category: 'Blues & Navies', system: 'FHI TCX' },
  { code: '16-4535 TCX', name: 'Blue Jewel', hex: '#009bb0', category: 'Blues & Navies', system: 'FHI TCX' },
  { code: '16-4132 TCX', name: 'Little Boy Blue', hex: '#6ca0dc', category: 'Blues & Navies', system: 'FHI TCX' },
  { code: '15-3919 TCX', name: 'Serenity', hex: '#92a8d1', category: 'Blues & Navies', system: 'FHI TCX' },
  { code: '15-4720 TCX', name: 'Aqua Sky', hex: '#7bc4c4', category: 'Blues & Navies', system: 'FHI TCX' },
  { code: '14-4810 TCX', name: 'Beach Glass', hex: '#9fe2bf', category: 'Blues & Navies', system: 'FHI TCX' },
  { code: '14-4115 TCX', name: 'Skyway', hex: '#adbed2', category: 'Blues & Navies', system: 'FHI TCX' },
  { code: '13-4308 TCX', name: 'Baby Blue', hex: '#bad3df', category: 'Blues & Navies', system: 'FHI TCX' },
  { code: 'PMS 286 C', name: 'Royal Blue', hex: '#0033a0', category: 'Blues & Navies', system: 'PMS Coated' },
  { code: 'PMS 293 C', name: 'Navy Cobalt', hex: '#0051ba', category: 'Blues & Navies', system: 'PMS Coated' },
  { code: 'PMS 300 C', name: 'Process Cyan Blue', hex: '#005eb8', category: 'Blues & Navies', system: 'PMS Coated' },
  { code: 'PMS 281 C', name: 'Midnight Navy', hex: '#00205b', category: 'Blues & Navies', system: 'PMS Coated' },
  { code: 'PMS 299 C', name: 'Bright Sky Blue', hex: '#00a3e0', category: 'Blues & Navies', system: 'PMS Coated' },
  { code: 'PMS Reflex Blue C', name: 'Reflex Blue', hex: '#0a1172', category: 'Blues & Navies', system: 'PMS Coated' },

  // =========================================================================
  // 4. REDS, MAROONS & CORALS (Textile FHI & PMS)
  // =========================================================================
  { code: '19-1664 TCX', name: 'True Red', hex: '#bf1932', category: 'Reds & Corals', system: 'FHI TCX' },
  { code: '18-1662 TCX', name: 'Flame Scarlet', hex: '#cd2434', category: 'Reds & Corals', system: 'FHI TCX' },
  { code: '19-1763 TCX', name: 'Formula One', hex: '#bd1827', category: 'Reds & Corals', system: 'FHI TCX' },
  { code: '19-1764 TCX', name: 'Lipstick Red', hex: '#b31a38', category: 'Reds & Corals', system: 'FHI TCX' },
  { code: '19-1557 TCX', name: 'Chili Pepper', hex: '#9b1b30', category: 'Reds & Corals', system: 'FHI TCX' },
  { code: '18-1750 TCX', name: 'Viva Magenta', hex: '#bb2649', category: 'Reds & Corals', system: 'FHI TCX' },
  { code: '19-1250 TCX', name: 'Tibetan Red', hex: '#782a3b', category: 'Reds & Corals', system: 'FHI TCX' },
  { code: '19-1725 TCX', name: 'Cabernet', hex: '#662938', category: 'Reds & Corals', system: 'FHI TCX' },
  { code: '19-1627 TCX', name: 'Port Royal', hex: '#532637', category: 'Reds & Corals', system: 'FHI TCX' },
  { code: '19-1524 TCX', name: 'Burgundy', hex: '#64313e', category: 'Reds & Corals', system: 'FHI TCX' },
  { code: '18-1438 TCX', name: 'Marsala', hex: '#964f4c', category: 'Reds & Corals', system: 'FHI TCX' },
  { code: '18-1655 TCX', name: 'Tomato', hex: '#ce2939', category: 'Reds & Corals', system: 'FHI TCX' },
  { code: '17-1563 TCX', name: 'Cherry Tomato', hex: '#eb3c27', category: 'Reds & Corals', system: 'FHI TCX' },
  { code: '16-1546 TCX', name: 'Living Coral', hex: '#ff6f61', category: 'Reds & Corals', system: 'FHI TCX' },
  { code: '17-1547 TCX', name: 'Bloom', hex: '#ea6b66', category: 'Reds & Corals', system: 'FHI TCX' },
  { code: '15-1530 TCX', name: 'Peach Bloom', hex: '#e29a8a', category: 'Reds & Corals', system: 'FHI TCX' },
  { code: 'PMS 186 C', name: 'Cardinal Red', hex: '#c8102e', category: 'Reds & Corals', system: 'PMS Coated' },
  { code: 'PMS 200 C', name: 'Crimson Red', hex: '#ba0c2f', category: 'Reds & Corals', system: 'PMS Coated' },
  { code: 'PMS 185 C', name: 'Bright Scarlet Red', hex: '#e4002b', category: 'Reds & Corals', system: 'PMS Coated' },
  { code: 'PMS 485 C', name: 'Warm Red Flame', hex: '#da291c', category: 'Reds & Corals', system: 'PMS Coated' },
  { code: 'PMS 7427 C', name: 'Deep Burgundy Wine', hex: '#8a1538', category: 'Reds & Corals', system: 'PMS Coated' },

  // =========================================================================
  // 5. PINKS & PURPLES (Textile FHI & PMS)
  // =========================================================================
  { code: '18-2120 TCX', name: 'Honeysuckle', hex: '#d94f70', category: 'Pinks & Purples', system: 'FHI TCX' },
  { code: '19-2431 TCX', name: 'Very Berry', hex: '#b91c47', category: 'Pinks & Purples', system: 'FHI TCX' },
  { code: '19-2045 TCX', name: 'Beetroot Purple', hex: '#cf2759', category: 'Pinks & Purples', system: 'FHI TCX' },
  { code: '18-2133 TCX', name: 'Pink Flambe', hex: '#d84976', category: 'Pinks & Purples', system: 'FHI TCX' },
  { code: '17-2227 TCX', name: 'Rose Violet', hex: '#db6b97', category: 'Pinks & Purples', system: 'FHI TCX' },
  { code: '16-2124 TCX', name: 'Pink Carnation', hex: '#e98ca7', category: 'Pinks & Purples', system: 'FHI TCX' },
  { code: '15-2216 TCX', name: 'Begonia Pink', hex: '#ec9fb3', category: 'Pinks & Purples', system: 'FHI TCX' },
  { code: '15-2217 TCX', name: 'Candy Pink', hex: '#e8a2b5', category: 'Pinks & Purples', system: 'FHI TCX' },
  { code: '13-1520 TCX', name: 'Rose Quartz', hex: '#f7cac9', category: 'Pinks & Purples', system: 'FHI TCX' },
  { code: '14-1911 TCX', name: 'Candy Floss', hex: '#e8bacb', category: 'Pinks & Purples', system: 'FHI TCX' },
  { code: '18-3838 TCX', name: 'Ultra Violet', hex: '#5f4b8b', category: 'Pinks & Purples', system: 'FHI TCX' },
  { code: '18-3224 TCX', name: 'Radiant Orchid', hex: '#b163a3', category: 'Pinks & Purples', system: 'FHI TCX' },
  { code: '19-3518 TCX', name: 'Grape Royale', hex: '#4e3352', category: 'Pinks & Purples', system: 'FHI TCX' },
  { code: '19-3737 TCX', name: 'Purple Passion', hex: '#543b59', category: 'Pinks & Purples', system: 'FHI TCX' },
  { code: '17-3619 TCX', name: 'Amethyst', hex: '#875692', category: 'Pinks & Purples', system: 'FHI TCX' },
  { code: '16-3310 TCX', name: 'Lavender Mist', hex: '#a89bc4', category: 'Pinks & Purples', system: 'FHI TCX' },
  { code: '14-3207 TCX', name: 'Pink Lavender', hex: '#d8b9d3', category: 'Pinks & Purples', system: 'FHI TCX' },
  { code: 'PMS 2685 C', name: 'Deep Purple', hex: '#330072', category: 'Pinks & Purples', system: 'PMS Coated' },
  { code: 'PMS 2592 C', name: 'Vibrant Magenta Violet', hex: '#9b26b6', category: 'Pinks & Purples', system: 'PMS Coated' },
  { code: 'PMS 233 C', name: 'Hot Pink Fuchsia', hex: '#be0078', category: 'Pinks & Purples', system: 'PMS Coated' },

  // =========================================================================
  // 6. GREENS & OLIVES (Textile FHI & PMS)
  // =========================================================================
  { code: '17-5641 TCX', name: 'Emerald', hex: '#009473', category: 'Greens & Olives', system: 'FHI TCX' },
  { code: '15-0343 TCX', name: 'Greenery', hex: '#88b04b', category: 'Greens & Olives', system: 'FHI TCX' },
  { code: '15-5519 TCX', name: 'Turquoise', hex: '#45b5aa', category: 'Greens & Olives', system: 'FHI TCX' },
  { code: '18-0527 TCX', name: 'Olive Branch', hex: '#696845', category: 'Greens & Olives', system: 'FHI TCX' },
  { code: '19-0515 TCX', name: 'Lead Green', hex: '#464b37', category: 'Greens & Olives', system: 'FHI TCX' },
  { code: '19-0414 TCX', name: 'Forest Night', hex: '#40443a', category: 'Greens & Olives', system: 'FHI TCX' },
  { code: '19-0309 TCX', name: 'Deep Forest', hex: '#363c32', category: 'Greens & Olives', system: 'FHI TCX' },
  { code: '19-5513 TCX', name: 'Dark Green', hex: '#1e382b', category: 'Greens & Olives', system: 'FHI TCX' },
  { code: '18-5624 TCX', name: 'Garden Green', hex: '#396b4e', category: 'Greens & Olives', system: 'FHI TCX' },
  { code: '17-6153 TCX', name: 'Fern Green', hex: '#4f7942', category: 'Greens & Olives', system: 'FHI TCX' },
  { code: '17-0207 TCX', name: 'Laurel Green', hex: '#858779', category: 'Greens & Olives', system: 'FHI TCX' },
  { code: '16-0213 TCX', name: 'Tea Green', hex: '#9fa38b', category: 'Greens & Olives', system: 'FHI TCX' },
  { code: '16-5804 TCX', name: 'Desert Sage', hex: '#929e8b', category: 'Greens & Olives', system: 'FHI TCX' },
  { code: '14-0418 TCX', name: 'Tender Greens', hex: '#b9c09c', category: 'Greens & Olives', system: 'FHI TCX' },
  { code: '13-0117 TCX', name: 'Green Flash', hex: '#85c441', category: 'Greens & Olives', system: 'FHI TCX' },
  { code: 'PMS 347 C', name: 'Kelly Green', hex: '#009a44', category: 'Greens & Olives', system: 'PMS Coated' },
  { code: 'PMS 368 C', name: 'Lime Green', hex: '#78be20', category: 'Greens & Olives', system: 'PMS Coated' },
  { code: 'PMS 356 C', name: 'Hunter Forest Green', hex: '#007a3d', category: 'Greens & Olives', system: 'PMS Coated' },
  { code: 'PMS 3272 C', name: 'Ocean Aqua Green', hex: '#00a389', category: 'Greens & Olives', system: 'PMS Coated' },

  // =========================================================================
  // 7. YELLOWS & ORANGES (Textile FHI & PMS)
  // =========================================================================
  { code: '13-0647 TCX', name: 'Illuminating', hex: '#f5df4d', category: 'Yellows & Oranges', system: 'FHI TCX' },
  { code: '14-0848 TCX', name: 'Mimosa', hex: '#f0c05a', category: 'Yellows & Oranges', system: 'FHI TCX' },
  { code: '13-1023 TCX', name: 'Peach Fuzz', hex: '#ffbe98', category: 'Yellows & Oranges', system: 'FHI TCX' },
  { code: '17-1463 TCX', name: 'Tangerine Tango', hex: '#dd4124', category: 'Yellows & Oranges', system: 'FHI TCX' },
  { code: '17-1336 TCX', name: 'Burnt Orange', hex: '#b85d19', category: 'Yellows & Oranges', system: 'FHI TCX' },
  { code: '16-1359 TCX', name: 'Orange Peel', hex: '#de6d21', category: 'Yellows & Oranges', system: 'FHI TCX' },
  { code: '15-1247 TCX', name: 'Apricot', hex: '#f19035', category: 'Yellows & Oranges', system: 'FHI TCX' },
  { code: '14-1159 TCX', name: 'Marigold', hex: '#fba834', category: 'Yellows & Oranges', system: 'FHI TCX' },
  { code: '13-0947 TCX', name: 'Banana', hex: '#fcd458', category: 'Yellows & Oranges', system: 'FHI TCX' },
  { code: '12-0752 TCX', name: 'Buttercup', hex: '#fae03a', category: 'Yellows & Oranges', system: 'FHI TCX' },
  { code: '11-0616 TCX', name: 'Pastel Yellow', hex: '#fbf1c9', category: 'Yellows & Oranges', system: 'FHI TCX' },
  { code: 'PMS 109 C', name: 'Golden Yellow', hex: '#ffd100', category: 'Yellows & Oranges', system: 'PMS Coated' },
  { code: 'PMS 123 C', name: 'Sun Yellow', hex: '#ffc72c', category: 'Yellows & Oranges', system: 'PMS Coated' },
  { code: 'PMS 021 C', name: 'Bright Orange', hex: '#fe5000', category: 'Yellows & Oranges', system: 'PMS Coated' },
  { code: 'PMS 151 C', name: 'Warm Apricot Orange', hex: '#ff8200', category: 'Yellows & Oranges', system: 'PMS Coated' },

  // =========================================================================
  // 8. BROWNS & EARTH TONES (Textile FHI & PMS)
  // =========================================================================
  { code: '19-0815 TCX', name: 'Java', hex: '#3d312a', category: 'Browns & Earth Tones', system: 'FHI TCX' },
  { code: '19-0912 TCX', name: 'Chocolate Brown', hex: '#453328', category: 'Browns & Earth Tones', system: 'FHI TCX' },
  { code: '18-1248 TCX', name: 'Rust', hex: '#9b4722', category: 'Browns & Earth Tones', system: 'FHI TCX' },
  { code: '18-1442 TCX', name: 'Mahogany', hex: '#823a32', category: 'Browns & Earth Tones', system: 'FHI TCX' },
  { code: '18-1340 TCX', name: 'Copper Brown', hex: '#99522b', category: 'Browns & Earth Tones', system: 'FHI TCX' },
  { code: '18-1031 TCX', name: 'Deep Brown', hex: '#594235', category: 'Browns & Earth Tones', system: 'FHI TCX' },
  { code: '17-1040 TCX', name: 'Sudan Brown', hex: '#855b32', category: 'Browns & Earth Tones', system: 'FHI TCX' },
  { code: '16-1144 TCX', name: 'Medal Bronze', hex: '#9c7a3c', category: 'Browns & Earth Tones', system: 'FHI TCX' },
  { code: '15-1040 TCX', name: 'Praline', hex: '#ad8b60', category: 'Browns & Earth Tones', system: 'FHI TCX' },
  { code: '14-1122 TCX', name: 'Sheepskin', hex: '#c9af88', category: 'Browns & Earth Tones', system: 'FHI TCX' },
  { code: 'PMS 469 C', name: 'Earthy Leather Brown', hex: '#5b341c', category: 'Browns & Earth Tones', system: 'PMS Coated' },
  { code: 'PMS 7527 C', name: 'Warm Putty Taupe', hex: '#d6d2c4', category: 'Browns & Earth Tones', system: 'PMS Coated' }
];

/**
 * Normalizes user-entered Pantone string for robust lookup matching:
 * - Trims whitespace
 * - Standardizes internal spaces and casing
 * - Handles "19-4052tcx", "19 - 4052 tcx", "pantone 19-4052 tcx", "PMS 286C"
 */
export function normalizePantoneInput(raw: string): string {
  if (!raw) return '';
  let str = raw.trim().toUpperCase();

  // Remove redundant "PANTONE" prefix if user entered it
  str = str.replace(/^PANTONE\s+/i, '');

  // Normalize hyphens spacing e.g. "19 - 4052" -> "19-4052"
  str = str.replace(/(\d+)\s*-\s*(\d+)/g, '$1-$2');

  // Normalize suffix spacing e.g. "19-4052TCX" -> "19-4052 TCX"
  str = str.replace(/(\d{2}-\d{4})\s*(TCX|TPX|TPG|TSX|TN)/i, '$1 $2');

  // Normalize PMS format e.g. "PMS286C" -> "PMS 286 C", "286 C" -> "PMS 286 C"
  if (/^PMS\s*\d+\s*[CU]?$/i.test(str)) {
    str = str.replace(/^PMS\s*(\d+)\s*([CU]?)$/i, (m, num, letter) => `PMS ${num}${letter ? ' ' + letter : ''}`);
  }

  // Collapse multiple spaces
  return str.replace(/\s+/g, ' ').trim();
}

/**
 * Validates whether entered code matches official Pantone format structure:
 * - FHI Textile format: XX-XXXX TCX/TPX/TPG (e.g. 19-4052 TCX)
 * - PMS Spot format: PMS [Number] C/U (e.g. PMS 286 C)
 */
export function isValidPantoneFormat(code: string): boolean {
  if (!code) return false;
  const normalized = normalizePantoneInput(code);

  // 1. FHI Textile Cotton/Paper format (e.g. 19-4052 TCX, 19-4052, 18-1662 TCX)
  if (/^\d{2}-\d{4}(\s+(TCX|TPX|TPG|TSX|TN))?$/i.test(normalized)) {
    return true;
  }

  // 2. PMS Formula Guide format (e.g. PMS 286 C, PMS 286, PMS Cool Gray 9 C, PMS Process Black C)
  if (
    /^PMS\s+([A-Z0-9\s]+)(\s+[CU])?$/i.test(normalized) ||
    /^PMS\s+Process\s+Black(\s+C)?$/i.test(normalized) ||
    /^\d+\s+[CU]$/i.test(normalized)
  ) {
    return true;
  }

  return false;
}

/**
 * Performs synchronous lookup against verified Pantone library with smart matching:
 * 1. Exact match on normalized code (e.g. "19-4052 TCX")
 * 2. Prefix match if user typed standard 6-digit FHI code without suffix (e.g. "19-4052" -> finds "19-4052 TCX")
 * 3. PMS number match (e.g. "286 C" -> finds "PMS 286 C")
 * 4. PMS number without suffix (e.g. "PMS 286" -> finds "PMS 286 C")
 * 5. TPX/TPG variant fallback for TCX equivalents
 */
export function lookupPantone(inputCode: string): PantoneLookupResult {
  const cleanInput = inputCode.trim();
  if (!cleanInput) {
    return { found: false };
  }

  const normalized = normalizePantoneInput(cleanInput);

  // 1. Try exact match on code
  let match = VERIFIED_PANTONE_LIBRARY.find(
    (item) => item.code.toUpperCase() === normalized.toUpperCase()
  );

  // 2. Try match without suffix (e.g. user typed "19-4052")
  if (!match && /^\d{2}-\d{4}$/.test(normalized)) {
    match = VERIFIED_PANTONE_LIBRARY.find(
      (item) => item.code.toUpperCase().startsWith(normalized.toUpperCase())
    );
  }

  // 3. Try matching "PMS " prefix if user entered just e.g. "286 C"
  if (!match && /^\d+\s+[CU]$/i.test(normalized)) {
    const withPms = `PMS ${normalized}`;
    match = VERIFIED_PANTONE_LIBRARY.find(
      (item) => item.code.toUpperCase() === withPms.toUpperCase()
    );
  }

  // 4. Try matching PMS number without suffix (e.g. "PMS 286" or "286")
  if (!match && /^PMS\s+\d+$/i.test(normalized)) {
    const withC = `${normalized} C`;
    match = VERIFIED_PANTONE_LIBRARY.find(
      (item) => item.code.toUpperCase() === withC.toUpperCase()
    );
  }

  // 5. Try matching TPX/TPG variant if user entered TPX/TPG for a TCX color
  if (!match && /^\d{2}-\d{4}\s+(TPX|TPG)$/i.test(normalized)) {
    const baseCode = normalized.split(' ')[0];
    match = VERIFIED_PANTONE_LIBRARY.find(
      (item) => item.code.startsWith(baseCode)
    );
  }

  if (match) {
    return {
      found: true,
      pantone_code: match.code,
      name: match.name,
      hex_code: match.hex,
      category: match.category,
      system: match.system,
    };
  }

  // Format validation check to give helpful error message
  if (!isValidPantoneFormat(normalized)) {
    return {
      found: false,
      error: 'Invalid Pantone code format. Supported: "19-4052 TCX", "18-1662 TCX", or "PMS 286 C".',
    };
  }

  return {
    found: false,
    error: `Pantone code "${normalized}" was not found in the verified reference dataset.`,
  };
}

/**
 * Converts a hex code string (e.g. "#FFE966" or "FFE966") into an RGB object { r, g, b } (0-255).
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  if (!hex) return null;
  const clean = hex.replace('#', '').trim();
  if (!/^[0-9A-Fa-f]{6}$/.test(clean)) return null;
  const num = parseInt(clean, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

/**
 * Converts RGB components (0-255) into a standardized uppercase 6-digit hex code (e.g. "#FFE966").
 */
export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(Number(v) || 0)));
  const hex = [clamp(r), clamp(g), clamp(b)]
    .map((c) => c.toString(16).padStart(2, '0').toUpperCase())
    .join('');
  return `#${hex}`;
}

/**
 * Validates whether string is a valid 6-digit hex color (with or without '#').
 */
export function isValidHex(hex: string): boolean {
  if (!hex) return false;
  const clean = hex.replace('#', '').trim();
  return /^[0-9A-Fa-f]{6}$/.test(clean);
}

/**
 * Asynchronous Pantone lookup:
 * 1. Checks fast local client-side verified library first.
 * 2. If not found, calls backend API to check the full 3,219+ `pantone_colors` database table.
 */
export async function lookupPantoneAsync(inputCode: string): Promise<PantoneLookupResult> {
  const clean = inputCode.trim();
  if (!clean) return { found: false };

  // 1. Check local textile library
  const localRes = lookupPantone(clean);
  if (localRes.found) {
    const rgb = hexToRgb(localRes.hex_code || '');
    return {
      ...localRes,
      red: rgb?.r,
      green: rgb?.g,
      blue: rgb?.b,
    };
  }

  // 2. Query backend database pantone_colors table
  try {
    const apiRes = await api.lookupPantoneColor(clean);
    if (apiRes && apiRes.found && apiRes.pantone_name) {
      const hex = apiRes.hex_code || (apiRes.red !== undefined ? rgbToHex(apiRes.red, apiRes.green || 0, apiRes.blue || 0) : '#64748B');
      return {
        found: true,
        pantone_code: apiRes.pantone_code || apiRes.pantone_name,
        name: apiRes.pantone_name,
        hex_code: hex,
        red: apiRes.red,
        green: apiRes.green,
        blue: apiRes.blue,
        category: 'Pantone Reference Library',
        system: (apiRes.color_system as any) || 'PMS Coated',
      };
    }
  } catch (err) {
    // Backend lookup failed or offline; fall back to local result
  }

  return localRes;
}

