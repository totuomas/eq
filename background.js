//background.js
chrome.action.setBadgeText({ text: "off" });
chrome.action.setBadgeBackgroundColor({ color: "#646464" });

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "GET_TAB_ID") {
    sendResponse(sender.tab.id);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.local.remove(String(tabId));
});