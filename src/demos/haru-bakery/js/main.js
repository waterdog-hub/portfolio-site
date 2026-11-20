// 2026-11-20 - portfolio-site - 하루밀 베이커리 데모: 모바일 메뉴 열고 닫기
// 파일 위치: src/demos/haru-bakery/js/main.js
// 포트폴리오 src/js/main.js와 같은 방식이다. 보이고 숨기는 일은 CSS(.nav.is-open)가 맡고,
// 여기서는 클래스와 aria 속성(화면 낭독기가 읽는 상태)만 바꾼다.

const navToggle = document.getElementById("navToggle");
const nav = document.getElementById("nav");

function setMenuOpen(isOpen) {
  nav.classList.toggle("is-open", isOpen);
  navToggle.setAttribute("aria-expanded", String(isOpen));
  navToggle.setAttribute("aria-label", isOpen ? "메뉴 닫기" : "메뉴 열기");
}

navToggle.addEventListener("click", () => {
  setMenuOpen(!nav.classList.contains("is-open"));
});

// 메뉴 링크를 누르면 해당 섹션으로 이동하면서 메뉴를 닫는다
nav.addEventListener("click", (event) => {
  if (event.target.closest("a")) setMenuOpen(false);
});
