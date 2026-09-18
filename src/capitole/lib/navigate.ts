/**
 * URL of a chapter's exercise page.
 *
 * Mirrors BM.gotoCategory() (js/utils.js) exactly — same page, same query
 * parameter — but returns the URL instead of assigning location.href, so a
 * chapter card can be a real <a href>. category.html is not migrated, so
 * this must keep matching it.
 */
export function categoryHref(categoryId: string): string {
  return `category.html?id=${encodeURIComponent(categoryId)}`;
}
