# portfolio-site

크몽·숨고 외주 홍보용 웹 제작 포트폴리오 사이트입니다. 순수 HTML·CSS로 만들어 빌드 없이 바로 열고 배포할 수 있습니다.

## 미리보기

`src/index.html`을 브라우저로 열거나, 로컬 서버를 띄웁니다.

```
py -3 -m http.server 8000 -d src
```

그다음 `http://localhost:8000`에 접속합니다.

## 구조

| 파일 | 역할 |
|------|------|
| `src/index.html` | 원페이지 전체 (메뉴, 히어로, 서비스, 가격, 포트폴리오, 과정, 기술, FAQ, 문의) |
| `src/css/style.css` | 스타일. 맨 위 `:root`의 `--accent`를 바꾸면 강조색이 바뀝니다 |
| `src/js/main.js` | 휴대폰 화면의 메뉴 열고 닫기 |
| `ai-agent/claude/기획_261120_포트폴리오 사이트 기획 v0.1.md` | 목표, 요구사항, 결정 기록 |

## 배포

Netlify가 이 저장소의 `main` 브랜치에 연결되어 있습니다(배포 폴더 `src`, 빌드 명령 없음). `main`에 푸시하면 자동으로 다시 배포됩니다.

- 주소: https://portfolio-site-qnx5.netlify.app (자리표시를 채울 때까지 비공개)
- 공개 범위와 주소 이름은 Netlify의 **Manage → General**에서 바꿉니다.
