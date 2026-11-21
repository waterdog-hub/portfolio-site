// 작성일: 2026-11-21
// 파일 위치: tests/demos/ongi-sikdang.store.test.mjs
// 목적: 온기식당 데모 저장소(기본 메뉴, 24시간 만료, 깨진 값, 되돌릴 수 있는 저장)를 검증한다.
import test from "node:test";
import assert from "node:assert/strict";
import {
  STORAGE_KEY, LIFETIME_MS, CATEGORIES, MAX_MENUS, MAX_UPLOADED_PHOTOS, createSeed, loadState, commit, openStorage,
  parsePrice, formatPrice, validateMenu, addMenu, updateMenu, deleteMenu, setSoldOut, setPhoto,
  countUploadedPhotos, setNotice, setTodaySet, menusByCategory, resetState,
} from "../../src/demos/ongi-sikdang/js/store.js";

// 가짜 저장소: throwOnSet이면 쓰기가 항상 실패한다(용량 초과 흉내).
function fakeStorage({ throwOnSet = false, initial = {} } = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: k => (k in data ? data[k] : null),
    setItem(k, v) { if (throwOnSet) throw new Error("QuotaExceededError"); data[k] = String(v); },
    removeItem: k => { delete data[k]; },
  };
}
const NOW = new Date("2026-11-21T10:00:00+09:00");

test("createSeed: 메뉴 12개 안팎, 분류 4개 모두 있음, 사진 있는 메뉴 6개, 품절 1개, 공지 보임", () => {
  const s = createSeed(NOW);
  assert.ok(s.menus.length >= 11 && s.menus.length <= 14);
  assert.deepEqual(new Set(s.menus.map(m => m.category)), new Set(CATEGORIES));
  assert.equal(s.menus.filter(m => m.photo.startsWith("assets/")).length, 6);
  assert.equal(s.menus.filter(m => m.soldOut).length, 1);
  assert.equal(s.notice.visible, true);
});

test("loadState_empty_seeds", () => {
  const st = fakeStorage();
  const r = loadState(st, NOW);
  assert.equal(r.persisted, true);
  assert.equal(r.state.createdAt, NOW.getTime());
  assert.ok(st.data[STORAGE_KEY]);
});

test("loadState_valid_kept", () => {
  const st = fakeStorage();
  const first = loadState(st, NOW).state;
  const later = new Date(NOW.getTime() + 3600000);
  assert.deepEqual(loadState(st, later).state, first);
});

test("loadState_expired_resets", () => {
  const old = createSeed(new Date(NOW.getTime() - LIFETIME_MS - 1));
  const st = fakeStorage({ initial: { [STORAGE_KEY]: JSON.stringify(old) } });
  assert.equal(loadState(st, NOW).state.createdAt, NOW.getTime());
});

test("loadState_future_createdAt_resets", () => {
  const future = createSeed(new Date(NOW.getTime() + 60000));
  const st = fakeStorage({ initial: { [STORAGE_KEY]: JSON.stringify(future) } });
  assert.equal(loadState(st, NOW).state.createdAt, NOW.getTime());
});

test("loadState_corrupt_resets", () => {
  const good = createSeed(NOW);
  const bad = [
    "{not json",
    JSON.stringify({ version: 0 }),
    JSON.stringify({ version: 1, menus: null }),
    JSON.stringify({ ...good, notice: { text: 1, visible: true } }),
    JSON.stringify({ ...good, todaySet: { dishes: "a", price: "9000" } }),
  ];
  for (const raw of bad) {
    const st = fakeStorage({ initial: { [STORAGE_KEY]: raw } });
    const r = loadState(st, NOW);
    assert.equal(r.state.menus.length, good.menus.length, raw);
    assert.equal(r.state.createdAt, NOW.getTime(), raw);
  }
});

test("loadState_invalid_menu_item_resets", () => {
  const good = createSeed(NOW);
  const mutations = [
    m => { m.price = NaN; },
    m => { m.price = "9000"; },
    m => { m.category = "dessert"; },
    m => { m.soldOut = "no"; },
    m => { m.photo = null; },
    m => { m.name = 5; },
    m => { m.id = 1; },
    m => { delete m.description; },
    m => { m.updatedAt = "now"; },
  ];
  for (const mutate of mutations) {
    const s = structuredClone(good);
    mutate(s.menus[0]);
    s.createdAt = NOW.getTime() - 1000; // 만료가 아니라 항목 검사로만 걸러지는지 본다
    const st = fakeStorage({ initial: { [STORAGE_KEY]: JSON.stringify(s) } });
    assert.equal(loadState(st, NOW).state.createdAt, NOW.getTime());
  }
  const s = structuredClone(good); s.menus[1] = null;
  const st = fakeStorage({ initial: { [STORAGE_KEY]: JSON.stringify(s) } });
  assert.equal(loadState(st, NOW).state.createdAt, NOW.getTime());
});

