// Code.gs
// DAILY CASHBOOK & DENOMINATION TRACKER - GOOGLE SHEETS BACKEND (Unified HTML Version)

const SHEET_NAMES = {
  SUMMARY: 'Daily_Summary',
  TRANSACTIONS: 'Transactions',
  DENOMINATIONS: 'Denominations',
  USERS: 'Users',
  BANK_TRANSACTIONS: 'Bank_Transactions',
  DAILY_REPORTS: 'Daily_Reports_Formatted'
};

// 1. Initial Setup Function (Run this manually once after pasting)
function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  Object.values(SHEET_NAMES).forEach(name => {
    let sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
      
      let headers = [];
      if (name === SHEET_NAMES.SUMMARY) {
        headers = ['Date', 'Opening_Balance', 'Total_Deposits', 'Total_Expenses', 'Closing_Balance', 'Bank_Opening_Balance', 'Bank_Total_Credits', 'Bank_Total_Debits', 'Bank_Closing_Balance', 'Verified', 'Variance', 'Remarks', 'Counted_By', 'Verified_By'];
      } else if (name === SHEET_NAMES.TRANSACTIONS) {
        headers = ['ID', 'Date', 'Type', 'Mode', 'Name', 'Category', 'Amount', 'Entered_by', 'Timestamp'];
      } else if (name === SHEET_NAMES.DENOMINATIONS) {
        headers = ['Date', 'Denomination', 'Count', 'Amount'];
      } else if (name === SHEET_NAMES.USERS) {
        headers = ['Username', 'Password', 'Role']; 
      } else if (name === SHEET_NAMES.BANK_TRANSACTIONS) {
        headers = ['ID', 'Date', 'Type', 'Mode', 'Reference', 'Description', 'Amount', 'Entered_by', 'Timestamp'];
      } else if (name === SHEET_NAMES.DAILY_REPORTS) {
        headers = ['Date', 'Summary_Type', 'Opening_Balance', 'Total_Inflow', 'Total_Outflow', 'Closing_Balance', 'Status', 'Generated_At'];
      }
      
      if (headers.length > 0) {
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
        sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
      }
    }
  });
}

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Cashbook_App')
    .setTitle('Daily Cashbook Tracker')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    const payload = data.payload;
    const date = data.date;

    let result;
    switch (action) {
      case 'getUsers': result = getSheetData(SHEET_NAMES.USERS); break;
      case 'addUser': result = appendRow(SHEET_NAMES.USERS, payload); break;
      case 'editUser': result = editUser(payload); break;
      case 'deleteUser': result = deleteRow(SHEET_NAMES.USERS, 'Username', payload.Username); break;
      
      case 'getSummary': result = getSheetData(SHEET_NAMES.SUMMARY); break;
      case 'loadDayData': 
        result = {
          summaries: getSheetData(SHEET_NAMES.SUMMARY),
          txs: getSheetData(SHEET_NAMES.TRANSACTIONS).filter(t => String(safeValue(t.Date)) === String(date)),
          denoms: getSheetData(SHEET_NAMES.DENOMINATIONS).filter(d => String(safeValue(d.Date)) === String(date)),
          bankTxs: getSheetData(SHEET_NAMES.BANK_TRANSACTIONS).filter(t => String(safeValue(t.Date)) === String(date))
        };
        break;
      
      case 'saveSummary': result = updateOrAppendSummary(payload); break;
      case 'saveTransaction': result = appendRow(SHEET_NAMES.TRANSACTIONS, payload); break;
      case 'deleteTransaction': result = deleteRow(SHEET_NAMES.TRANSACTIONS, 'ID', payload.ID); break;
      
      case 'saveBankTransaction': result = appendRow(SHEET_NAMES.BANK_TRANSACTIONS, payload); break;
      case 'deleteBankTransaction': result = deleteRow(SHEET_NAMES.BANK_TRANSACTIONS, 'ID', payload.ID); break;
      
      case 'saveDenominations': result = saveDenominations(payload, date); break;
      case 'getTransactions': result = getSheetData(SHEET_NAMES.TRANSACTIONS); break;
      case 'getDenominations': result = getSheetData(SHEET_NAMES.DENOMINATIONS); break;
    }

    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({status: 'error', message: err.message})).setMimeType(ContentService.MimeType.JSON);
  }
}

// --- Helper Functions ---
function getSheetData(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(name);
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  return data.slice(1).map(row => {
    let obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });
}

function appendRow(name, payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) { setupSheets(); sheet = ss.getSheetByName(name); }
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const row = headers.map(h => payload[h] !== undefined ? payload[h] : '');
  sheet.appendRow(row);
  return { status: 'success' };
}

function deleteRow(name, key, value) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(name);
  if (!sheet) return { status: 'error' };
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const colIndex = headers.indexOf(key);
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][colIndex]) === String(value)) {
      sheet.deleteRow(i + 1);
      return { status: 'success' };
    }
  }
  return { status: 'not_found' };
}

function editUser(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.USERS);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === payload.Username) {
      sheet.getRange(i + 1, 2).setValue(payload.Password);
      sheet.getRange(i + 1, 3).setValue(payload.Role);
      return { status: 'success' };
    }
  }
  return { status: 'error' };
}

function saveDenominations(payload, date) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAMES.DENOMINATIONS);
  if (!sheet) { setupSheets(); sheet = ss.getSheetByName(SHEET_NAMES.DENOMINATIONS); }
  
  // Clear existing denoms for this date
  const data = sheet.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(safeValue(data[i][0])) === String(date)) {
      sheet.deleteRow(i + 1);
    }
  }
  
  // Add new
  payload.forEach(item => {
    sheet.appendRow([item.Date, item.Denomination, item.Count, item.Amount]);
  });
  return { status: 'success' };
}

