import 'server-only';

import { cache } from 'react';

/**
 * data/vendor-offer/primary-resolver.ts — storefront query-layer adapter for
 * the primary vendor resolver per STORY-4-2-PRIMARY-VENDOR-RESOLVER §AC-PVR-4.2.
 *
 * Locked behaviour while `multi_vendor_pricing_enabled=false` (D-77 / ADR-070):
 *   return shape is `{ primary, secondary: [] }` — `secondary` ALWAYS empty
 *   in v1.5.0. v1.6.0 flag-flip populates `secondary` additively without any
 *   callsite type-signature change (story §E8 Reverse Engineering).
 *
 * React 19 `cache()` wraps the **constructor** of the per-request loader so
 * each RSC request scope gets ONE loader instance — NOT individual lookups
 * (story §AC-PVR-4.2-01, Method 2 Frontend Specialist guidance §E1, PAT-5).
 *
 * Server-only segregation (AR-26): `import 'server-only'` is the FIRST line
 * of this module so the Next.js build analyzer fails the build if a client
 * component imports it transitively. The backend resolver implementation is
 * a pure server module under `GP/backend/src/modules/vendor-offer/`; the
 * storefront re-imports the algorithm and the typed surface only.
 *
 * @see _bmad-output/implementation-artifacts/v150/STORY-4-2-PRIMARY-VENDOR-RESOLVER.md
 */

// -----------------------------------------------------------------------------
// Stable type contract (subset re-stated locally — keeps storefront compile
// independent from the backend submodule pin until @gp/vendor-offer ships).
// -----------------------------------------------------------------------------

export type VendorOfferStatus = 'active' | 'suspended' | 'archived';

export interface VendorOffer {
  id: string;
  vendor_id: string;
  product_id: string;
  price_amount: number;
  price_currency: string;
  status: VendorOfferStatus;
  incumbent_marker: boolean;
  primary?: boolean;
  created_at: Date | string;
  updated_at?: Date | string;
}

export type PrimaryVendorKey = { productId: string };

export type PrimaryVendorResolution = {
  primary: VendorOffer | null;
  secondary: VendorOffer[];
};

// -----------------------------------------------------------------------------
// DataLoader-compatible shim (interface-faithful with facebook/dataloader)
// -----------------------------------------------------------------------------

type BatchLoadFn<K, V> = (keys: ReadonlyArray<K>) => Promise<ReadonlyArray<V | Error>>;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface DataLoaderOptions<K, V> {
  batch?: boolean;
  maxBatchSize?: number;
  cache?: boolean;
  cacheKeyFn?: (key: K) => string;
  batchScheduleFn?: (callback: () => void) => void;
}

class DataLoader<K, V> {
  private readonly batchFn: BatchLoadFn<K, V>;
  private readonly options: Required<
    Pick<DataLoaderOptions<K, V>, 'batch' | 'maxBatchSize' | 'cache'>
  > &
    Pick<DataLoaderOptions<K, V>, 'cacheKeyFn' | 'batchScheduleFn'>;

  private readonly resultCache: Map<string, Promise<V>> = new Map();
  private pending: Array<{
    key: K;
    cacheKey: string;
    resolve: (value: V) => void;
    reject: (err: Error) => void;
  }> = [];
  private scheduled = false;

  /** Per-instance counter — used by callsite tests to verify N+1 prevention. */
  public readonly _stats = { batchCalls: 0, totalKeys: 0 };

  constructor(batchFn: BatchLoadFn<K, V>, options: DataLoaderOptions<K, V> = {}) {
    this.batchFn = batchFn;
    this.options = {
      batch: options.batch ?? true,
      maxBatchSize: options.maxBatchSize ?? Infinity,
      cache: options.cache ?? true,
      cacheKeyFn: options.cacheKeyFn,
      batchScheduleFn: options.batchScheduleFn,
    };
  }

