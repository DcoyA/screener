"use client";

import Link from "next/link";
import { useState } from "react";
import SiteHeader from "../components/SiteHeader";

const quickCards = [
  {
    id: "ranking",
    title: "랭킹",
    desc: "재무 / 밸류 / 유동성이 괜찮은 종목을 넓게 찾는 1차 후보 단계",
  },
  {
    id: "risk",
    title: "리스크",
    desc: "부채, 이익 안정성, 유동성 부족, 주의 신호를 먼저 걸러내는 단계",
  },
  {
    id: "final",
    title: "실전투자",
    desc: "현재 시장 국면까지 반영해 실제로 검토할 후보만 다시 좁히는 단계",
  },
  {
    id: "alternative",
    title: "대안투자",
    desc: "개별 종목보다 ETF, 금, 테마형, 분산형 접근이 더 적절할 때 보는 메뉴",
  },
  {
    id: "report",
    title: "리포트",
    desc: "이번 주 시장 흐름, 상위 후보 변화, 핵심 포인트를 묶어 보는 요약 자료",
  },
  {
    id: "email",
    title: "프리미엄 이메일",
    desc: "사이트를 매일 직접 돌지 않아도 핵심 변화만 이메일로 받아보는 기능",
  },
];

const steps = [
  {
    id: "step1",
    step: "Step 1",
    title: "랭킹에서 1차 후보 찾기",
    summary:
      "랭킹은 오늘 기준으로 괜찮아 보이는 종목을 넓게 발견하는 단계다. 여기서 바로 사는 게 아니라, 후보군을 추리는 것이 목적이다.",
    always: [
      "랭킹은 매수 확정 페이지가 아니라 시작점이다.",
      "상위 1개만 보는 게 아니라, 후보 3~10개 정도를 추리는 용도로 보는 게 좋다.",
      "점수는 종합 해석용이지, 단독 매수 버튼이 아니다.",
    ],
    details: [
      {
        title: "랭킹 숫자는 어떻게 봐야 하나",
        body: [
          "기본 보기: 전체 후보를 넓게 보는 기본 모드",
          "저평가 중심 보기: PER, PBR이 낮은 종목을 더 우선해서 보고 싶을 때",
          "안정성 중심 보기: 부채비율, 이익 안정성을 더 중요하게 보고 싶을 때",
          "유동성 중심 보기: 거래대금이 충분한 종목만 우선 보고 싶을 때",
        ],
      },
      {
        title: "종합점수 해석",
        body: [
          "밸류: PER, PBR 등 저평가 여부",
          "퀄리티: 영업이익률, ROE, 이익 안정성",
          "안전성: 부채비율, 자본 상태",
          "시장성: 시총, 거래대금, 유동성",
          "변화: 최근 성장률, 실적 흐름",
          "점수가 높다는 건 후보로 볼 이유가 많다는 뜻이지, 곧바로 매수해도 된다는 뜻은 아니다.",
        ],
      },
      {
        title: "숫자 해석 예시",
        body: [
          "상승여력 0~10%: 적정가 대비 차이가 작아 매력 낮을 수 있음",
          "상승여력 10~25%: 추가 검토 가치가 있는 구간",
          "상승여력 25% 이상: 숫자상 매력은 크지만 함정일 수도 있으니 리스크 확인 필수",
          "부채비율 100% 이하: 비교적 안정적으로 해석되는 경우가 많음",
          "부채비율 100~200%: 업종 특성 확인 필요",
          "부채비율 200% 이상: 재무 리스크 경고 구간으로 보는 편이 일반적",
          "PER 5~15배: 저평가로 볼 여지가 있음 / 25배 이상: 성장 기대가 크거나 과열일 수 있음",
          "PBR 1배 이하: 자산가치 대비 저평가로 보일 수 있음 / 3배 이상: 프리미엄 기대가 많이 반영됐을 가능성",
          "아래 수치는 절대 기준이 아니라, 숫자를 읽는 감을 잡기 위한 참고 예시입니다.",
        ],
      },
      {
        title: "실제로 여기서 할 일",
        body: [
          "랭킹 1~30위권을 넓게 훑는다",
          "상승여력, 부채비율, 거래대금, PER/PBR을 같이 본다",
          "너무 비싸 보이거나, 너무 부채가 높은 종목은 일단 보류한다",
          "관심 가는 종목 3~10개 정도를 다음 단계로 넘긴다",
        ],
      },
    ],
    conclusion: "랭킹은 시작점이다. 바로 매수 버튼이 아니다.",
  },
  {
    id: "step2",
    step: "Step 2",
    title: "리스크에서 탈락 후보 걸러내기",
    summary: "좋아 보이는 종목을 찾기보다, 먼저 버려야 하는 종목을 찾는 단계다.",
    always: [
      "랭킹 상위라도 리스크가 높으면 실전 진입 전에 한 번 더 멈춰야 한다.",
      "리스크 페이지는 숫자가 좋아 보이는 함정 종목을 걸러내는 역할이 크다.",
    ],
    details: [
      {
        title: "리스크 레벨 해석",
        body: [
          "낮음: 현재 기준으로 뚜렷한 재무/유동성 경고가 적음",
          "보통: 바로 탈락은 아니지만 꼭 체크포인트를 확인해야 함",
          "주의: 숫자가 좋아 보여도 실전 진입은 매우 신중해야 함",
        ],
      },
      {
        title: "왜 랭킹 상위인데 리스크가 높을 수 있나",
        body: [
          "PBR이 낮아 보여도 부채가 매우 높을 수 있음",
          "최근 이익이 꺾였는데 싸 보이기만 할 수 있음",
          "거래대금이 적어 빠져나오기 어려울 수 있음",
          "유상증자, 적자전환, 차입금 증가 같은 경고 신호가 있을 수 있음",
        ],
      },
      {
        title: "리스크에서 실제로 봐야 할 것",
        body: [
          "부채비율 200% 이상 여부",
          "영업이익 / 순이익 적자 여부",
          "거래대금 부족 여부",
          "최근 공시/뉴스 불확실성",
          "자본잠식, 대규모 차입, 유상증자 가능성",
        ],
      },
    ],
    conclusion: "좋아 보여도 리스크가 높으면, 실전투자 전에 먼저 멈추는 게 맞습니다.",
  },
  {
    id: "step3",
    step: "Step 3",
    title: "실전투자에서 현재 국면 기준 최종 후보 좁히기",
    summary:
      "랭킹이 종목의 기본 체력을 보는 단계라면, 실전투자는 지금 들어갈 만한 구간인지 다시 보는 단계다.",
    always: [
      "실전투자는 랭킹 결과를 그대로 재출력하는 페이지가 아니다.",
      "업종 흐름, 뉴스 플래그, 리스크 수준, 진입 타이밍을 다시 반영해서 후보를 좁힌다.",
    ],
    details: [
      {
        title: "왜 랭킹과 결과가 다를 수 있나",
        body: [
          "랭킹은 1차 후보 생성",
          "실전투자는 현재 시장 국면 반영",
          "그래서 랭킹 상위 종목도 제외될 수 있고, 반대로 순위는 조금 낮아도 현재 국면상 매수 후보가 될 수 있다",
        ],
      },
      {
        title: "매수 후보 / 관찰 후보 / 제외 후보 해석",
        body: [
          "매수 후보: 지금도 추가 검토 가치가 있는 종목",
          "관찰 후보: 종목 체력은 괜찮지만 지금은 타이밍 또는 리스크를 더 봐야 하는 종목",
          "제외 후보: 현재 국면에서는 실전 매수 대상으로 보기 어려운 종목",
        ],
      },
      {
        title: "여기서 사용자에게 필요한 행동",
        body: [
          "매수 후보만 보는 게 아니라 관찰 후보도 같이 비교",
          "랭킹 상위인데 제외된 종목은 왜 제외됐는지 읽어보기",
          "실전투자는 찍어주는 페이지가 아니라 이유를 읽는 페이지라고 생각하기",
        ],
      },
    ],
    conclusion: "실전투자는 좋은 회사를 찾는 단계가 아니라, 지금 볼 만한 후보만 남기는 단계입니다.",
  },
  {
    id: "step4",
    step: "Step 4",
    title: "종목 상세 / 뉴스 / 공시 확인",
    summary:
      "마음에 드는 종목이 나와도 바로 사지 말고, 최근 뉴스와 공시, 실적 흐름까지 확인하는 단계다.",
    always: [
      "실전투자에서 후보가 됐다고 바로 진입하면 안 된다.",
      "최근 뉴스, 공시, 업종 분위기, 최근 급등/급락 여부까지 보고 판단해야 한다.",
    ],
    details: [
      {
        title: "종목 상세에서 볼 것",
        body: [
          "최근 실적 흐름",
          "적정가 / 상승여력",
          "부채와 이익 상태",
          "최근 거래대금",
          "최근 급등 여부",
        ],
      },
      {
        title: "뉴스 / 공시 확인 포인트",
        body: [
          "최근 악재성 공시가 없는지",
          "업황 변화가 큰지",
          "기대만 앞서고 실적이 비어 있는지",
          "실적 발표 / 수주 / 증자 / 소송 등 중요한 이벤트 있는지",
        ],
      },
    ],
    conclusion: "여기까지 보고도 이해가 안 되면, 그 종목은 안 사는 게 맞습니다.",
  },
  {
    id: "step5",
    step: "Step 5",
    title: "최종 판단 / 기록",
    summary:
      "실제 매수는 본인 판단이고, 가능하면 기록을 남겨서 나중에 복기할 수 있게 만드는 단계다.",
    always: [
      "최종 매수는 사용자 본인 책임",
      "가능하면 한 번에 몰빵보다 분할 접근 검토",
      "왜 이 종목을 보게 됐는지, 어떤 숫자를 보고 판단했는지 기록해두면 나중에 도움이 됨",
      "다시 볼 기준(실적 발표, 리스크 변화, 뉴스)을 정해두면 좋음",
    ],
    details: [],
    conclusion: "사이트는 후보를 도와주지만, 책임지는 버튼은 대신 눌러주지 않습니다.",
    images: [],
  },
];

