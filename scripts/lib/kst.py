"""KST(한국 표준시, UTC+9) 날짜/요일 계산 공용 헬퍼.

GitHub Actions 러너는 UTC로 돈다. `datetime.now()`를 그대로 쓰면 KST 05~08시대
실행 시 날짜가 하루 밀리거나 요일이 어긋난다(예: KST 월요일 00~08시는 UTC로
아직 일요일). 파이프라인 스크립트에서 "오늘 날짜"/"오늘 요일"이 필요하면 항상
이 모듈을 거친다 - datetime.now()/date.today()를 직접 쓰지 않는다.
"""

from datetime import datetime, timedelta, timezone

KST = timezone(timedelta(hours=9))


def kst_now() -> datetime:
    return datetime.now(KST)


def kst_today_str() -> str:
    """"YYYY-MM-DD" 형식의 오늘(KST) 날짜."""
    return kst_now().strftime("%Y-%m-%d")


def kst_weekday() -> int:
    """0=월 1=화 2=수 3=목 4=금 5=토 6=일 (KST 기준)."""
    return kst_now().weekday()


def kst_last_business_day() -> str:
    """오늘(KST)보다 앞선 가장 최근 평일(월~금)을 "YYYY-MM-DD"로 반환한다.

    공휴일은 고려하지 않는다 - 주말만 건너뛴다.
    """
    d = kst_now()
    while True:
        d -= timedelta(days=1)
        if d.weekday() < 5:
            return d.strftime("%Y-%m-%d")
