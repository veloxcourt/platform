<!-- BEGIN:nextjs-agent-rules -->
# Next.js 16 (may differ from your training data)

Only when the task touches Next.js APIs (routing, layouts, server actions, caching, `params`/`searchParams`, middleware/proxy, metadata, config), grep `node_modules/next/dist/docs/` for that specific API and read just the matching section. Skip the docs for pure UI, styling, copy or domain-logic changes.
<!-- END:nextjs-agent-rules -->

# Working efficiently

- Go straight to the files the user names; search narrowly (Grep for a symbol) instead of exploring the tree.
- Project layout: routes and server actions in `src/app`, UI by area in `src/components/features/<area>`, shadcn primitives in `src/components/ui`, business logic in `src/modules/<area>/{domain,application,infrastructure}`.
- Before writing a new component, reuse the closest existing sibling as the pattern.
- Never read `*.pdf`, images, `*.svg` logos or `node_modules` (except the Next docs above) unless asked.
- Verify with `npx tsc --noEmit` and `npx eslint <changed files>`. Don't run `npm run build` (it applies the DB schema) or start the dev server unless asked.
- Keep replies short: what changed and anything the user must do.

# Deploying to production

The Vercel project `velox-court/platform` is connected to `github.com/veloxcourt/platform`. Every push to `main` triggers a production deploy automatically.

- To deploy: commit the finished changes and `git push origin main`. That is the whole process.
- NEVER run `vercel --prod` / `vercel deploy`: it uploads the local working tree (including uncommitted work) and lets production diverge from GitHub.
- Before pushing, confirm with the user that every uncommitted change is meant to ship; don't commit work in progress.
- After pushing, check the deploy status with `npx vercel ls platform --prod` and report the result.
