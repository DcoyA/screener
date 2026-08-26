export default function sitemap() {
  const baseUrl = "https://www.hellomedia.win";

  const staticPages = [
    "",
    "/screener",
    "/performance",
    "/reports",
    "/notice",

    // SEO pages
    "/seo/low-pbr",
    "/seo/high-roe",
    "/seo/ai-stock",
    "/seo/value-stocks",
    "/seo/weekly-stocks",
  ];

  const now = new Date();

  return staticPages.map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified: now,
    changeFrequency: path.startsWith("/seo/")
      ? "weekly"
      : path === "/screener" || path === "/performance" || path === "/reports"
      ? "weekly"
      : "monthly",
    priority:
      path === ""
        ? 1.0
        : path === "/screener"
        ? 0.9
        : path === "/performance" || path === "/reports"
        ? 0.8
        : path.startsWith("/seo/")
        ? 0.7
        : 0.5,
  }));
}
