// Sample data for the landing preview and the "Run the example" action.
// A fictional shop that wants to opt out of AI training crawlers and tidy its search pages.
export const SAMPLE_CURRENT = `# robots.txt for shop.example (live today)
User-agent: *
Disallow: /cart
Disallow: /checkout/
Disallow: /account/
Allow: /account/help
Disallow: /*?sort=

Sitemap: https://shop.example/sitemap.xml
`;

export const SAMPLE_PROPOSED = `# Proposed: block AI training crawlers, hide internal search
User-agent: *
Disallow: /cart
Disallow: /checkout/
Disallow: /account/
Allow: /account/help
Disallow: /search

User-agent: GPTBot
User-agent: ClaudeBot
User-agent: Google-Extended
User-agent: CCBot
Disallow: /

Sitemap: https://shop.example/sitemap.xml
`;

export const SAMPLE_PATHS = `/
/products/linen-shirt
/collections/summer?sort=price
/searchlight-collection
/search?q=linen
/account/help
/checkout/payment
/blog/care-guide
`;
