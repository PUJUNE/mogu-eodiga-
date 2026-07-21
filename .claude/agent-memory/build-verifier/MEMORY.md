# build-verifier 메모리 — 빌드 파이프라인 노하우

## 빌드 구조
- 각 게임 폴더의 `build.py`가 `<게임폴더>/index.html` + `src/*.js` + 에셋을 병합해 저장소 루트에 단일 배포 HTML을 생성한다. 더블클릭(file://) 실행 가능해야 한다.
- 특례: `game/build.py`는 산출물을 2개 만든다 — `모구 어디가.html` + `eodiga.html`(런처 링크용 ASCII 파일명, 동일 내용).

## build.py 동작 방식 (전 게임 공통 패턴)
1. 에셋 → base64 데이터 URI로 인코딩해 `<script>window.<NS> = { ASSETS: … };</script>` 블록을 regex(re.S)로 치환.
2. `order` 리스트 순서대로 src 모듈을 읽어 각각 `{ … }` 블록 스코프로 감싸 병합 (파일 간 최상위 const 충돌 방지) → 연속된 `<script src="src/…">` 태그 전체를 병합 스크립트 하나로 치환.
3. 산출물 경로와 KB 크기 출력.

## 검증 체크리스트
- `python3 <게임>/build.py` 정상 종료 + 크기 출력 확인 (이전 빌드 대비 급감하면 병합 누락 의심).
- 산출 HTML에 `src="src/` 참조가 남아 있으면 실패 (regex 미매치 신호).
- `data:image/png;base64,` 내장 확인. 에셋 regex의 네임스페이스(`window.MGB` 등)가 index.html과 일치해야 치환된다 — 네임스페이스 바꾸면 build.py regex도 같이 바꿔야 함.
- src에 파일을 추가하면 **build.py의 order 목록과 index.html의 script 태그 양쪽**에 등록해야 한다. 한쪽만 하면 개발판/빌드본 동작이 달라진다.
- 블록 스코프 병합 때문에 모듈 간 공유는 반드시 `window.<NS>` 경유여야 한다. 최상위 선언을 다른 파일에서 참조하는 코드는 빌드본에서만 깨진다.
- ES `import`/`export`는 쓰지 않는 구조 — 산출물에 남아 있으면 잘못된 것.
- 산출 HTML을 http 서버로 열어 콘솔/페이지 에러 0건 확인 (각 게임 browser-test.mjs 후반부의 빌드본·터치 검증 구간 재사용).
- 런처 `index.html`에 `#card-<게임>` 카드가 있고 href가 산출물 파일명과 일치하는지 확인 (카드 20장, 검색창 있음).

## 게임별 특이사항
- mogubble 등 일부 게임은 자기 에셋 없이 `game/assets/mogu-icon.png`를 재사용 — build.py의 에셋 경로 기준이 저장소 루트(HERE.parent)다.
- three.js 게임(game=어디가, mogukingdom)은 CDN 로드라 빌드본도 인터넷 필요. 나머지는 완전 오프라인 동작이 원칙.
- 세이브 파일(`*_세이브*.json`)과 `test/dbg-*`, `test/pix-*`, `working log/`는 gitignore 대상 — 커밋 전 status에 섞여 있으면 안 된다.