test("loadState_null_storage_memory", () => {
  const r = loadState(null, NOW);
  assert.equal(r.persisted, false);
  assert.ok(r.state.menus.length > 0);
});

test("commit_saves_change", () => {
  const st = fakeStorage();
  const { state } = loadState(st, NOW);
  const id = state.menus[0].id;
  const r = commit(st, state, d => { d.menus.find(m => m.id === id).soldOut = true; });
  assert.equal(r.ok, true);
  assert.equal(state.menus[0].soldOut, false); // 원본은 건드리지 않는다
  assert.equal(loadState(st, NOW).state.menus.find(m => m.id === id).soldOut, true);
});

test("commit_quota_keeps_previous", () => {
  const st = fakeStorage();
  const { state } = loadState(st, NOW);
  const before = st.data[STORAGE_KEY];
  const failing = { ...st, setItem() { throw new Error("QuotaExceededError"); } };
  const r = commit(failing, state, d => { d.menus[0].soldOut = true; });
  assert.equal(r.ok, false);
  assert.equal(r.code, "QUOTA");
  assert.deepEqual(r.state, state);
  assert.equal(st.data[STORAGE_KEY], before);
});

test("commit_null_storage_memory", () => {
  const state = createSeed(NOW);
  const r = commit(null, state, d => { d.menus[0].soldOut = true; });
  assert.equal(r.ok, true);
  assert.equal(r.state.menus[0].soldOut, true);
});

test("openStorage: localStorage가 던지면 null", () => {
  assert.equal(openStorage({ get localStorage() { throw new Error("denied"); } }), null);
  const st = fakeStorage();
  assert.equal(openStorage({ localStorage: st }), st);
});

// ---- Task 2: 메뉴·공지·백반 규칙 ----
const PHOTO = "data:image/jpeg;base64,AAAA";

test("parsePrice", () => {
  assert.equal(parsePrice("9,000"), 9000);
  assert.equal(parsePrice(" 9000 "), 9000);
  assert.equal(parsePrice("999,999"), 999999);
  for (const bad of ["구천", "0", "-500", "1000000", "9.5", ""]) assert.equal(parsePrice(bad), null);
});

test("formatPrice", () => {
  assert.equal(formatPrice(9000), "9,000");
  assert.equal(formatPrice(11000), "11,000");
  assert.equal(formatPrice(500), "500");
});

test("validateMenu: 칸 이름을 돌려줌", () => {
  const ok = { name: " 라면 ", price: "4,500", description: " 얼큰 ", category: "meal" };
  assert.deepEqual(validateMenu(ok), { ok: true, value: { name: "라면", price: 4500, description: "얼큰", category: "meal" } });
  assert.equal(validateMenu({ ...ok, description: "" }).ok, true);
  assert.deepEqual(validateMenu({ ...ok, name: "  " }), { ok: false, field: "name" });
  assert.deepEqual(validateMenu({ ...ok, name: "가".repeat(21) }), { ok: false, field: "name" });
  assert.equal(validateMenu({ ...ok, name: "가".repeat(20) }).ok, true);
  assert.deepEqual(validateMenu({ ...ok, price: "abc" }), { ok: false, field: "price" });
  assert.deepEqual(validateMenu({ ...ok, description: "가".repeat(41) }), { ok: false, field: "description" });
  assert.deepEqual(validateMenu({ ...ok, category: "drink" }), { ok: false, field: "category" });
});

test("addMenu: 41번째는 LIMIT", () => {
  const d = createSeed(NOW);
  const value = { name: "새메뉴", price: 5000, description: "", category: "extra" };
  let last;
  while (d.menus.length < MAX_MENUS) last = addMenu(d, value, NOW);
  assert.equal(d.menus.length, MAX_MENUS);
  const r = addMenu(d, value, NOW);
  assert.deepEqual(r, { ok: false, code: "LIMIT" });
  assert.equal(d.menus.length, MAX_MENUS);
  const m = d.menus.find(x => x.id === last.id);
  assert.equal(m.soldOut, false);
  assert.equal(m.photo, "");
  assert.equal(m.updatedAt, NOW.getTime());
});

