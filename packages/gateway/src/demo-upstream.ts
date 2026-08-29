import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { createDemoToolServer } from "./demo-tools.js";

serveStdio(createDemoToolServer, {
  onerror: (error) => {
    console.error("[zkmcp-demo-tools] MCP error:", error.message);
  },
});