  load(key: K): Promise<V> {
    const cacheKey = this.cacheKeyOf(key);
    if (this.options.cache) {
      const hit = this.resultCache.get(cacheKey);
      if (hit) {
        return hit;
      }
    }
    const promise = new Promise<V>((resolve, reject) => {
      this.pending.push({ key, cacheKey, resolve, reject });
    });
    if (this.options.cache) {
      this.resultCache.set(cacheKey, promise);
    }
    this.schedule();
    return promise;
  }

  clear(key: K): this {
    this.resultCache.delete(this.cacheKeyOf(key));
    return this;
  }

  clearAll(): this {
    this.resultCache.clear();
    return this;
  }

  private cacheKeyOf(key: K): string {
    return this.options.cacheKeyFn ? this.options.cacheKeyFn(key) : String(key);
  }

  private schedule(): void {
    if (this.scheduled) {
      return;
    }
    this.scheduled = true;
    const dispatch = () => {
      this.scheduled = false;
      void this.dispatch();
    };
    if (this.options.batchScheduleFn) {
      this.options.batchScheduleFn(dispatch);
    } else {
      Promise.resolve().then(dispatch);
    }
  }

  private async dispatch(): Promise<void> {
    if (this.pending.length === 0) {
      return;
    }
    const queue = this.pending;
    this.pending = [];
    const maxBatch = this.options.batch ? this.options.maxBatchSize : 1;
    for (let i = 0; i < queue.length; i += maxBatch) {
      const slice = queue.slice(i, i + maxBatch);
      this._stats.batchCalls += 1;
      this._stats.totalKeys += slice.length;
      try {
        const values = await this.batchFn(slice.map((q) => q.key));
        if (values.length !== slice.length) {
          const err = new Error(
            `DataLoader batch function returned ${values.length} values for ${slice.length} keys`
          );
          slice.forEach((q) => q.reject(err));
          continue;
        }
        slice.forEach((q, idx) => {
          const v = values[idx];
          if (v instanceof Error) {
            q.reject(v);
          } else {
            q.resolve(v);
          }
        });
      } catch (err) {
        slice.forEach((q) => q.reject(err as Error));
      }
    }
  }
}

// -----------------------------------------------------------------------------
// Public façade
// -----------------------------------------------------------------------------

/**
 * VendorOfferReadPort — minimal port the storefront depends on. The concrete
 * implementation calls the backend (e.g. via Medusa SDK or REST) and returns
 * the active offers for the requested product ids. Wired by callers (typically
 * via `getDefaultPort()`); kept narrow so we never leak the backend's full
 * Mikro-ORM surface into the storefront bundle.
 */
export interface VendorOfferReadPort {
  findActiveByProductIds(
    productIds: ReadonlyArray<string>
  ): Promise<ReadonlyArray<VendorOffer>>;
}

/** Key normalizer — exported so callsite tests can verify behaviour. */
export function normalizePrimaryVendorKey(key: PrimaryVendorKey): string {
  if (key === null || key === undefined) {
    throw new TypeError('PrimaryVendorKey: null/undefined key');
  }
  if (typeof key.productId !== 'string' || key.productId.trim().length === 0) {
    throw new TypeError('PrimaryVendorKey.productId required (non-empty string)');
  }
  return key.productId;
}

/**
 * Build the DataLoader batch function over a port. Pure — used both by the
 * cache-wrapped factory below and by tests that exercise the algorithm.
 */