test("setSoldOut·updateMenu·deleteMenu", () => {
  const d = createSeed(NOW);
  const id = d.menus[0].id;
  const later = new Date(NOW.getTime() + 1000);
  assert.equal(setSoldOut(d, id, true, later), true);
  assert.equal(d.menus[0].soldOut, true);
  assert.equal(d.menus[0].updatedAt, later.getTime());
  assert.equal(updateMenu(d, id, { name: "바뀜", price: 1234, description: "d", category: "set" }, later), true);
  assert.equal(d.menus[0].name, "바뀜");
  assert.equal(d.menus[0].category, "set");
  assert.equal(d.menus[0].soldOut, true); // 다른 칸은 유지
  assert.equal(deleteMenu(d, id), true);
  assert.equal(d.menus.some(m => m.id === id), false);
  assert.equal(setSoldOut(d, "nope", true, later), false);
  assert.equal(updateMenu(d, "nope", { name: "a", price: 1, description: "", category: "meal" }, later), false);
  assert.equal(deleteMenu(d, "nope"), false);
});

test("setPhoto: 11번째 올린 사진은 PHOTO_LIMIT, 이미 올린 사진을 바꾸는 건 허용, 빈 값은 빼기", () => {
  const d = createSeed(NOW);
  assert.equal(countUploadedPhotos(d), 0); // assets/ 사진은 세지 않는다
  for (let i = 0; i < MAX_UPLOADED_PHOTOS; i++) assert.deepEqual(setPhoto(d, d.menus[i].id, PHOTO, NOW), { ok: true });
  assert.equal(countUploadedPhotos(d), MAX_UPLOADED_PHOTOS);
  assert.deepEqual(setPhoto(d, d.menus[10].id, PHOTO, NOW), { ok: false, code: "PHOTO_LIMIT" });
  assert.equal(d.menus[10].photo, "");
  assert.deepEqual(setPhoto(d, d.menus[0].id, PHOTO + "B", NOW), { ok: true }); // 교체는 허용
  assert.equal(d.menus[0].photo, PHOTO + "B");
  assert.equal(countUploadedPhotos(d), MAX_UPLOADED_PHOTOS);
  assert.deepEqual(setPhoto(d, d.menus[0].id, "", NOW), { ok: true }); // 빼기
  assert.equal(d.menus[0].photo, "");
  assert.equal(countUploadedPhotos(d), MAX_UPLOADED_PHOTOS - 1);
  assert.deepEqual(setPhoto(d, d.menus[10].id, PHOTO, NOW), { ok: true });
});

test("setNotice·setTodaySet 자르기", () => {
  const d = createSeed(NOW);
  setNotice(d, "  " + "가".repeat(70) + "  ", false);
  assert.equal(d.notice.text, "가".repeat(60));
  assert.equal(d.notice.visible, false);
  setNotice(d, "  쉬는 날  ", true);
  assert.equal(d.notice.text, "쉬는 날");
  setTodaySet(d, "나".repeat(100), 8000);
  assert.equal(d.todaySet.dishes, "나".repeat(80));
  assert.equal(d.todaySet.price, 8000);
});

test("menusByCategory: 새 메뉴는 그 분류 끝", () => {
  const d = createSeed(NOW);
  const seedStews = d.menus.filter(m => m.category === "stew").map(m => m.name);
  addMenu(d, { name: "부대찌개", price: 9000, description: "", category: "stew" }, NOW);
  assert.deepEqual(menusByCategory(d, "stew").map(m => m.name), [...seedStews, "부대찌개"]);
  const all = menusByCategory(d, "all");
  assert.equal(all.length, d.menus.length);
  const cats = all.map(m => CATEGORIES.indexOf(m.category));
  assert.deepEqual(cats, [...cats].sort((a, b) => a - b)); // 분류 순서로 묶임
  assert.equal(menusByCategory(d, "meal").every(m => m.category === "meal"), true);
});

test("resetState: 새 기본 데이터", () => {
  const r = resetState(NOW);
  assert.equal(r.createdAt, NOW.getTime());
  assert.equal(r.menus.length, createSeed(NOW).menus.length);
});
