var App = App || {};

App.app = (function () {
  var activeTab = "home";

  function init() {
    document.querySelectorAll(".tab-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        switchTab(btn.getAttribute("data-tab"));
      });
    });

    document.getElementById("fab").addEventListener("click", function () {
      App.forms.openActionSheet();
    });

    if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    }

    switchTab("home");
  }

  function switchTab(tab) {
    activeTab = tab;
    document.querySelectorAll(".tab-panel").forEach(function (panel) {
      panel.classList.toggle("active", panel.id === "tab-" + tab);
    });
    document.querySelectorAll(".tab-btn").forEach(function (btn) {
      btn.classList.toggle("tab-selected", btn.getAttribute("data-tab") === tab);
    });
    refreshActiveTab();
  }

  function refreshActiveTab() {
    if (activeTab === "home") App.home.render();
    else if (activeTab === "trends") App.trends.render();
    else if (activeTab === "accounts") App.accounts.render();
  }

  return {
    init: init,
    switchTab: switchTab,
    refreshActiveTab: refreshActiveTab,
  };
})();

document.addEventListener("DOMContentLoaded", App.app.init);
