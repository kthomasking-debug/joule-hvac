# VS Code Recommended Settings for Joule HVAC

This workspace includes workspace settings to improve developer experience for working with the React + Vite + Capacitor project.

## What was added
- `.vscode/settings.json` updated with:
  - Auto-saving on focus change and formatting on save
  - ESLint autofix on save for quick lint fixes
  - Prettier as the default formatter for JS/TS/JSON
  - Exclude `node_modules`, `dist`, `build`, and Android build folders from file watcher and search
  - Terminal settings (font family & scrollback)
  - `chat.agent.maxRequests: 35` guidance (for GitHub Copilot Chat)

- `.vscode/extensions.json` with recommended extensions (ESLint, Prettier, GitLens, DotENV, and optional Copilot & Copilot Chat).

## The `chat.agent.maxRequests` setting
- Where it fits: This setting is for GitHub Copilot Chat (or other agentic/assistant extensions) and limits how many chained/interactive 'requests' or back-and-forth 'thought steps' the agent can perform in a single user prompt/session.
- Keep default: The default (35) is sensible. Raise it only if you run long, multi-step agent workflows often and get interrupted by the 'limit reached' prompt.
- If you want to change it per project, modify it in `.vscode/settings.json`.

## Extensions we recommend
- ESLint (dbaeumer.vscode-eslint)
- Prettier (esbenp.prettier-vscode)
- GitLens (eamodio.gitlens)
- DotENV (dotnetsa.dotenv or mikestead.dotenv)
- GitHub Copilot (optional) + GitHub Copilot Chat (optional)

## Run/Dev tips
- The workspace's `npm` scripts are in `package.json`. The most common commands are:

```powershell
npm run dev     # start Vite dev server
npm test        # run the test suite (vitest)
npm run build   # build the app
```

- If you use Prettier or ESLint plugins, make sure to align project config: the workspace expects your `.eslintrc` and Prettier settings to be present and configured (both are used in the project already).

## Next steps (optional)
- Add optional `editor.rulers` or `editor.wordWrap` to match your team coding standards.
- Add an `.editorconfig` at the repo root to make editor settings consistent across IDEs.
- If you want me to apply these settings to the user's global settings or to CI, I can add instructions or a small script to enforce consistent settings.

If you'd like, I can also enable a project-level `.editorconfig` and `pre-commit` hooks (husky + lint-staged) so that this project auto-formats and lint-fixes on commit.
