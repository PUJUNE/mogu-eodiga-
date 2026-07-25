// main.js — 부트스트랩
(function () {
  "use strict";
  function boot() {
    window.MWH.UI.init();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
