// 작성일: 2026-11-21
// 파일 위치: src/demos/bareun-academy/js/owner.js
// 목적: 원장님 화면. 신청 목록·개수·필터, 상태 변경, 메모, 되돌리기. 저장은 store.js가 맡는다.
// 학부모가 입력한 글은 textContent/value로만 화면에 넣는다(HTML로 해석되지 않게).

import {
  STORAGE_KEY, openStorage, loadState, saveState, setStatus, setMemo,
  countByStatus, sortedInquiries, isJustArrived, resetState,
} from "./store.js";

const STATUS_LABEL = { new: "새 신청", contacted: "연락함", enrolled: "등록", onhold: "보류" };

const list = document.getElementById("inquiryList");
const tpl = document.getElementById("cardTpl");
const emptyMsg = document.getElementById("emptyMsg");
const persistNotice = document.getElementById("persistNotice");
const saveError = document.getElementById("saveError");
const filterBtns = document.querySelectorAll(".owner__filters .tab");

const storage = openStorage(window);
let { state, persisted } = loadState(storage, new Date());
let filter = "all";
persistNotice.hidden = persisted;

// 신청 시각을 "11/21 14:32"로 쓴다
function formatAt(ms) {
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function renderCounts() {
  const c = countByStatus(state);
  document.getElementById("countNew").textContent = c.new;
  document.getElementById("countContacted").textContent = c.contacted;
  document.getElementById("countDone").textContent = c.enrolled;
}

function buildCard(inq) {
  const li = tpl.content.firstElementChild.cloneNode(true);
  li.dataset.id = inq.id;
  const q = (sel) => li.querySelector(sel);
  q(".inq__name").textContent = `${inq.parentName} · ${inq.grade} · ${inq.subject}`;
  const badge = q(".inq__badge");
  badge.textContent = STATUS_LABEL[inq.status];
  badge.classList.add(`inq__badge--${inq.status}`);
  q(".inq__phone").textContent = inq.phone;
  q(".inq__time").textContent = inq.preferredTime;
  q(".inq__message").textContent = inq.message || "(내용 없음)";
  q(".inq__at").textContent = formatAt(inq.createdAt);
  if (isJustArrived(inq)) {
    li.classList.add("inq--arrived");
    q(".inq__arrived").hidden = false;
  }
  // 지금 상태로 바꾸는 버튼은 필요 없으니 숨긴다
  li.querySelectorAll(".inq__btn").forEach((b) => { b.hidden = b.dataset.status === inq.status; });
  q(".inq__memo-input").value = inq.memo || "";
  q(".inq__memo-input").setAttribute("aria-label", `${inq.parentName} 메모`);
  return li;
}

function render() {
  renderCounts();
  filterBtns.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.filter === filter)));
  const items = sortedInquiries(state, filter);
  list.replaceChildren(...items.map(buildCard));
  emptyMsg.hidden = items.length > 0;
}

// 새 state를 저장해 보고, 성공했을 때만 화면에 반영한다. 실패하면 이전 state를 그대로 둔다.
function commit(next) {
  const r = saveState(storage, next);
  if (!r.ok) {
    saveError.textContent = "저장하지 못했어요. 브라우저 저장 공간이 막혀 있거나 가득 찼을 수 있어요. 방금 한 변경은 반영되지 않았어요.";
    saveError.hidden = false;
    return false;
  }
  saveError.hidden = true;
  persisted = true;
  persistNotice.hidden = true;
  state = next;
  render();
  return true;
}

filterBtns.forEach((b) => b.addEventListener("click", () => { filter = b.dataset.filter; render(); }));

// 버튼·폼이 카드마다 생기므로 목록 하나에서 받아 처리한다
list.addEventListener("click", (e) => {
  const btn = e.target.closest(".inq__btn");
  if (!btn) return;
  const id = btn.closest(".inq").dataset.id;
  commit(setStatus(state, id, btn.dataset.status));
});

list.addEventListener("submit", (e) => {
  e.preventDefault();
  const card = e.target.closest(".inq");
  commit(setMemo(state, card.dataset.id, card.querySelector(".inq__memo-input").value));
});

document.getElementById("resetBtn").addEventListener("click", () => {
  if (!window.confirm("방문자가 낸 신청이 모두 지워지고 예시 신청으로 돌아가요. 되돌릴까요?")) return;
  commit(resetState(new Date()));
});

// 다른 탭(학부모 화면)에서 신청하면 새로 고침 없이 다시 읽어 그린다
window.addEventListener("storage", (e) => {
  if (e.key !== STORAGE_KEY) return;
  ({ state, persisted } = loadState(storage, new Date()));
  persistNotice.hidden = persisted;
  render();
});

render();
