/**
 * @param {string} str
 * @returns {string}
 */
export function encode(str) {
  return unescape(encodeURIComponent(str)).replace(
    /([A-Z])|(\/)|([^ #$&-\)+-9;=@-\[\]^`-{}~])/g,
    (_, cap, slash, misc) =>
      cap
        ? "!" + cap.toLowerCase()
        : slash
          ? "_"
          : "%" + misc.charCodeAt(0).toString(16).toString(2, "0"),
  );
}
/**
 * @param {string} str
 * @returns {string}
 */
export function decode(str) {
  return decodeURIComponent(
    escape(
      str.replace(
        /!([a-z])|(_)|%([0189a-f][0-9a-f]|2[125a]|3[acef]|[57][cf])|(![^a-z]|%(?:[46][0-9a-f]|2[0346-9b-f]|3[0-9bd]|[57][0-9abde]))/g,
        (_, cap, slash, misc, err) =>
          err
            ? (() => {
                throw new Error("invalid escape " + err);
              })()
            : cap
              ? cap.toUpperCase()
              : slash
                ? "/"
                : String.fromCharCode(parseInt(misc, 16)),
      ),
    ),
  );
}
