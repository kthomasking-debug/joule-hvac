const asNum = (v) => {
  const s = ('' + v).trim();
  if (!/\d/.test(s)) return NaN;
  const n = Number(s.replace(/[^\d\-.]/g, ''));
  return Number.isFinite(n) ? n : NaN;
};

console.log('heat ->', asNum('heat'));
console.log('70 ->', asNum('70'));
console.log('70.1 ->', asNum('70.1'));
console.log('70F ->', asNum('70F'));
console.log('F70 ->', asNum('F70'));
console.log(' - 70 ->', asNum(' - 70 '));
console.log('empty ->', asNum(''));
