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
        headers = ['ID', 'Date', 'Type', 'Mode', 'Category', 'Description', 'Amount', 'Entered_by', 'Timestamp'];
      } else if (name === SHEET_NAMES.DENOMINATIONS) {
        headers = ['Date', 'Denomination', 'Count', 'Amount'];
      } else if (name === SHEET_NAMES.USERS) {
        headers = ['Username', 'Password', 'Role']; // Roles: Admin, Cashier
      } else if (name === SHEET_NAMES.BANK_TRANSACTIONS) {
        headers = ['ID', 'Date', 'Type', 'Reference', 'Description', 'Amount', 'Entered_by', 'Timestamp'];
      } else if (name === SHEET_NAMES.DAILY_REPORTS) {
        headers = ['Date', 'Summary_Type', 'Opening_Balance', 'Total_Inflow', 'Total_Outflow', 'Closing_Balance', 'Status', 'Generated_At'];
      }
      
      if (headers.length > 0) {
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
        sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
        
        // Add default admin if users sheet is created
        if (name === SHEET_NAMES.USERS) {
          sheet.appendRow(['admin', 'adminpassword', 'Admin']);
        }
        
        // Force the whole datatable to Plain Text immediately so dates don't break logic
        if (name !== SHEET_NAMES.USERS) {
           sheet.getRange(2, 1, 1000, headers.length).setNumberFormat("@");
        }
      }
    }
  });
}

// 2. HTTP GET - Check setup or raw data
function doGet(e) {
  // We use POST for everything for simplicity, but GET can verify endpoint
  return jsonResponse({ status: 'success', message: 'Cashbook API is online' });
}

// 3. HTTP POST - Handle all data operations
function doPost(e) {
  try {
    // Auto-setup database if it's missing (Prevents login lockout)
    if (!SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.USERS)) {
      setupSheets();
    }
    
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    
    if (action === 'getUsers') {
      return jsonResponse(getSheetData(SHEET_NAMES.USERS));
    } else if (action === 'addUser') {
      appendRow(SHEET_NAMES.USERS, data.payload);
      SpreadsheetApp.flush();
      return jsonResponse({ status: 'success' });
    } else if (action === 'editUser') {
      editUser(data.payload);
      SpreadsheetApp.flush();
      return jsonResponse({ status: 'success' });
    } else if (action === 'deleteUser') {
      deleteUser(data.payload.Username);
      return jsonResponse({ status: 'success' });
    } else if (action === 'getSummary') {
      return jsonResponse(getSheetData(SHEET_NAMES.SUMMARY));
    } else if (action === 'loadDayData') {
      let summaries = getSheetData(SHEET_NAMES.SUMMARY);
      let tRaw = getSheetData(SHEET_NAMES.TRANSACTIONS);
      let dRaw = getSheetData(SHEET_NAMES.DENOMINATIONS);
      let bRaw = getSheetData(SHEET_NAMES.BANK_TRANSACTIONS);
      
      let txs = data.date ? tRaw.filter(r => String(safeValue(r.Date)) === String(data.date)) : tRaw;
      let denoms = data.date ? dRaw.filter(r => String(safeValue(r.Date)) === String(data.date)) : dRaw;
      let bankTxs = data.date ? bRaw.filter(r => String(safeValue(r.Date)) === String(data.date)) : bRaw;
      
      return jsonResponse({ summaries, txs, denoms, bankTxs });
    } else if (action === 'getBankTransactions') {
      let bTxs = getSheetData(SHEET_NAMES.BANK_TRANSACTIONS);
      if (data.date) bTxs = bTxs.filter(r => String(safeValue(r.Date)) === String(data.date));
      return jsonResponse(bTxs);
    } else if (action === 'saveBankTransaction') {
      Object.keys(data.payload).forEach(k => { data.payload[k] = safeValue(data.payload[k]); });
      appendRow(SHEET_NAMES.BANK_TRANSACTIONS, data.payload);
      SpreadsheetApp.flush();
      return jsonResponse({ status: 'success' });
    } else if (action === 'deleteBankTransaction') {
      deleteGenericRow(SHEET_NAMES.BANK_TRANSACTIONS, 'ID', data.payload.ID);
      SpreadsheetApp.flush();
      return jsonResponse({ status: 'success' });
    } else if (action === 'getTransactions') {
      let txs = getSheetData(SHEET_NAMES.TRANSACTIONS);
      if (data.date) txs = txs.filter(r => r.Date === data.date);
      return jsonResponse(txs);
    } else if (action === 'getDenominations') {
      let denoms = getSheetData(SHEET_NAMES.DENOMINATIONS);
      if (data.date) denoms = denoms.filter(r => r.Date === data.date);
      return jsonResponse(denoms);
    } else if (action === 'saveTransaction') {
      Object.keys(data.payload).forEach(k => { data.payload[k] = safeValue(data.payload[k]); });
      appendRow(SHEET_NAMES.TRANSACTIONS, data.payload);
      if (data.payload.Date) drawDailySheet(data.payload.Date);
      SpreadsheetApp.flush();
      return jsonResponse({ status: 'success' });
    } else if (action === 'deleteTransaction') {
      deleteTransaction(data.payload.ID);
      if (data.payload.Date) drawDailySheet(data.payload.Date);
      SpreadsheetApp.flush();
      return jsonResponse({ status: 'success' });
    } else if (action === 'saveSummary') {
      updateOrAppendSummary(data.payload);
      SpreadsheetApp.flush();
      return jsonResponse({ status: 'success' });
    } else if (action === 'saveDenominations') {
      saveDenominationsList(data.date, data.payload);
      SpreadsheetApp.flush();
      return jsonResponse({ status: 'success' });
    }
    
    throw new Error('Unknown action: ' + action);
  } catch (err) {
    return jsonResponse({ status: 'error', message: err.toString() }, 400);
  }
}

