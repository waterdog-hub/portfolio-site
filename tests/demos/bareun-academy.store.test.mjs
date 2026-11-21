// 작성일: 2026-11-21
// 파일 위치: tests/demos/bareun-academy.store.test.mjs
// 목적: 바른길 학원 데모 저장소(store.js)의 예시 데이터, 읽기·쓰기, 24시간 만료, 깨진 값 처리를 검증한다.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  STORAGE_KEY, LIFETIME_MS, STATUSES, createSeed, loadState, saveState, openStorage,
} from "../../src/demos/bareun-academy/js/store.js";

// 메모리 가짜 저장소: 브라우저 없이 localStorage 동작을 흉내 낸다.
function fakeStorage({ throwOnSet = null } = {}) {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { if (throwOnSet) throw throwOnSet; m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
  };
}

const now = new Date("2026-11-21T10:00:00+09:00");

test("createSeed: 예시 5~6건, 모두 isSample, 상태 4가지가 섞임, 신청 시각은 now 이전 7일 이내", () => {
  const s = createSeed(now);
  assert.ok(s.inquiries.length >= 5 && s.inquiries.length <= 6);
  assert.ok(s.inquiries.every(i => i.isSample));
  assert.deepEqual(new Set(s.inquiries.map(i => i.status)), new Set(STATUSES));
  assert.ok(s.inquiries.every(i => i.createdAt <= now.getTime() && i.createdAt > now.getTime() - 7 * 86400000));
});

test("loadState_empty_seeds_and_persists", () => {
  const st = fakeStorage();
  const first = loadState(st, now);
  assert.equal(first.persisted, true);
  assert.equal(first.state.version, 1);
  assert.equal(first.state.createdAt, now.getTime());
  assert.deepEqual(saveState(st, first.state), { ok: true });
  const again = loadState(st, new Date(now.getTime() + 1000));
  assert.deepEqual(again.state, first.state);
});

test("loadState_expired_resets", () => {
  const st = fakeStorage();
  const old = createSeed(new Date(now.getTime() - LIFETIME_MS - 1));
  st.setItem(STORAGE_KEY, JSON.stringify(old));
  const r = loadState(st, now);
  assert.equal(r.state.createdAt, now.getTime());
  assert.notDeepEqual(r.state, old);
});

test("loadState_not_expired_keeps", () => {
  const st = fakeStorage();
  const t = new Date(now.getTime() - LIFETIME_MS + 60000);
  const kept = createSeed(t);
  st.setItem(STORAGE_KEY, JSON.stringify(kept));
  const r = loadState(st, now);
  assert.deepEqual(r.state, kept);
});

test("loadState_corrupt_resets", () => {
  for (const raw of ["{not json", JSON.stringify({ version: 0 }), JSON.stringify({ version: 1, inquiries: "x" })]) {
    const st = fakeStorage();
    st.setItem(STORAGE_KEY, raw);
    const r = loadState(st, now);
    assert.equal(r.state.version, 1);
    assert.equal(r.state.createdAt, now.getTime());
    assert.ok(Array.isArray(r.state.inquiries) && r.state.inquiries.length >= 5);
  }
});

test("loadState_null_storage_memory_only", () => {
  const r = loadState(null, now);
  assert.equal(r.persisted, false);
  assert.ok(r.state.inquiries.length >= 5);
  assert.deepEqual(saveState(null, r.state), { ok: false, code: "NO_STORAGE" });
});

test("saveState_quota_returns_code", () => {
  const err = new Error("full");
  err.name = "QuotaExceededError";
  const st = fakeStorage({ throwOnSet: err });
  assert.deepEqual(saveState(st, createSeed(now)), { ok: false, code: "QUOTA" });
});

test("openStorage: 접근이 막히면 null", () => {
  const blocked = { get localStorage() { throw new Error("SecurityError"); } };
  assert.equal(openStorage(blocked), null);
  assert.ok(openStorage({ localStorage: fakeStorage() }));
});
