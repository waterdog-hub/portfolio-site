// 작성일: 2026-11-21
// 파일 위치: src/demos/bareun-academy/js/main.js
// 목적: 학부모 화면의 모바일 메뉴, 시간표 탭, 상담 신청 폼. 저장은 store.js가 맡는다.
// 사용자가 입력한 글은 textContent로만 화면에 넣는다(HTML로 해석되지 않게).

import { openStorage, loadState, saveState, addInquiry } from "./store.js";

// ===== 모바일 메뉴 (하루밀과 같은 방식: 클래스와 aria만 바꾸고 보이기는 CSS가 맡는다) =====
const navToggle = document.getElementById("navToggle");
const nav = document.getElementById("nav");

function setMenuOpen(isOpen) {
  nav.classList.toggle("is-open", isOpen);
  navToggle.setAttribute("aria-expanded", String(isOpen));
  navToggle.setAttribute("aria-label", isOpen ? "메뉴 닫기" : "메뉴 열기");
}
navToggle.addEventListener("click", () => setMenuOpen(!nav.classList.contains("is-open")));
nav.addEventListener("click", (e) => { if (e.target.closest("a")) setMenuOpen(false); });

// ===== 시간표 탭: data-level로 거르고 선택한 탭에 aria-pressed =====
const tabs = document.querySelectorAll(".tab");
const rows = document.querySelectorAll("#timetable .class-row");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    const filter = tab.dataset.filter;
    tabs.forEach((t) => t.setAttribute("aria-pressed", String(t === tab)));
    rows.forEach((row) => { row.hidden = filter !== "all" && row.dataset.level !== filter; });
  });
});

// ===== 상담 신청 =====
const form = document.getElementById("consultForm");
const submitBtn = document.getElementById("submitBtn");
const formError = document.getElementById("formError");
const persistNotice = document.getElementById("persistNotice");
const done = document.getElementById("done");

const FIELDS = ["parentName", "phone", "grade", "subject", "preferredTime", "message", "consent"];
const ERROR_TEXT = {
  parentName: "이름을 1~20자로 적어 주세요.",
  phone: "연락처를 숫자와 -로 9~13자 적어 주세요. (예: 000-0000-0000)",
  grade: "자녀 학년을 골라 주세요.",
  subject: "과목을 골라 주세요.",
  preferredTime: "상담하기 편한 시간을 골라 주세요.",
  message: "문의 내용은 200자 이내로 적어 주세요.",
  consent: "개인정보 수집에 동의해 주세요.",
};

const storage = openStorage(window);
let { state, persisted } = loadState(storage, new Date());
// 저장할 수 없는 브라우저면 폼 위에 미리 알려 준다
persistNotice.hidden = persisted;

let sending = false; // 빠르게 두 번 눌러도 한 번만 접수하려는 잠금

function clearErrors() {
  for (const name of FIELDS) {
    form.elements[name].removeAttribute("aria-invalid");
    document.getElementById(`${name}-error`).hidden = true;
  }
  formError.hidden = true;
}

function showFieldError(name) {
  const input = form.elements[name];
  const msg = document.getElementById(`${name}-error`);
  input.setAttribute("aria-invalid", "true");
  msg.textContent = ERROR_TEXT[name];
  msg.hidden = false;
  input.focus();
}

function showFormError(text) {
  formError.textContent = text;
  formError.hidden = false;
}

function showDone(inquiry) {
  document.getElementById("doneName").textContent = inquiry.parentName;
  document.getElementById("doneGrade").textContent = inquiry.grade;
  document.getElementById("doneSubject").textContent = inquiry.subject;
  document.getElementById("doneTime").textContent = inquiry.preferredTime;
  form.hidden = true;
  done.hidden = false;
  document.getElementById("done-title").focus();
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  if (sending) return;
  sending = true;
  submitBtn.disabled = true;
  clearErrors();

  const input = {
    parentName: form.elements.parentName.value,
    phone: form.elements.phone.value,
    grade: form.elements.grade.value,
    subject: form.elements.subject.value,
    preferredTime: form.elements.preferredTime.value,
    message: form.elements.message.value,
    consent: form.elements.consent.checked,
  };
  // 원장님 화면(다른 탭)에서 상태·메모를 바꿨을 수 있으니 추가하기 직전에 저장소에서 다시 읽는다.
  // 처음 연 때의 state에 더하면 그사이 바뀐 내용을 덮어써 버린다.
  // 저장이 안 되는 브라우저(persisted=false)면 다시 읽으면 예시로 돌아가 앞서 낸 신청이 사라지므로 그대로 둔다.
  if (persisted) ({ state, persisted } = loadState(storage, new Date()));
  const result = addInquiry(state, input, new Date());

  if (!result.ok) {
    if (result.code === "INVALID") showFieldError(result.field);
    else showFormError("데모에서는 신청을 20건까지 받아요. 원장님 화면에서 [예시로 되돌리기]를 눌러 주세요.");
    sending = false;
    submitBtn.disabled = false;
    return;
  }

  state = result.state;
  const saved = saveState(storage, state);
  persisted = saved.ok;
  // 저장이 안 돼도 화면의 신청 완료는 보여 주고, 원장님 화면에서 안 보일 수 있음을 알린다
  persistNotice.hidden = persisted;
  showDone(result.inquiry);
  // 성공하면 잠금을 풀지 않는다: 같은 신청이 두 번 들어가지 않게 [한 번 더 신청하기]에서 푼다
});

// 한 번 더 신청하기: 폼을 다시 보여 주고 동의만 다시 받는다
document.getElementById("againBtn").addEventListener("click", () => {
  done.hidden = true;
  form.hidden = false;
  sending = false;
  submitBtn.disabled = false;
  form.elements.consent.checked = false;
  form.elements.message.value = "";
  form.elements.parentName.focus();
});

// 뒤로 가기로 돌아오면 브라우저가 예전 화면을 그대로 꺼내 보여 줄 수 있다(bfcache).
// 그사이 다른 화면에서 바뀐 저장 상태를 다시 읽는다(이 화면엔 목록이 없어 저장 안내만 다시 맞춘다).
window.addEventListener("pageshow", (e) => {
  if (!e.persisted || !persisted) return;
  ({ state, persisted } = loadState(storage, new Date()));
  persistNotice.hidden = persisted;
});
