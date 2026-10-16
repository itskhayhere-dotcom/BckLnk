const SPREADSHEET_ID = '1nPYEHaBUGVpbMyGM2smVCSf4MJe6UM5J9lnadGQ35Qw';
const BROKEN_SHEET_NAME = 'Broken Links';
const REQUIRED_HEADERS = [
  'Backlink URL', 'Target URL', 'Traffic', 'Conversion Fit', 'Last Audited', 'Audit Note'
];

function setup() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheets()[0];
  ensureHeaders_(sheet);
  if (!ss.getSheetByName(BROKEN_SHEET_NAME)) {
    const broken = ss.insertSheet(BROKEN_SHEET_NAME);
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    broken.getRange(1, 1, 1, headers.length).setValues([headers]);
    broken.setFrozenRows(1);
  }
  sheet.setFrozenRows(1);
  return 'Setup complete';
}

function doGet() {
  return json_({ok:true, message:'ITSKHAY backlink agent API is running'});
}

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (body.action === 'login') return json_(login_(body.username, body.password));
    if (!authorized_(body.token)) return json_({ok:false, error:'Unauthorized. Please log in again.'});
    if (body.action === 'getData') return json_({ok:true, data:getData_()});
    if (body.action === 'addProspect') return json_(addProspect_(body.prospect || {}));
    if (body.action === 'audit') return json_(auditAll_());
    if (body.action === 'searchLinks') return json_({ok:true, links:searchLinks_(body.niche || '', body.targetUrl || '', body.requestedCount, body.categories)});
    return json_({ok:false,error:'Unknown action'});
  } catch (err) {
    return json_({ok:false,error:String(err && err.message || err)});
  }
}

function login_(username, password) {
  const p = PropertiesService.getScriptProperties();
  const expectedUser = p.getProperty('ADMIN_USERNAME');
  const expectedHash = p.getProperty('ADMIN_PASSWORD_HASH');
  const secret = p.getProperty('APP_TOKEN_SECRET');
  if (!expectedUser || !expectedHash || !secret) {
    return {ok:false,error:'Admin credentials are not configured in Script Properties.'};
  }
  if (String(username || '') !== expectedUser || sha256_(String(password || '')) !== expectedHash.toLowerCase()) {
    Utilities.sleep(400);
    return {ok:false,error:'Invalid login details.'};
  }
  const token = Utilities.getUuid().replace(/-/g,'') + Utilities.getUuid().replace(/-/g,'');
  CacheService.getScriptCache().put('session_' + sha256_(token + secret), '1', 21600);
  return {ok:true,token:token,expiresIn:21600};
}

function authorized_(token) {
  if (!token) return false;
  const secret = PropertiesService.getScriptProperties().getProperty('APP_TOKEN_SECRET');
  if (!secret) return false;
  return CacheService.getScriptCache().get('session_' + sha256_(String(token) + secret)) === '1';
}

function getData_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const main = ss.getSheets()[0];
  ensureHeaders_(main);
  const headers = main.getRange(1,1,1,main.getLastColumn()).getDisplayValues()[0];
  const rows = main.getLastRow() > 1 ? main.getRange(2,1,main.getLastRow()-1,headers.length).getDisplayValues() : [];
  const broken = ss.getSheetByName(BROKEN_SHEET_NAME);
  const brokenCount = broken && broken.getLastRow() > 1 ? broken.getLastRow()-1 : 0;
  return {headers:headers,rows:rows,brokenCount:brokenCount,mainSheet:main.getName()};
}

function ensureHeaders_(sheet) {
  let lastCol = Math.max(sheet.getLastColumn(), 1);
  let headers = sheet.getRange(1,1,1,lastCol).getDisplayValues()[0];
  if (!headers.some(String)) {
    headers = ['Si No','Date','Website Name','Category','DA','PA','SS','Homepage URL (register/submit here)','Status','Expiry','Email ID'];
    sheet.getRange(1,1,1,headers.length).setValues([headers]);
    lastCol = headers.length;
  }
  REQUIRED_HEADERS.forEach(h => {
    if (headers.indexOf(h) === -1) {
      lastCol++;
      sheet.getRange(1,lastCol).setValue(h);
      headers.push(h);
    }
  });
  return headers;
}

