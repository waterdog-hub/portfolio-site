// 작성일: 2026-11-21
// 파일 위치: src/demos/ongi-sikdang/js/main.js
// 목적: 손님 화면의 모바일 메뉴, 공지 띠, 오늘의 백반, 메뉴판 그리기. 저장은 store.js가 맡는다.
// 저장된 글(메뉴 이름·공지 등)은 textContent로만 넣어 HTML로 해석되지 않게 한다.

import { STORAGE_KEY, openStorage, loadState, menusByCategory, formatPrice } from "./store.js";

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

// ===== 화면 그리기 =====
const noticeBand = document.getElementById("noticeBand");
const noticeText = document.getElementById("noticeText");
const persistNotice = document.getElementById("persistNotice");
const menuList = document.getElementById("menuList");
const menuEmpty = document.getElementById("menuEmpty");
const itemTpl = document.getElementById("menuItemTpl");
const tabs = document.querySelectorAll(".tab");

const DAYS = ["일", "월", "화", "수", "목", "금", "토"];
const storage = openStorage(window);
let { state, persisted } = loadState(storage, new Date());
let filter = "all";

function renderNotice() {
  // 꺼져 있거나 글이 비어 있으면 띠 자체를 숨긴다
  const show = state.notice.visible && state.notice.text.trim() !== "";
  noticeBand.hidden = !show;
  noticeText.textContent = state.notice.text;
}

function renderToday() {
  const now = new Date();
  document.getElementById("todayDate").textContent = `${now.getMonth() + 1}/${now.getDate()}(${DAYS[now.getDay()]})`;
  document.getElementById("todayDishes").textContent = state.todaySet.dishes;
  document.getElementById("todayPrice").textContent = `${formatPrice(state.todaySet.price)}원`;
}

function renderMenu() {
  const items = menusByCategory(state, filter);
  menuList.replaceChildren(...items.map((m) => {
    const li = itemTpl.content.firstElementChild.cloneNode(true);
    const img = li.querySelector(".menu-item__photo");
    if (m.photo) {
      img.src = m.photo;
      img.alt = m.name;
    } else {
      img.remove(); // 사진이 없으면 칸 자체를 없애 글이 왼쪽부터 시작한다
    }
    li.querySelector(".menu-item__name").textContent = m.name;
    li.querySelector(".menu-item__desc").textContent = m.description;
    li.querySelector(".menu-item__won").textContent = `${formatPrice(m.price)}원`;
    li.classList.toggle("is-soldout", m.soldOut);
    li.querySelector(".badge-soldout").hidden = !m.soldOut;
    return li;
  }));
  menuEmpty.hidden = items.length > 0;
}

function render() {
  persistNotice.hidden = persisted;
  renderNotice();
  renderToday();
  renderMenu();
}

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    filter = tab.dataset.filter;
    tabs.forEach((t) => t.setAttribute("aria-pressed", String(t === tab)));
    renderMenu();
  });
});

// 사장님 화면을 다른 탭에서 열어 고치면 바로 반영한다
window.addEventListener("storage", (e) => {
  if (e.key !== STORAGE_KEY && e.key !== null) return; // key가 null이면 저장소 전체가 비워진 것
  ({ state, persisted } = loadState(storage, new Date()));
  render();
});

render();
