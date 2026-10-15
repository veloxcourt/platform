<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Deploying to production

The Vercel project `velox-court/platform` is connected to `github.com/veloxcourt/platform`. Every push to `main` triggers a production deploy automatically.

- To deploy: commit the finished changes and `git push origin main`. That is the whole process.
- NEVER run `vercel --prod` / `vercel deploy`: it uploads the local working tree (including uncommitted work) and lets production diverge from GitHub.
- Before pushing, confirm with the user that every uncommitted change is meant to ship; don't commit work in progress.
- After pushing, check the deploy status with `npx vercel ls platform --prod` and report the result.
