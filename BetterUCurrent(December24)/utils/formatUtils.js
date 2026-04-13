/**
 * Formats a number to have at most one decimal place
 * @param {number} num - The number to format
 * @returns {string} The formatted number
 */
export const formatNumber = (num) => {
  if (typeof num !== 'number') return '0';
  return Number(num.toFixed(1)).toString();
};

/**
 * Formats a weight value with the appropriate unit
 * @param {number} weight - The weight value
 * @param {string} unit - The unit ('kg' or 'lbs')
 * @returns {string} The formatted weight
 */
export const formatWeight = (weight, unit) => {
  if (typeof weight !== 'number') return '0';
  return `${formatNumber(weight)} ${unit}`;
};

/**
 * Formats a height value with the appropriate unit
 * @param {number} height - The height value
 * @param {string} unit - The unit ('cm' or 'in')
 * @returns {string} The formatted height
 */
export const formatHeight = (height, unit) => {
  if (typeof height !== 'number') return '0';
  return `${formatNumber(height)} ${unit}`;
};

/**
 * Formats a time value in minutes
 * @param {number} minutes - The time in minutes
 * @returns {string} The formatted time
 */
export const formatTime = (minutes) => {
  if (typeof minutes !== 'number') return '0';
  return `${formatNumber(minutes)} min`;
};

/**
 * Formats a percentage value
 * @param {number} value - The percentage value
 * @returns {string} The formatted percentage
 */
export const formatPercentage = (value) => {
  if (typeof value !== 'number') return '0%';
  return `${formatNumber(value)}%`;
};

/**
 * Formats a BMI value
 * @param {number} bmi - The BMI value
 * @returns {string} The formatted BMI
 */
export const formatBMI = (bmi) => {
  if (typeof bmi !== 'number') return '0';
  return formatNumber(bmi);
};

/**
 * Formats calories
 * @param {number} calories - The calorie value
 * @returns {string} The formatted calories
 */
export const formatCalories = (calories) => {
  if (typeof calories !== 'number') return '0';
  return `${Math.round(calories)} cal`;
}; 