const menuGuides = [
  {
    id: "alternative",
    title: "대안투자 메뉴는 언제 쓰는가",
    summary: "대안투자는 개별 종목보다 ETF / 금 / 자산군 분산 접근이 더 나은 상황에서 보는 메뉴다.",
    body: [
      "개별 종목을 고르기보다 자산군 자체를 선택하고 싶을 때",
      "주식보다 변동성이 낮거나 성격이 다른 대안을 찾고 싶을 때",
      "특정 업종을 직접 고르기보다 섹터 ETF로 접근하고 싶을 때",
      "금, 채권형, 테마형, 우주, 반도체, 배당형 등으로 분산 관점을 보고 싶을 때",
    ],
    conclusion: "대안투자는 종목을 못 고르겠을 때가 아니라, 종목보다 자산군이 더 중요할 때 보는 메뉴입니다.",
  },
  {
    id: "report",
    title: "리포트는 어떻게 봐야 하나",
    summary: "리포트는 당장 종목 하나를 사기 위한 페이지가 아니라, 이번 주 시장 흐름과 후보군 분위기를 묶어 보는 자료다.",
    body: [
      "추천 읽는 순서: 시장 메모 → 상위 후보 변화 → 리스크 변화 → 주간 핵심 포인트",
      "리포트는 종목 추천서가 아니다",
      "시장이 어떻게 바뀌었는지, 어떤 후보군이 강해졌는지, 무엇을 조심해야 하는지 보는 자료다",
      "매수 판단 전 참고 자료로 쓰는 게 맞다",
    ],
    conclusion: "리포트는 종목 추천서가 아니라, 시장 해석 보조 자료입니다.",
  },
  {
    id: "email",
    title: "프리미엄 이메일은 왜 신청하나",
    summary: "사이트를 매일 직접 돌지 않아도, 핵심 변화만 이메일로 받아보고 싶은 사람을 위한 기능이다.",
    body: [
      "랭킹 변화, 리스크 변화, 실전 후보 변화를 한 번에 확인할 수 있음",
      "사이트를 매일 직접 돌지 않아도 됨",
      "주 2회 또는 정해진 발송 주기에 맞춰 핵심 정보만 받아볼 수 있음",
      "어떤 메일이 오나: 이번 주 상위 후보 요약 / 리스크 경고 종목 변화 / 실전투자 후보 변화 / 시장 한 줄 코멘트 / 추가로 봐야 할 종목·테마",
    ],
    conclusion: "프리미엄 이메일은 사이트 전체를 매번 직접 보지 않아도 핵심 변화만 받아보는 기능입니다.",
  },
];

