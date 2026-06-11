interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  meter?: { credits: number };
  cost?: Record<string, unknown>;
  provider?: string;
}

/**
 * endoflife.date MCP.
 *
 * Keyless end-of-life / support timelines for ~460 software products —
 * languages, frameworks, OSes, databases, devices (Python, Node.js, Ubuntu,
 * PostgreSQL, Kubernetes, ...). Answers "when does Python 3.9 lose support?",
 * "what's the latest Ubuntu LTS?", "is Node 18 still supported?". Keyless.
 *
 * Field quirks (handled by mapCycle): eol, support, and lts can each be a
 * DATE STRING (when it ends), a BOOLEAN (false = never EOL / no support window,
 * true = still supported), or ABSENT. We surface these raw + labeled and never
 * compute against the current time (the API ships the dates; the caller compares).
 */


const BASE = 'https://endoflife.date/api';
const UA = 'pipeworx/1.0 (+https://pipeworx.io)';

type RawCycle = Record<string, unknown>;

/** Date string | boolean | absent — keep as-is, normalizing only `absent`. */
function rawDateOrBool(v: unknown, fallback: unknown): unknown {
  return v === undefined ? fallback : v;
}

/**
 * Map a raw endoflife.date cycle to a stable shape. `eol`, `support`, and `lts`
 * are surfaced raw (a date string when there's an end date, or a boolean) so the
 * caller can tell "ends on YYYY-MM-DD" from "never EOL (false)" / "supported (true)".
 */
function mapCycle(raw: RawCycle): Record<string, unknown> {
  return {
    cycle: raw.cycle ?? null,
    release_date: raw.releaseDate ?? null,
    eol: rawDateOrBool(raw.eol, null), // date string (EOL date) OR boolean (false = never EOL)
    support: rawDateOrBool(raw.support, null), // date string (active-support end) OR boolean
    latest: raw.latest ?? null,
    latest_release_date: raw.latestReleaseDate ?? null,
    lts: rawDateOrBool(raw.lts, false), // boolean OR date string (date LTS support begins)
    discontinued: rawDateOrBool(raw.discontinued, null),
  };
}

