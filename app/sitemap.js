import stocks from "./data/stocks.json";

export default function sitemap() {
  const baseUrl = "https://screener-two-kappa.vercel.app";

  const staticPages = [
    "",
    "/ranking",
    "/risk",
    "/reports",
  ].map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: path === "" ? 1.0 : 0.8,
  }));

  const stockPages = stocks.map((stock) => ({
    url: `${baseUrl}/stock/${stock.code}`,
    lastModified: stock.updatedAt ? new Date(stock.updatedAt) : new Date(),
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  return [...staticPages, ...stockPages];
}
