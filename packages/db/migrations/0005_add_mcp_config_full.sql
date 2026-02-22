-- Add config column for full MCP server config (stdio, url, desktop).
-- When config is set, it overrides command/args/env for mcp.json output.
-- command/args/env remain for backward compatibility and CLI enable/disable.
ALTER TABLE `project_mcp_servers` ADD COLUMN `config` text;
