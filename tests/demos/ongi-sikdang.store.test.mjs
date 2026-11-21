// 작성일: 2026-11-21
// 파일 위치: tests/demos/ongi-sikdang.store.test.mjs
// 목적: 온기식당 데모 저장소(기본 메뉴, 24시간 만료, 깨진 값, 되돌릴 수 있는 저장)를 검증한다.
import test from "node:test";
import assert from "node:assert/strict";
import {
  STORAGE_KEY, LIFETIME_MS, CATEGORIES, createSeed, loadState, commit, openStorage,
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