// --- HELPER FUNCTIONS ---

function getSheetData(sheetName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return [];
  
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  
  const headers = data[0];
  const rows = [];
  
  for (let i = 1; i < data.length; i++) {
    let rowObj = {};
    for (let j = 0; j < headers.length; j++) {
      rowObj[headers[j]] = safeValue(data[i][j]);
    }
    rows.push(rowObj);
  }
  return rows;
}

function safeValue(val) {
  if (Object.prototype.toString.call(val) === '[object Date]') {
    const tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
    return Utilities.formatDate(val, tz, "yyyy-MM-dd");
  }
  return val;
}

function appendRow(sheetName, obj) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  const rowData = headers.map(h => obj[h] !== undefined ? obj[h] : '');
  sheet.appendRow(rowData);
}

function deleteUser(username) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.USERS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const userColIndex = headers.indexOf('Username');
  
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][userColIndex]) === String(username)) {
      sheet.deleteRow(i + 1);
    }
  }
}

function editUser(payload) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.USERS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const userColIndex = headers.indexOf('Username');
  
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][userColIndex]) === String(payload.Username)) {
      const rowData = headers.map(h => payload[h] !== undefined ? payload[h] : data[i][headers.indexOf(h)]);
      sheet.getRange(i + 1, 1, 1, headers.length).setValues([rowData]);
      return;
    }
  }
}


function deleteGenericRow(sheetName, colName, value) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const colIndex = headers.indexOf(colName);
  
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][colIndex]) === String(value)) {
      sheet.deleteRow(i + 1);
    }
  }
}

function updateOrAppendSummary(summaryObj) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.SUMMARY);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const dateColIndex = headers.indexOf('Date');
  
  let rowIndex = -1;
  for (let i = 1; i < data.length; i++) {
    if (String(safeValue(data[i][dateColIndex])) === String(summaryObj.Date)) {
      rowIndex = i + 1;
      break;
    }
  }
  
  const rowData = headers.map(h => summaryObj[h] !== undefined ? summaryObj[h] : '');
  if (rowIndex > -1) {
    sheet.getRange(rowIndex, 1, 1, headers.length).setValues([rowData]);
  } else {
    sheet.appendRow(rowData);
  }
  
  // Dynamically draw the requested per-day visual tab
  drawDailySheet(summaryObj.Date);
}

