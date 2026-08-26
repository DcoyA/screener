/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        // TASK 7: 같은 종목이 /diagnosis/[code]와 /stock/[code] 두 URL로
        // 동시에 존재하던 문제. /stock/[code]를 정식 경로로 통일하고
        // 여기로 301(permanent)로 보낸다. 실제 페이지(app/diagnosis/[code])는
        // 삭제했다 - 이 redirects()가 라우팅 단계에서 먼저 가로챈다.
        source: "/diagnosis/:code",
        destination: "/stock/:code",
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;
