export interface Env {
	ENV: string;
	TELEGRAM_BOT_TOKEN: string;
	TELEGRAM_CHAT_ID: string;
	FORM4_API_KEY: string;
	FINNHUB_API_KEY: string;
}

export interface TickerResult {
	ticker: string;
	companyName: string;
	score: number;
	uniqueBuyersCount: number;
	hasCeoPurchase: boolean;
	hasCfoPurchase: boolean;
	totalBuyingValue: number;
	marketCap: number | null;
	sector: string | null;
	nextEarningsDate: string | null;
	scoreBreakdown: string[];
}

export interface FinnhubQuote {
	c: number;
	d: number;
	dp: number;
}

export interface FinnhubProfile {
	name: string;
	marketCapitalization: number;
	finnhubIndustry: string;
}

export interface EarningsCalendarEvent {
	date: string;
	symbol: string;
}

export interface FinnhubEarningsCalendar {
	earningsCalendar: EarningsCalendarEvent[];
}