function ImagePlaceholder({ label }) {
  return (
    <div className="imagePlaceholder">
      <div className="imageBadge">이미지 자리</div>
      <p>{label}</p>
      <span>여기에 실제 캡쳐 이미지를 삽입하면 됩니다</span>
    </div>
  );
}

function StepImages({ images }) {
  if (!images?.length) return null;
  return (
    <div className="imageGrid fixedThumbs">
      {images.map((src) => (
        <div className="stepImageFrame" key={src}>
          <img src={src} alt="가이드 캡쳐" className="stepImage" />
        </div>
      ))}
    </div>
  );
}

export default function NoticePage() {
  const [openSteps, setOpenSteps] = useState({
    step1: true,
    step2: false,
    step3: false,
    step4: false,
    step5: false,
    alternative: false,
    report: false,
    email: false,
    example: true,
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const toggle = (key) => setOpenSteps((prev) => ({ ...prev, [key]: !prev[key] }));

  const openModal = () => {
    setIsModalOpen(true);
    setSubmitError("");
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setIsSubmitting(false);
    setSubmitError("");
    if (isSubmitted) {
      setEmail("");
      setIsSubmitted(false);
    }
  };

  const handleSubscribe = async (e) => {
    e.preventDefault();
    const trimmed = email.trim();

    if (!trimmed) {
      setSubmitError("이메일 주소를 입력해주세요.");
      return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(trimmed)) {
      setSubmitError("올바른 이메일 주소를 입력해주세요.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError("");

    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed.toLowerCase() }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        setSubmitError(data?.error || "저장 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.");
        return;
      }

      setIsSubmitted(true);
    } catch (error) {
      setSubmitError("저장 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="container">
      <SiteHeader />

      <section className="heroCard">
        <div className="heroText">
          <p className="badge">USER GUIDE</p>
          <h1>우량주 스카우터 사용 가이드</h1>
          <p className="heroDesc">
            우량주 스카우터는 KRX 와 OPEN DART 에 공시된 정보를 1차로 분석하여 제공합니다
            <br />
            랭킹에서 후보를 찾고, 리스크를 걸러내고, 실전투자에서 현재 시장 기준 후보를 좁힌 뒤,
            <br />
            종목 상세와 뉴스 확인까지 거쳐 최종 판단하는 흐름으로 사용합니다.
          </p>
          <div className="noticeCallout">
            우량주 스카우터는 종목찍어주기 시스템이 아닌, 후보를 압축하고 해석을 돕는 도구입니다.
          </div>
          <div className="heroActions">
            <a href="#process" className="primaryBtn">사이트 이용 순서 보기</a>
            <a href="#examples" className="ghostBtn">실전 예시 보기</a>
            <button type="button" className="ghostBtn buttonLike" onClick={openModal}>프리미엄 이메일</button>
          </div>
        </div>
        <div className="heroImageCol">
          <img src="/main001.png" alt="메인 화면" className="realImage" />
        </div>
      </section>

      <section className="summarySection">
        <div className="sectionHeader">
          <div>
            <p className="sectionEyebrow">QUICK START</p>
            <h2>먼저 이것만 이해하면 됩니다</h2>
          </div>
          <p className="sectionSideText">서비스 전체 흐름 30초 만에 알기</p>
        </div>
        <div className="summaryGrid">
          {quickCards.map((card) => (
            <div className="summaryCard" key={card.id}>
              <strong>{card.title}</strong>
              <p>{card.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="process" className="processSection">
        <div className="sectionHeader">
          <div>
            <p className="sectionEyebrow">PROCESS</p>
            <h2>실제 사용 순서</h2>
          </div>
          <p className="sectionSideText">5단계의 기본 흐름</p>
        </div>
        <div className="accordionStack">
          {steps.map((step) => {
            const isOpen = !!openSteps[step.id];
            return (
              <article className="accordionCard" key={step.id}>
                <button className="accordionHeader" onClick={() => toggle(step.id)} type="button">
                  <div>
                    <span className="stepTag">{step.step}</span>
                    <h3>{step.title}</h3>
                    <p>{step.summary}</p>
                  </div>
                  <span className={`arrow ${isOpen ? "open" : ""}`}>⌄</span>
                </button>

                {isOpen ? (
                  <div className="accordionBody">
                    <div className="bodyBlock emphasis">
                      <span className="miniTitle">항상 보이는 핵심 설명</span>
                      <ul className="bulletList">
                        {step.always.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>

                    {step.details.map((detail) => (
                      <div className="bodyBlock" key={detail.title}>
                        <span className="miniTitle">{detail.title}</span>
                        <ul className="bulletList">
                          {detail.body.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    ))}

                    <div className="bottomLine">{step.conclusion}</div>
                    <StepImages images={step.images} />
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>

      <section id="examples" className="examplesSection">
        <article className="examplesCard">
          <button className="accordionHeader flat" onClick={() => toggle("example")} type="button">
            <div>
              <p className="sectionEyebrow">EXAMPLE</p>
              <h2>실제 사용 예시: 후보를 어떻게 고르고, 어떻게 걸러내는가</h2>
              <p>높은 순위 종목을 그대로 사는 구조가 아니라, 단계별로 줄여가는 구조라는 걸 실제 흐름으로 보여줍니다.</p>
            </div>
            <span className={`arrow ${openSteps.example ? "open" : ""}`}>⌄</span>
          </button>

          {openSteps.example ? (
            <div className="accordionBody">
              <div className="exampleGrid">
                <div className="bodyBlock">
                  <span className="miniTitle">예시 1 — 관찰로 끝나는 경우</span>
                  <ol className="orderedList">
                    <li>랭킹에서 A종목 발견</li>
                    <li>상승여력은 좋아 보였음</li>
                    <li>부채비율이 높고 리스크가 보통 이상</li>
                    <li>실전투자에서는 관찰 후보로 분류</li>
                    <li>최근 뉴스 확인 후 바로 매수하지 않고 대기</li>
                  </ol>
                </div>
                <div className="bodyBlock">
                  <span className="miniTitle">예시 2 — 최종 검토 가치가 남는 경우</span>
                  <ol className="orderedList">
                    <li>랭킹에서 B종목 발견</li>
                    <li>리스크 낮음</li>
                    <li>실전투자에서 매수 후보</li>
                    <li>종목 상세와 최근 뉴스도 무난</li>
                    <li>관심종목 등록 후 분할 매수 검토</li>
                  </ol>
                </div>
              </div>

              <div className="bottomLine">이 사이트는 높은 순위 종목을 그냥 사라고 하는 구조가 아니라, 단계별로 줄여가는 구조입니다.</div>
            </div>
          ) : null}
        </article>
      </section>

      <section className="menuGuideSection">
        <div className="sectionHeader">
          <div>
            <p className="sectionEyebrow">EXTRA MENU</p>
            <h2>대안투자, 리포트, 프리미엄 이메일은 이렇게 씁니다</h2>
          </div>
          <p className="sectionSideText">직접 종목을 고르는 흐름 외에도, 언제 어떤 보조 메뉴를 써야 하는지 같이 안내합니다.</p>
        </div>

        <div className="accordionStack">
          {menuGuides.map((menu) => {
            const isOpen = !!openSteps[menu.id];
            return (
              <article className="accordionCard" key={menu.id} id={menu.id === "email" ? "premium-email" : undefined}>
                <button className="accordionHeader" onClick={() => toggle(menu.id)} type="button">
                  <div>
                    <h3>{menu.title}</h3>
                    <p>{menu.summary}</p>
                  </div>
                  <span className={`arrow ${isOpen ? "open" : ""}`}>⌄</span>
                </button>

                {isOpen ? (
                  <div className="accordionBody">
                    <div className="bodyBlock">
                      <ul className="bulletList">
                        {menu.body.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>

      <section className="warningSection">
        <div className="warningCard">
          <p className="sectionEyebrow">IMPORTANT</p>
          <h2>절대 오해하면 안 되는 점</h2>
          <ul className="bulletList warningList">
            <li>랭킹 1위 = 매수 추천이 아닙니다</li>
            <li>리스크가 높으면 실전투자에서 제외될 수 있습니다</li>
            <li>뉴스 / 공시 확인 없이 매수 결정하지 마세요</li>
            <li>사이트는 투자 판단을 돕는 도구이지, 결과를 보장하는 서비스가 아닙니다</li>
          </ul>
        </div>
      </section>

      <section className="ctaSection">
        <div className="ctaCard">
          <h2>이제 바로 시작해보세요</h2>
          <div className="ctaButtons">
            <Link href="/screener?tab=ranking" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 14, padding: "12px 18px", textDecoration: "none", fontWeight: 800, background: "#0f172a", color: "#fff" }}>
              랭킹 보러 가기
            </Link>
            <Link href="/screener?tab=risk" className="primaryBtn">리스크</Link>
            <Link href="/screener?tab=final" className="primaryBtn">실전투자</Link>
            <Link href="/alternative" className="primaryBtn">대안투자</Link>
            <Link href="/reports" className="primaryBtn">리포트</Link>
            <button type="button" className="ghostBtn buttonLike" onClick={openModal}>프리미엄 리포트 신청</button>
          </div>
        </div>
      </section>

      {isModalOpen && (
        <div className="modalOverlay" onClick={closeModal}>
          <div className="modalCard" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="closeBtn" onClick={closeModal} aria-label="팝업 닫기">×</button>
            {!isSubmitted ? (
              <>
                <p className="modalBadge">리포트 구독하기</p>
                <h3>주간 프리미엄 리포트 오픈 알림 신청</h3>
                <p className="modalDesc">
                  사전등록하면 무료 샘플 리포트 안내와 프리미엄 MVP 베타 오픈 소식을 먼저 보내드립니다.
                  프리미엄은 확정 수익이 아니라 단기/중기/장기 시나리오와 체크 포인트를 제공하는 구조로 준비 중입니다.
                </p>
                <form className="subscribeForm" onSubmit={handleSubscribe}>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="이메일 주소를 입력해주세요"
                    required
                  />
                  {submitError ? <p className="errorText">{submitError}</p> : null}
                  <div className="modalActions">
                    <button type="button" className="ghostBtn buttonLike" onClick={closeModal}>닫기</button>
                    <button type="submit" className="primaryBtn buttonLike" disabled={isSubmitting}>
                      {isSubmitting ? "저장 중..." : "리포트 구독하기"}
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="successBox">
                <p className="modalBadge">신청 완료</p>
                <h3>접수가 완료되었습니다</h3>
                <p className="modalDesc">프리미엄 MVP 관련 소식과 샘플 리포트 안내를 이메일로 보내드릴게요.</p>
                <div className="modalActions singleAction">
                  <button type="button" className="primaryBtn buttonLike" onClick={closeModal}>확인</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <style jsx>{`
        .container {
          max-width: 1180px;
          margin: 0 auto;
          padding: 0 24px 80px;
          color: #0f172a;
        }
        .topLinks {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          margin-bottom: 26px;
          flex-wrap: wrap;
        }
        .homeBtn,
        .primaryBtn,
        .ghostBtn,
        .buttonLike {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 14px;
          padding: 12px 16px;
          text-decoration: none;
          font-weight: 800;
          transition: all 0.15s ease;
          cursor: pointer;
        }
        .buttonLike {
          appearance: none;
          border: 0;
        }
        .homeBtn,
        .primaryBtn {
          border: 1px solid #0f172a;
          background: #0f172a;
          color: #fff;
        }
        .ghostBtn {
          border: 1px solid #dbe3f0;
          background: #fff;
          color: #0f172a;
        }
        .heroCard,
        .summaryCard,
        .accordionCard,
        .examplesCard,
        .warningCard,
        .ctaCard {
          border: 1px solid #e5e7eb;
          border-radius: 28px;
          background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
          box-shadow: 0 20px 50px rgba(15, 23, 42, 0.06);
        }
        .heroCard {
          display: grid;
          grid-template-columns: minmax(0, 1.35fr) minmax(280px, 380px);
          gap: 20px;
          align-items: center;
          padding: 28px;
          margin-bottom: 28px;
        }
        .heroText {
          min-width: 0;
        }
        .heroImageCol {
          display: flex;
          justify-content: center;
          align-items: center;
          min-width: 0;
        }
        .realImage {
          width: 100%;
          max-width: 360px;
          max-height: 440px;
          height: auto;
          display: block;
          object-fit: contain;
          border-radius: 22px;
        }
        .badge,
        .sectionEyebrow,
        .imageBadge,
        .stepTag,
        .modalBadge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          padding: 7px 12px;
          font-size: 0.78rem;
          font-weight: 800;
        }
        .badge,
        .sectionEyebrow,
        .modalBadge {
          background: var(--ruby-100);
          color: var(--ruby-700);
        }
        .stepTag {
          background: #0f172a;
          color: #fff;
          margin-bottom: 10px;
        }
        .heroText h1 {
          margin: 0 0 12px;
          font-size: clamp(2rem, 4vw, 3rem);
          letter-spacing: -0.04em;
          word-break: keep-all;
        }
        .heroDesc,
        .sectionSideText,
        .accordionHeader p,
        .summaryCard p,
        .imagePlaceholder span,
        .modalDesc {
          color: #64748b;
          line-height: 1.78;
        }
        .noticeCallout {
          margin-top: 16px;
          border: 1px solid #e5e7eb;
          border-radius: 18px;
          padding: 16px;
          background: #f8fafc;
          color: #0f172a;
          font-weight: 700;
          line-height: 1.72;
        }
        .heroActions,
        .ctaButtons {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          margin-top: 18px;
        }
        .sectionHeader {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 16px;
          flex-wrap: wrap;
          margin-bottom: 18px;
        }
        .sectionHeader h2,
        .warningCard h2,
        .ctaCard h2,
        .modalCard h3 {
          margin: 6px 0 0;
          font-size: 1.7rem;
          letter-spacing: -0.03em;
        }
        .summarySection,
        .processSection,
        .examplesSection,
        .menuGuideSection,
        .warningSection,
        .ctaSection {
          margin-top: 26px;
        }
        .summaryGrid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
        }
        .summaryCard {
          padding: 18px;
        }
        .summaryCard strong {
          display: block;
          margin-bottom: 8px;
          font-size: 1.02rem;
        }
        .accordionStack {
          display: grid;
          gap: 16px;
        }
        .accordionCard,
        .examplesCard {
          padding: 0;
          overflow: hidden;
        }
        .accordionHeader {
          width: 100%;
          border: 0;
          background: transparent;
          padding: 22px 24px;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          text-align: left;
          cursor: pointer;
        }
        .accordionHeader h3 {
          margin: 0 0 8px;
          font-size: 1.38rem;
          letter-spacing: -0.03em;
        }
        .accordionHeader.flat {
          padding-bottom: 16px;
        }
        .accordionBody {
          padding: 0 24px 24px;
          display: grid;
          gap: 12px;
        }
        .bodyBlock {
          border: 1px solid #e5e7eb;
          border-radius: 18px;
          background: #fff;
          padding: 16px;
        }
        .bodyBlock.emphasis {
          background: #f8fafc;
        }
        .miniTitle {
          display: block;
          margin-bottom: 10px;
          color: #0f172a;
          font-size: 0.86rem;
          font-weight: 800;
        }
        .bulletList,
        .orderedList {
          margin: 0;
          padding-left: 18px;
          color: #475569;
          line-height: 1.8;
        }
        .orderedList li + li,
        .bulletList li + li {
          margin-top: 4px;
        }
        .bottomLine {
          border-radius: 16px;
          padding: 14px 16px;
          background: #0f172a;
          color: #fff;
          font-weight: 800;
          line-height: 1.65;
        }
        .imageGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }
        .stepImageFrame {
          border: 1px solid #e5e7eb;
          border-radius: 18px;
          background: #fff;
          padding: 10px;
          min-height: 280px;
          max-height: 540px;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }
        .imageGrid.oneCol {
          grid-template-columns: 1fr;
        }
        .imageGrid.twoCol,
        .exampleGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }
        .imagePlaceholder {
          min-height: 220px;
          border: 1px dashed #cbd5e1;
          border-radius: 22px;
          padding: 18px;
          background: #f8fafc;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          text-align: center;
          gap: 8px;
        }
        .imagePlaceholder p {
          margin: 0;
          color: #0f172a;
          font-weight: 800;
        }
        .imageBadge {
          background: #e2e8f0;
          color: #475569;
        }
        .stepImage {
          width: 100%;
          height: auto;
          max-height: 520px;
          object-fit: contain;
          display: block;
          border-radius: 18px;
          border: 1px solid #e5e7eb;
          background: #fff;
        }
        .warningCard,
        .ctaCard {
          padding: 24px;
        }
        .warningList li {
          color: #0f172a;
          font-weight: 700;
        }
        .arrow {
          font-size: 1.4rem;
          color: #64748b;
          line-height: 1;
          transform: rotate(0deg);
          transition: transform 0.15s ease;
        }
        .arrow.open {
          transform: rotate(180deg);
        }
        .modalOverlay {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.58);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 200;
          padding: 20px;
        }
        .modalCard {
          position: relative;
          width: min(560px, 100%);
          border: 1px solid #e5e7eb;
          border-radius: 28px;
          background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
          box-shadow: 0 30px 70px rgba(15, 23, 42, 0.22);
          padding: 28px;
        }
        .closeBtn {
          position: absolute;
          right: 16px;
          top: 16px;
          width: 40px;
          height: 40px;
          border-radius: 999px;
          border: 1px solid #dbe3f0;
          background: #fff;
          color: #0f172a;
          font-size: 1.5rem;
          cursor: pointer;
        }
        .subscribeForm {
          display: grid;
          gap: 12px;
          margin-top: 18px;
        }
        .subscribeForm input {
          width: 100%;
          height: 52px;
          border-radius: 14px;
          border: 1px solid #dbe3f0;
          background: #fff;
          color: #0f172a;
          padding: 0 16px;
          font-size: 1rem;
        }
        .modalActions {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          margin-top: 6px;
        }
        .modalActions.singleAction {
          justify-content: center;
        }
        .successBox {
          display: grid;
          gap: 12px;
          text-align: center;
        }
        .errorText {
          margin: 0;
          color: #dc2626;
          font-size: 0.92rem;
          font-weight: 700;
        }
        @media (max-width: 980px) {
          .heroCard,
          .summaryGrid,
          .imageGrid,
          .imageGrid.twoCol,
          .exampleGrid {
            grid-template-columns: 1fr;
          }
          .heroImageCol {
            justify-content: center;
          }
          .realImage {
            max-width: 100%;
          }
          .imageGrid {
            grid-template-columns: 1fr;
          }
        
          .stepImageFrame {
            min-height: 220px;
            max-height: 460px;
          }
        
          .stepImage {
            max-height: 440px;
          }
        }
        @media (max-width: 760px) {
          .container {
            padding: 0 18px 64px;
          }
          .sectionHeader,
          .topLinks {
            flex-direction: column;
            align-items: flex-start;
          }
          .accordionHeader {
            padding: 20px;
          }
          .accordionBody,
          .warningCard,
          .ctaCard,
          .heroCard,
          .summaryCard,
          .modalCard {
            padding: 20px;
          }
          .heroActions .primaryBtn,
          .heroActions .ghostBtn,
          .heroActions .buttonLike,
          .ctaButtons .primaryBtn,
          .ctaButtons .ghostBtn,
          .ctaButtons .buttonLike,
          .modalActions .primaryBtn,
          .modalActions .ghostBtn,
          .modalActions .buttonLike {
            width: 100%;
          }
        }
      `}</style>
    </main>
  );
}
