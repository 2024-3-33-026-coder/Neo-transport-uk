/**
 * IDEAL POSTCODES ADDRESS AUTOCOMPLETE & RESOLUTION SERVICE
 * 
 * Server-side client for the official Ideal Postcodes Address Autocomplete API.
 * 
 * Documentation:
 * - Autocomplete: GET https://api.ideal-postcodes.co.uk/v1/autocomplete/addresses
 * - Resolve (PAF/ID): GET https://api.ideal-postcodes.co.uk/v1/autocomplete/addresses/:id/gbr
 * - Resolve (UDPRN): GET https://api.ideal-postcodes.co.uk/v1/udprn/:udprn
 * 
 * SECURITY:
 * - API keys are strictly read from process.env (IDEAL_POSTCODES_API_KEY).
 * - API keys are NEVER logged or sent to the browser.
 * - Test isolation helper allows deterministic unit tests without live network calls.
 */

export interface AddressSuggestionHit {
  id: string;
  suggestion: string;
  udprn?: number | string;
  urls?: {
    udprn?: string;
  };
}

export interface AddressSuggestionsResult {
  success: boolean;
  configured: boolean;
  query: string;
  hits: AddressSuggestionHit[];
  message?: string;
  error?: string;
}

export interface ResolvedAddressDetails {
  id: string;
  suggestion: string;
  formattedAddress: string;
  postcode: string;
  line_1: string;
  line_2?: string;
  line_3?: string;
  post_town: string;
  county?: string;
  country?: string;
  udprn?: number | string;
  uprn?: number | string;
  latitude: number | null;
  longitude: number | null;
}

export interface AddressResolutionResult {
  success: boolean;
  configured: boolean;
  address?: ResolvedAddressDetails;
  error?: string;
  message?: string;
}

let customFetcherForTesting: typeof fetch | null = null;

export function setCustomAddressFetcherForTesting(fn: typeof fetch | null): void {
  customFetcherForTesting = fn;
}

export function getIdealPostcodesApiKey(): string | null {
  const key = process.env.IDEAL_POSTCODES_API_KEY || process.env.VITE_IDEAL_POSTCODES_API_KEY;
  if (!key || typeof key !== 'string' || !key.trim()) {
    return null;
  }
  return key.trim();
}

/**
 * Fetch address suggestions matching a partial query string.
 */
export async function fetchAddressSuggestions(
  query: string,
  options?: { apiKey?: string; fetchFn?: typeof fetch }
): Promise<AddressSuggestionsResult> {
  const cleanQuery = (query || '').trim();
  if (!cleanQuery || cleanQuery.length < 2) {
    return {
      success: true,
      configured: true,
      query: cleanQuery,
      hits: [],
    };
  }

  const apiKey = options?.apiKey || getIdealPostcodesApiKey();
  if (!apiKey) {
    return {
      success: false,
      configured: false,
      query: cleanQuery,
      hits: [],
      error: 'IDEAL_POSTCODES_API_KEY is not configured in the application environment.',
      message: 'Address autocomplete is unavailable because IDEAL_POSTCODES_API_KEY is not configured.',
    };
  }

  const fetchFn = options?.fetchFn || customFetcherForTesting || fetch;
  const url = `https://api.ideal-postcodes.co.uk/v1/autocomplete/addresses?api_key=${encodeURIComponent(
    apiKey
  )}&query=${encodeURIComponent(cleanQuery)}`;

  try {
    const res = await fetchFn(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      let errMsg = `Ideal Postcodes API error (HTTP ${res.status})`;
      if (res.status === 401) {
        errMsg = 'Ideal Postcodes authentication failed: Invalid or expired API key.';
      } else if (res.status === 402) {
        errMsg = 'Ideal Postcodes lookup balance exhausted or payment required.';
      } else if (res.status === 404) {
        return {
          success: true,
          configured: true,
          query: cleanQuery,
          hits: [],
        };
      }
      return {
        success: false,
        configured: true,
        query: cleanQuery,
        hits: [],
        error: errMsg,
      };
    }

    const data = (await res.json()) as any;
    const rawHits = data?.result?.hits;
    const hits: AddressSuggestionHit[] = Array.isArray(rawHits)
      ? rawHits.map((h: any) => ({
          id: String(h.id || h.udprn || ''),
          suggestion: String(h.suggestion || ''),
          udprn: h.udprn,
          urls: h.urls,
        }))
      : [];

    return {
      success: true,
      configured: true,
      query: cleanQuery,
      hits,
    };
  } catch (err: any) {
    return {
      success: false,
      configured: true,
      query: cleanQuery,
      hits: [],
      error: `Network error reaching Ideal Postcodes API: ${err?.message || String(err)}`,
    };
  }
}

