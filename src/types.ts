import type {
  JsonApiError,
  JsonApiLinks,
  JsonApiMeta,
  JsonApiObject,
  RequestOptions,
} from "fetchja";
import type { Operation, OperationBuilder } from "fetchja/atomic";

export type KeyofUnion<T> = T extends T ? keyof T : never;
export type OneOf<T, K extends KeyofUnion<T> = KeyofUnion<T>> = T extends T
  ? T & Partial<Record<Exclude<K, keyof T>, never>>
  : never;

// oxlint-disable-next-line typescript/no-redundant-type-constituents
export type Compute<T> = { [K in keyof T]: T[K] } & unknown;

/**
 * Options passed through to a Fetchja verb method.
 *
 * Most callers only set `params`, `headers`, or other request options exposed
 * by {@link RequestOptions}.
 */
export type FetchjaBaseQueryOptions = Omit<RequestOptions, "url" | "method" | "body">;

export namespace FetchjaBaseQueryArgs {
  /** Describes a `GET` request for a resource model. */
  export interface Get extends FetchjaBaseQueryOptions {
    method: "GET";
    /** The resource path, e.g. `articles` or `articles/1`. */
    model: string;
  }

  /** Describes a `POST` request for a resource model and body. */
  export interface Post extends FetchjaBaseQueryOptions {
    method: "POST";
    /** The resource name, e.g. `article`. */
    model: string;
    /** The resource to create. */
    body: Record<string, unknown>;
  }

  /** Describes a `PATCH` request for a resource model and body. */
  export interface Patch extends FetchjaBaseQueryOptions {
    method: "PATCH";
    /** The resource name, e.g. `article`. */
    model: string;
    /** The fields to update. When it has an `id`, Fetchja appends it to the URL. */
    body: Record<string, unknown>;
  }

  /** Describes a `DELETE` request for a resource model and resource ID. */
  export interface Delete extends FetchjaBaseQueryOptions {
    method: "DELETE";
    /** The resource name, e.g. `article`. */
    model: string;
    /** The id of the resource to delete. */
    id: string;
  }

  /** Describes a low-level request passed directly to Fetchja. */
  export interface Request extends Omit<RequestOptions, "url"> {
    /** Identifies this as a low-level request descriptor. */
    kind: "request";
    /** The request path, relative to the configured base URL. */
    url: string;
  }

  /** Describes a JSON:API Atomic Operations request. */
  export interface Atomic extends FetchjaBaseQueryOptions {
    /** Identifies this as a JSON:API Atomic Operations request. */
    kind: "atomic";
    /** Builds the ordered operations sent as one server-atomic batch. */
    operations: (op: OperationBuilder) => Operation[];
  }
}

/** The arguments accepted by a query created with {@link fetchjaBaseQuery}. */
export type FetchjaBaseQueryArgs =
  | string
  | OneOf<
      | FetchjaBaseQueryArgs.Get
      | FetchjaBaseQueryArgs.Post
      | FetchjaBaseQueryArgs.Patch
      | FetchjaBaseQueryArgs.Delete
      | FetchjaBaseQueryArgs.Request
      | FetchjaBaseQueryArgs.Atomic
    >;

/** The shape of the error surfaced to RTK Query when a request fails. */
export interface FetchjaBaseQueryError {
  /** The HTTP status code of the failed response. */
  status?: number;
  /** The HTTP status text of the failed response. */
  statusText?: string;
  /** The JSON:API error objects returned by the server. */
  errors?: JsonApiError[];
  /** The whole error document, with its `meta`, `links`, and `jsonapi`. */
  data?: Record<string, unknown>;
}

/** The response metadata surfaced to RTK Query alongside a successful result. */
export interface FetchjaBaseQueryMeta {
  // extra top-level keys added by custom clients will be preserved here.
  [key: string]: unknown;
  /** The HTTP status code. */
  status: number;
  /** The HTTP status text. */
  statusText: string;
  /** The response headers. */
  headers: Record<string, string>;
  /** Non-standard information from the response document. */
  meta?: JsonApiMeta;
  /** The document links. */
  links?: JsonApiLinks;
  /** The object describing the server's implementation. */
  jsonapi?: JsonApiObject;
}