function addProspect_(p) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheets()[0];
  const headers = ensureHeaders_(sheet);
  const name = String(p.websiteName || '').trim();
  const homepage = String(p.homepageUrl || '').trim();
  if (!name || !homepage) return {ok:false,error:'Website name and homepage URL are required.'};
  const existing = getData_();
  const homeIdx = headers.findIndex(h => /homepage url|website url|website link/i.test(h));
  const nameIdx = headers.findIndex(h => /website name|website/i.test(h));
  const key = normalizeDomain_(homepage);
  for (const row of existing.rows) {
    const oldUrl = homeIdx >= 0 ? row[homeIdx] : '';
    const oldName = nameIdx >= 0 ? row[nameIdx] : '';
    if ((key && normalizeDomain_(oldUrl) === key) || (name && oldName.toLowerCase() === name.toLowerCase())) {
      return {ok:false,duplicate:true,error:'Already recorded — skipped to avoid duplicate backlink prospects.'};
    }
  }
  const row = headers.map(h => {
    const k = h.toLowerCase();
    if (/website name/.test(k)) return name;
    if (/category/.test(k)) return p.category || p.niche || '';
    if (k === 'da') return p.da || '';
    if (k === 'pa') return p.pa || '';
    if (k === 'ss' || /spam score/.test(k)) return p.ss || '';
    if (/homepage url|website url|website link/.test(k)) return homepage;
    if (k === 'status') return 'Prospect';
    if (k === 'traffic') return p.traffic || '';
    if (/conversion fit/.test(k)) return p.conversionFit || '';
    if (/target url/.test(k)) return p.targetUrl || '';
    if (/backlink url/.test(k)) return p.backlinkUrl || '';
    if (/date/.test(k)) return new Date();
    return '';
  });
  sheet.appendRow(row);
  return {ok:true,message:'Prospect added.'};
}

function auditAll_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const main = ss.getSheets()[0];
  const headers = ensureHeaders_(main);
  let broken = ss.getSheetByName(BROKEN_SHEET_NAME);
  if (!broken) {
    broken = ss.insertSheet(BROKEN_SHEET_NAME);
    broken.getRange(1,1,1,headers.length).setValues([headers]);
    broken.setFrozenRows(1);
  } else if (broken.getLastColumn() < headers.length) {
    broken.getRange(1,1,1,headers.length).setValues([headers]);
  }
  const lastRow = main.getLastRow();
  if (lastRow < 2) return {ok:true,checked:0,live:0,moved:0,notes:['No rows to audit.']};
  const values = main.getRange(2,1,lastRow-1,headers.length).getValues();
  const display = main.getRange(2,1,lastRow-1,headers.length).getDisplayValues();
  const statusIdx = headers.findIndex(h => /^status$/i.test(h));
  const backlinkIdx = headers.findIndex(h => /backlink url/i.test(h));
  const targetIdx = headers.findIndex(h => /target url/i.test(h));
  const auditedIdx = headers.findIndex(h => /last audited/i.test(h));
  const noteIdx = headers.findIndex(h => /audit note/i.test(h));
  if (backlinkIdx < 0 || targetIdx < 0) return {ok:false,error:'Backlink URL and Target URL columns are required.'};
  const keep = [], move = [];
  let live = 0, checked = 0;
  const notes = [];
  for (let i=0;i<values.length;i++) {
    const row = values[i].slice();
    const status = statusIdx >= 0 ? String(display[i][statusIdx] || '').trim().toLowerCase() : '';
    const backlinkUrl = String(display[i][backlinkIdx] || '').trim();
    const targetUrl = String(display[i][targetIdx] || '').trim();
    if (status === 'live' || backlinkUrl) {
      if (!backlinkUrl || !targetUrl) {
        if (auditedIdx >= 0) row[auditedIdx] = new Date();
        if (noteIdx >= 0) row[noteIdx] = 'Needs review: add Backlink URL and Target URL before audit.';
        keep.push(row); continue;
      }
      checked++;
      const result = verifyBacklink_(backlinkUrl, targetUrl);
      if (auditedIdx >= 0) row[auditedIdx] = new Date();
      if (noteIdx >= 0) row[noteIdx] = result.note;
      if (result.live) {
        if (statusIdx >= 0) row[statusIdx] = 'Live';
        live++;
        keep.push(row);
      } else {
        if (statusIdx >= 0) row[statusIdx] = 'Broken';
        move.push(row);
      }
    } else keep.push(row);
  }
  if (move.length) broken.getRange(broken.getLastRow()+1,1,move.length,headers.length).setValues(move);
  main.getRange(2,1,values.length,headers.length).clearContent();
  if (keep.length) main.getRange(2,1,keep.length,headers.length).setValues(keep);
  return {ok:true,checked:checked,live:live,moved:move.length,notes:notes};
}

