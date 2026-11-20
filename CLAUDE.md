# Claude를 위한 프로젝트 지침

## 프로젝트 정보

- **프로젝트명**: `portfolio-site`
- **한 줄 설명**: 크몽·숨고 외주 홍보용 1인 웹 제작 포트폴리오 사이트
- **상태**: 원페이지 완료, 하루밀 베이커리 데모(`src/demos/haru-bakery/`)를 포트폴리오 첫 사례로 연결, 포트폴리오 사례 3건(remodel-link, 잇다, smart-voca)과 실제 화면 스크린샷 반영 (2026-11-20). 활동명·가격·플랫폼 링크는 자리표시
- **기획 문서**: `ai-agent/claude/기획_261120_포트폴리오 사이트 기획 v0.1.md` (요구사항 ID R-01~R-10, 결정 D-01~D-06)

### 기술 스택

| 레이어 | 기술 |
|--------|------|
| 화면 | 순수 HTML + CSS + 최소한의 JavaScript (빌드 도구 없음, 결정 D-01) |
| 글꼴 | Pretendard (jsDelivr CDN) |
| 배포 | 정적 호스팅 (Netlify 또는 Vercel 무료, 미정) |

## 상위 정책 참조

본 프로젝트는 **`docs/개발방법론.md`** 를 따른다. smart-voca 프로젝트의 `CLAUDE.md`와 같은 방식으로 조정해 적용한다.

| 방법론 내용 | 이 프로젝트 |
|-------------|-------------|
| aisw01 서버 SSH 접근 | 로컬 Windows PC에서 Claude Code를 실행한다 |
| GitHub `sowiseted` 조직 | 개인 공개 저장소 `waterdog-hub/portfolio-site`를 쓴다 (origin, 2026-11-20 생성) |
| Gemini 보조 에이전트 | 쓰지 않는다 |
| SDLC 산출물 전체 | 정적 사이트 규모에 맞게 기획서(요구사항·결정 기록 포함) 하나로 테일러링한다. 백엔드 사례를 만들 때 사례별로 설계 문서를 둔다 |

## 작업 공간 구조

```
portfolio-site/
├── CLAUDE.md          # 본 문서
├── README.md          # 소개, 실행·배포 방법
├── docs/              # 승인된 최종 산출물 (Claude는 직접 쓰지 않는다)
├── ai-agent/
│   ├── claude/        # Claude 작업 문서 (기획·검토·일지)
│   ├── uploads/       # 참고 자료 (참고 사이트 캡처 등)
│   └── scripts/       # 프로젝트 전용 스크립트
└── src/               # 배포되는 사이트 (이 폴더를 그대로 올린다)
    ├── index.html
    ├── css/style.css  # 맨 위 :root 변수에 색·간격
    ├── js/main.js     # 모바일 메뉴
    ├── demos/haru-bakery/  # 가게 홈페이지 데모 (데모 전용 css·js·assets)
    └── assets/        # 스크린샷·이미지
```

## 작업 원칙 (smart-voca CLAUDE.md와 같다)

- 흐름: 요구사항 접수 → 현황 파악 → 기획 문서 갱신 → 구현 → 브라우저 확인 → 완료 보고
- 요구사항 ID(R-xx)와 연결해 구현하고, 구현하면 기획 문서의 상태를 갱신한다.
- 되돌아볼 결정은 기획 문서 §4에 `배경 / 대안 / 결정 근거`로 남긴다.
- 설명은 학습이 되게: 새 코드나 큰 변경에는 *왜* 그렇게 했는지 한두 줄 덧붙인다. 운영자는 프론트엔드를 배우는 중이다.
- 200줄 이상 코드는 파일 하나씩, 한 파일이 500줄을 넘으면 분리를 제안한다.
- 커밋·푸시·배포는 사용자 승인 후에 한다. 커밋 메시지는 Conventional Commits (`feat:`, `fix:`, `docs:` …).

## 코드 작성 규칙

1. **파일 최상단 헤더**: 작성일, 파일 위치, 목적 (HTML은 `<!-- -->`, CSS·JS는 주석)
2. **스타일은 CSS 파일에**: HTML에 `style=""`을 쓰지 않는다. 색은 `:root` 변수만 쓴다.
3. **모바일 우선 확인**: 화면을 바꾸면 데스크톱(1280px)과 휴대폰(375px) 너비에서 확인한다.
4. **접근성 기본**: 이미지에 `alt`, 버튼에 `aria-label`, 시맨틱 태그(`header`, `main`, `section`, `article`)를 쓴다.

## 프로젝트 특화 메모

- **외부 연락처 금지 (결정 D-02)**: 크몽·숨고는 직거래 유도를 제재한다. 사이트에 전화번호·카카오톡·이메일을 넣지 않는다. 문의 버튼은 플랫폼 프로필로만 연결한다.
- **자리표시 위치**: 활동명 `OO 웹스튜디오`, 가격(R-04), 크몽·숨고 링크(`href="#"`, R-09). `index.html`의 `TODO` 주석을 검색하면 찾을 수 있다.
- **사례 프로젝트 위치**: smart-voca `C:\Users\PC2602\smart-voca` (공개 저장소), remodel-link `C:\Users\PC2602\Desktop\중소기업 외주 프로젝트\remodel-link` (비공개), 잇다 `C:\Users\PC2602\Desktop\itda` (비공개). 비공개 저장소는 사이트에 링크하지 않는다.
- **스크린샷 다시 찍기 (D-05)**: 개발 DB를 쓰지 않는다. smart-voca·remodel-link는 각 프로젝트에서 `.venv\Scripts\python ai-agent/scripts/browser_check.py --keep`을 실행하고 결과 폴더의 `*_1280.png`를 고른다(remodel-link는 `contract_in_progress_company_1280.png`, smart-voca는 `home_1280.png`). 잇다는 가짜 LLM(`node tools/fake-llm/fake-llm.js`)과 테스트 스키마(`DB_URL`을 `itda_it`로)로 백엔드를 띄우고 API로 지어낸 데이터를 넣어 찍는다. 파일은 `src/assets/`에 1280x900으로 둔다. 휴대폰용은 같은 방법으로 375px 너비로 찍어 `이름-375.png`로 둔다(remodel-link `contract_in_progress_performer_375.png`, smart-voca `home_375.png`, 잇다는 문항 화면).
- **하루밀 베이커리 데모**: 위치 `src/demos/haru-bakery/` (사진 출처 `assets/CREDITS.md`). 포트폴리오 카드용 스크린샷은 `py -3 ai-agent/scripts/screenshot.py URL 출력경로 375 800 jpeg 80`(1280은 1280 900)으로 CDP 기기 에뮬레이션을 써서 찍는다 (헤드리스 Edge 창은 약 496px보다 좁아지지 않아 --window-size로는 375px을 찍을 수 없다), JPEG.
- **로컬 미리보기**: `src/index.html`을 브라우저로 바로 열면 된다. 서버가 필요하면 `py -3 -m http.server 8000 -d src`.
- **Python 실행 명령**: 이 PC에서는 `python`이 동작하지 않는다. `py -3`을 쓴다.
- **Git 설정**: 기본 브랜치 `main`. 작성자(`user.name`, noreply `user.email`)와 `core.autocrlf=input`은 smart-voca처럼 저장소 설정으로만 넣었다 (전역 설정 없음). 빈 폴더(`assets/`, `uploads/`, `scripts/`)는 파일이 생기면 추적된다.
