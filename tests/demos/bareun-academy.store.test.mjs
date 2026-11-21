// 작성일: 2026-11-21
// 파일 위치: tests/demos/bareun-academy.store.test.mjs
// 목적: 바른길 학원 데모 저장소(store.js)의 예시 데이터, 읽기·쓰기, 24시간 만료, 깨진 값 처리를 검증한다.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  STORAGE_KEY, LIFETIME_MS, STATUSES, createSeed, loadState, saveState, openStorage,
  validateInquiry, addInquiry, setStatus, setMemo, countByStatus, sortedInquiries, isJustArrived, resetState,
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
  for (const raw of ["{not json", JSON.stringify({ version: 0 }), JSON.stringify({ version: 1, createdAt: now.getTime(), inquiries: "x" })]) {
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

// 저장된 값이 깨졌을 때(신청 항목 모양, 미래 시각)도 예시 데이터로 되돌린다.
test("loadState: 신청 항목 모양이 틀리면 리셋", () => {
  const recent = now.getTime() - 1000;
  const good = { id: "a", status: "new", createdAt: 1 };
  const bads = [[null], [{ ...good, status: "done" }], [{ ...good, id: 5 }], [{ ...good, createdAt: "x" }]];
  for (const inquiries of bads) {
    const st = fakeStorage();
    st.setItem(STORAGE_KEY, JSON.stringify({ version: 1, createdAt: recent, inquiries }));
    const r = loadState(st, now);
    assert.equal(r.state.createdAt, now.getTime());
    assert.ok(r.state.inquiries.length >= 5);
  }
});

test("loadState: createdAt이 미래면 만료로 보고 리셋", () => {
  const st = fakeStorage();
  const future = createSeed(new Date(now.getTime() + 60000));
  st.setItem(STORAGE_KEY, JSON.stringify(future));
  const r = loadState(st, now);
  assert.equal(r.state.createdAt, now.getTime());
});

const valid = { parentName: "홍길동", phone: "010-1234-5678", grade: "초5", subject: "수학", preferredTime: "평일 저녁", message: "", consent: true };

test("addInquiry: 정상 신청은 new·isSample false로 맨 앞", () => {
  const s = createSeed(now);
  const r = addInquiry(s, { ...valid, parentName: "  홍길동  " }, new Date(now.getTime() + 1000));
  assert.equal(r.ok, true);
  assert.equal(r.inquiry.status, "new");
  assert.equal(r.inquiry.isSample, false);
  assert.equal(r.inquiry.memo, "");
  assert.equal(r.inquiry.parentName, "홍길동");
  assert.equal(sortedInquiries(r.state, "all")[0].id, r.inquiry.id);
});

test("addInquiry: 잘못된 칸 이름을 돌려줌", () => {
  const s = createSeed(now);
  const field = (patch) => addInquiry(s, { ...valid, ...patch }, now).field;
  assert.equal(field({ phone: "010-12" }), "phone");
  assert.equal(field({ consent: false }), "consent");
  assert.equal(field({ parentName: "  " }), "parentName");
  assert.equal(field({ parentName: "가".repeat(21) }), "parentName");
  assert.equal(field({ grade: "" }), "grade");
  assert.equal(field({ subject: " " }), "subject");
  assert.equal(field({ preferredTime: "" }), "preferredTime");
  assert.equal(field({ message: "가".repeat(201) }), "message");
  assert.deepEqual(addInquiry(s, { ...valid, phone: "x" }, now), { ok: false, code: "INVALID", field: "phone" });
  assert.equal(validateInquiry(valid).ok, true);
});

test("addInquiry: 방문자 신청 21번째는 LIMIT", () => {
  let s = createSeed(now); // 예시 건은 세지 않음
  for (let i = 0; i < 20; i++) {
    const r = addInquiry(s, valid, now);
    assert.equal(r.ok, true);
    s = r.state;
  }
  assert.deepEqual(addInquiry(s, valid, now), { ok: false, code: "LIMIT" });
});

test("addInquiry: 원래 state를 바꾸지 않음", () => {
  const s = createSeed(now);
  const before = s.inquiries.length;
  addInquiry(s, valid, now);
  assert.equal(s.inquiries.length, before);
});

test("setStatus: 아무 상태로나 바꿀 수 있고 잘못된 값은 무시", () => {
  const s = createSeed(now);
  const enrolled = s.inquiries.find(i => i.status === "enrolled");
  const s2 = setStatus(s, enrolled.id, "new");
  assert.equal(s2.inquiries.find(i => i.id === enrolled.id).status, "new");
  assert.equal(enrolled.status, "enrolled");
  assert.equal(setStatus(s, enrolled.id, "done"), s);
  assert.equal(setStatus(s, "없는id", "new"), s);
});

test("setMemo: 공백 제거와 100자 자르기", () => {
  const s = createSeed(now);
  const id = s.inquiries[0].id;
  assert.equal(setMemo(s, id, "  통화함  ").inquiries[0].memo, "통화함");
  assert.equal(setMemo(s, id, "가".repeat(150)).inquiries[0].memo.length, 100);
  assert.equal(setMemo(s, "없는id", "x"), s);
});

test("countByStatus와 isJustArrived", () => {
  const s = createSeed(now);
  const base = countByStatus(s);
  assert.equal(base.new + base.contacted + base.enrolled + base.onhold, s.inquiries.length);
  const r = addInquiry(s, valid, now);
  assert.equal(countByStatus(r.state).new, base.new + 1);
  assert.equal(isJustArrived(r.inquiry), true);
  assert.equal(isJustArrived(s.inquiries.find(i => i.status === "new")), false);
});

test("sortedInquiries: 필터와 최신순, resetState는 새 시드", () => {
  const s = createSeed(now);
  const list = sortedInquiries(s, "new");
  assert.ok(list.every(i => i.status === "new"));
  const all = sortedInquiries(s, "all");
  assert.ok(all.every((x, k) => k === 0 || all[k - 1].createdAt >= x.createdAt));
  const r = resetState(now);
  assert.equal(r.createdAt, now.getTime());
  assert.equal(r.inquiries.length, s.inquiries.length);
});
