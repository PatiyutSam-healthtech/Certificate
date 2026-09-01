/**
 * File storage on Google Drive. A single root folder holds one subfolder
 * per user, created lazily on first use — no manual folder setup needed.
 * Files are never shared publicly; every read goes through this script,
 * which checks document ownership first (see Documents.gs).
 */

function getRootFolder_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty("ROOT_FOLDER_ID");
  if (id) {
    try {
      return DriveApp.getFolderById(id);
    } catch (err) {
      // stored id no longer resolves (e.g. folder was deleted); recreate below
    }
  }
  var folder = DriveApp.createFolder("DocVault Files");
  props.setProperty("ROOT_FOLDER_ID", folder.getId());
  return folder;
}

function getUserFolder_(userId) {
  var root = getRootFolder_();
  var existing = root.getFoldersByName(userId);
  if (existing.hasNext()) return existing.next();
  return root.createFolder(userId);
}