function updateOrAppendSummary(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAMES.SUMMARY);
  if (!sheet) { setupSheets(); sheet = ss.getSheetByName(SHEET_NAMES.SUMMARY); }
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const dateColIndex = headers.indexOf('Date');
  
  for (let i = 1; i < data.length; i++) {
    if (String(safeValue(data[i][dateColIndex])) === String(payload.Date)) {
      const rowData = headers.map(h => payload[h] !== undefined ? payload[h] : data[i][headers.indexOf(h)]);
      sheet.getRange(i + 1, 1, 1, headers.length).setValues([rowData]);
      
      if (payload.Verified) { drawDailySheet(payload.Date); }
      return { status: 'success' };
    }
  }
  
  const rowData = headers.map(h => payload[h] !== undefined ? payload[h] : '');
  sheet.appendRow(rowData);
  if (payload.Verified) { drawDailySheet(payload.Date); }
  return { status: 'success' };
}

function safeValue(val) {
  if (val instanceof Date) {
    const d = new Date(val);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().split('T')[0];
  }
  return val;
}

function drawDailySheet(dateStr) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetName = 'Day_' + dateStr;
  let sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) sheet = ss.insertSheet(sheetName);
  else sheet.clear();
  
  const summaries = getSheetData(SHEET_NAMES.SUMMARY);
  const summary = summaries.find(s => String(safeValue(s.Date)) === String(dateStr)) || {};
  const allTxs = getSheetData(SHEET_NAMES.TRANSACTIONS).filter(t => String(safeValue(t.Date)) === String(dateStr));
  const deps = allTxs.filter(t => t.Type === 'Deposit');
  const exps = allTxs.filter(t => t.Type === 'Expense');
  const denoms = getSheetData(SHEET_NAMES.DENOMINATIONS).filter(d => String(safeValue(d.Date)) === String(dateStr));
  const bankTxs = getSheetData(SHEET_NAMES.BANK_TRANSACTIONS).filter(t => String(safeValue(t.Date)) === String(dateStr));
  const bCreds = bankTxs.filter(t => t.Type === 'Credit');
  const bDebs = bankTxs.filter(t => t.Type === 'Debit');
  
  const view = [];
  view.push(['DAILY CASHBOOK LEDGER - ' + dateStr, '', '', '']);
  view.push([]);
  view.push(['Status:', summary.Verified ? 'Verified & Locked' : 'Draft', '', '']);
  view.push(['Opening Balance:', summary.Opening_Balance || 0, '', '']);
  view.push([]);
  view.push(['--- RECEIPTS ---', 'Amount', '--- PAYMENTS ---', 'Amount']);
  
  const maxRows = Math.max(deps.length, exps.length, 1);
  for (let i=0; i<maxRows; i++) {
     let dType = deps[i] ? deps[i].Category + ' (' + deps[i].Mode + ')' : '';
     let dAmt = deps[i] ? deps[i].Amount : '';
     let eType = exps[i] ? (exps[i].Name || '') + ': ' + exps[i].Category + ' (' + exps[i].Mode + ')' : '';
     let eAmt = exps[i] ? exps[i].Amount : '';
     view.push([dType, dAmt, eType, eAmt]);
  }
  
  view.push([]);
  view.push(['Total Receipts:', summary.Total_Deposits || 0, 'Total Payments:', summary.Total_Expenses || 0]);
  view.push(['Closing Balance:', summary.Closing_Balance || 0, '', '']);
  view.push([]);
  
  view.push(['--- BANK RECEIPTS ---', 'Amount', '--- BANK PAYMENTS ---', 'Amount']);
  const maxBankRows = Math.max(bCreds.length, bDebs.length, 1);
  for (let i=0; i<maxBankRows; i++) {
     let cDesc = bCreds[i] ? bCreds[i].Description + ' (Ref: ' + (bCreds[i].Reference||'N/A') + ', ' + (bCreds[i].Mode||'Bank') + ')' : '';
     let cAmt = bCreds[i] ? bCreds[i].Amount : '';
     let dDesc = bDebs[i] ? bDebs[i].Description + ' (Ref: ' + (bDebs[i].Reference||'N/A') + ', ' + (bDebs[i].Mode||'Bank') + ')' : '';
     let dAmt = bDebs[i] ? bDebs[i].Amount : '';
     view.push([cDesc, cAmt, dDesc, dAmt]);
  }
  view.push(['Bank Total Receipts:', summary.Bank_Total_Credits || 0, 'Bank Total Payments:', summary.Bank_Total_Debits || 0]);
  view.push(['Bank Opening Balance:', summary.Bank_Opening_Balance || 0, 'Bank Closing Balance:', summary.Bank_Closing_Balance || 0]);
  view.push([]);
  
  if (denoms.length > 0) {
    view.push(['--- DENOMINATIONS ---', '', '', '']);
    denoms.forEach(d => {
       view.push(['Note: ' + d.Denomination, d.Count + ' count', 'Value:', d.Amount]);
    });
    view.push([]);
    view.push(['Variance:', summary.Variance || 0, '', '']);
    view.push(['Remarks:', summary.Remarks || 'None', '', '']);
  }
  
  view.push([]);
  view.push(['Verified By:', summary.Verified_By || 'System', '', '']);
  view.push(['Report Generated At:', new Date().toLocaleString(), '', '']);
  
  const lastRow = view.length;
  sheet.getRange(1, 1, view.length, 4).setValues(view);
  sheet.getRange(1, 1, 1, 4).setFontWeight("bold").setFontSize(14).setBackground("#4F46E5").setFontColor("white");
  sheet.getRange(6, 1, 1, 4).setFontWeight("bold").setBackground("#F1F5F9");
  sheet.autoResizeColumns(1, 4);
  sheet.setFrozenRows(5);
}
