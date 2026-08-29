import { ApiReference } from "@scalar/nextjs-api-reference";

export const GET = ApiReference({
  metaData: {
    title: "zkMCP Playground API",
  },
  theme: "default",
  url: "/openapi.json",
});
