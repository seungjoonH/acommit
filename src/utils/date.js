export function nowStamp() {
  const d = new Date();
  const p = n => String(n).padStart(2, "0");

  return (
    `${d.getFullYear()}-` +
    `${p(d.getMonth() + 1)}-` +
    `${p(d.getDate())}_` +
    `${p(d.getHours())}-` +
    `${p(d.getMinutes())}-` +
    `${p(d.getSeconds())}`
  );
}