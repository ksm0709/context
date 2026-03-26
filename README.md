# context

Context plugin for Bun

> A Bun module created from the [bun-module](https://github.com/zenobi-us/bun-module) template

## Usage

<!-- Example usage code goes here -->

## MCP Server

This plugin automatically registers an MCP (Model Context Protocol) server named `context-mcp` with OpenCode. The server provides metadata-first knowledge discovery for `.md` files in `docs/` and `.context/`.

Recommended workflow:
1. Run `search_knowledge` to get ranked candidate notes.
2. Compare each result's path, title, description, tags, score, and snippet.
3. Open the best match with `read_knowledge`.
4. Use the related-note metadata appended to `read_knowledge` output to continue exploring linked notes.

Core knowledge tools:
- `search_knowledge` — returns ranked note summaries so agents can choose what to open next without relying on exact full-text matches.
- `read_knowledge` — opens a selected note and appends linked-note metadata for relevant `[[wikilink]]` references.
- `create_knowledge_note` / `update_knowledge_note` — create and maintain knowledge notes once the relevant context is understood.

## OMX Support

This plugin supports OMX (OpenCode Managed eXtension). See [docs/omx-setup.md](docs/omx-setup.md) for setup instructions.

## Installation

<!-- Installation instructions go here -->

## Development

- `mise run build` - Build the module
- `mise run test` - Run tests
- `mise run lint` - Lint code
- `mise run lint:fix` - Fix linting issues
- `mise run format` - Format code with Prettier

## Release

See the [RELEASE.md](RELEASE.md) file for instructions on how to release a new version of the module.

## Contributing

Contributions are welcome! Please file issues or submit pull requests on the GitHub repository.

## License

See the [LICENSE](LICENSE) file for details.
