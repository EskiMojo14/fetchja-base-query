import { expectTypeOf } from "vite-plus/test";
import type { FetchjaResource } from "./resource.ts";

interface RawArticle {
  type: "articles";
  id: string;
  attributes: { title: string };
  relationships: {
    author: { data: { type: "people"; id: string } };
    comments: { data: { type: "comments"; id: string }[] };
  };
}

interface RawPerson {
  type: "people";
  id: string;
  attributes: { name: string };
}

interface RawComment {
  type: "comments";
  id: string;
  attributes: { body: string };
}

type Article = FetchjaResource<RawArticle, RawPerson | RawComment>;

type ExpectedArticle = {
  type: "articles";
  id: string;
  title: string;
  author: {
    type: "people";
    id: string;
    name: string;
  };
  comments: {
    type: "comments";
    id: string;
    body: string;
  }[];
  $: {
    relationships?: RawArticle["relationships"];
  };
};

expectTypeOf<Article>().toEqualTypeOf<ExpectedArticle>();

interface RawArticleWithoutIncluded {
  type: "articles";
  id: string;
  relationships: {
    author: { data: { type: "people"; id: string } };
  };
}

type ArticleWithoutIncluded = FetchjaResource<RawArticleWithoutIncluded>;

type ExpectedIdentifier = {
  type: "people";
  id: string;
};

expectTypeOf<ArticleWithoutIncluded["author"]>().toEqualTypeOf<ExpectedIdentifier>({
  type: "people",
  id: "id",
});
