var App = App || {};

App.charts = (function () {
  var u = App.utils;

  function setupCanvas(canvas) {
    var ratio = window.devicePixelRatio || 1;
    var rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    var ctx = canvas.getContext("2d");
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    return { ctx: ctx, w: rect.width, h: rect.height };
  }

  // Horizontal bar chart: items = [{label, value, color}]
  function horizontalBars(canvas, items) {
    var s = setupCanvas(canvas);
    var ctx = s.ctx, w = s.w, h = s.h;
    ctx.clearRect(0, 0, w, h);
    if (!items.length) {
      emptyState(ctx, w, h);
      return;
    }
    var max = Math.max.apply(null, items.map(function (i) { return i.value; })) || 1;
    var rowH = h / items.length;
    var barH = Math.min(22, rowH * 0.5);
    var labelW = 92;
    var total = items.reduce(function (s, i) { return s + i.value; }, 0) || 1;

    ctx.font = "13px -apple-system, system-ui, sans-serif";
    ctx.textBaseline = "middle";

    items.forEach(function (item, idx) {
      var y = rowH * idx + rowH / 2;
      ctx.fillStyle = getCss("--text-secondary");
      ctx.textAlign = "left";
      ctx.fillText(truncate(item.label, 12), 0, y - barH / 2 - 8);

      var barMaxW = w - labelW;
      var barW = (item.value / max) * barMaxW;
      roundRect(ctx, 0, y - barH / 2, Math.max(barW, 3), barH, 4);
      ctx.fillStyle = item.color || getCss("--accent");
      ctx.fill();

      ctx.fillStyle = getCss("--text-primary");
      ctx.textAlign = "left";
      var pct = Math.round((item.value / total) * 100);
      ctx.fillText(u.formatCurrency(item.value) + "  (" + pct + "%)", Math.max(barW, 3) + 8, y - barH / 2 - 8 + barH / 2 + 8);
    });
  }

  // Grouped bar chart for income vs expense per month: months = [{label, income, expense}]
  function groupedBars(canvas, months) {
    var s = setupCanvas(canvas);
    var ctx = s.ctx, w = s.w, h = s.h;
    ctx.clearRect(0, 0, w, h);
    if (!months.length) {
      emptyState(ctx, w, h);
      return;
    }
    var padBottom = 22;
    var padTop = 10;
    var chartH = h - padBottom - padTop;
    var max = Math.max.apply(null, months.map(function (m) { return Math.max(m.income, m.expense); })) || 1;
    var groupW = w / months.length;
    var barW = Math.min(16, groupW * 0.28);

    ctx.font = "11px -apple-system, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    months.forEach(function (m, idx) {
      var cx = groupW * idx + groupW / 2;
      var incH = (m.income / max) * chartH;
      var expH = (m.expense / max) * chartH;

      ctx.fillStyle = getCss("--income");
      roundRect(ctx, cx - barW - 2, padTop + (chartH - incH), barW, Math.max(incH, 1), 3);
      ctx.fill();

      ctx.fillStyle = getCss("--expense");
      roundRect(ctx, cx + 2, padTop + (chartH - expH), barW, Math.max(expH, 1), 3);
      ctx.fill();

      ctx.fillStyle = getCss("--text-secondary");
      ctx.fillText(m.label, cx, padTop + chartH + 4);
    });
  }

  // Donut chart: items = [{label, value, color}]
  function donut(canvas, items) {
    var s = setupCanvas(canvas);
    var ctx = s.ctx, w = s.w, h = s.h;
    ctx.clearRect(0, 0, w, h);
    var total = items.reduce(function (s, i) { return s + i.value; }, 0);
    var cx = w / 2, cy = h / 2;
    var radius = Math.min(w, h) / 2 - 6;
    var innerRadius = radius * 0.6;

    if (!total) {
      emptyState(ctx, w, h);
      return;
    }

    var start = -Math.PI / 2;
    items.forEach(function (item) {
      var slice = (item.value / total) * Math.PI * 2;
      var end = start + slice;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, start, end);
      ctx.closePath();
      ctx.fillStyle = item.color;
      ctx.fill();
      start = end;
    });

    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(cx, cy, innerRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  }

  function emptyState(ctx, w, h) {
    ctx.font = "13px -apple-system, system-ui, sans-serif";
    ctx.fillStyle = getCss("--text-secondary");
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("No data yet", w / 2, h / 2);
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function truncate(str, n) {
    return str.length > n ? str.slice(0, n - 1) + "…" : str;
  }

  function getCss(varName) {
    return getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || "#888";
  }

  return {
    horizontalBars: horizontalBars,
    groupedBars: groupedBars,
    donut: donut,
  };
})();
