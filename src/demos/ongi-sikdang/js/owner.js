// 작성일: 2026-11-21
// 파일 위치: src/demos/ongi-sikdang/js/owner.js
// 목적: 사장님 화면(M-01~M-06). 공지·오늘의 백반·메뉴 추가/수정/삭제·품절 스위치·사진·되돌리기. 저장 규칙은 store.js가 맡는다.
// 사장님이 쓴 글(메뉴 이름 등)은 textContent/value로만 넣어 HTML로 해석되지 않게 한다.

import {
  STORAGE_KEY, MAX_MENUS, MAX_UPLOADED_PHOTOS, CATEGORIES, CATEGORY_LABELS,
  openStorage, loadState, commit, parsePrice, formatPrice, validateMenu,
  addMenu, updateMenu, deleteMenu, setSoldOut, setPhoto, countUploadedPhotos,
  setNotice, setTodaySet, menusByCategory, resetState,
} from "./store.js";
import { resizePhoto } from "./photo.js";

// 실패 코드별 안내 문구
const ERROR_MSG = {
  QUOTA: "저장 공간이 부족해요. 사진을 몇 장 빼고 다시 해 주세요",
  LIMIT: `데모에서는 메뉴를 ${MAX_MENUS}개까지 둘 수 있어요`,
  PHOTO_LIMIT: `데모에서는 사진을 ${MAX_UPLOADED_PHOTOS}장까지 올릴 수 있어요`,
  NOT_FOUND: "이 메뉴를 찾지 못했어요. 다른 화면에서 지워졌을 수 있어요",
};
const FLASH_MS = 3000;

const $ = (id) => document.getElementById(id);
const persistNotice = $("persistNotice");
const liveMsg = $("liveMsg");
const errorBox = $("errorBox");
const errorText = $("errorText");
const menuGroups = $("menuGroups");
const menuCount = $("menuCount");
const rowTpl = $("rowTpl");

const noticeForm = $("noticeForm");
const noticeInput = $("noticeInput");
const noticeVisible = $("noticeVisible");
const todayForm = $("todayForm");
const todayDishesInput = $("todayDishesInput");
const todayPriceInput = $("todayPriceInput");
const todayPriceError = $("todayPriceError");

const dialog = $("menuDialog");
const menuForm = $("menuForm");
const fields = {
  name: $("mName"), price: $("mPrice"), description: $("mDesc"), category: $("mCategory"),
};
const photoPreview = $("mPhotoPreview");
const photoNone = $("mPhotoNone");
const photoInput = $("mPhotoInput");
const photoPickText = $("mPhotoPickText");
const photoRemove = $("mPhotoRemove");
const photoStatus = $("mPhotoStatus");
const dialogError = $("dialogError");
const dialogSave = $("dialogSave");

const storage = openStorage(window);
let { state, persisted } = loadState(storage, new Date());

// 방금 바꾼 줄 강조: { id, text }. 3초 뒤 지운다.
let flash = null;
let flashTimer = 0;
let toastTimer = 0;

// 공지·백반 칸에 쓰다 만 글이 있는지. 다른 탭 변경으로 다시 그릴 때 쓰던 글을 덮어쓰지 않으려고 기억한다.
const dirty = { notice: false, today: false };

// 수정 창 상태: 어떤 메뉴를 고치는지(추가면 null)와 창 안에서 고른 사진
const edit = { id: null, photo: "", originalPhoto: "", busy: false };

// ===== 저장 =====

// store의 규칙 함수(addMenu 등)가 실패하면 저장하지 않고 빠져나오기 위한 표시
class RuleStop {
  constructor(code) { this.code = code; }
}

// 바꾸는 일은 모두 여기를 거친다. change(draft)는 성공하면 아무것도 돌려주지 않고, 규칙에 막히면 코드("LIMIT" 등)를 돌려준다.
// 규칙에 막히면 commit 안에서 던져서 저장 자체를 건너뛴다(일부만 바뀐 draft가 저장되지 않게).
function apply(change) {
  let r;
  try {
    r = commit(storage, state, (draft) => {
      const code = change(draft);
      if (code) throw new RuleStop(code);
    });
  } catch (e) {
    if (e instanceof RuleStop) return { ok: false, code: e.code };
    throw e;
  }
  if (!r.ok) return r; // QUOTA: r.state는 원래 state라 화면도 그대로 둔다
  state = r.state;
  if (storage) persisted = true; // 처음엔 못 썼어도 지금 써졌으면 저장되는 상태다
  hideError();
  return { ok: true };
}

