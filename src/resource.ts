import type { Compute } from "./types.ts";

type FetchjaAttributes<Resource> = Resource extends { attributes?: infer Attributes }
  ? Attributes extends object
    ? Attributes
    : object
  : object;

type FetchjaIncludedResource<Identifier, Included> = Identifier extends {
  type: infer Type;
}
  ? Extract<Included, { type: Type }>
  : never;

type FetchjaRelationshipData<Data, Included> = Data extends readonly (infer Item)[]
  ? FetchjaRelationshipItem<Item, Included>[]
  : Data extends null
    ? null
    : FetchjaRelationshipItem<Data, Included>;

type FetchjaRelationshipItem<Item, Included> = [FetchjaIncludedResource<Item, Included>] extends [
  never,
]
  ? Item
  : FetchjaResource<FetchjaIncludedResource<Item, Included>, Included>;

type FetchjaRelationships<Resource, Included> = Resource extends {
  relationships?: infer Relationships extends Record<string, unknown>;
}
  ? {
      [Key in keyof Relationships]: Relationships[Key] extends {
        data?: infer Data;
      }
        ? FetchjaRelationshipData<Data, Included>
        : never;
    }
  : object;

type FetchjaResourceEnvelope<Resource> = Compute<
  Pick<Resource, Extract<keyof Resource, "lid" | "links" | "meta">> &
    (Resource extends { relationships?: infer Relationships }
      ? { relationships?: Relationships }
      : object)
>;

type FetchjaResourceMetadata<Resource> =
  Extract<keyof Resource, "lid" | "links" | "meta" | "relationships"> extends never
    ? object
    : { $: FetchjaResourceEnvelope<Resource> };

/**
 * Converts a raw JSON:API resource type to the shape returned by Fetchja.
 * Attributes are promoted to the resource, and included relationships are
 * resolved by matching their resource `type`.
 *
 * @param Resource - A raw JSON:API resource type, typically generated from OpenAPI.
 * @param Included - The union of raw resources from the document's `included` member.
 */
export type FetchjaResource<Resource, Included = never> = Resource extends {
  type: string;
}
  ? Compute<
      Omit<Resource, "attributes" | "relationships" | "lid" | "links" | "meta"> &
        FetchjaAttributes<Resource> &
        FetchjaRelationships<Resource, Included> &
        FetchjaResourceMetadata<Resource>
    >
  : never;
