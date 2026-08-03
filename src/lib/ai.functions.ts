import { createServerFn } from "@tanstack/react-start";

const DISCLAIMER =
  "You are a markets analyst for a personal finance app. Use only the live data provided plus widely known public context. Never guarantee profits, never give personal buy/sell instructions, and clearly frame everything as informational commentary. Be concise and specific.";

export type MarketBrief = {
  headline: string;
  summary: string;
  keyEvents: string[];
  stocksToWatch: { name: string; why: string }[];
  trendingSectors: string[];
  corporateResults: string[];
  economicEvents: string[];
  rbiUpdate: string;
  fedUpdate: string;
  oilImpact: string;
  goldMovement: string;
  dollarMovement: string;
  disclaimer: string;
};

export const generateMarketBrief = createServerFn({ method: "POST" })
  .inputValidator((input: { context: string }) => ({
    context: String(input.context).slice(0, 12000),
  }))
  .handler(async ({ data }): Promise<MarketBrief> => {
    const { aiJson, strictObject, strArray } = await import("./ai-gateway.server");
    return aiJson<MarketBrief>({
      system: DISCLAIMER,
      prompt: `Write today's market brief for an Indian investor using this live data snapshot and recent headlines.\n\n${data.context}\n\nKeep every list to 3-6 short entries. Distinguish clearly between the live numbers given and your interpretation.`,
      schemaName: "market_brief",
      schema: strictObject({
        headline: { type: "string" },
        summary: { type: "string" },
        keyEvents: strArray,
        stocksToWatch: {
          type: "array",
          items: strictObject({ name: { type: "string" }, why: { type: "string" } }),
        },
        trendingSectors: strArray,
        corporateResults: strArray,
        economicEvents: strArray,
        rbiUpdate: { type: "string" },
        fedUpdate: { type: "string" },
        oilImpact: { type: "string" },
        goldMovement: { type: "string" },
        dollarMovement: { type: "string" },
        disclaimer: { type: "string" },
      }),
    });
  });

export type NewsAnalysis = {
  items: {
    id: string;
    summary: string;
    category: string;
    companies: string[];
    sectors: string[];
    sentiment: "positive" | "negative" | "neutral";
    importance: number;
  }[];
};

export const analyseHeadlines = createServerFn({ method: "POST" })
  .inputValidator((input: { headlines: { id: string; title: string; source: string }[] }) => ({
    headlines: (input.headlines ?? []).slice(0, 20).map((h) => ({
      id: String(h.id).slice(0, 80),
      title: String(h.title).slice(0, 240),
      source: String(h.source).slice(0, 60),
    })),
  }))
  .handler(async ({ data }): Promise<NewsAnalysis> => {
    if (data.headlines.length === 0) return { items: [] };
    const { aiJson, strictObject, strArray } = await import("./ai-gateway.server");
    return aiJson<NewsAnalysis>({
      system: DISCLAIMER,
      prompt: `For each headline return a one-sentence AI summary, a category (Markets, Policy, Earnings, Global, Commodities, Currency, Company, Economy), affected companies, affected sectors, market sentiment and an importance score 1-10.\n\n${JSON.stringify(
        data.headlines,
      )}\n\nReturn one entry per headline, keeping the same id.`,
      schemaName: "news_analysis",
      schema: strictObject({
        items: {
          type: "array",
          items: strictObject({
            id: { type: "string" },
            summary: { type: "string" },
            category: { type: "string" },
            companies: strArray,
            sectors: strArray,
            sentiment: { type: "string", enum: ["positive", "negative", "neutral"] },
            importance: { type: "number" },
          }),
        },
      }),
    });
  });

export type StockResearch = {
  overview: string;
  businessModel: string;
  strengths: string[];
  weaknesses: string[];
  risks: string[];
  growthDrivers: string[];
  financialAnalysis: string;
  technicalAnalysis: string;
  newsSummary: string;
  analystRatings: string;
  longTermOutlook: string;
  fairValueDiscussion: string;
  valuationMetrics: { label: string; value: string; note: string }[];
  swot: { strengths: string[]; weaknesses: string[]; opportunities: string[]; threats: string[] };
  sources: string[];
  disclaimer: string;
};

export const researchStock = createServerFn({ method: "POST" })
  .inputValidator((input: { symbol: string; name: string; context: string }) => ({
    symbol: String(input.symbol).slice(0, 24),
    name: String(input.name).slice(0, 120),
    context: String(input.context).slice(0, 6000),
  }))
  .handler(async ({ data }): Promise<StockResearch> => {
    const { aiJson, strictObject, strArray } = await import("./ai-gateway.server");
    return aiJson<StockResearch>({
      system: DISCLAIMER,
      prompt: `Produce a research note on ${data.name} (${data.symbol}).\n\nLive price data (from Yahoo Finance):\n${data.context}\n\nFor fundamentals you do not have live, state that the figure is an approximate public estimate and name the kind of source. Keep each list to 3-5 entries. Valuation metrics should list label/value/note (e.g. PE ratio, PB, ROE, ROCE, debt-to-equity, revenue growth, profit growth, dividend yield) and flag when a value is an estimate rather than live data.`,
      schemaName: "stock_research",
      schema: strictObject({
        overview: { type: "string" },
        businessModel: { type: "string" },
        strengths: strArray,
        weaknesses: strArray,
        risks: strArray,
        growthDrivers: strArray,
        financialAnalysis: { type: "string" },
        technicalAnalysis: { type: "string" },
        newsSummary: { type: "string" },
        analystRatings: { type: "string" },
        longTermOutlook: { type: "string" },
        fairValueDiscussion: { type: "string" },
        valuationMetrics: {
          type: "array",
          items: strictObject({
            label: { type: "string" },
            value: { type: "string" },
            note: { type: "string" },
          }),
        },
        swot: strictObject({
          strengths: strArray,
          weaknesses: strArray,
          opportunities: strArray,
          threats: strArray,
        }),
        sources: strArray,
        disclaimer: { type: "string" },
      }),
    });
  });

