#!/usr/bin/env bash
# 지수(계단식) 백오프 재시도 (STEP 9, Q2). nick-fields/retry@v3 대체.
#   nick-fields/retry v3에는 백오프 파라미터가 없어(retry_wait_seconds 단일 고정값)
#   1분/5분/20분 구간을 만들 수 없다. 그래서 셸 루프로 교체한다.
#
# 사용: retry-with-backoff.sh <command> [args...]
#
# 환경변수:
#   RETRY_DELAYS   재시도 사이 대기(초) 공백 구분 목록. 기본 "60 300 1200".
#                  항목 수 + 1 = 최대 시도 횟수. 지수식 계산이 아니라 명시 배열.
#   RETRY_TIMEOUT  각 시도의 최대 실행 시간(초). 기본 1800. 0이면 무제한.
#   RETRY_JITTER   대기에 더할 지터 최대(초). 기본 30. 동시 실행 충돌 회피.
#
# 종료 코드 분류:
#   0            성공 → 즉시 종료
#   그 외 비정상  재시도. 대기 소진 시 마지막 코드로 종료.
#   TODO(STEP 9): 대상 스크립트가 "재시도 가능(75) vs 치명(1)"을 종료 코드로
#     분리하지 않는다(collect_flow_signals.py/collect_disclosures.py는 대부분
#     sys.exit(1) 또는 미처리 예외 → 1). 지금은 0이 아니면 전부 재시도한다.
#     스키마 불일치/secret 누락 같은 로직 오류도 3회 재시도하며 최대 26분을
#     낭비할 수 있다. 스크립트가 네트워크/타임아웃/HTTP 429·5xx를 75로,
#     로직 오류를 1로 나누도록 고치면 아래에 `[ "$code" -eq 1 ] && exit 1` 분기를 넣는다.

set -uo pipefail

if [ "$#" -lt 1 ]; then
  echo "usage: $0 <command> [args...]" >&2
  exit 2
fi

read -ra DELAYS <<< "${RETRY_DELAYS:-60 300 1200}"
TIMEOUT="${RETRY_TIMEOUT:-1800}"
JITTER_MAX="${RETRY_JITTER:-30}"
MAX_ATTEMPTS=$(( ${#DELAYS[@]} + 1 ))

attempt=1
while true; do
  echo "::group::attempt ${attempt}/${MAX_ATTEMPTS}: $*"
  set +e
  if [ "$TIMEOUT" -gt 0 ]; then
    timeout "$TIMEOUT" "$@"
  else
    "$@"
  fi
  code=$?
  set -e
  echo "::endgroup::"

  if [ "$code" -eq 0 ]; then
    echo "attempt ${attempt}/${MAX_ATTEMPTS}, exit=0 - 성공"
    exit 0
  fi

  if [ "$attempt" -ge "$MAX_ATTEMPTS" ]; then
    echo "attempt ${attempt}/${MAX_ATTEMPTS}, exit=${code} - 재시도 소진, 실패"
    exit "$code"
  fi

  base="${DELAYS[$((attempt - 1))]}"
  jitter=0
  if [ "$JITTER_MAX" -gt 0 ]; then
    jitter=$(( RANDOM % (JITTER_MAX + 1) ))
  fi
  wait=$(( base + jitter ))
  # 마지막(3번째) 대기는 러너 과금 시간을 그대로 소모한다. RETRY_DELAYS로 조정 가능.
  echo "attempt ${attempt}/${MAX_ATTEMPTS}, exit=${code}, next wait=${wait}s (base ${base} + jitter ${jitter})"
  sleep "$wait"
  attempt=$(( attempt + 1 ))
done
