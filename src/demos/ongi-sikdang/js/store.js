// 작성일: 2026-11-21
// 파일 위치: src/demos/ongi-sikdang/js/store.js
// 목적: 온기식당 데모(가상 식당)의 메뉴·공지·오늘의 백반을 방문자 브라우저 localStorage에 저장·복원한다. DOM을 쓰지 않아 Node에서 테스트할 수 있다.

export const STORAGE_KEY = "ongi-sikdang-demo-v1";
export const LIFETIME_MS = 86400000; // 24시간
export const MAX_MENUS = 40;
export const MAX_UPLOADED_PHOTOS = 10;
export const CATEGORIES = ["meal", "stew", "set", "extra"];
export const CATEGORY_LABELS = { meal: "식사", stew: "찌개", set: "정식", extra: "추가" };

// 기본 메뉴: 사진은 assets/menu-1~6.jpg 6장만 있고 나머지는 사진 없이 둔다.
const SEED_MENUS = [
  { name: "김치찌개", price: 9000, description: "묵은지를 푹 끓인 돼지고기 김치찌개", category: "stew", photo: "assets/menu-1.jpg" },
  { name: "해물순두부찌개", price: 9500, description: "얼큰한 국물에 해물이 가득", category: "stew", photo: "assets/menu-2.jpg" },
  { name: "된장찌개", price: 8500, description: "두부와 애호박을 넣은 구수한 된장찌개", category: "stew", photo: "" },
  { name: "제육볶음 정식", price: 10000, description: "매콤한 제육볶음에 밥과 국, 반찬", category: "set", photo: "assets/menu-3.jpg" },
  { name: "고등어구이 정식", price: 11000, description: "노릇하게 구운 고등어에 밥과 국, 반찬", category: "set", photo: "assets/menu-4.jpg", soldOut: true },
  { name: "불고기 정식", price: 11000, description: "달콤한 불고기에 밥과 국, 반찬", category: "set", photo: "" },
  { name: "비빔밥", price: 9000, description: "나물과 고추장을 곁들인 비빔밥", category: "meal", photo: "assets/menu-6.jpg" },
  { name: "김치볶음밥", price: 8500, description: "계란후라이를 올린 김치볶음밥", category: "meal", photo: "" },
  { name: "제육덮밥", price: 9000, description: "제육볶음을 듬뿍 얹은 덮밥", category: "meal", photo: "" },
  { name: "계란말이", price: 6000, description: "도톰하게 부친 계란말이", category: "extra", photo: "assets/menu-5.jpg" },
  { name: "공깃밥", price: 1000, description: "갓 지은 밥 한 공기", category: "extra", photo: "" },
  { name: "계란후라이", price: 1000, description: "반숙 계란후라이 한 개", category: "extra", photo: "" },
];

export function createSeed(now) {
  const t = now.getTime();
  return {
    version: 1,
    createdAt: t,
    notice: { text: "오늘은 재료 소진으로 저녁 8시에 마감해요", visible: true },
    todaySet: { dishes: "제육볶음 · 계란말이 · 시금치나물 · 된장국", price: 9000 },
    menus: SEED_MENUS.map(({ soldOut = false, ...m }) => ({
      id: crypto.randomUUID(),
      ...m,
      soldOut,
      updatedAt: t,
    })),
  };
}

// 사생활 보호 모드 등에서는 localStorage 접근 자체가 던질 수 있어 모두 null로 바꾼다.
export function openStorage(win) {
  try {
    const s = win.localStorage;
    const k = "__ongi_probe__";
    s.setItem(k, "1");
    s.removeItem(k);
    return s;
  } catch {
    return null;
  }
}

// 깨진 값이 화면을 망가뜨리지 않도록 메뉴 한 개씩 모양을 확인한다.
function isValidMenu(m) {
  return m !== null && typeof m === "object"
    && typeof m.id === "string" && typeof m.name === "string"
    && typeof m.price === "number" && Number.isFinite(m.price)
    && CATEGORIES.includes(m.category)
    && typeof m.soldOut === "boolean" && typeof m.photo === "string";
}

function isValid(s) {
  return s !== null && typeof s === "object" && s.version === 1
    && typeof s.createdAt === "number" && Number.isFinite(s.createdAt)
    && s.notice !== null && typeof s.notice === "object"
    && typeof s.notice.text === "string" && typeof s.notice.visible === "boolean"
    && s.todaySet !== null && typeof s.todaySet === "object"
    && typeof s.todaySet.dishes === "string"
    && typeof s.todaySet.price === "number" && Number.isFinite(s.todaySet.price)
    && Array.isArray(s.menus) && s.menus.every(isValidMenu);
}

function write(storage, state) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    // 용량 초과든 다른 쓰기 실패든 방문자에게는 "저장 불가"이므로 한 가지로 다룬다.
    return false;
  }
}

export function loadState(storage, now) {
  if (!storage) return { state: createSeed(now), persisted: false };
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      // 24시간이 지났거나(미래 시각 포함) 형식이 깨졌으면 기본 데이터로 되돌린다.
      const age = now.getTime() - parsed?.createdAt;
      if (isValid(parsed) && age >= 0 && age <= LIFETIME_MS) {
        return { state: parsed, persisted: true };
      }
    }
  } catch {
    // JSON 파싱 실패 또는 읽기 실패: 아래에서 새로 만든다.
  }
  const state = createSeed(now);
  return { state, persisted: write(storage, state) };
}

// 복사본에 change를 적용한 뒤 한 번에 저장한다. setItem은 실패하면 기존 값을 그대로 두므로
// 실패 시 원래 state를 돌려주면 화면과 저장소가 어긋나지 않는다.
export function commit(storage, state, change) {
  const draft = structuredClone(state);
  change(draft);
  if (!storage) return { ok: true, state: draft };
  if (!write(storage, draft)) return { ok: false, code: "QUOTA", state };
  return { ok: true, state: draft };
}
