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

export function formatMarketCap(capInMillions: number | null): string {
	if (capInMillions === null || capInMillions === undefined) return "N/A";
	if (capInMillions >= 1000) {
		return `$${(capInMillions / 1000).toFixed(1)}B`;
	}
	return `$${capInMillions.toFixed(1)}M`;
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
