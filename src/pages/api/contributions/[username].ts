import type { APIRoute } from 'astro';

export const prerender = false;

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry {
	data: unknown;
	expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

export const GET: APIRoute = async ({ params }) => {
	const { username } = params;

	if (!username || !/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/.test(username)) {
		return new Response(JSON.stringify({ error: 'Invalid username' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	const cached = cache.get(username);
	if (cached && cached.expiresAt > Date.now()) {
		return new Response(JSON.stringify(cached.data), {
			status: 200,
			headers: {
				'Content-Type': 'application/json',
				'X-Cache': 'HIT',
			},
		});
	}

	let response: Response;
	try {
		response = await fetch(`https://github.com/${username}.contribs`, {
			headers: { Accept: 'application/json' },
		});
	} catch {
		return new Response(JSON.stringify({ error: 'Failed to reach GitHub' }), {
			status: 502,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	if (response.status === 404) {
		return new Response(JSON.stringify({ error: 'User not found' }), {
			status: 404,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	if (!response.ok) {
		return new Response(JSON.stringify({ error: 'GitHub API error' }), {
			status: 502,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	let data: unknown;
	try {
		data = await response.json();
	} catch {
		return new Response(JSON.stringify({ error: 'Invalid response from GitHub' }), {
			status: 502,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	cache.set(username, { data, expiresAt: Date.now() + CACHE_TTL_MS });

	return new Response(JSON.stringify(data), {
		status: 200,
		headers: {
			'Content-Type': 'application/json',
			'X-Cache': 'MISS',
		},
	});
};
