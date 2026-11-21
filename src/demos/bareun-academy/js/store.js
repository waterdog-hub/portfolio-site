// 작성일: 2026-11-21
// 파일 위치: src/demos/bareun-academy/js/store.js
// 목적: 바른길 학원 데모(가상 학원)의 상담 신청을 방문자 브라우저 localStorage에 저장·복원한다. DOM을 쓰지 않아 Node에서 테스트할 수 있다.

export const STORAGE_KEY = "bareun-academy-demo-v1";
export const LIFETIME_MS = 86400000; // 24시간
export const MAX_VISITOR_INQUIRIES = 20;
export const STATUSES = ["new", "contacted", "enrolled", "onhold"];

const DAY = 86400000;
const HOUR = 3600000;

// 예시 신청: 이름은 가려 쓰고, 학년·과목은 시간표의 반과 맞춘다.
const SAMPLES = [
  { parentName: "김OO 학부모", grade: "초4", subject: "수학", preferredTime: "평일 오후", message: "수학 기초를 다지고 싶어요.", status: "new", memo: "", ago: 2 * HOUR },
  { parentName: "이OO 학부모", grade: "초5", subject: "수학", preferredTime: "평일 저녁", message: "연산 실수가 잦아 상담 원합니다.", status: "contacted", memo: "목요일 통화 완료", ago: 1 * DAY },
  { parentName: "박OO 학부모", grade: "초6", subject: "영어", preferredTime: "주말", message: "중학 영어 준비를 시작하려 해요.", status: "enrolled", memo: "초6 영어 기본반 등록", ago: 3 * DAY },
  { parentName: "최OO 학부모", grade: "중1", subject: "수학", preferredTime: "평일 저녁", message: "수학 기본반 레벨 테스트 문의.", status: "onhold", memo: "다음 학기 재문의 예정", ago: 4 * DAY },
  { parentName: "정OO 학부모", grade: "중2", subject: "둘 다", preferredTime: "평일 오후", message: "영어 내신과 수학 심화를 함께 알아봐요.", status: "new", memo: "", ago: 5 * DAY },
  { parentName: "한OO 학부모", grade: "중3", subject: "수학", preferredTime: "주말", message: "수학 심화반 상담을 받고 싶습니다.", status: "contacted", memo: "", ago: 6 * DAY },
];

export function createSeed(now) {
  const t = now.getTime();
  return {
    version: 1,
    createdAt: t,
    inquiries: SAMPLES.map(({ ago, ...s }) => ({
      id: crypto.randomUUID(),
      phone: "000-0000-0000",
      ...s,
      createdAt: t - ago,
      isSample: true,
    })),
  };
}

// 사생활 보호 모드 등에서는 localStorage 접근 자체가 던질 수 있어 모두 null로 바꾼다.
export function openStorage(win) {
  try {
    const s = win.localStorage;
    const k = "__bareun_probe__";
    s.setItem(k, "1");
    s.removeItem(k);
    return s;
  } catch {
    return null;
  }
}

// 신청 항목 하나가 화면에서 쓸 수 있는 모양인지 본다(깨진 값이 화면을 망가뜨리지 않게).
function isValidInquiry(i) {
  return i && typeof i === "object" && typeof i.id === "string"
    && STATUSES.includes(i.status) && typeof i.createdAt === "number";
}

function isValid(state) {
  return state && typeof state === "object" && state.version === 1
    && typeof state.createdAt === "number" && Number.isFinite(state.createdAt)
    && Array.isArray(state.inquiries) && state.inquiries.every(isValidInquiry);
}

export function loadState(storage, now) {
  if (!storage) return { state: createSeed(now), persisted: false };
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      // 24시간이 지났거나 형식이 깨졌으면 예시 데이터로 되돌린다.
      // createdAt이 미래인 값(시계 조작 등)도 만료로 본다.
      const age = now.getTime() - parsed.createdAt;
      if (isValid(parsed) && age >= 0 && age <= LIFETIME_MS) {
        return { state: parsed, persisted: true };
      }
    }
  } catch {
    // JSON 파싱 실패 또는 읽기 실패: 아래에서 새로 만든다.
  }
  const state = createSeed(now);
  const r = saveState(storage, state);
  return { state, persisted: r.ok };
}

export function saveState(storage, state) {
  if (!storage) return { ok: false, code: "NO_STORAGE" };
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return { ok: true };
  } catch {
    // 용량 초과(name 또는 code 22/1014)든 그 밖의 쓰기 실패든 방문자에게는 "저장 불가"라 같은 QUOTA로 묶는다.
    return { ok: false, code: "QUOTA" };
  }
}

// 아래 함수들은 받은 state를 고치지 않고 새 state를 돌려준다. 저장이 실패해도 화면이 예전 state를 그대로 쓰면 된다.

export function validateInquiry(input) {
  const parentName = String(input.parentName ?? "").trim();
  const phone = String(input.phone ?? "").trim();
  const grade = String(input.grade ?? "").trim();
  const subject = String(input.subject ?? "").trim();
  const preferredTime = String(input.preferredTime ?? "").trim();
  const message = String(input.message ?? "").trim();
  if (parentName.length < 1 || parentName.length > 20) return { ok: false, field: "parentName" };
  if (!/^[0-9-]{9,13}$/.test(phone)) return { ok: false, field: "phone" };
  if (!grade) return { ok: false, field: "grade" };
  if (!subject) return { ok: false, field: "subject" };
  if (!preferredTime) return { ok: false, field: "preferredTime" };
  if (message.length > 200) return { ok: false, field: "message" };
  if (input.consent !== true) return { ok: false, field: "consent" };
  return { ok: true, value: { parentName, phone, grade, subject, preferredTime, message } };
}

export function addInquiry(state, input, now) {
  const v = validateInquiry(input);
  if (!v.ok) return { ok: false, code: "INVALID", field: v.field };
  // 예시 건은 세지 않고 방문자가 낸 신청만 20건으로 제한한다.
  if (state.inquiries.filter(i => !i.isSample).length >= MAX_VISITOR_INQUIRIES) {
    return { ok: false, code: "LIMIT" };
  }
  const inquiry = {
    id: crypto.randomUUID(),
    ...v.value,
    status: "new",
    memo: "",
    createdAt: now.getTime(),
    isSample: false,
  };
  const next = structuredClone(state);
  next.inquiries.push(inquiry);
  return { ok: true, state: next, inquiry };
}

export function setStatus(state, id, status) {
  if (!STATUSES.includes(status) || !state.inquiries.some(i => i.id === id)) return state;
  const next = structuredClone(state);
  next.inquiries.find(i => i.id === id).status = status;
  return next;
}

export function setMemo(state, id, memo) {
  if (!state.inquiries.some(i => i.id === id)) return state;
  const next = structuredClone(state);
  next.inquiries.find(i => i.id === id).memo = String(memo ?? "").trim().slice(0, 100);
  return next;
}

export function countByStatus(state) {
  const c = { new: 0, contacted: 0, enrolled: 0, onhold: 0 };
  for (const i of state.inquiries) c[i.status]++;
  return c;
}

export function sortedInquiries(state, filter) {
  return state.inquiries
    .filter(i => filter === "all" || i.status === filter)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function isJustArrived(inquiry) {
  return !inquiry.isSample && inquiry.status === "new";
}

export function resetState(now) {
  return createSeed(now);
}
