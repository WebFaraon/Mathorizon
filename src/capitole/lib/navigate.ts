/**
 * URL of a chapter (optionally a specific subcategory/exercise within it).
 *
 * Mirrors BM.gotoCategory() (js/utils.js) exactly — same page, same query
 * parameters, same precedence (sub only makes it in alongside id; ex only
 * alongside sub) — but returns the URL instead of assigning location.href,
 * so a card can be a real <a href>. category.html is not migrated, so this
 * must keep matching it.
 */
export function categoryHref(categoryId: string, subcategoryId?: string, exerciseId?: string): string {
  let url = `category.html?id=${encodeURIComponent(categoryId)}`;
  if (subcategoryId) url += `&sub=${encodeURIComponent(subcategoryId)}`;
  if (exerciseId) url += `&ex=${encodeURIComponent(exerciseId)}`;
  return url;
}
