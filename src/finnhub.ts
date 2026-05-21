export async function fetchFinnhub<T>(
	endpoint: string,
	params: Record<string, string>,
	apiKey: string
): Promise<T | null> {
	const url = new URL(`https://finnhub.io/api/v1/${endpoint}`);
	url.searchParams.append("token", apiKey);
	for (const [key, val] of Object.entries(params)) {
		url.searchParams.append(key, val);
	}
	try {
		const res = await fetch(url.toString(), {
			headers: { 'Accept': 'application/json' }
		});
		if (!res.ok) {
			console.error(`Finnhub error on ${endpoint}: ${res.status} ${await res.text()}`);
			return null;
		}
		return await res.json() as T;
	} catch (err: any) {
		console.error(`Finnhub fetch error on ${endpoint}: ${err.message}`);
		return null;
	}
}

const EXCHANGE_RATES: Record<string, number> = {
	USD: 1.0,
	TWD: 0.031,
	EUR: 1.08,
	GBP: 1.27,
	GBX: 0.0127,
	CAD: 0.73,
	JPY: 0.0064,
	CNY: 0.14,
	HKD: 0.13,
	INR: 0.012,
	CHF: 1.10,
	AUD: 0.66,
	BRL: 0.19,
	MXN: 0.06,
	KRW: 0.00073,
	SEK: 0.093,
	NOK: 0.093,
	DKK: 0.14,
	ZAR: 0.055,
	SGD: 0.74,
};

export function convertToUSD(value: number, currency?: string): number {
	if (!currency) return value;
	const rate = EXCHANGE_RATES[currency.toUpperCase()];
	if (rate === undefined) {
		console.warn(`Unknown currency: ${currency}. Defaulting to 1.0`);
		return value;
	}
	return value * rate;
}

export function formatMarketCap(capInMillions: number | null, currency?: string): string {
	if (capInMillions === null || capInMillions === undefined) return "N/A";
	const capInUSD = convertToUSD(capInMillions, currency);
	if (capInUSD >= 1000000) {
		return `$${(capInUSD / 1000000).toFixed(2)}T`;
	}
	if (capInUSD >= 1000) {
		return `$${(capInUSD / 1000).toFixed(1)}B`;
	}
	return `$${capInUSD.toFixed(1)}M`;
}

export function formatValue(value: number): string {
	if (value >= 1000000) {
		return `$${(value / 1000000).toFixed(1)}M`;
	}
	if (value >= 1000) {
		return `$${(value / 1000).toFixed(0)}k`;
	}
	return `$${value.toFixed(0)}`;
}
