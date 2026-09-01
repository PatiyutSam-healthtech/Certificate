/**
 * Tiny row<->object helper over Google Sheets, used as the "database" for
 * this app. Each sheet's first row is a header row; every other row is one
 * record. Kept intentionally simple (no indexing) since a personal document
 * vault has at most a few thousand rows per user.
 */

var USER_HEADERS = ["id", "email", "passwordHash", "salt", "name", "createdAt"];
var SESSION_HEADERS = ["token", "userId", "createdAt", "expiresAt"];
var CATEGORY_HEADERS = ["id", "userId", "name", "color", "createdAt"];
var DOCUMENT_HEADERS = [
  "id",
  "userId",
  "categoryId",
  "title",
  "originalName",
  "driveFileId",
  "mimeType",
  "size",
  "extractedText",
  "autoNamed",
  "createdAt",
  "updatedAt",
];

function getSpreadsheet_() {
  // Container-bound script: the spreadsheet this script is attached to.
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error(
      "This script must be bound to a Google Sheet (Extensions > Apps Script). See SETUP.md.",
    );
  }
  return ss;
}

function getSheet_(name, headers) {
  var ss = getSpreadsheet_();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function headersFor_(sheetName) {
  switch (sheetName) {
    case "Users":
      return USER_HEADERS;
    case "Sessions":
      return SESSION_HEADERS;
    case "Categories":
      return CATEGORY_HEADERS;
    case "Documents":
      return DOCUMENT_HEADERS;
    default:
      throw new Error("Unknown sheet: " + sheetName);
  }
}

function rowToObject_(headers, row) {
  var obj = {};
  for (var i = 0; i < headers.length; i++) {
    obj[headers[i]] = row[i];
  }
  return obj;
}

function objectToRow_(headers, obj) {
  return headers.map(function (h) {
    var v = obj[h];
    return v === undefined || v === null ? "" : v;
  });
}

/** Returns every record in a sheet as an array of plain objects. */
function getAllRows_(sheetName) {
  var headers = headersFor_(sheetName);
  var sheet = getSheet_(sheetName, headers);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  return values.map(function (row) {
    return rowToObject_(headers, row);
  });
}

/** Appends a new record. `obj` must already contain a unique `id` (or `token` for Sessions). */
function insertRow_(sheetName, obj) {
  var headers = headersFor_(sheetName);
  var sheet = getSheet_(sheetName, headers);
  sheet.appendRow(objectToRow_(headers, obj));
  return obj;
}

var ID_COLUMN_BY_SHEET = {
  Users: "id",
  Sessions: "token",
  Categories: "id",
  Documents: "id",
};

/** Finds the 1-indexed sheet row number for a record by its id column, or -1. */
function findRowIndexById_(sheetName, id) {
  var headers = headersFor_(sheetName);
  var idCol = headers.indexOf(ID_COLUMN_BY_SHEET[sheetName]);
  var sheet = getSheet_(sheetName, headers);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  var ids = sheet.getRange(2, idCol + 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) return i + 2; // +2: header row + 1-index
  }
  return -1;
}

function findById_(sheetName, id) {
  var rowIndex = findRowIndexById_(sheetName, id);
  if (rowIndex === -1) return null;
  var headers = headersFor_(sheetName);
  var sheet = getSheet_(sheetName, headers);
  var row = sheet.getRange(rowIndex, 1, 1, headers.length).getValues()[0];
  return rowToObject_(headers, row);
}

/** Merges `patch` into the existing record and writes the row back. */
function updateById_(sheetName, id, patch) {
  var rowIndex = findRowIndexById_(sheetName, id);
  if (rowIndex === -1) throw new Error("record not found: " + id);
  var headers = headersFor_(sheetName);
  var sheet = getSheet_(sheetName, headers);
  var current = rowToObject_(
    headers,
    sheet.getRange(rowIndex, 1, 1, headers.length).getValues()[0],
  );
  var updated = Object.assign({}, current, patch);
  sheet.getRange(rowIndex, 1, 1, headers.length).setValues([objectToRow_(headers, updated)]);
  return updated;
}

function deleteById_(sheetName, id) {
  var rowIndex = findRowIndexById_(sheetName, id);
  if (rowIndex === -1) return false;
  getSheet_(sheetName, headersFor_(sheetName)).deleteRow(rowIndex);
  return true;
}
