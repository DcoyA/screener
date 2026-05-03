export default function robots() {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: "https://screener-two-kappa.vercel.app/sitemap.xml",
  };
}
