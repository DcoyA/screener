# 캐시 즉시 무효화 훅 (`/api/revalidate`)

STEP 8에서 추가. 데이터 파이프라인이 새 스냅샷을 Supabase에 적재한 뒤,
`/screener` 등 요청 시점에 Supabase를 읽는 화면의 캐시를 **즉시** 비운다.

## 훅을 안 붙여도 되는 이유 (먼저 읽을 것)

이 훅은 **선택**이다. 붙이지 않아도:

- `app/lib/stocksData.js`의 `unstable_cache`가 `revalidate: 3600`이라 **최대 1시간**
  뒤 자동으로 다시 조회한다.
- `weekly-json-update.yml`이 `app/data/*.json`을 커밋·push 하면 Vercel이 재배포하고,
  재배포 시 전체 데이터 캐시가 초기화된다. 실제로는 이 재배포가 갱신의 주 경로다.

즉 훅의 역할은 "Supabase 적재 완료 ~ Vercel 재배포 반영" 사이의 수 분을 메우는 것뿐이다.
일 1회 갱신되는 데이터라 이 지연은 실무상 문제되지 않는다. **붙이지 않는 선택도 안전하다.**

## 붙이는 경우

### 1. 시크릿 생성·등록

임의의 긴 랜덤 문자열을 만든다:

```bash
openssl rand -hex 32
```

- **Vercel**: Project → Settings → Environment Variables → `REVALIDATE_SECRET` = 위 값
  (Production. 재배포해야 반영됨)
- **GitHub**: Repo → Settings → Secrets and variables → Actions → New repository secret
  → `REVALIDATE_SECRET` = **같은 값**

`REVALIDATE_SECRET`이 없으면 `/api/revalidate`는 503을 반환하고 아무 것도 무효화하지 않는다.

### 2. 워크플로 스텝 추가

> ⚠ `weekly-json-update.yml`은 CLAUDE.md에서 직접 수정 금지 대상이라 여기서는
> **붙여넣을 diff만** 제시한다. 저장소 관리자가 직접 반영할 것.

`.github/workflows/weekly-json-update.yml`의 `update` job, **`Push changes` 스텝 바로 다음**에
아래 스텝을 추가한다:

```yaml
      - name: Push changes
        run: git push origin main

      # ↓↓↓ 여기부터 추가 ↓↓↓
      - name: Revalidate production cache
        # 캐시 갱신 실패가 데이터 수집 성공을 무효화해선 안 된다.
        continue-on-error: true
        env:
          REVALIDATE_SECRET: ${{ secrets.REVALIDATE_SECRET }}
        run: |
          if [ -z "$REVALIDATE_SECRET" ]; then
            echo "REVALIDATE_SECRET 미설정 - revalidate 훅 건너뜀(최대 1시간 뒤 자동 갱신됨)"
            exit 0
          fi
          curl -sS -X POST "https://<프로덕션-도메인>/api/revalidate" \
            -H "x-revalidate-secret: $REVALIDATE_SECRET" \
            -H "content-type: application/json" \
            -d '{"tags":["stocks"]}' \
            -w "\nHTTP %{http_code}\n"
      # ↑↑↑ 여기까지 추가 ↑↑↑
```

`<프로덕션-도메인>`을 실제 배포 도메인으로 바꾼다.

## 수동 검증

```bash
curl -sS -X POST "https://<프로덕션-도메인>/api/revalidate" -H "x-revalidate-secret: $REVALIDATE_SECRET" -H "content-type: application/json" -d '{"tags":["stocks"]}'
```

기대 응답: `{"ok":true,"revalidated":["stocks"],"at":"..."}`

## 계약 (route.js)

| 조건 | 응답 |
|---|---|
| `REVALIDATE_SECRET` 미설정 | `503` |
| `x-revalidate-secret` 헤더 불일치/누락 | `401` |
| body가 `{tags:[...]}` 아님 / 빈 배열 | `400` |
| 화이트리스트(`["stocks"]`) 밖 태그 | `400` |
| 정상 | `200` `{ok, revalidated, at}` + 서버 로그 |
| `GET` 등 | `405` |

시크릿은 **헤더로만** 받는다(쿼리스트링은 액세스 로그에 남음).