/**
 * Resolve a selected address suggestion to full details including formatted address,
 * postcode, provider address ID, and coordinates when available.
 */
export async function resolveAddress(
  params: { id?: string; udprn?: number | string; suggestion?: string },
  options?: { apiKey?: string; fetchFn?: typeof fetch }
): Promise<AddressResolutionResult> {
  const { id, udprn, suggestion } = params;
  if (!id && !udprn) {
    return {
      success: false,
      configured: true,
      error: 'Either address ID or UDPRN is required to resolve address details.',
    };
  }

  const apiKey = options?.apiKey || getIdealPostcodesApiKey();
  if (!apiKey) {
    return {
      success: false,
      configured: false,
      error: 'IDEAL_POSTCODES_API_KEY is not configured in the application environment.',
      message: 'Address resolution is unavailable because IDEAL_POSTCODES_API_KEY is not configured.',
    };
  }

  const fetchFn = options?.fetchFn || customFetcherForTesting || fetch;

  // Prefer UDPRN endpoint if udprn is provided, otherwise use autocomplete resolve endpoint
  let targetUrl: string;
  if (udprn) {
    targetUrl = `https://api.ideal-postcodes.co.uk/v1/udprn/${encodeURIComponent(
      String(udprn)
    )}?api_key=${encodeURIComponent(apiKey)}`;
  } else {
    targetUrl = `https://api.ideal-postcodes.co.uk/v1/autocomplete/addresses/${encodeURIComponent(
      String(id)
    )}/gbr?api_key=${encodeURIComponent(apiKey)}`;
  }

  try {
    const res = await fetchFn(targetUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      let errMsg = `Ideal Postcodes resolution error (HTTP ${res.status})`;
      if (res.status === 401) {
        errMsg = 'Ideal Postcodes authentication failed: Invalid or expired API key.';
      } else if (res.status === 402) {
        errMsg = 'Ideal Postcodes lookup balance exhausted or payment required.';
      } else if (res.status === 404) {
        errMsg = 'Address record not found for the specified suggestion ID.';
      }
      return {
        success: false,
        configured: true,
        error: errMsg,
      };
    }

    const data = (await res.json()) as any;
    const item = data?.result;
    if (!item) {
      return {
        success: false,
        configured: true,
        error: 'Address response payload did not contain a valid result object.',
      };
    }

    const line_1 = String(item.line_1 || '').trim();
    const line_2 = item.line_2 ? String(item.line_2).trim() : undefined;
    const line_3 = item.line_3 ? String(item.line_3).trim() : undefined;
    const post_town = String(item.post_town || item.town_or_city || '').trim();
    const postcode = String(item.postcode || '').trim().toUpperCase();
    const county = item.county ? String(item.county).trim() : undefined;
    const country = item.country ? String(item.country).trim() : 'United Kingdom';

    // Format address cleanly: e.g. "10 Downing Street, London, SW1A 2AA"
    const formattedParts = [line_1, line_2, line_3, post_town, postcode].filter(Boolean);
    const formattedAddress = formattedParts.join(', ') || suggestion || postcode;

    const lat = typeof item.latitude === 'number' && Number.isFinite(item.latitude) ? item.latitude : null;
    const lng = typeof item.longitude === 'number' && Number.isFinite(item.longitude) ? item.longitude : null;

    const addressDetails: ResolvedAddressDetails = {
      id: String(id || udprn || item.udprn || ''),
      suggestion: suggestion || formattedAddress,
      formattedAddress,
      postcode,
      line_1,
      line_2,
      line_3,
      post_town,
      county,
      country,
      udprn: item.udprn || udprn,
      uprn: item.uprn,
      latitude: lat,
      longitude: lng,
    };

    return {
      success: true,
      configured: true,
      address: addressDetails,
    };
  } catch (err: any) {
    return {
      success: false,
      configured: true,
      error: `Network error resolving address details: ${err?.message || String(err)}`,
    };
  }
}
