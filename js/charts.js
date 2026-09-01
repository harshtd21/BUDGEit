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

  // Category heat map: a compact tile grid, one tile per category, sized by
  // tier (bigger tiles for bigger shares) and colored by intensity relative
  // to the largest category — gives an at-a-glance distribution instead of a
  // tall list/bar chart. items = [{label, value}] (plain DOM, not canvas).
  function categoryHeatmap(container, items) {
    if (!items.length) {
      container.innerHTML = '<div class="empty-list">No expenses this month.</div>';
      return;
    }
    var total = items.reduce(function (s, i) { return s + i.value; }, 0) || 1;
    var maxValue = Math.max.apply(null, items.map(function (i) { return i.value; })) || 1;

    container.innerHTML = items
      .map(function (item) {
        var pct = (item.value / total) * 100;
        var intensity = item.value / maxValue;
        var tier = pct >= 20 ? "lg" : pct >= 10 ? "md" : "sm";
        var bgPct = Math.round(15 + intensity * 75);
        return (
          '<div class="heatmap-tile heatmap-tile-' + tier + '" style="background: color-mix(in srgb, var(--expense) ' + bgPct + '%, var(--card-bg));" title="' +
          u.escapeHtml(item.label) + " — " + u.formatCurrency(item.value) + '">' +
          '<div class="heatmap-tile-label">' + u.escapeHtml(item.label) + "</div>" +
          '<div class="heatmap-tile-pct">' + Math.round(pct) + "%</div>" +
          "</div>"
        );
      })
      .join("");
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

  function getCss(varName) {
    return getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || "#888";
  }

  return {
    categoryHeatmap: categoryHeatmap,
    groupedBars: groupedBars,
    donut: donut,
  };
})();
