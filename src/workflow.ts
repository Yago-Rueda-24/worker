import { Form4ApiClient } from "form4api";
import { Env, TickerResult, FinnhubProfile, FinnhubEarningsCalendar } from "./types";
import { sendTelegramMessage } from "./telegram";
import { fetchFinnhub, formatMarketCap, formatValue, convertToUSD } from "./finnhub";
import { calculateScore } from "./scoring";

export async function runWorkflow(env: Env, triggerType: string, ticker?: string): Promise<string> {
	if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
		throw new Error("Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID configuration.");
	}
	if (!env.FORM4_API_KEY) {
		throw new Error("Missing FORM4_API_KEY configuration.");
	}
	if (!env.FINNHUB_API_KEY || env.FINNHUB_API_KEY === "your_finnhub_key_here") {
		throw new Error("Missing or invalid FINNHUB_API_KEY configuration.");
	}

	const client = new Form4ApiClient({ apiKey: env.FORM4_API_KEY });
	let topTickers: string[] = [];
	const initialCompanyName: Record<string, string> = {};

	if (ticker) {
		topTickers = [ticker.toUpperCase()];
		initialCompanyName[ticker.toUpperCase()] = "";
	} else {
		console.log("Fetching recent insider purchases from Form4API...");
		const rawTxns = await client.transactions.list({
			code: "P",
			perPage: 100
		});

		const purchases = rawTxns.filter(t => t.transactionCode === "P" && t.isOpenMarket && !t.is10b5Plan);
		
		if (purchases.length === 0) {
			console.log("No recent valid open-market purchases found.");
			const emptyMsg = `🤖 <b>Insider Opportunities Alert</b>\n\n❌ No recent valid open-market purchases found in the market.`;
			await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID, emptyMsg);
			return "No recent valid open-market purchases found.";
		}

		const tickerStats: Record<string, { count: number; totalValue: number; companyName: string }> = {};
		for (const txn of purchases) {
			const sym = txn.ticker.toUpperCase();
			if (!tickerStats[sym]) {
				tickerStats[sym] = { count: 0, totalValue: 0, companyName: txn.companyName };
			}
			tickerStats[sym].count++;
			const val = txn.totalValue || (txn.sharesAmount * (txn.pricePerShare || 0));
			tickerStats[sym].totalValue += val;
		}

		topTickers = Object.entries(tickerStats)
			.sort((a, b) => b[1].count - a[1].count || b[1].totalValue - a[1].totalValue)
			.slice(0, 8)
			.map(([sym]) => sym);

		for (const sym of topTickers) {
			initialCompanyName[sym] = tickerStats[sym].companyName;
		}
	}

	console.log(`Analyzing tickers: ${topTickers.join(", ")}`);

	const fourteenDaysAgo = new Date();
	fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
	const fromDateStr = fourteenDaysAgo.toISOString().split('T')[0];

	const today = new Date();
	const todayStr = today.toISOString().split('T')[0];
	const ninetyDaysFromNow = new Date();
	ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90);
	const endStr = ninetyDaysFromNow.toISOString().split('T')[0];

	const results: TickerResult[] = [];

	const analysisPromises = topTickers.map(async (sym) => {
		try {
			const historyTxns = await client.transactions.list({
				ticker: sym,
				from: fromDateStr,
				perPage: 100
			});

			const [profile, earnings] = await Promise.all([
				fetchFinnhub<FinnhubProfile>('stock/profile2', { symbol: sym }, env.FINNHUB_API_KEY),
				fetchFinnhub<FinnhubEarningsCalendar>('calendar/earnings', {
					symbol: sym,
					from: todayStr,
					to: endStr
				}, env.FINNHUB_API_KEY)
			]);

			const scoreDetails = calculateScore({
				historyTxns,
				profile
			});

			const rawMarketCap = profile ? profile.marketCapitalization : null;
			const marketCap = rawMarketCap !== null ? convertToUSD(rawMarketCap, profile?.currency) : null;
			const sector = profile ? profile.finnhubIndustry : null;

			let nextEarningsDate: string | null = null;
			if (earnings && Array.isArray(earnings.earningsCalendar) && earnings.earningsCalendar.length > 0) {
				nextEarningsDate = earnings.earningsCalendar[0].date;
			}

			const companyName = profile?.name || initialCompanyName[sym] || sym;

			results.push({
				ticker: sym,
				companyName,
				score: scoreDetails.score,
				uniqueBuyersCount: scoreDetails.uniqueBuyersCount,
				hasCeoPurchase: scoreDetails.hasCeoPurchase,
				hasCfoPurchase: scoreDetails.hasCfoPurchase,
				totalBuyingValue: scoreDetails.totalBuyingValue,
				marketCap,
				sector,
				nextEarningsDate,
				scoreBreakdown: scoreDetails.scoreBreakdown
			});

		} catch (err: any) {
			console.error(`Error processing ticker ${sym}: ${err.message}`);
		}
	});

	await Promise.all(analysisPromises);

	results.sort((a, b) => b.score - a.score);

	let telegramMessage = `🔥 <b>Insider Opportunities</b>\n\n`;
	if (results.length === 0) {
		telegramMessage += `❌ No opportunities found.`;
	} else {
		results.forEach((item, index) => {
			telegramMessage += `${index + 1}. <b>${item.ticker}</b>\n` +
				`- ${item.uniqueBuyersCount} ${item.uniqueBuyersCount === 1 ? 'insider' : 'insiders'} bought shares\n`;

			if (item.hasCeoPurchase) {
				telegramMessage += `- CEO purchase detected\n`;
			}
			if (item.hasCfoPurchase) {
				telegramMessage += `- CFO purchase detected\n`;
			}

			telegramMessage += `- Total insider buying: ${formatValue(item.totalBuyingValue)}\n` +
				`- Market cap: ${formatMarketCap(item.marketCap)}\n` +
				`- Score: ${item.score}\n\n`;
		});
	}

	telegramMessage += `⚙️ <i>Trigger: ${triggerType} | ${new Date().toISOString().slice(0, 19).replace('T', ' ')} UTC</i>`;

	console.log("Sending Telegram message...");
	await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID, telegramMessage);

	return JSON.stringify(results, null, 2);
}

