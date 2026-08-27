"use client";

import { Suspense, useEffect } from "react";
import PageTopBar from "../components/PageTopBar";
import { toNumber } from "./lib/format";
import { useDemoAccount } from "./hooks/useDemoAccount";
import { useWishlist } from "./hooks/useWishlist";
import { useQuote } from "./hooks/useQuote";
import { useOrders } from "./hooks/useOrders";
import { useTradeMarkers } from "./hooks/useTradeMarkers";
import AccountPanel from "./components/AccountPanel";
import StockSearchPanel from "./components/StockSearchPanel";
import ChartPanel from "./components/ChartPanel";
import OrderForm from "./components/OrderForm";
import PositionTable from "./components/PositionTable";
import OrderHistoryList from "./components/OrderHistoryList";
import { styles, responsiveCss } from "./styles";

function DemoTradeContent() {
  const demoAccount = useDemoAccount();
  const wishlistStocks = useWishlist(demoAccount.authUser);
  const quote = useQuote();
  const ordersState = useOrders({
    account: demoAccount.account,
    code: quote.code,
    name: quote.name,
    price: quote.price,
    onAccountCashUpdate: demoAccount.updateCash,
  });

  const tradeMarkers = useTradeMarkers({
    chartData: quote.chartData,
    chartScale: quote.chartScale,
    orders: ordersState.orders,
    code: quote.code,
  });

  // 새 계좌가 로드되거나 초기화되면 주문/보유종목 캐시를 비웁니다.
  useEffect(() => {
    if (demoAccount.accountVersion > 0) {
      ordersState.resetLocalOrders();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoAccount.accountVersion]);

  // 로그아웃하면 주문/보유종목 캐시를 비웁니다.
  useEffect(() => {
    if (!demoAccount.authUser) {
      ordersState.resetLocalOrders();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoAccount.authUser]);

  // 시세가 갱신되면 방금 조회한 종목의 평가가를 보유종목 가격 캐시에도 반영합니다.
  useEffect(() => {
    ordersState.updatePositionPrice(quote.code, quote.price);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quote.code, quote.price]);

  return (
    <main style={styles.page}>
      <style>{responsiveCss}</style>

      <div style={styles.pageInner}>
      <div className="dt-demo-header">
        <PageTopBar />
      </div>

      <section style={styles.topBar} className="dt-topbar">
        <div>
          <div style={styles.logo}>모의투자 Beta</div>
          <h1 style={styles.title}>가상투자 터미널</h1>
          <p style={styles.subTitle}>
            처음부터 내 돈으로 투자하기 부담되죠? 가상계좌로 매수 판단을 먼저 검증해보세요.
            <br />
            모든 계좌에는 1억의 가상현금이 지급됩니다. <br />
            계좌번호와 PIN을 저장해두면 언제든 내역을 이어볼 수 있습니다.
          </p>
        </div>

        <AccountPanel
          account={demoAccount.account}
          authUser={demoAccount.authUser}
          resetting={demoAccount.resetting}
          onKakaoLogin={demoAccount.handleKakaoLogin}
          onReset={demoAccount.resetAccount}
        />
      </section>

      <section style={styles.tradeGrid} className="dt-trade-grid">
        <StockSearchPanel
          searchCode={quote.searchCode}
          onSearchCodeChange={quote.setSearchCode}
          onSearch={() => quote.fetchQuote(quote.searchCode, "", "manual")}
          onSelectPopular={quote.selectStock}
          selectedPopularCode={quote.selectedPopularCode}
          loadingQuote={quote.loadingQuote}
          wishlistStocks={wishlistStocks}
          code={quote.code}
          onSelectWishlist={(item) => {
            quote.setSearchCode(item.code);
            quote.fetchQuote(item.code, item.name, "manual");
          }}
        />

        <ChartPanel
          name={quote.name}
          code={quote.code}
          price={quote.price}
          change={quote.change}
          rate={quote.rate}
          candles={quote.candles}
          candleInterval={quote.candleInterval}
          chartData={quote.chartData}
          quoteState={quote.quoteState}
          quoteError={quote.quoteError}
          marketOpen={quote.marketOpen}
          priceBasis={quote.priceBasis}
          tradeMarkers={tradeMarkers}
          onRetry={quote.retry}
          fomoScore={ordersState.fomoScore}
          fomoLabel={ordersState.fomoLabel}
          showFomoTip={ordersState.showFomoTip}
          onDismissFomoTip={ordersState.dismissFomoTip}
        />

        <OrderForm
          account={demoAccount.account}
          authUser={demoAccount.authUser}
          onKakaoLogin={demoAccount.handleKakaoLogin}
          side={ordersState.side}
          onSideChange={ordersState.setSide}
          price={quote.price}
          onPriceChange={quote.setPrice}
          quantity={ordersState.quantity}
          onQuantityChange={ordersState.setQuantity}
          selectedHoldingQuantity={ordersState.selectedHoldingQuantity}
          totalOrderAmount={ordersState.totalOrderAmount}
          estimatedCash={ordersState.estimatedCash}
          reason={ordersState.reason}
          onReasonChange={ordersState.setReason}
          targetPrice={ordersState.targetPrice}
          onTargetPriceChange={ordersState.setTargetPrice}
          stopLossPrice={ordersState.stopLossPrice}
          onStopLossPriceChange={ordersState.setStopLossPrice}
          holdingDays={ordersState.holdingDays}
          onHoldingDaysChange={ordersState.setHoldingDays}
          onSubmit={ordersState.submitOrder}
          orderStatus={ordersState.orderStatus}
          canOrder={Boolean(demoAccount.account) && quote.quoteState === "ready" && toNumber(quote.price) > 0}
          orderDisabledReason={
            !demoAccount.account
              ? ""
              : quote.quoteState !== "ready" || !(toNumber(quote.price) > 0)
                ? "시세를 불러온 뒤 주문할 수 있어요."
                : ""
          }
        />
      </section>

      <section style={styles.bottomGrid} className="dt-bottom-grid">
        <PositionTable
          portfolioSummary={ordersState.portfolioSummary}
          loadingPositions={ordersState.loadingPositions}
          onRefresh={() => ordersState.refreshPositionPrices()}
        />
        <OrderHistoryList orders={ordersState.orders} />
      </section>
      </div>
    </main>
  );
}

export default function DemoTradePage() {
  return (
    <Suspense fallback={null}>
      <DemoTradeContent />
    </Suspense>
  );
}
