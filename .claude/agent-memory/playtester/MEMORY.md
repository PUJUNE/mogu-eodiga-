# playtester 메모리 — 모구 게임 시리즈 구동 노하우

## 저장소 구조
- 게임마다 개발 폴더(`<게임>/src`, `<게임>/test`, `<게임>/build.py`)와 배포용 단일 HTML(`/<게임>.html`)이 있다. 루트 `index.html`은 런처(카드 목록).
- 모구 어디가만 폴더명이 `game/`이고 배포본이 `모구 어디가.html` + `eodiga.html` 2개.

## 테스트 환경 셋업
- playwright-core는 `game/package.json`의 devDependency뿐 — `game/`에서 `npm install` 후, 스크립트를 `game/` 기준으로 실행하거나 `NODE_PATH=game/node_modules` 지정.
- 브라우저: 기본은 `channel: 'chrome'`, 없으면 `CHROMIUM=<경로>` 환경변수로 실행 파일 지정. 원격 환경에는 `/opt/pw-browsers/chromium`이 있다.
- 실행 형식: `GAME_ROOT=<저장소 루트> CHROMIUM=/opt/pw-browsers/chromium node <게임>/test/browser-test.mjs`
- 각 게임의 http 서버 포트가 다르다(87xx 대역, 충돌 방지용). 새 게임은 안 쓰는 포트를 골라라.

## 테스트 스크립트 관례 (browser-test.mjs 패턴)
- 로컬 http 서버로 저장소 루트를 서빙 → 런처와 게임 폴더 모두 접근 가능.
- `check(이름, 조건)` 헬퍼로 PASS/FAIL 출력, 실패·콘솔에러 수로 exit code 결정.
- 콘솔 에러 수집 시 404는 제외: `!m.text().includes('404')`.
- 데스크톱 뷰포트 1280×720. 터치 테스트는 390×844 + `hasTouch: true, isMobile: true`로 **빌드본 html**을 연다. 터치 감지는 `body.classList.contains('touch')`, 가상패드는 `#vpad`, 버튼은 `PointerEvent`(pointerType:'touch') dispatch로 누른다.
- 스크린샷: 정식 산출물은 `test/shot-*.png`(커밋됨), 임시 디버그는 `test/dbg-*`·`test/pix-*`(gitignore됨).
- FPS 측정: rAF 2초 카운트 스니펫 (game/test/shot.mjs 참조).
- 순수 로직 테스트(level-test.mjs 등)는 `shim.mjs`로 window 셔임 후 Node에서 실행 — import 없는 순수 모듈(rng/difficulty/levels/logic)만 로드 가능.

## 게임별 전역 네임스페이스 (window.XXX)
game(어디가)=MOGU, mogubble=MGB, mogubrick=MBK, mogudiver=MDV, mogudragon=MDG, mogufortress=MFT, mogukingdom=MKR, moguman=MGM, mogumarble=MBL, mogumuscle=MMS, mogunamgeuk=MNG, mogusamguk=MSG, moguski=MSJ, mogusolo=MSL, moguvolley=MGV, motris=MTR, supermogu=SMG

## 디버그 훅 · 상태 주입
- 모든 게임이 `window.<NS>._dbg()`(상태 요약)를 노출하고, 대부분 `_st()`(내부 상태 객체 직접 접근)도 있다.
- 검증은 게임플레이에 맡기지 말고 `_st()`로 결정적 상황을 만든다. 예(mogumuscle): 적을 `P.x + 28`에 배치하고 `spd=0, aggr=0, invT=0, stunT=0`으로 무력화한 뒤 공격 판정 확인. 공격 모션·쿨다운(`atkT`, `cd`)이 남아 있으면 입력이 씹히니 초기화하고 대기 시간을 둔다.
- 태그 오발 방지처럼, 상태 주입 시 위치가 다른 트리거 존(코너 등)에 걸리지 않게 배치할 것.

## 공통 조작·화면 흐름
- 런처 카드: `#card-<게임>` 클릭 → 타이틀. 타이틀에서 Enter로 시작이 일반적.
- 공통 키: ←→↑↓ 이동, Space/Z 공격, X 점프, C 태그(머슬), ESC 일시정지, R 재시작, D 난이도.
- 난이도 4단계 공통 문법: `.diff-btn[data-diff="easy|normal|hard|crazy"]` (이지 ×0.8 / 노말 ×1.0 / 하드 ×1.2 / 크레이지 ×1.42).
- 타이틀 버튼: `#btn-new`(처음부터), `#btn-next`(다음), `#btn-title`, `#btn-series`(런처 복귀 — 복귀 확인은 `page.title() === '모구 게임 시리즈'`).

## 세이브 조작
- localStorage 키는 `<게임>-save-v1` 패턴 (ui.js의 `this.KEY`). 어디가는 `mogu-eodiga-save-v1`.
- 스테이지 강제 해금: 세이브 JSON을 직접 심고 reload. 예(어디가): `{stars: {1:1, …, n-1:1}, bestTime: {}}` 저장 후 `.stage-node` n-1번째 클릭.
- 어디가는 타이틀 → Enter → 월드맵(`.stage-node` 클릭) → 플레이 구조. three.js CDN 로드로 초기 대기 2.5초 정도 필요.

## 주의사항
- three.js 게임(game, mogukingdom)은 CDN 인터넷 연결 필요 — 오프라인이면 로드 실패가 콘솔 에러로 뜬다.
- 화면 전환마다 waitForTimeout이 필요하다 (전환 연출 0.4~2.5초). check 실패 시 대기 부족부터 의심.