export function buildPrimaryVendorBatchFn(
  port: VendorOfferReadPort
): BatchLoadFn<PrimaryVendorKey, PrimaryVendorResolution> {
  return async (keys) => {
    const productIds = keys.map((k) => k.productId);
    const rows = await port.findActiveByProductIds(productIds);

    const grouped = new Map<string, VendorOffer[]>();
    for (const row of rows) {
      if (row.status !== 'active') {
        continue;
      }
      const arr = grouped.get(row.product_id);
      if (arr) {
        arr.push(row);
      } else {
        grouped.set(row.product_id, [row]);
      }
    }

    return keys.map<PrimaryVendorResolution>((k) => {
      const list = grouped.get(k.productId);
      if (!list || list.length === 0) {
        return { primary: null, secondary: [] };
      }
      const sorted = [...list].sort((a, b) => {
        if (a.incumbent_marker !== b.incumbent_marker) {
          return a.incumbent_marker ? -1 : 1;
        }
        const ca = typeof a.created_at === 'string' ? a.created_at : a.created_at.toISOString();
        const cb = typeof b.created_at === 'string' ? b.created_at : b.created_at.toISOString();
        if (ca !== cb) {
          return ca < cb ? -1 : 1;
        }
        return a.id < b.id ? -1 : 1;
      });
      // Locked flag-off return shape — secondary ALWAYS [] in v1.5.0.
      return { primary: sorted[0], secondary: [] };
    });
  };
}

/** Default loader options — locked at AC-PVR-4.2-01. */
export const PRIMARY_VENDOR_LOADER_OPTIONS: DataLoaderOptions<
  PrimaryVendorKey,
  PrimaryVendorResolution
> = {
  batch: true,
  maxBatchSize: 100,
  cache: true,
  cacheKeyFn: normalizePrimaryVendorKey,
  batchScheduleFn: (cb) => {
    setTimeout(cb, 1);
  },
};

/**
 * Internal port resolver — kept module-private so callers cannot accidentally
 * inject a port that breaks the server-only contract. The default port lazily
 * imports the SDK (server-side) and adapts its response into VendorOffer rows.
 *
 * The factory is `cache()`-wrapped below; one DataLoader per RSC request.
 */
let _portResolver: () => VendorOfferReadPort = () => {
  throw new Error(
    'data/vendor-offer/primary-resolver: no VendorOfferReadPort registered. ' +
      'Call setVendorOfferReadPort() during app bootstrap (or in tests) before ' +
      'invoking getPrimaryVendorForProduct().'
  );
};

/** Wire the runtime port. Call once during app bootstrap (or in tests). */
export function setVendorOfferReadPort(port: VendorOfferReadPort): void {
  _portResolver = () => port;
}

/** Reset the port (test-only convenience). */
export function resetVendorOfferReadPort(): void {
  _portResolver = () => {
    throw new Error('data/vendor-offer/primary-resolver: port not registered');
  };
}

/**
 * `cache()`-wrapped DataLoader CONSTRUCTOR — exposed as a stable named export
 * so the AC-PVR-4.2-01 integration test can assert the same loader instance
 * is returned within a request scope.
 *
 * The port is resolved **lazily on each batch dispatch** (not at construction
 * time) so a request that runs through wiring middleware after the loader
 * was first instantiated still picks up the correct port. The DataLoader
 * instance itself is memoised by `cache()` per-request — that is the AC-PVR-4.2-01
 * "constructor wrapped in cache()" guarantee.
 */
export const getPrimaryVendorLoader = cache(() => {
  return new DataLoader<PrimaryVendorKey, PrimaryVendorResolution>(
    (keys) => buildPrimaryVendorBatchFn(_portResolver())(keys),
    PRIMARY_VENDOR_LOADER_OPTIONS
  );
});

/**
 * Public callsite façade. Every entry in `manual-registry` reads via this
 * symbol; the grep CI lint enforces it.
 */
export async function getPrimaryVendorForProduct(
  productId: string
): Promise<PrimaryVendorResolution> {
  // Validate up-front so callers get a synchronous-style error on misuse.
  normalizePrimaryVendorKey({ productId });
  const loader = getPrimaryVendorLoader();
  return loader.load({ productId });
}

/** Test-only helper — exposes the DataLoader class for instance-of assertions. */
export const __test = {
  DataLoader,
};
