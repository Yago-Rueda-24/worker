import { Transaction } from "form4api";
import { FinnhubProfile } from "./types";
import { convertToUSD } from "./finnhub";

interface ScoringInput {
	historyTxns: Transaction[];
	profile: FinnhubProfile | null;
}

interface ScoringResult {
	score: number;
	uniqueBuyersCount: number;
	hasCeoPurchase: boolean;
	hasCfoPurchase: boolean;
	totalBuyingValue: number;
	scoreBreakdown: string[];
}

export function calculateScore(input: ScoringInput): ScoringResult {
	const { historyTxns, profile } = input;

	const histPurchases = historyTxns.filter(t => t.transactionCode === "P" && t.isOpenMarket && !t.is10b5Plan);

	const uniqueBuyers = new Set(histPurchases.map(t => t.insiderCik || t.insiderName));
	const uniqueBuyersCount = uniqueBuyers.size;
	const isClusterBuy = uniqueBuyersCount >= 2;

	const hasCeoPurchase = histPurchases.some(t => {
		const title = (t.insiderTitle || "").toLowerCase();
		return title.includes("ceo") || title.includes("chief executive");
	});

	const hasCfoPurchase = histPurchases.some(t => {
		const title = (t.insiderTitle || "").toLowerCase();
		return title.includes("cfo") || title.includes("chief financial");
	});

	const hasLargePurchase = histPurchases.some(t => {
		const val = t.totalValue || (t.sharesAmount * (t.pricePerShare || 0));
		return val > 100000;
	});

	const totalBuyingValue = histPurchases.reduce((sum, t) => {
		const val = t.totalValue || (t.sharesAmount * (t.pricePerShare || 0));
		return sum + val;
	}, 0);

	const hasAutoSale = historyTxns.some(t => t.transactionCode === "S" && t.is10b5Plan);
	const hasOptionExercise = historyTxns.some(t => t.transactionCode === "M" || t.transactionCode === "X");

	const rawMarketCap = profile ? profile.marketCapitalization : null;
	const marketCap = rawMarketCap !== null ? convertToUSD(rawMarketCap, profile?.currency) : null;

	let score = 0;
	const scoreBreakdown: string[] = [];

	if (isClusterBuy) {
		score += 4;
		scoreBreakdown.push("+4 Cluster Buying (>= 2 insiders)");
	}
	if (hasCeoPurchase) {
		score += 3;
		scoreBreakdown.push("+3 CEO purchase");
	}
	if (hasCfoPurchase) {
		score += 2;
		scoreBreakdown.push("+2 CFO purchase");
	}
	if (hasLargePurchase) {
		score += 2;
		scoreBreakdown.push("+2 Large purchase (> $100k)");
	}
	if (marketCap !== null && marketCap < 10000) {
		score += 1;
		scoreBreakdown.push("+1 Small/Mid Cap (< $10B)");
	}
	if (hasAutoSale) {
		score -= 3;
		scoreBreakdown.push("-3 Automatic sale penalty");
	}
	if (hasOptionExercise) {
		score -= 2;
		scoreBreakdown.push("-2 Option exercise penalty");
	}

	return {
		score,
		uniqueBuyersCount,
		hasCeoPurchase,
		hasCfoPurchase,
		totalBuyingValue,
		scoreBreakdown
	};
}

