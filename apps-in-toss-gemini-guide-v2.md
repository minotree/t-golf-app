# 앱인토스 및 AI 개발 도구 가이드 (v3)

개정: 2026-10-19. 기존 v2의 파일명은 링크 호환을 위해 유지한다.

이 문서는 선택 가능한 개발 도구와 플랫폼 준비 절차를 설명한다. 앱 요구사항은 `golf-app-prd-trd-spec.md`, 최신 합의·실행 순서는 `progress.md`, 작업 승인 규칙은 `AGENTS.md`를 따른다. 아래 도구의 설치·연결·명령 실행을 완료했다는 뜻은 아니다.

## 1. 앱 분석 엔진과 개발 도구

| 역할 | 현재 방향 | 제약 |
| --- | --- | --- |
| 사용자 영상 분석 | 기기 내 MediaPipe Pose Landmarker 검증 | 골프 지표 정확도·iPhone 성능 검증 필요 |
| 앱 UI·플랫폼 | Ionic React / Vite, 이후 앱인토스·Capacitor | 플랫폼별 권한·SDK·실행 지원 별도 확인 |
| 코드 작성 보조 | 현재 개발 환경 또는 선택적으로 Aider 등 | 모델 API 비용·외부 전송 정책을 별도로 확인 |
| 데이터 | Supabase에 분석 결과만 저장 | 영상 업로드 없음, 로그인·RLS 필요 |

Gemini·Qwen은 앱 분석을 위해 필요한 의존성이 아니다. 개발 도구로 채택하더라도 사용자 영상을 외부 LLM에 보내는 기능을 추가하지 않는다.

## 2. 앱인토스 공식 자료와 지원 범위

