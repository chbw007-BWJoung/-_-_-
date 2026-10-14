# 노거수회 수목 스터디

2026~2027년 노거수회 수목 스터디 일정을 확인하고 발표 담당자를 관리하는 설치형 웹 앱(PWA)입니다.

## 주요 파일
- `index.html`: 앱 화면과 일정 데이터
- `manifest.webmanifest`: 홈 화면 설치 정보
- `sw.js`: 오프라인 앱 셸 캐시
- `netlify/functions/assignees.mjs`: 담당자 공용 저장 API
- `netlify.toml`: Netlify 배포 및 Functions 설정

## GitHub에 올리기
ZIP 파일 자체가 아니라 압축을 푼 **폴더 안의 파일 전체**를 저장소 최상위에 올립니다. `index.html`, `netlify.toml`, `netlify/functions/`가 저장소 최상위 기준으로 보여야 합니다.

## Netlify 배포
1. Netlify에서 이 GitHub 저장소를 Import합니다.
2. `netlify.toml`의 설정을 사용합니다. 별도 빌드 명령은 필요하지 않습니다.
3. Netlify 환경 변수에 `EDIT_PIN`을 설정합니다.
4. 배포(Deploy)를 실행한 뒤 사이트에서 관리자 로그인과 담당자 저장을 시험합니다.

## 보안 및 운영 메모
- `EDIT_PIN`은 Netlify 환경 변수에만 설정하고, HTML/JavaScript 또는 GitHub 파일에 적지 마세요.
- 담당자 목록은 Netlify Blobs에 저장됩니다. 브라우저의 로컬 저장소만으로는 모든 회원에게 변경 사항이 공유되지 않습니다.
- `EDIT_PIN`을 바꾼 뒤에는 재배포하고, 관리자 저장 기능이 새 비밀번호로 동작하는지 확인하세요.
- 일정 데이터는 `index.html`의 `BASE` 배열에 들어 있습니다. 회차 번호가 42 다음에 44로 표시되는 부분은 원본 일정의 의도를 확인하기 전까지 임의로 고치지 않았습니다.
