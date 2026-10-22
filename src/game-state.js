"use strict";

const fs = require("node:fs");
const path = require("node:path");

const MAP_WIDTH = 1400;
const MAP_HEIGHT = 900;
const DAY_DURATION_MS = 20 * 60 * 1000;

// Clean villa architecture with wide open doorways and zero overlapping items
const WALLS = [
  // Outer perimeter (1400x900)
  { x: 20, y: 20, w: 1360, h: 15 },
  { x: 20, y: 865, w: 1360, h: 15 },
  { x: 20, y: 20, w: 15, h: 860 },
  { x: 1365, y: 20, w: 15, h: 860 },

  // Top indoor partitions (Bedroom, Spa, Gym)
  { x: 350, y: 35, w: 15, h: 180 }, // Bedroom to Spa (doorway y: 215-310)
  { x: 590, y: 35, w: 15, h: 180 }, // Spa to Gym (doorway y: 215-310)

  // Horizontal wall separating top rooms from living/kitchen (y: 310)
  { x: 35, y: 310, w: 130, h: 15 },
  { x: 260, y: 310, w: 170, h: 15 }, // Bedroom door: x 165-260
  { x: 510, y: 310, w: 170, h: 15 }, // Spa door: x 430-510
  { x: 780, y: 310, w: 115, h: 15 }, // Gym door: x 680-780

  // Partition dividing house indoor from outdoor pool deck (x: 880)
  { x: 880, y: 35, w: 15, h: 120 },  // Wall top
  { x: 880, y: 260, w: 15, h: 100 }, // Wall mid (Doorway 1 to pool: y 155-260 from gym!)
  { x: 880, y: 500, w: 15, h: 100 }, // Wall bottom (Doorway 2 to pool: y 360-500 from living!)

  // Kitchen to Living Room partition (x: 430)
  { x: 430, y: 325, w: 15, h: 65 },
  { x: 430, y: 510, w: 15, h: 85 },  // Doorway kitchen to living: y 390-510 (wide & completely clear)

  // Wall separating indoor/deck from garden & tiger sanctuary (y: 600)
  { x: 35, y: 600, w: 420, h: 15 },
  { x: 580, y: 600, w: 300, h: 15 }, // Doorway from living to garden: x 455-580
  { x: 880, y: 600, w: 180, h: 15 }, // Wall between pool deck and garden
  { x: 1200, y: 600, w: 165, h: 15 },// Doorway from pool to tiger walkway: x 1060-1200

  // Tiger enclosure perimeter fence (x: 800..1330, y: 625..845) - PROPORTIONAL SIZE!
  { x: 800, y: 625, w: 530, h: 12 },  // Top fence
  { x: 1320, y: 625, w: 12, h: 220 }, // Right fence
  { x: 800, y: 835, w: 530, h: 12 },  // Bottom fence
  { x: 800, y: 625, w: 12, h: 70 },   // Left fence top
  { x: 800, y: 765, w: 12, h: 80 }    // Left fence bottom (gate opening at y: 695-765 directly to garden!)
];

