export default function sitemap() {
  const baseUrl = "https://www.hellomedia.win";

  const staticPages = [
    "",
    "/ranking",
    "/risk",
    "/report",
    "/notice",
    "/faq",

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
      : path === "/ranking" || path === "/risk" || path === "/report"
      ? "weekly"
      : "monthly",
    priority:
      path === ""
        ? 1.0
        : path === "/ranking"
        ? 0.9
        : path === "/risk" || path === "/report"
        ? 0.8
        : path.startsWith("/seo/")
        ? 0.7
        : 0.5,
  }));
}
