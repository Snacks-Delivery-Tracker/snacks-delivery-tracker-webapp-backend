const round2 = (val) => {
  if (typeof val !== 'number' || Number.isNaN(val)) return val;
  return Math.round((val + Number.EPSILON) * 100) / 100;
};

module.exports = round2;