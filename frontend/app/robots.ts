import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/public", "/complaint"],
        disallow: [
          "/dashboard/",
          "/dashboard/*",
          "/api/",
          "/api/*",
          "/admin/",
          "/auth/",
          "/reports/",
          "/data-quality/",
          "/investigations/",
          "/ml-report/",
          "/patterns/",
          "/complaint/status",
        ],
        crawlDelay: 10,
      },
      {
        userAgent: [
          "GPTBot",
          "ChatGPT-User",
          "CCBot",
          "anthropic-ai",
          "Claude-Web",
          "Bytespider",
          "Google-Extended",
          "PerplexityBot",
          "FacebookBot",
          "Diffbot",
          "SemrushBot",
          "AhrefsBot",
          "MJ12bot",
          "DotBot",
          "Baiduspider",
          "PetalBot",
        ],
        disallow: ["/"],
      },
    ],
  };
}