export type SectorTake = { sectors: { sector: string; view: string }[] };

export const analyseSectors = createServerFn({ method: "POST" })
  .inputValidator((input: { context: string }) => ({ context: String(input.context).slice(0, 6000) }))
  .handler(async ({ data }): Promise<SectorTake> => {
    const { aiJson, strictObject } = await import("./ai-gateway.server");
    return aiJson<SectorTake>({
      system: DISCLAIMER,
      prompt: `Given these live sector performance numbers, give a two-sentence read on each sector: what the move suggests and what to watch.\n\n${data.context}`,
      schemaName: "sector_take",
      schema: strictObject({
        sectors: {
          type: "array",
          items: strictObject({ sector: { type: "string" }, view: { type: "string" } }),
        },
      }),
    });
  });

export type GlobalImpact = {
  summary: string;
  impacts: { market: string; move: string; indiaImpact: string }[];
  disclaimer: string;
};

export const analyseGlobalImpact = createServerFn({ method: "POST" })
  .inputValidator((input: { context: string }) => ({ context: String(input.context).slice(0, 6000) }))
  .handler(async ({ data }): Promise<GlobalImpact> => {
    const { aiJson, strictObject } = await import("./ai-gateway.server");
    return aiJson<GlobalImpact>({
      system: DISCLAIMER,
      prompt: `Explain how these global market moves may transmit to Indian equities, the rupee and rates. One entry per market listed.\n\n${data.context}`,
      schemaName: "global_impact",
      schema: strictObject({
        summary: { type: "string" },
        impacts: {
          type: "array",
          items: strictObject({
            market: { type: "string" },
            move: { type: "string" },
            indiaImpact: { type: "string" },
          }),
        },
        disclaimer: { type: "string" },
      }),
    });
  });

export type PortfolioAlerts = {
  alerts: {
    symbol: string;
    type: string;
    severity: "high" | "medium" | "low";
    message: string;
    action: string;
  }[];
  summary: string;
};

export type EconomicCalendar = {
  groups: {
    group: string;
    events: { date: string; title: string; detail: string; impact: "high" | "medium" | "low" }[];
  }[];
  disclaimer: string;
};

export const generateEconomicCalendar = createServerFn({ method: "POST" })
  .inputValidator((input: { today: string }) => ({ today: String(input.today).slice(0, 40) }))
  .handler(async ({ data }): Promise<EconomicCalendar> => {
    const { aiJson, strictObject } = await import("./ai-gateway.server");
    return aiJson<EconomicCalendar>({
      system: DISCLAIMER,
      prompt: `Today is ${data.today}. Build a forward-looking economic and corporate calendar for the next 6 weeks relevant to Indian and US markets. Use these groups exactly: "RBI meetings", "Federal Reserve meetings", "GDP releases", "Inflation data", "Employment reports", "Company earnings", "Dividend dates", "IPO calendar". Give 2-5 events per group with ISO dates. Where a date is scheduled but not officially confirmed, say so in the detail.`,
      schemaName: "economic_calendar",
      schema: strictObject({
        groups: {
          type: "array",
          items: strictObject({
            group: { type: "string" },
            events: {
              type: "array",
              items: strictObject({
                date: { type: "string" },
                title: { type: "string" },
                detail: { type: "string" },
                impact: { type: "string", enum: ["high", "medium", "low"] },
              }),
            },
          }),
        },
        disclaimer: { type: "string" },
      }),
    });
  });

export const advisePortfolio = createServerFn({ method: "POST" })
  .inputValidator((input: { context: string }) => ({ context: String(input.context).slice(0, 8000) }))
  .handler(async ({ data }): Promise<PortfolioAlerts> => {
    const { aiJson, strictObject } = await import("./ai-gateway.server");
    return aiJson<PortfolioAlerts>({
      system: DISCLAIMER,
      prompt: `Review these holdings with their live prices and recent headlines. Flag what deserves attention: results season, big price moves, technical trend changes, dividends, sector sentiment shifts or major news. Educational monitoring only, no buy/sell instruction.\n\n${data.context}`,
      schemaName: "portfolio_alerts",
      schema: strictObject({
        summary: { type: "string" },
        alerts: {
          type: "array",
          items: strictObject({
            symbol: { type: "string" },
            type: { type: "string" },
            severity: { type: "string", enum: ["high", "medium", "low"] },
            message: { type: "string" },
            action: { type: "string" },
          }),
        },
      }),
    });
  });