const OBJECTS = {
  // 1. Kamar Tidur Utama (Top-Left)
  bed_double: {
    id: "bed_double",
    name: "Kasur Double",
    area: "bedroom",
    x: 60,
    y: 55,
    w: 120,
    h: 110,
    solid: true,
    interactX: 185,
    interactY: 110,
    radius: 75,
    state: "made"
  },
  nightstand: {
    id: "nightstand",
    name: "Lampu Tidur",
    area: "bedroom",
    x: 185,
    y: 55,
    w: 40,
    h: 40,
    solid: true,
    interactX: 205,
    interactY: 105,
    radius: 60,
    state: "on"
  },
  wardrobe: {
    id: "wardrobe",
    name: "Lemari Pakaian",
    area: "bedroom",
    x: 235,
    y: 55,
    w: 85,
    h: 55,
    solid: true,
    interactX: 275,
    interactY: 120,
    radius: 65,
    state: "neat"
  },

  // 2. Kamar Mandi & Spa (Top-Center)
  shower: {
    id: "shower",
    name: "Shower & Spa",
    area: "bathroom",
    x: 390,
    y: 55,
    w: 75,
    h: 75,
    solid: true,
    interactX: 425,
    interactY: 140,
    radius: 65,
    state: "idle"
  },
  bathroom_sink: {
    id: "bathroom_sink",
    name: "Wastafel Marmer",
    area: "bathroom",
    x: 475,
    y: 55,
    w: 65,
    h: 50,
    solid: true,
    interactX: 505,
    interactY: 115,
    radius: 65,
    state: "clean"
  },
  toilet: {
    id: "toilet",
    name: "Toilet",
    area: "bathroom",
    x: 545,
    y: 55,
    w: 40,
    h: 45,
    solid: true,
    interactX: 565,
    interactY: 110,
    radius: 65,
    state: "clean"
  },

  // 3. Ruang Olahraga / Gym (Top-Mid-Right)
  treadmill: {
    id: "treadmill",
    name: "Treadmill Lari",
    area: "gym",
    x: 630,
    y: 55,
    w: 65,
    h: 75,
    solid: true,
    interactX: 660,
    interactY: 140,
    radius: 70,
    state: "ready"
  },
  bench_press: {
    id: "bench_press",
    name: "Bench Press & Barbel",
    area: "gym",
    x: 715,
    y: 55,
    w: 70,
    h: 65,
    solid: true,
    interactX: 750,
    interactY: 130,
    radius: 70,
    state: "ready"
  },
  yoga_mat: {
    id: "yoga_mat",
    name: "Matras Yoga & Meditasi",
    area: "gym",
    x: 800,
    y: 60,
    w: 65,
    h: 75,
    solid: false,
    interactX: 830,
    interactY: 100,
    radius: 70,
    state: "ready"
  },

  // 4. Area Kolam Renang Mewah (Top-Right Resort Deck, walkable for real swimming)
  swimming_pool: {
    id: "swimming_pool",
    name: "Kolam Renang Mewah",
    area: "pool",
    x: 930,
    y: 180,
    w: 390,
    h: 220,
    solid: false, // Walkable for swimming immersion!
    interactX: 1125,
    interactY: 290,
    radius: 140,
    state: "clear"
  },
  pool_lounge: {
    id: "pool_lounge",
    name: "Kursi Berjemur Kolam",
    area: "pool",
    x: 1040,
    y: 60,
    w: 140,
    h: 75,
    solid: true,
    interactX: 1110,
    interactY: 145,
    radius: 75,
    state: "ready"
  },

  // 5. Dapur Modern & Ruang Makan (Mid-Left, fridge neatly on outer left wall!)
  stove: {
    id: "stove",
    name: "Kompor Dapur",
    area: "kitchen",
    x: 60,
    y: 335,
    w: 80,
    h: 55,
    solid: true,
    interactX: 100,
    interactY: 400,
    radius: 65,
    state: "idle"
  },
  kitchen_sink: {
    id: "kitchen_sink",
    name: "Wastafel Cuci Piring",
    area: "kitchen",
    x: 155,
    y: 335,
    w: 75,
    h: 55,
    solid: true,
    interactX: 190,
    interactY: 400,
    radius: 65,
    state: "clean"
  },
  fridge: {
    id: "fridge",
    name: "Kulkas 2 Pintu",
    area: "kitchen",
    x: 60,
    y: 450, // Placed neatly on outer left wall, NOT in the doorway!
    w: 65,
    h: 80,
    solid: true,
    interactX: 135,
    interactY: 490,
    radius: 70,
    state: "stocked"
  },
  dining_table: {
    id: "dining_table",
    name: "Meja Makan",
    area: "kitchen",
    x: 175,
    y: 440,
    w: 140,
    h: 80,
    solid: true,
    interactX: 245,
    interactY: 530,
    radius: 80,
    state: "set"
  },
  trash_bin: {
    id: "trash_bin",
    name: "Tempat Sampah",
    area: "kitchen",
    x: 350,
    y: 450,
    w: 35,
    h: 40,
    solid: true,
    interactX: 340,
    interactY: 470,
    radius: 55,
    state: "empty"
  },

  // 6. Ruang Keluarga & Game Lounge (Mid-Center)
  living_sofa: {
    id: "living_sofa",
    name: "Sofa Ruang Tamu",
    area: "living",
    x: 480,
    y: 345,
    w: 145,
    h: 70,
    solid: true,
    interactX: 550,
    interactY: 425,
    radius: 75,
    state: "neat"
  },
  living_tv: {
    id: "living_tv",
    name: "TV Layar Lebar",
    area: "living",
    x: 505,
    y: 435,
    w: 95,
    h: 30,
    solid: true,
    interactX: 550,
    interactY: 420,
    radius: 65,
    state: "off"
  },
  living_floor: {
    id: "living_floor",
    name: "Karpet Beludru",
    area: "living",
    x: 645,
    y: 350,
    w: 160,
    h: 120,
    solid: false,
    interactX: 725,
    interactY: 410,
    radius: 75,
    state: "clean"
  },
  board_game_table: {
    id: "board_game_table",
    name: "Meja Board Game",
    area: "living",
    x: 670,
    y: 375,
    w: 95,
    h: 65,
    solid: true,
    interactX: 715,
    interactY: 450,
    radius: 75,
    state: "ready"
  },
  bookshelf: {
    id: "bookshelf",
    name: "Rak Buku Santai",
    area: "living",
    x: 750, // Moved away from doorway (x: 880) so pool door is completely clear!
    y: 340,
    w: 45,
    h: 80,
    solid: true,
    interactX: 740,
    interactY: 430,
    radius: 65,
    state: "neat"
  },
  record_player: {
    id: "record_player",
    name: "Pemutar Musik Vinil",
    area: "living",
    x: 750,
    y: 480,
    w: 45,
    h: 50,
    solid: true,
    interactX: 740,
    interactY: 510,
    radius: 65,
    state: "playing"
  },
  photo_spot: {
    id: "photo_spot",
    name: "Spot Foto Bersama",
    area: "living",
    x: 660,
    y: 500,
    w: 60,
    h: 60,
    solid: false,
    interactX: 690,
    interactY: 530,
    radius: 70,
    state: "ready"
  },

  // 7. Taman Asri Bersebelahan dengan Kandang Macan (Bottom-Left & Center, ZERO OVERLAP!)
  terrace_table: {
    id: "terrace_table",
    name: "Meja Teh Taman",
    area: "garden",
    x: 80,
    y: 635,
    w: 95,
    h: 65,
    solid: true,
    interactX: 130,
    interactY: 710,
    radius: 75,
    state: "ready"
  },
  garden_bench: {
    id: "garden_bench",
    name: "Kursi Santai Taman",
    area: "garden",
    x: 200,
    y: 635,
    w: 85,
    h: 50,
    solid: true,
    interactX: 240,
    interactY: 695,
    radius: 75,
    state: "empty"
  },
  flower_pot: {
    id: "flower_pot",
    name: "Pot Bunga Asri",
    area: "garden",
    x: 310,
    y: 635,
    w: 55,
    h: 55,
    solid: true,
    interactX: 335,
    interactY: 700,
    radius: 70,
    state: "watered"
  },
  garden_grill: {
    id: "garden_grill",
    name: "Panggangan BBQ Taman",
    area: "garden",
    x: 395,
    y: 635,
    w: 55,
    h: 55,
    solid: true,
    interactX: 425,
    interactY: 700,
    radius: 70,
    state: "ready"
  },
  koi_pond: {
    id: "koi_pond",
    name: "Kolam Ikan Koi",
    area: "garden",
    x: 80,
    y: 735,
    w: 135,
    h: 90,
    solid: false,
    interactX: 145,
    interactY: 725,
    radius: 85,
    state: "swimming"
  },
  vegetable_patch: {
    id: "vegetable_patch",
    name: "Petak Sayur Subur",
    area: "garden",
    x: 240,
    y: 735,
    w: 135,
    h: 80,
    solid: false,
    interactX: 305,
    interactY: 725,
    radius: 85,
    state: "growing"
  },
  garden_path: {
    id: "garden_path",
    name: "Jalan Santai Taman",
    area: "garden",
    x: 400,
    y: 735,
    w: 260,
    h: 80,
    solid: false,
    interactX: 530,
    interactY: 770,
    radius: 85,
    state: "clean"
  },

  // 8. Kandang Macan Eksotis Proporsional (Bottom-Right, directly connected via gate)
  tiger_gate: {
    id: "tiger_gate",
    name: "Pintu Kandang Mamacan",
    area: "tiger",
    x: 800,
    y: 695,
    w: 12,
    h: 70,
    solid: true, // Becomes non-solid when opened!
    interactX: 780,
    interactY: 730,
    radius: 75,
    state: "closed"
  },
  tiger: {
    id: "tiger",
    name: "Mamacan",
    area: "tiger",
    x: 980,
    y: 720,
    w: 40,
    h: 24,
    solid: false,
    interactX: 980,
    interactY: 720,
    radius: 85,
    state: "idle"
  }
};

