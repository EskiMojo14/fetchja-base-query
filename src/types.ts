import type {
  JsonApiError,
  JsonApiLinks,
  JsonApiMeta,
  JsonApiObject,
  RequestOptions,
} from "fetchja";

export type KeyofUnion<T> = T extends T ? keyof T : never;
export type OneOf<T, K extends KeyofUnion<T> = KeyofUnion<T>> = T extends T
  ? T & Partial<Record<Exclude<K, keyof T>, never>>
  : never;

// oxlint-disable-next-line typescript/no-redundant-type-constituents
export type Compute<T> = { [K in keyof T]: T[K] } & unknown;

/** Options passed through to a Fetchja verb method. */
export type FetchjaBaseQueryOptions = Omit<RequestOptions, "url" | "method" | "body">;

/** The arguments accepted by a query created with {@link fetchjaBaseQuery}. */
export type FetchjaBaseQueryArgs =
  | string
  | OneOf<
      | { method: "GET"; model: string; options?: FetchjaBaseQueryOptions }
      | {
          method: "POST" | "PATCH";
          model: string;
          body: Record<string, unknown>;
          options?: FetchjaBaseQueryOptions;
        }
      | { method: "DELETE"; model: string; id: string; options?: FetchjaBaseQueryOptions }
      | { kind: "request"; options: RequestOptions & { url: string } }
    >;

/** The shape of the error surfaced to RTK Query when a request fails. */
export interface FetchjaBaseQueryError {
  status?: number;
  statusText?: string;
  errors?: JsonApiError[];
  data?: Record<string, unknown>;
}

/** The response metadata surfaced to RTK Query alongside a successful result. */
export interface FetchjaBaseQueryMeta {
  // extra top-level keys added by custom clients will be preserved here.
  [key: string]: unknown;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  /** The document's top-level `meta`, `links`, and `jsonapi` members, if present. */
  meta?: JsonApiMeta;
  links?: JsonApiLinks;
  jsonapi?: JsonApiObject;
}
