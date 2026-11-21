// 작성일: 2026-11-21
// 파일 위치: src/demos/ongi-sikdang/js/photo.js
// 목적: 사장님이 올린 메뉴 사진을 브라우저 안에서 작게 줄여 JPEG 데이터 주소(data URL)로 만든다.
// localStorage는 5MB 안팎이라 원본 사진(수 MB)을 그대로 넣으면 금방 가득 찬다. 그래서 저장 전에 꼭 줄인다.

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIDE = 600;            // 긴 변 600px: 메뉴 줄의 작은 정사각형에는 충분하다
const QUALITY = 0.75;
const RETRY_QUALITY = 0.6;       // 200KB를 넘을 때 한 번 더 줄이는 품질
const MAX_BYTES = 200 * 1024;

// createImageBitmap이 없거나 실패하는 브라우저(오래된 사파리 등)를 위해 <img>로도 읽는다.
async function decode(file) {
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(file);
      return { source: bmp, width: bmp.width, height: bmp.height, done: () => bmp.close() };
    } catch {
      // 아래 <img> 방법으로 한 번 더 시도한다
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, done: () => {} };
  } finally {
    URL.revokeObjectURL(url); // decode가 끝나면 그림은 이미 메모리에 있어 주소를 바로 버려도 된다
  }
}

// data URL은 base64라서 글자 수의 약 3/4이 실제 바이트 수다.
function byteSize(dataUrl) {
  return dataUrl.length * 0.75;
}

export async function resizePhoto(file) {
  if (!file || !ACCEPTED_TYPES.includes(file.type)) return { ok: false, code: "NOT_IMAGE" };

  let pic;
  try {
    pic = await decode(file);
  } catch {
    return { ok: false, code: "DECODE_FAILED" }; // 확장자만 jpg인 깨진 파일 등
  }
  if (!pic.width || !pic.height) {
    pic.done();
    return { ok: false, code: "DECODE_FAILED" };
  }

  const scale = Math.min(1, MAX_SIDE / Math.max(pic.width, pic.height)); // 작은 사진은 키우지 않는다
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(pic.width * scale));
  canvas.height = Math.max(1, Math.round(pic.height * scale));
  const ctx = canvas.getContext("2d");
  // JPEG에는 투명이 없어 투명한 부분이 검게 나온다. 먼저 흰색으로 칠해 둔다.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(pic.source, 0, 0, canvas.width, canvas.height);
  pic.done();

  let dataUrl = canvas.toDataURL("image/jpeg", QUALITY);
  if (byteSize(dataUrl) > MAX_BYTES) dataUrl = canvas.toDataURL("image/jpeg", RETRY_QUALITY);
  // canvas가 너무 커서 그리지 못하면 "data:,"처럼 빈 값이 나온다
  if (!dataUrl.startsWith("data:image/jpeg")) return { ok: false, code: "DECODE_FAILED" };
  return { ok: true, dataUrl };
}