let loadedTasks = null;
function getTaskCatalog() {
  if (!loadedTasks) {
    const raw = fs.readFileSync(path.join(__dirname, "../data/tasks.json"), "utf8");
    loadedTasks = JSON.parse(raw);
  }
  return loadedTasks;
}

// Dynamic collision check that respects dynamic object solidity (e.g. opened gate)
function checkCollision(x, y, radius = 16, dynamicObjects = null) {
  // Map boundary
  if (x - radius < 35 || x + radius > MAP_WIDTH - 35 || y - radius < 35 || y + radius > MAP_HEIGHT - 35) {
    return true;
  }

  // Check walls
  for (const w of WALLS) {
    if (
      x + radius > w.x &&
      x - radius < w.x + w.w &&
      y + radius > w.y &&
      y - radius < w.y + w.h
    ) {
      return true;
    }
  }

  // Check solid furniture
  const objSource = dynamicObjects || OBJECTS;
  for (const obj of Object.values(objSource)) {
    if (!obj.solid) continue;
    if (
      x + radius > obj.x &&
      x - radius < obj.x + obj.w &&
      y + radius > obj.y &&
      y - radius < obj.y + obj.h
    ) {
      return true;
    }
  }

  return false;
}

function createInitialRoomState(roomId) {
  return {
    roomId,
    version: 1,
    day: 1,
    gameTimeMs: 8 * 60 * 60 * 1000,
    lastTick: Date.now(),
    paused: false,
    stats: {
      energy: 85,
      hunger: 80,
      mood: 85,
      homeComfort: 80,
      harmony: 85
    },
    players: {
      karip: {
        role: "karip",
        claimed: false,
        online: false,
        token: null,
        x: 200,
        y: 240, // Free open floor in bedroom, 70px clearance from bed and wardrobe
        direction: "down",
        anim: "idle",
        isSick: false,
        activeTask: null,
        bubble: null,
        lastActive: Date.now()
      },
      gabin: {
        role: "gabin",
        claimed: false,
        online: false,
        token: null,
        x: 260,
        y: 240, // Free open floor
        direction: "down",
        anim: "idle",
        isSick: false,
        activeTask: null,
        bubble: null,
        lastActive: Date.now()
      }
    },
    tiger: {
      x: 980,
      y: 720,
      targetX: 980,
      targetY: 720,
      direction: "left",
      anim: "idle",
      isOutside: false,
      lastMoveTick: Date.now()
    },
    objects: JSON.parse(JSON.stringify(OBJECTS)),
    tasks: {
      completedToday: [],
      cooldowns: {}
    },
    chat: [],
    activeInvite: null
  };
}

module.exports = {
  MAP_WIDTH,
  MAP_HEIGHT,
  DAY_DURATION_MS,
  WALLS,
  OBJECTS,
  getTaskCatalog,
  checkCollision,
  createInitialRoomState
};