const tools: McpToolExport['tools'] = [
  {
    name: 'list_products',
    description:
      'List the ~460 software products endoflife.date tracks (languages, frameworks, OSes, databases, devices) as slugs. These slugs feed get_product and get_cycle. Keyless. Use the `search` filter to find one ("postgres", "ubuntu", "node").',
    inputSchema: {
      type: 'object',
      properties: {
        search: {
          type: 'string',
          description: 'Case-insensitive substring filter over product slugs, e.g. "post" matches "postgresql". Optional.',
        },
        limit: {
          type: 'number',
          description: 'Max products to return (default 50, max 200).',
        },
      },
    },
  },
  {
    name: 'get_product',
    description:
      "Get a product's full release/support timeline — every cycle with release date, EOL date, active-support end, latest patch, and LTS status. Use for \"is Node 18 still supported?\" / \"what's the latest Ubuntu LTS?\". `product` is a slug from list_products, e.g. \"python\", \"nodejs\", \"ubuntu\", \"postgresql\", \"kubernetes\". Keyless.",
    inputSchema: {
      type: 'object',
      properties: {
        product: {
          type: 'string',
          description:
            'Product slug from list_products, e.g. "python", "nodejs", "ubuntu", "postgresql", "kubernetes".',
        },
      },
      required: ['product'],
    },
  },
  {
    name: 'get_cycle',
    description:
      'Get a single release cycle\'s support details for a product — release date, EOL, active-support end, latest patch, LTS, and any extended-support window. Use for a precise version question like "when does Python 3.9 lose support?". `product` is a slug from list_products; `cycle` is a version like "3.12", "20.04", "18". Keyless.',
    inputSchema: {
      type: 'object',
      properties: {
        product: {
          type: 'string',
          description: 'Product slug from list_products, e.g. "python", "ubuntu", "nodejs".',
        },
        cycle: {
          type: 'string',
          description: 'Release cycle / version, e.g. "3.12", "20.04", "18".',
        },
      },
      required: ['product', 'cycle'],
    },
  },
];

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  try {
    switch (name) {
      case 'list_products':
        return listProducts(args);
      case 'get_product':
        return getProduct(args);
      case 'get_cycle':
        return getCycle(args);
      default:
        return { error: `Unknown tool: ${name}` };
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

async function listProducts(args: Record<string, unknown>): Promise<unknown> {
  const search = typeof args.search === 'string' ? args.search.trim().toLowerCase() : '';
  let limit = typeof args.limit === 'number' && Number.isFinite(args.limit) ? Math.floor(args.limit) : 50;
  if (limit < 1) limit = 1;
  if (limit > 200) limit = 200;

  const res = await fetch(`${BASE}/all.json`, { headers: { Accept: 'application/json', 'User-Agent': UA } });
  if (!res.ok) return { error: `endoflife.date: ${res.status} ${(await res.text()).slice(0, 200)}` };

  const arr = (await res.json()) as unknown[];
  const all = Array.isArray(arr) ? arr.filter((s): s is string => typeof s === 'string') : [];
  const filtered = search ? all.filter((s) => s.toLowerCase().includes(search)) : all;

  return {
    total: all.length,
    count: Math.min(filtered.length, limit),
    products: filtered.slice(0, limit),
  };
}

async function getProduct(args: Record<string, unknown>): Promise<unknown> {
  const product = typeof args.product === 'string' ? args.product.trim().toLowerCase() : '';
  if (!product) return { error: 'provide a product slug (see list_products)', product: args.product ?? null };

  const res = await fetch(`${BASE}/${encodeURIComponent(product)}.json`, {
    headers: { Accept: 'application/json', 'User-Agent': UA },
  });
  if (res.status === 404)
    return { error: `no such product "${product}" — check list_products`, product };
  if (!res.ok) return { error: `endoflife.date: ${res.status} ${(await res.text()).slice(0, 200)}` };

  const arr = (await res.json()) as RawCycle[];
  const list = Array.isArray(arr) ? arr : [];
  const cap = 30;
  const cycles = list.slice(0, cap).map(mapCycle);

  return {
    product,
    cycle_count: list.length,
    note:
      'eol/support are raw: a date string = the day support/EOL ends; a boolean = false (never EOL / no support window) or true (still supported). lts is a boolean or a date.' +
      (list.length > cap ? ` Showing the ${cap} most-recent of ${list.length} cycles.` : ''),
    cycles,
  };
}

async function getCycle(args: Record<string, unknown>): Promise<unknown> {
  const product = typeof args.product === 'string' ? args.product.trim().toLowerCase() : '';
  const cycle = typeof args.cycle === 'string' ? args.cycle.trim() : '';
  if (!product || !cycle)
    return { error: 'provide both product and cycle (see list_products / get_product)', product: args.product ?? null, cycle: args.cycle ?? null };

  const res = await fetch(`${BASE}/${encodeURIComponent(product)}/${encodeURIComponent(cycle)}.json`, {
    headers: { Accept: 'application/json', 'User-Agent': UA },
  });
  if (res.status === 404)
    return { error: 'no such product/cycle — check list_products and the product\'s cycles via get_product', product, cycle };
  if (!res.ok) return { error: `endoflife.date: ${res.status} ${(await res.text()).slice(0, 200)}` };

  const raw = (await res.json()) as RawCycle;
  const mapped = mapCycle(raw);
  if (mapped.cycle == null) mapped.cycle = cycle; // single-cycle responses sometimes omit `cycle`

  // surface any extra fields the API includes (extendedSupport, codename, etc.)
  const mappedSources = new Set(['cycle', 'releaseDate', 'eol', 'support', 'latest', 'latestReleaseDate', 'lts', 'discontinued']);
  const extras: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!mappedSources.has(k)) extras[k] = v;
  }

  return { product, ...mapped, ...extras };
}

export default { tools, callTool, meter: { credits: 1 } } satisfies McpToolExport;