// ===== 알림 =====

function announce(text) {
  // 같은 문구가 이어져도 스크린리더가 다시 읽게 비웠다가 채운다
  liveMsg.textContent = "";
  clearTimeout(toastTimer);
  setTimeout(() => { liveMsg.textContent = text; }, 50);
  toastTimer = setTimeout(() => { liveMsg.textContent = ""; }, FLASH_MS);
}

function showError(code) {
  errorText.textContent = ERROR_MSG[code] || "저장하지 못했어요. 다시 해 주세요";
  errorBox.hidden = false;
}
function hideError() { errorBox.hidden = true; }
$("errorClose").addEventListener("click", hideError);

// ===== 그리기 =====

function fillNoticeForm() {
  noticeInput.value = state.notice.text;
  noticeVisible.checked = state.notice.visible;
  dirty.notice = false;
}

function fillTodayForm() {
  todayDishesInput.value = state.todaySet.dishes;
  todayPriceInput.value = formatPrice(state.todaySet.price);
  setInvalid(todayPriceInput, todayPriceError, false);
  dirty.today = false;
}

function buildRow(m) {
  const li = rowTpl.content.firstElementChild.cloneNode(true);
  li.dataset.id = m.id;
  const q = (sel) => li.querySelector(sel);
  const img = q(".m-row__photo");
  if (m.photo) {
    img.src = m.photo;
    q(".m-row__nophoto").remove();
  } else {
    img.remove();
  }
  q(".m-row__name").textContent = m.name;
  q(".m-row__won").textContent = `${formatPrice(m.price)}원`;
  q(".badge-soldout").hidden = !m.soldOut;
  li.classList.toggle("is-soldout", m.soldOut);

  const sw = q('[data-act="soldout"]');
  sw.setAttribute("aria-checked", String(m.soldOut));
  // 버튼마다 메뉴 이름을 넣어야 스크린리더로 줄을 옮겨 다녀도 어느 메뉴인지 안다
  sw.setAttribute("aria-label", `${m.name} 품절`);
  q('[data-act="edit"]').setAttribute("aria-label", `${m.name} 수정`);
  q('[data-act="delete"]').setAttribute("aria-label", `${m.name} 삭제`);

  const fl = q(".m-row__flash");
  if (flash && flash.id === m.id) {
    fl.textContent = flash.text;
    li.classList.add("is-flash");
  } else {
    fl.hidden = true;
  }
  return li;
}

function renderMenus() {
  const uploaded = countUploadedPhotos(state);
  menuCount.textContent = `메뉴 ${state.menus.length}/${MAX_MENUS}개 · 올린 사진 ${uploaded}/${MAX_UPLOADED_PHOTOS}장`;
  menuGroups.replaceChildren(...CATEGORIES.map((c) => {
    const group = document.createElement("section");
    group.className = "m-group";
    const h = document.createElement("h3");
    h.className = "m-group__title";
    const items = menusByCategory(state, c);
    h.textContent = `${CATEGORY_LABELS[c]} (${items.length})`;
    group.append(h);
    if (items.length === 0) {
      const p = document.createElement("p");
      p.className = "m-group__empty";
      p.textContent = "이 분류에 메뉴가 없어요";
      group.append(p);
    } else {
      const ul = document.createElement("ul");
      ul.className = "m-list";
      ul.append(...items.map(buildRow));
      group.append(ul);
    }
    return group;
  }));
}

function render() {
  persistNotice.hidden = persisted;
  renderMenus();
}

function rowOf(id) {
  return menuGroups.querySelector(`.m-row[data-id="${CSS.escape(id)}"]`);
}