function verifyBacklink_(pageUrl, targetUrl) {
  try {
    const page = normalizeUrl_(pageUrl), target = normalizeUrl_(targetUrl);
    const response = UrlFetchApp.fetch(page, {
      muteHttpExceptions:true, followRedirects:true,
      headers:{'User-Agent':'Mozilla/5.0 (compatible; ITSKHAYBacklinkAudit/1.0)'}
    });
    const code = response.getResponseCode();
    if (code < 200 || code >= 400) return {live:false,note:'HTTP ' + code + ' — moved to Broken Links for review'};
    const html = response.getContentText().toLowerCase();
    const targetHost = target.replace(/^https?:\/\//,'').split('/')[0].replace(/^www\./,'');
    const targetNoWww = target.replace(/^https?:\/\/(www\.)?/,'').replace(/\/$/,'');
    const found = html.indexOf(target) >= 0 || html.indexOf(targetNoWww) >= 0 || html.indexOf(targetHost) >= 0;
    if (!found) return {live:false,note:'Target URL not found in page HTML'};
    return {live:true,note:'Target URL found in page HTML'};
  } catch (err) {
    return {live:false,note:'Could not verify: ' + String(err.message || err) + ' — manual review recommended'};
  }
}

function searchLinks_(niche, targetUrl, requestedCount, categories) {
  const q = encodeURIComponent(String(niche || '').trim());
  const target = encodeURIComponent(String(targetUrl || '').trim());
  const count = Math.max(1, Math.min(50, Number(requestedCount) || 10));
  const selected = Array.isArray(categories) ? categories : ['directories','guest-posts','local-citations'];
  const definitions = {
    'directories': {label:'Business directories', query:q+'+free+business+directory+submission'},
    'guest-posts': {label:'Guest post opportunities', query:q+'+write+for+us+guest+post'},
    'local-citations': {label:'Local citations', query:q+'+business+listing+directory+India'},
    'resource-pages': {label:'Resource pages', query:q+'+resources+useful+links'},
    'profiles': {label:'Business profile links', query:q+'+create+business+profile+website'},
    'forums': {label:'Relevant communities', query:q+'+industry+forum+community+participate'},
    'competitors': {label:'Competitor backlink research', query:q+'+competitor+backlinks+free+tools'},
    'broken-links': {label:'Broken-link opportunities', query:q+'+broken+link+building+resource+pages'}
  };
  const all = selected.filter(k => definitions[k]).map(k => ({
    label:definitions[k].label,
    url:'https://www.google.com/search?q='+definitions[k].query
  }));
  if (target) all.push({label:'Search for target URL mentions',url:'https://www.google.com/search?q='+target+'+link'});
  // Search options are category-focused query links, not individual verified sites.
  // Count controls the requested prospect target and is displayed in the UI; actual results come from each search provider.
  return all.slice(0, count);
}

function normalizeDomain_(url) {
  try { return String(url).toLowerCase().replace(/^https?:\/\//,'').replace(/^www\./,'').split('/')[0].split('?')[0]; }
  catch(e) { return ''; }
}
function normalizeUrl_(url) {
  let u = String(url || '').trim();
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  return u;
}
function sha256_(s) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8)
    .map(b => ('0' + ((b + 256) % 256).toString(16)).slice(-2)).join('');
}
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
