# Retry Failed Pipeline 관련 운영 노트 (STEP 9)

## `retry-failed-pipeline.yml` 변경 (적용됨)

- `secrets.GITHUB_TOKEN` → `secrets.GH_PAT`
  `GITHUB_TOKEN` 으로 `gh workflow run` 하면 대상 워크플로가 트리거되지 않는
  경우가 있다(같은 토큰이 만든 이벤트로는 워크플로 실행이 다시 안 도는 제약).
  → **`GH_PAT` 시크릿이 저장소에 등록돼 있어야 한다.** (repo/workflow scope PAT)
- `sleep 2700` (45분) 제거 + `timeout-minutes: 90 → 45`
  대기 45분간 러너가 그대로 점유돼 과금됐다. "시간 두고 재시도"는
  `weekly-json-update.yml` 의 11:07 KST 백업 스케줄이 이미 담당한다
  (오늘자 데이터가 있으면 `check` 잡이 스킵). 여기서는 즉시 1회만 재시도한다.

## `weekly-json-update.yml` concurrency — 패치 diff (미적용, 보호 파일)

`weekly-json-update.yml` 은 CLAUDE.md 상 직접 수정 금지 대상이라 여기에 diff만 둔다.
저장소 관리자가 검토 후 반영할 것.

### 왜 필요한가

현재:

```yaml
concurrency:
  group: weekday-json-update
  cancel-in-progress: true
```

`cancel-in-progress: true` 면 같은 concurrency group 의 새 실행이 시작될 때
**진행 중이던 실행을 취소**한다. 시나리오:

1. 09:07 스케줄 실행이 (예: KRX 응답 지연으로) 20분째 돌고 있다.
2. 그 사이 무언가가 같은 group 의 새 실행을 시작한다
   (백업 스케줄과는 group 이 같아 안전하지만, `retry-failed-pipeline.yml` 이나
    슬랙 재시작 버튼의 `workflow_dispatch` 재실행이 겹칠 수 있다).
3. 진행 중이던 정상 실행이 취소되고, 재시도 실행만 남는다.

즉 재시도 메커니즘이 정상 실행을 죽일 수 있다.

### diff

```diff
 concurrency:
   group: weekday-json-update
-  cancel-in-progress: true
+  # 재시도(dispatch)나 백업 스케줄이 진행 중인 정상 실행을 죽이지 않도록 false.
+  # 중복 실행은 check 잡의 "오늘자면 스킵" 가드가 걸러낸다.
+  cancel-in-progress: false
```

`cancel-in-progress: false` 면 새 실행이 **큐에서 대기**한다. 앞 실행이 끝나고
데이터가 이미 오늘자면, 뒤 실행의 `check` 잡이 `skip=true` 로 빠지므로
중복 파이프라인이 실제로 두 번 도는 일은 없다.

### 반영 후 확인

- Actions 탭에서 `weekly-json-update.yml` 이 여전히 스케줄로 도는지
- 09:07 과 11:07 이 겹칠 때 뒤 실행이 취소가 아니라 스킵으로 끝나는지