// 다시 그리면 눌렀던 버튼이 새 버튼으로 바뀌어 포커스가 사라지므로 같은 줄의 같은 버튼으로 돌려준다
function focusRow(id, act) {
  const row = id && rowOf(id);
  const el = row && row.querySelector(`[data-act="${act}"]`);
  (el || $("addBtn")).focus();
}

function setFlash(id, text) {
  clearTimeout(flashTimer);
  flash = { id, text };
  flashTimer = setTimeout(() => {
    // 3초 뒤에는 다시 그리지 않고 그 줄의 강조만 지운다(포커스·입력이 흔들리지 않게)
    const row = rowOf(id);
    if (row) {
      row.classList.remove("is-flash");
      row.querySelector(".m-row__flash").hidden = true;
    }
    flash = null;
  }, FLASH_MS);
}

// ===== M-01 공지 · M-02 오늘의 백반 =====

function setInvalid(input, errorEl, invalid) {
  if (invalid) input.setAttribute("aria-invalid", "true");
  else input.removeAttribute("aria-invalid");
  errorEl.hidden = !invalid;
}

noticeForm.addEventListener("input", () => { dirty.notice = true; });
noticeForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const r = apply((d) => { setNotice(d, noticeInput.value, noticeVisible.checked); });
  if (!r.ok) { showError(r.code); return; }
  fillNoticeForm(); // 앞뒤 공백을 뺀 저장값으로 맞춘다
  render();
  announce("공지를 저장했어요");
});

todayForm.addEventListener("input", () => { dirty.today = true; });
todayForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const price = parsePrice(todayPriceInput.value);
  setInvalid(todayPriceInput, todayPriceError, price === null);
  if (price === null) { todayPriceInput.focus(); return; }
  const r = apply((d) => { setTodaySet(d, todayDishesInput.value, price); });
  if (!r.ok) { showError(r.code); return; }
  fillTodayForm();
  render();
  announce("오늘의 백반을 저장했어요");
});

// ===== M-03 메뉴 목록: 줄마다 생기는 버튼을 목록 하나에서 받는다 =====

menuGroups.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-act]");
  if (!btn) return;
  const id = btn.closest(".m-row").dataset.id;
  const menu = state.menus.find((m) => m.id === id);
  if (!menu) return;
  const act = btn.dataset.act;

  if (act === "soldout") {
    const next = !menu.soldOut;
    const r = apply((d) => (setSoldOut(d, id, next, new Date()) ? null : "NOT_FOUND"));
    if (!r.ok) { showError(r.code); return; }
    const text = next ? "방금 품절로 바꿨어요" : "방금 판매중으로 바꿨어요";
    setFlash(id, text);
    render();
    focusRow(id, "soldout");
    announce(`${menu.name}: ${next ? "품절로 바꿨어요" : "판매중으로 바꿨어요"}`);
  } else if (act === "edit") {
    openDialog(menu);
  } else if (act === "delete") {
    if (!window.confirm(`"${menu.name}" 메뉴를 지울까요? 지우면 되돌릴 수 없어요.`)) return;
    // 지운 뒤 포커스를 보낼 곳: 같은 분류의 다음 줄, 없으면 앞 줄, 그것도 없으면 [+ 메뉴 추가]
    const row = btn.closest(".m-row");
    const neighbor = row.nextElementSibling || row.previousElementSibling;
    const nextId = neighbor ? neighbor.dataset.id : null;
    const r = apply((d) => (deleteMenu(d, id) ? null : "NOT_FOUND"));
    if (!r.ok) { showError(r.code); return; }
    render();
    focusRow(nextId, "delete");
    announce(`"${menu.name}" 메뉴를 지웠어요`); // 이름 받침에 따라 을/를이 달라져 따옴표로 묶는다
  }
});

$("addBtn").addEventListener("click", () => {
  // 창을 열기 전에 막아서, 다 적고 나서야 안 된다는 걸 알게 되지 않게 한다
  if (state.menus.length >= MAX_MENUS) { showError("LIMIT"); return; }
  openDialog(null);
});

// ===== M-04 메뉴 추가·수정 창 · M-05 사진 =====

