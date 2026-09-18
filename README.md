# genio-one-site

Marketing site for GenioOne, served at [genio.sh](https://genio.sh) via Cloudflare Pages.

## Structure

- `public/` — static site assets deployed as-is
- `public/install.sh` — CE installer script (`curl -fsSL https://genio.sh/install.sh | sh`)

## Deploy

```sh
npx wrangler pages deploy public --project-name genioone-landing
```
