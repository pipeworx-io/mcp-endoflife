# mcp-endoflife

endoflife.date MCP.

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1394+ live data sources.

## Tools

| Tool | Description |
|------|-------------|
| `list_products` | List the ~460 software products endoflife.date tracks (languages, frameworks, OSes, databases, devices) as slugs. These slugs feed get_product and get_cycle. Keyless. Use the `search` filter to find one ("postgres", "ubuntu", "node"). |
| `get_product` | Get a product's full release/support timeline — every cycle with release date, EOL date, active-support end, latest patch, and LTS status. Use for "is Node 18 still supported?" / "what's the latest Ubuntu LTS?". `product` is a slug from list_products, e.g. "python", "nodejs", "ubuntu", "postgresql", "kubernetes". Keyless. |
| `get_cycle` | Get a single release cycle's support details for a product — release date, EOL, active-support end, latest patch, LTS, and any extended-support window. Use for a precise version question like "when does Python 3.9 lose support?". `product` is a slug from list_products; `cycle` is a version like "3.12", "20.04", "18". Keyless. |

## Quick Start

Add to your MCP client (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "endoflife": {
      "url": "https://gateway.pipeworx.io/endoflife/mcp"
    }
  }
}
```

Or connect to the full Pipeworx gateway for access to all 1394+ data sources:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English:

```
ask_pipeworx({ question: "your question about Endoflife data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