fields.category.replaceChildren(...CATEGORIES.map((c) => new Option(CATEGORY_LABELS[c], c)));

const FIELD_ERRORS = {
  name: $("mNameError"), price: $("mPriceError"), description: $("mDescError"), category: $("mCategoryError"),
};

function clearDialogErrors() {
  Object.keys(fields).forEach((k) => setInvalid(fields[k], FIELD_ERRORS[k], false));
  dialogError.textContent = "";
}

function showDialogPhoto() {
  const has = edit.photo !== "";
  photoPreview.hidden = !has;
  if (has) photoPreview.src = edit.photo;
  else photoPreview.removeAttribute("src");
  photoNone.hidden = has;
  photoPickText.textContent = has ? "사진 바꾸기" : "사진 올리기";
  photoRemove.hidden = !has;
}

function openDialog(menu) {
  edit.id = menu ? menu.id : null;
  edit.photo = menu ? menu.photo : "";
  edit.originalPhoto = edit.photo;
  $("dialogTitle").textContent = menu ? "메뉴 수정" : "메뉴 추가";
  fields.name.value = menu ? menu.name : "";
  fields.price.value = menu ? formatPrice(menu.price) : "";
  fields.description.value = menu ? menu.description : "";
  fields.category.value = menu ? menu.category : CATEGORIES[0];
  photoInput.value = "";
  photoStatus.textContent = "";
  clearDialogErrors();
  showDialogPhoto();
  dialog.showModal();
  fields.name.focus();
}

// 취소로 닫으면 원래 눌렀던 [수정] 버튼(그새 다시 그려졌을 수 있음)이나 [+ 메뉴 추가]로 돌아간다.
// "close" 이벤트는 브라우저에 따라 늦거나 안 와서, 닫는 곳에서 바로 포커스를 옮긴다.
function closeDialog() {
  if (edit.busy) return; // 사진을 줄이는 중에는 닫지 않는다(끝난 결과가 엉뚱한 메뉴에 들어가지 않게)
  dialog.close();
  focusRow(edit.id, "edit");
}

$("dialogCancel").addEventListener("click", closeDialog);
// Esc 키도 같은 길로 닫는다
dialog.addEventListener("cancel", (e) => {
  e.preventDefault();
  closeDialog();
});

photoInput.addEventListener("change", async () => {
  const file = photoInput.files[0];
  photoInput.value = ""; // 같은 파일을 다시 골라도 change가 일어나게 비운다
  if (!file) return;
  dialogError.textContent = "";

  // 새로 한 장이 늘어나는 경우만 10장 제한에 걸린다(이미 올린 사진을 바꾸는 건 괜찮다)
  const others = countUploadedPhotos(state) - (edit.originalPhoto.startsWith("data:") ? 1 : 0);
  if (others >= MAX_UPLOADED_PHOTOS) { dialogError.textContent = ERROR_MSG.PHOTO_LIMIT; return; }

  edit.busy = true;
  dialogSave.disabled = true;
  photoStatus.textContent = "사진 줄이는 중…";
  const r = await resizePhoto(file);
  edit.busy = false;
  dialogSave.disabled = false;
  if (!r.ok) {
    photoStatus.textContent = "";
    dialogError.textContent = r.code === "NOT_IMAGE"
      ? "사진 파일만 올릴 수 있어요"
      : "사진을 읽지 못했어요. 다른 사진으로 해 주세요";
    return;
  }
  edit.photo = r.dataUrl;
  showDialogPhoto();
  photoStatus.textContent = "사진을 넣었어요. 저장을 눌러야 손님 화면에 보여요";
});

photoRemove.addEventListener("click", () => {
  edit.photo = "";
  showDialogPhoto();
  photoStatus.textContent = "사진을 뺐어요. 저장을 눌러야 반영돼요";
  photoInput.focus(); // 누른 버튼이 숨겨지므로 바로 옆 [사진 올리기]로 옮긴다
});

