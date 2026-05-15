/**
 * Returns today's date as YYYY-MM-DD in the user's LOCAL timezone.
 * Use this instead of new Date().toISOString().split('T')[0] which gives UTC date.
 * UTC can be wrong around midnight (e.g. 11pm PST Feb 10 = 7am UTC Feb 11).
 *
 * @param {Date} [d=new Date()] - Optional date to format
 * @returns {string} Local date string YYYY-MM-DD
 */
export const getLocalDateString = (d = new Date()) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
