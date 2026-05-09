const CHINA_REDIRECT_ORIGIN = "http://119.91.224.223";
const GEO_ROUTER_HEADER = "x-bigdog-geo-router";
const CF_ARCHIVE_TITLE = "怀旧服";

function buildChinaRedirectUrl(request) {
  const sourceUrl = new URL(request.url);
  const targetUrl = new URL(CHINA_REDIRECT_ORIGIN);
  targetUrl.pathname = sourceUrl.pathname || "/";
  targetUrl.search = sourceUrl.search;
  return targetUrl.toString();
}

function withRouterHeader(response) {
  const headers = new Headers(response.headers);
  headers.set(GEO_ROUTER_HEADER, "active");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

async function rewriteArchiveHtml(response) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) return response;
  const html = await response.text();
  const rewritten = html.replace(/<title>.*?<\/title>/i, `<title>${CF_ARCHIVE_TITLE}</title>`);
  return new Response(rewritten, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  });
}

export default {
  async fetch(request, env) {
    if (request.cf?.country === "CN") {
      return Response.redirect(buildChinaRedirectUrl(request), 302);
    }
    const assetResponse = await env.ASSETS.fetch(request);
    return withRouterHeader(await rewriteArchiveHtml(assetResponse));
  }
};