menuForm.addEventListener("submit", (e) => {
  e.preventDefault();
  if (edit.busy) return;
  clearDialogErrors();
  const v = validateMenu({
    name: fields.name.value, price: fields.price.value,
    description: fields.description.value, category: fields.category.value,
  });
  if (!v.ok) {
    setInvalid(fields[v.field], FIELD_ERRORS[v.field], true);
    fields[v.field].focus();
    return;
  }

  const now = new Date();
  let id = edit.id;
  // 메뉴 내용과 사진을 한 번에 저장한다. 사진 제한에 걸리면 메뉴 추가도 함께 취소된다.
  const r = apply((d) => {
    if (id === null) {
      const added = addMenu(d, v.value, now);
      if (!added.ok) return added.code;
      id = added.id;
    } else if (!updateMenu(d, id, v.value, now)) {
      return "NOT_FOUND";
    }
    // 창 안에서 사진을 바꾸지 않았으면 건드리지 않는다.
    // 연 때의 사진을 그대로 다시 쓰면 그사이 다른 탭에서 바꾼 사진을 덮어쓰게 된다.
    if (edit.photo === edit.originalPhoto) return null;
    const p = setPhoto(d, id, edit.photo, now);
    return p.ok ? null : p.code;
  });
  if (!r.ok) {
    // 창은 열어 둔다: 적은 내용을 잃지 않고 사진을 빼거나 고쳐서 다시 저장할 수 있게
    dialogError.textContent = ERROR_MSG[r.code];
    if (r.code === "QUOTA" && edit.photo.startsWith("data:")) photoRemove.focus();
    else dialogSave.focus();
    return;
  }
  const wasAdd = edit.id === null;
  setFlash(id, wasAdd ? "방금 추가했어요" : "방금 저장했어요");
  render();
  dialog.close();
  focusRow(id, "edit");
  announce(wasAdd ? `${v.value.name} 메뉴를 추가했어요` : `${v.value.name} 메뉴를 저장했어요`);
});

// ===== M-06 처음 메뉴로 되돌리기 =====

$("resetBtn").addEventListener("click", () => {
  if (!window.confirm("바꾼 메뉴·공지·사진이 모두 지워지고 처음 메뉴로 돌아가요. 되돌릴까요?")) return;
  const r = apply((d) => { Object.assign(d, resetState(new Date())); });
  if (!r.ok) { showError(r.code); return; }
  flash = null;
  fillNoticeForm();
  fillTodayForm();
  render();
  $("resetBtn").focus();
  announce("처음 메뉴로 되돌렸어요");
});

// ===== 다른 탭에서 바뀐 내용 반영 =====

// 저장소에서 다시 읽어 그린다. 목록 안 버튼에 포커스가 있었으면 다시 그린 뒤 같은 줄·같은 버튼으로 돌려놓는다.
function reloadFromStorage() {
  const a = document.activeElement;
  const rowFocus = a && a.closest && a.closest(".m-row")
    ? { id: a.closest(".m-row").dataset.id, act: a.dataset.act }
    : null;
  ({ state, persisted } = loadState(storage, new Date()));
  // 쓰다 만 글이 있는 칸은 그대로 두고, 손대지 않은 칸만 새 값으로 채운다
  if (!dirty.notice) fillNoticeForm();
  if (!dirty.today) fillTodayForm();
  render();
  // 수정 창이 열려 있으면 창 안의 입력은 건드리지 않는다(창은 state를 다시 읽지 않는다)
  if (rowFocus && !dialog.open) {
    if (rowOf(rowFocus.id)) focusRow(rowFocus.id, rowFocus.act);
    else $("addBtn").focus(); // 그 메뉴가 다른 탭에서 지워졌으면
  }
}

window.addEventListener("storage", (e) => {
  if (e.key !== STORAGE_KEY && e.key !== null) return; // key가 null이면 저장소 전체가 비워진 것
  reloadFromStorage();
});

// 손님 화면에 갔다가 뒤로 가기로 돌아오면 예전 화면이 그대로 꺼내질 수 있다(bfcache). 그때도 다시 읽어 그린다.
// 쓰다 만 칸과 열린 수정 창은 reloadFromStorage가 그대로 둔다.
window.addEventListener("pageshow", (e) => {
  if (e.persisted) reloadFromStorage();
});

fillNoticeForm();
fillTodayForm();
render();