- [llms.txt](https://developers-apps-in-toss.toss.im/llms.txt)는 문서 색인이다. 관련 개별 문서를 읽고 실제 SDK 타입·샌드박스 동작을 확인한다. 문서 제공만으로 AI 생성 코드의 정확성이나 최신성이 보장되지는 않는다.
- [Console MCP](https://developers-apps-in-toss.toss.im/guide/console-mcp.md)는 인증 후 콘솔 조회·미니앱·검수·번들 등 작업을 지원한다. 문서 검색을 위한 [공식 AX 도구](https://github.com/toss/apps-in-toss-ax)와 역할을 구분한다. 현재 프로젝트에 연결한 상태는 아니다.
- 콘솔 연결 시 계정·워크스페이스·권한을 확인한다. 배포·제출·롤백·외부 알림·운영 변경은 프로젝트 승인 규칙을 따른다. 연결 자체가 실행 승인은 아니다.
- 프로젝트 생성은 최신 공식 튜토리얼을 확인한 후 실행한다. 기존 v2의 `npx create-ait-app`은 검증되지 않은 명령이므로 실행 예시에서 제외한다.
- 기존 웹 프로젝트 SDK 연동 절차는 공식 색인의 [웹 연동 문서](https://developers-apps-in-toss.toss.im/ai-vibe-coding/tutorials/webview.md)를 기준으로 한다. 이번 검토에서는 세부 페이지를 가져오지 못했으므로 설치 버전·초기화 명령은 앱인토스 단계에서 재확인한다.

카메라 권한이 존재하는 것과 연속 영상 녹화·MediaRecorder·WASM·Web Worker·외부 모델 로딩 지원은 별개다. 실제 토스 iOS/Android 환경에서 다음을 확인해야 한다.

1. 영상 촬영·재생·메모리·권한·백그라운드 처리.
2. 모델 다운로드·초기화·프레임 추론·취소 및 처리 시간.
3. 토스 로그인 서버 검증, Supabase 사용자 식별·권한 연결.
4. 모델 파일·외부 통신·개인정보 고지와 서비스 출시 정책.

지원이 확인되지 않은 기능은 대안을 검증하고 범위를 합의한다. PWA 구현을 앱인토스 호환 완료로 간주하지 않는다.

## 3. 모델 선택·비용·한도

### 로컬 모델

[Qwen2.5-Coder 공식 목록](https://ollama.com/library/qwen2.5-coder)의 크기는 0.5B·1.5B·3B·7B·14B·32B다. 기존 `16b` 예시는 잘못되어 제거했다. 선택 시 실제 태그·라이선스·양자화·메모리 요구량을 확인한다.

로컬 실행은 외부 API 호출료를 줄일 수 있지만 장비·전력·다운로드 비용과 속도·메모리 제약이 있다. 다운로드 후 오프라인 사용 가능 여부도 구성에 따라 검증한다. 이 프로젝트의 PC GPU·RAM과 Ollama 설치 상태는 아직 확인하지 않았다.

### 클라우드 모델

Gemini API의 무료 구간·가격·가용 모델은 모델·프로젝트·지역·결제 티어에 따라 확인한다. 소비자용 Gemini 구독과 개발자 API 과금·쿼터는 별개로 확인해야 한다.

| 개념 | 확인 사항 |
| --- | --- |
| RPM | 분당 요청 한도. 선택한 모델·프로젝트의 실제 값 확인 |
| TPM | 분당 토큰 한도. 입력·출력 등 집계 범위는 제공사 정의 확인 |
| RPD | 일일 요청 한도와 초기화 기준 확인 |
| 컨텍스트 | 단일 요청의 입력·출력 예산. TPM·비용·정확성과 별개 |

v2의 15 RPM·1,500 RPD·50 RPD·100만~200만 컨텍스트를 공통 보장값으로 사용하지 않는다. [공식 한도 안내](https://ai.google.dev/gemini-api/docs/rate-limits)와 AI Studio에 표시되는 실제 프로젝트 한도를 확인한다.

Gemini 2.0 Flash는 [공식 종료 안내](https://ai.google.dev/gemini-api/docs/deprecations)에 따라 2026-06-01 종료되어 실행 예시에서 제거했다. Gemini 1.5 및 오래된 Claude 예시도 현재 권장 모델로 고정하지 않는다. 도입 시 공식 모델 목록·가격·종료 일정·개발 도구 호환성을 함께 확인한다.

무료 API의 데이터 이용 조건·보관 정책도 확인한다. 키·개인 환경 파일·고객 영상·민감한 로그는 프롬프트나 저장소에 넣지 않는다. 유료 전환은 명시적 승인이 필요하다.

## 4. 선택 사항: Aider 사용

Aider는 여러 모델 제공사와 연동할 수 있지만 모든 모델이 동일한 편집·도구 기능을 지원하지는 않는다. 아래는 로컬 Ollama 서버와 해당 모델이 준비된 경우의 예시다. 설치·성능 검증을 수행하지 않았다.

```powershell
aider --model ollama_chat/qwen2.5-coder:14b --no-auto-commits --read AGENTS.md --read progress.md
```

제공사 접두어·모델 태그·옵션은 설치한 Aider 버전의 도움말과 [Ollama 연동 문서](https://aider.chat/docs/llms/ollama.html)를 확인한다. 모델 크기는 PC에 맞춰 선택한다.

선택적으로 사용할 `.aider.conf.yml` 예시이며 실제 설정 파일을 생성한 것은 아니다.

```yaml
model: ollama_chat/qwen2.5-coder:14b
encoding: utf-8
git: true
auto-commits: false
architect: false
read:
  - AGENTS.md
  - progress.md
```

- [공식 YAML 설정](https://aider.chat/docs/config/aider_conf.html)과 [Git 연동](https://aider.chat/docs/git.html)을 따른다. 자동 커밋을 끄더라도 사용자의 별도 커밋·푸시 승인이 필요하다.
- Architect 모드는 필요할 때 선택하고 editor 모델·편집 방식·추가 요청 비용을 확인한다. diff 모드와 architect 모드를 동시에 강제하지 않는다.
- `--read`는 로컬 문서를 컨텍스트로 제공한다. URL을 읽어 영구 학습하는 기능으로 설명하지 않는다. 웹 문서는 [명령 안내](https://aider.chat/docs/usage/commands.html)의 `/web URL` 또는 검토한 로컬 사본을 사용한다.
- Repo Map·대화 요약·캐시·읽기 파일의 포함 방식은 도구 설정에 따라 달라진다. 전체 저장소가 매 요청에 무조건 전송된다고 가정하지 않는다.
- 큰 컨텍스트보다 관련 문서·파일만 제공한다. `node_modules`, `dist`, 개인 환경 파일, 영상은 제외한다.
- 자동 검사 실패·편집 재시도·Architect/editor 호출·요약 등은 요청량을 늘릴 수 있다. 실제 사용량과 오류 유형을 확인한 뒤 요청 크기·재시도 횟수를 조정한다.
- API 키는 승인된 로컬 비밀 관리 방식으로 설정한다. PowerShell에 Bash `export` 예시를 그대로 사용하지 않는다.

## 5. 채택 전 확인 목록

- [ ] 사용 도구·정확한 버전·모델·라이선스·메모리·실제 비용 확인.
- [ ] 프로젝트 지침을 명시적으로 읽히고 자동 커밋 비활성화.
- [ ] 비밀·개인정보·사용자 영상의 외부 전송 제외 확인.
- [ ] 앱인토스 단계에서 최신 SDK·권한·인증·모델 실행 지원 확인.

확인일: 2026-10-19. 링크는 근거로 제공하며 도구 설치나 운영 실행은 수행하지 않았다.
