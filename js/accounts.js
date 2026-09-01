var App = App || {};

App.accounts = (function () {
  var u = App.utils;

  function render() {
    var root = document.getElementById("tab-accounts");
    root.innerHTML =
      '<div id="section-profile"></div>' +
      '<div id="section-bank-accounts" style="margin-top:28px;"></div>' +
      '<div id="section-net-worth"></div>' +
      '<div id="section-investments" style="margin-top:28px;"></div>' +
      '<div id="section-loans" style="margin-top:28px;"></div>' +
      '<div id="section-credit-cards" style="margin-top:28px;"></div>' +
      '<div id="section-about" style="margin-top:28px;"></div>' +
      '<div class="backup-section">' +
      "<h3>Backup</h3>" +
      '<button type="button" class="secondary-btn" id="export-btn">Export Data (JSON)</button>' +
      '<button type="button" class="secondary-btn" id="import-btn">Import Data (JSON)</button>' +
      '<input type="file" id="import-file" accept="application/json" style="display:none">' +
      "</div>";

    App.profile.render(document.getElementById("section-profile"));
    App.bankAccounts.render(document.getElementById("section-bank-accounts"));
    renderNetWorthBanner(document.getElementById("section-net-worth"));
    App.investments.render(document.getElementById("section-investments"));
    App.loans.render(document.getElementById("section-loans"));
    App.creditCards.render(document.getElementById("section-credit-cards"));
    App.about.render(document.getElementById("section-about"));

    root.querySelector("#export-btn").addEventListener("click", exportData);
    var importInput = root.querySelector("#import-file");
    root.querySelector("#import-btn").addEventListener("click", function () {
      importInput.click();
    });
    importInput.addEventListener("change", function (e) {
      if (e.target.files && e.target.files[0]) importData(e.target.files[0]);
    });
  }

  function renderNetWorthBanner(container) {
    App.derived.computeNetWorth().then(function (n) {
      container.innerHTML =
        '<div class="banner net-worth-banner">' +
        '<div class="banner-stats">' +
        '<div class="stat"><span class="stat-label">Assets</span><span class="stat-value income">' + u.formatCurrency(n.assets) + "</span></div>" +
        '<div class="stat"><span class="stat-label">Liabilities</span><span class="stat-value expense">' + u.formatCurrency(n.liabilities) + "</span></div>" +
        '<div class="stat"><span class="stat-label">Net</span><span class="stat-value ' + (n.net >= 0 ? "income" : "expense") + '">' + u.formatCurrency(n.net) + "</span></div>" +
        "</div>" +
        "</div>";
    });
  }

  function exportData() {
    App.db.exportAll().then(function (data) {
      var blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = "budget-backup-" + u.todayISO() + ".json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });
  }

  function importData(file) {
    if (!confirm("Importing will replace ALL current data with the contents of this file. Continue?")) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(reader.result);
        App.db.importReplace(data).then(function () {
          return App.db.getSettings();
        }).then(function (settings) {
          u.setCurrency((settings && settings.currency) || "INR");
          alert("Import complete.");
          render();
        });
      } catch (err) {
        alert("Could not read this file. Make sure it's a valid export from this app.");
      }
    };
    reader.readAsText(file);
  }

  return {
    render: render,
  };
})();
