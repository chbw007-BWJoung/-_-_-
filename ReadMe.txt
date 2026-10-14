노거수회 스터디 앱 – 배포 방법 (관리자 수정 → 모두에게 반영)
==========================================================

※ 끌어다 놓기(Netlify Drop)로 올리면 담당자 저장 기능이 동작하지 않습니다.
  아래처럼 GitHub를 거쳐 한 번만 연결해 두면, 이후에는 관리자가 앱에서 고치는 즉시
  모든 회원에게 반영됩니다(다시 배포할 필요 없음).

1. GitHub에 파일 올리기
   - github.com 가입/로그인 → 오른쪽 위 [+] → New repository
   - 이름 예: noguesu-study  (Private 선택 가능) → Create repository
   - 화면의 "uploading an existing file" 링크 클릭
   - zip을 푼 폴더 안의 내용 전체(icons, netlify 폴더 포함)를 끌어다 놓기 → Commit changes

2. Netlify에서 연결
   - app.netlify.com 로그인 → Add new project(또는 Add new site) → Import an existing project
   - GitHub 선택 → 방금 만든 저장소 선택 → 설정은 그대로 두고 Deploy

3. 관리자 비밀번호 정하기 (필수)
   - 프로젝트 화면 → Project configuration(Site configuration) → Environment variables
   - Add a variable → Key: EDIT_PIN   Value: 원하는 비밀번호
   - Deploys 메뉴 → Trigger deploy → Deploy project (비밀번호 적용을 위해 한 번 재배포)

4. 사용
   - 배포된 주소(https://○○○.netlify.app)를 단톡방에 공유
   - 회원: 주소 열기 → 홈 화면에 추가 → 일정 보기 (수정 버튼 없음)
   - 관리자: 오른쪽 위 🔒 → 비밀번호 입력 → 담당자 이름을 눌러 수정 → 저장
     (회원 화면에는 앱을 다시 열거나 1분 안에 자동 반영)

비밀번호를 바꾸려면 3번에서 EDIT_PIN 값을 바꾸고 재배포하세요.
기존에 로그인해 둔 관리자는 다음 저장 때 다시 로그인하라는 안내가 나옵니다.
