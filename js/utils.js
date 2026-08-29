var App = App || {};

App.utils = (function () {
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      var v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function round2(n) {
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }

  function todayISO() {
    return dateToISO(new Date());
  }

  function dateToISO(d) {
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  }

  function parseISO(s) {
    var parts = s.split("-").map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  function addDays(iso, n) {
    var d = parseISO(iso);
    d.setDate(d.getDate() + n);
    return dateToISO(d);
  }

  function addMonths(iso, n) {
    var d = parseISO(iso);
    var day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + n);
    var lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, lastDay));
    return dateToISO(d);
  }

  function addYears(iso, n) {
    var d = parseISO(iso);
    d.setFullYear(d.getFullYear() + n);
    return dateToISO(d);
  }

  function startOfMonth(iso) {
    var d = parseISO(iso);
    return dateToISO(new Date(d.getFullYear(), d.getMonth(), 1));
  }

  function endOfMonth(iso) {
    var d = parseISO(iso);
    return dateToISO(new Date(d.getFullYear(), d.getMonth() + 1, 0));
  }

  function startOfYear(iso) {
    var d = parseISO(iso);
    return dateToISO(new Date(d.getFullYear(), 0, 1));
  }

  function endOfYear(iso) {
    var d = parseISO(iso);
    return dateToISO(new Date(d.getFullYear(), 11, 31));
  }

  function monthLabel(iso) {
    var d = parseISO(iso);
    return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  }

  function shortMonthLabel(iso) {
    var d = parseISO(iso);
    return d.toLocaleDateString(undefined, { month: "short" });
  }

  function dayLabel(iso) {
    var d = parseISO(iso);
    var today = todayISO();
    if (iso === today) return "Today";
    if (iso === addDays(today, -1)) return "Yesterday";
    return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  }

  function groupHeaderLabel(iso) {
    var d = parseISO(iso);
    return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  }

  var currencyFormatter = new Intl.NumberFormat(navigator.language || "en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });

  function formatCurrency(n) {
    return currencyFormatter.format(n || 0);
  }

  function formatPlain(n) {
    return round2(n).toFixed(2);
  }

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str == null ? "" : String(str);
    return div.innerHTML;
  }

  function calculateEMI(principal, annualRatePercent, tenureMonths) {
    if (!principal || !tenureMonths || tenureMonths <= 0) return 0;
    var r = (annualRatePercent || 0) / 12 / 100;
    if (r === 0) return round2(principal / tenureMonths);
    var factor = Math.pow(1 + r, tenureMonths);
    return round2((principal * r * factor) / (factor - 1));
  }

  function maskAccountNumber(num) {
    var s = String(num || "");
    if (s.length <= 4) return s;
    return "•••• " + s.slice(-4);
  }

  return {
    uuid: uuid,
    round2: round2,
    todayISO: todayISO,
    dateToISO: dateToISO,
    parseISO: parseISO,
    addDays: addDays,
    addMonths: addMonths,
    addYears: addYears,
    startOfMonth: startOfMonth,
    endOfMonth: endOfMonth,
    startOfYear: startOfYear,
    endOfYear: endOfYear,
    monthLabel: monthLabel,
    shortMonthLabel: shortMonthLabel,
    dayLabel: dayLabel,
    groupHeaderLabel: groupHeaderLabel,
    formatCurrency: formatCurrency,
    formatPlain: formatPlain,
    escapeHtml: escapeHtml,
    calculateEMI: calculateEMI,
    maskAccountNumber: maskAccountNumber,
  };
})();