function drawDailySheet(dateStr) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetName = 'Day_' + dateStr;
  let sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) sheet = ss.insertSheet(sheetName);
  else sheet.clear();
  
  const summary = getSheetData(SHEET_NAMES.SUMMARY).find(s => String(safeValue(s.Date)) === String(dateStr)) || {};
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
  view.push(['--- DEPOSITS ---', 'Amount', '--- EXPENSES ---', 'Amount']);
  
  const maxRows = Math.max(deps.length, exps.length, 1);
  for (let i=0; i<maxRows; i++) {
     let dType = deps[i] ? deps[i].Category + ' (' + deps[i].Mode + ')' : '';
     let dAmt = deps[i] ? deps[i].Amount : '';
     let eType = exps[i] ? exps[i].Category + ' (' + exps[i].Mode + ')' : '';
     let eAmt = exps[i] ? exps[i].Amount : '';
     view.push([dType, dAmt, eType, eAmt]);
  }
  
  view.push([]);
  view.push(['Total Deposits:', summary.Total_Deposits || 0, 'Total Expenses:', summary.Total_Expenses || 0]);
  view.push([]);
  view.push(['System Expected Closing Balance:', summary.Closing_Balance || 0, '', '']);
  view.push([]);
  
  view.push(['--- BANK CREDITS ---', 'Amount', '--- BANK DEBITS ---', 'Amount']);
  const maxBankRows = Math.max(bCreds.length, bDebs.length, 1);
  for (let i=0; i<maxBankRows; i++) {
     let cDesc = bCreds[i] ? bCreds[i].Description + ' (Ref: ' + bCreds[i].Reference + ')' : '';
     let cAmt = bCreds[i] ? bCreds[i].Amount : '';
     let dDesc = bDebs[i] ? bDebs[i].Description + ' (Ref: ' + bDebs[i].Reference + ')' : '';
     let dAmt = bDebs[i] ? bDebs[i].Amount : '';
     view.push([cDesc, cAmt, dDesc, dAmt]);
  }
  view.push(['Bank Total Credits:', summary.Bank_Total_Credits || 0, 'Bank Total Debits:', summary.Bank_Total_Debits || 0]);
  view.push(['Bank Opening Balance:', summary.Bank_Opening_Balance || 0, 'Bank Closing Balance:', summary.Bank_Closing_Balance || 0]);
  view.push([]);
  
  if (denoms.length > 0) {
    view.push(['--- DENOMINATIONS ---', '', '', '']);
    denoms.forEach(d => {
       view.push(['Note: ' + d.Denomination, d.Count + ' count', 'Value:', d.Amount]);
    });
    view.push([]);
    view.push(['Variance:', summary.Variance, '', '']);
    view.push(['Remarks:', summary.Remarks || 'None', '', '']);
  }
  
  view.push([]);
  view.push(['Last Modified By:', summary.Verified_By || summary.Counted_By || 'System', '', '']);
  view.push(['Report Generated At:', new Date().toLocaleString(), '', '']);
  
  sheet.getRange(1, 1, view.length, 4).setValues(view);
  sheet.getRange(1, 1, 1, 4).setFontWeight("bold").setFontSize(14).setBackground("#4F46E5").setFontColor("white");
  sheet.getRange(6, 1, 1, 4).setFontWeight("bold").setBackground("#F1F5F9");
  sheet.getRange(lastRow, 1, 1, 4).setFontWeight("bold").setBackground("#F1F5F9");
  sheet.autoResizeColumns(1, 4);
  sheet.setFrozenRows(5);
}

function saveDenominationsList(date, denomsList) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.DENOMINATIONS);
  
  if (sheet.getLastRow() > 1) {
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const dateColIndex = headers.indexOf('Date');
    for (let i = data.length - 1; i >= 1; i--) {
      if (String(safeValue(data[i][dateColIndex])) === String(date)) {
        sheet.deleteRow(i + 1);
      }
    }
  }
  
  const headers = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
  denomsList.forEach(denomObj => {
    const rowData = headers.map(h => denomObj[h] !== undefined ? denomObj[h] : '');
    sheet.appendRow(rowData);
  });
}

function jsonResponse(data, code = 200) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
