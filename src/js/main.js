// 2026-11-20 - portfolio-site - 모바일 메뉴 열고 닫기
// 파일 위치: src/js/main.js
// 화면 전환은 CSS(.header.is-open)가 맡고, 여기서는 클래스만 바꾼다.

const header = document.getElementById("header");
const menuToggle = document.getElementById("menuToggle");
const nav = document.getElementById("nav");

function setMenuOpen(isOpen) {
  header.classList.toggle("is-open", isOpen);
  menuToggle.setAttribute("aria-expanded", String(isOpen));
  menuToggle.setAttribute("aria-label", isOpen ? "메뉴 닫기" : "메뉴 열기");
}

menuToggle.addEventListener("click", () => {
  setMenuOpen(!header.classList.contains("is-open"));
});

// 메뉴 링크를 누르면 해당 섹션으로 이동하면서 메뉴를 닫는다
nav.addEventListener("click", (event) => {
  if (event.target.closest("a")) setMenuOpen(false);
});
