const API_URL = 'https://script.google.com/macros/s/AKfycbxzPGK7gCEDhhz8dST9WRFjOaEwsANJOBuMJK61NfV6M5ln4o0ISuTEzy8_nO6la5rf/exec';
let token = '';
let sheetData = {headers:[],rows:[],brokenCount:0};
const $ = id => document.getElementById(id);
const loginPanel = $('login-panel'), dashboard = $('dashboard');
function showToast(msg){const t=$('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),3200)}
async function api(action, extra={}) {
  if (!API_URL || API_URL.includes('PASTE_YOUR')) throw new Error('Connect the Apps Script Web App URL in app.js first.');
  const r = await fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action,token,...extra})});
  const data = await r.json();
  if (!data.ok) throw new Error(data.error || 'Request failed');
  return data;
}
$('login-form').addEventListener('submit',async e=>{
  e.preventDefault(); $('login-error').textContent='';
  try{
    const data=await api('login',{username:$('username').value.trim(),password:$('password').value});
    token=data.token; loginPanel.classList.add('hidden');dashboard.classList.remove('hidden');$('logout').classList.remove('hidden');
    $('user-label').textContent=$('username').value.trim(); await loadData(); showToast('Secure login successful.');
  }catch(err){$('login-error').textContent=err.message}
});
$('logout').addEventListener('click',()=>{token='';dashboard.classList.add('hidden');loginPanel.classList.remove('hidden');$('logout').classList.add('hidden');$('password').value=''});
async function loadData(){
  try{const d=await api('getData');sheetData=d.data;renderTable();renderMetrics();}
  catch(err){showToast(err.message)}
}
function indexOf(re){return sheetData.headers.findIndex(h=>re.test(String(h||'')))}
function renderMetrics(){
 const status=indexOf(/^status$/i), da=indexOf(/^da$/i), pa=indexOf(/^pa$/i), ss=indexOf(/^ss$/i);
 $('total-count').textContent=sheetData.rows.length;
 $('live-count').textContent=sheetData.rows.filter(r=>String(r[status]||'').toLowerCase()==='live').length;
 $('broken-count').textContent=sheetData.brokenCount||0;
 $('potential-count').textContent=sheetData.rows.filter(r=>(Number(r[da])>=30||Number(r[pa])>=30)&&(r[ss]===''||Number(r[ss])<=10)).length;
}
function renderTable(){
 const filter=$('table-filter').value.toLowerCase();
 const selected=sheetData.headers.map((h,i)=>({h,i})).filter(x=>/website name|category|da$|pa$|^ss$|status|homepage url|backlink url|target url|traffic|conversion fit|last audited|audit note/i.test(x.h));
 $('table-head').innerHTML='<tr>'+selected.map(x=>`<th>${esc(x.h)}</th>`).join('')+'</tr>';
 const rows=sheetData.rows.filter(r=>r.join(' ').toLowerCase().includes(filter)).slice(0,300);
 $('table-body').innerHTML=rows.length?rows.map(r=>'<tr>'+selected.map(x=>`<td title="${esc(r[x.i]||'')}">${esc(r[x.i]||'—')}</td>`).join('')+'</tr>').join(''):`<tr><td colspan="${Math.max(selected.length,1)}" class="muted">No matching records found.</td></tr>`;
}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
$('table-filter').addEventListener('input',renderTable);
$('refresh').addEventListener('click',loadData);
document.querySelectorAll('.nav-item').forEach(b=>b.addEventListener('click',()=>{
 document.querySelectorAll('.nav-item').forEach(x=>x.classList.remove('active'));b.classList.add('active');
 const view=b.dataset.view;
 if(view==='audit') $('audit-btn').scrollIntoView({behavior:'smooth',block:'center'});
 else if(view==='prospects') $('search-form').scrollIntoView({behavior:'smooth',block:'center'});
 else window.scrollTo({top:0,behavior:'smooth'});
}));
$('search-form').addEventListener('submit',async e=>{
 e.preventDefault();
 const niche=$('niche').value.trim(), targetUrl=$('target-url').value.trim();
 const requestedCount=Number($('result-count').value||10);
 const categories=[...document.querySelectorAll('input[name="backlink-category"]:checked')].map(x=>x.value);
 if(!categories.length){showToast('Select at least one backlink category.');return;}
 try{
   const d=await api('searchLinks',{niche,targetUrl,requestedCount,categories});
   const links=d.links||[];
   $('search-results').innerHTML=`<p class="result-count-note">Showing ${links.length} search options for ${esc(niche)}. Each opens a targeted search; it is not a verified list of individual backlink sites.</p>`+
     links.map(x=>`<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.label)} ↗</a>`).join('');
 }catch(err){showToast(err.message)}
});
$('add-form').addEventListener('submit',async e=>{
 e.preventDefault();const msg=$('add-message');msg.textContent='Adding prospect…';
 const prospect={websiteName:$('p-name').value,homepageUrl:$('p-url').value,category:$('p-category').value,da:$('p-da').value,pa:$('p-pa').value,ss:$('p-ss').value,traffic:$('p-traffic').value,conversionFit:$('p-fit').value,niche:$('niche').value,targetUrl:$('target-url').value};
 try{const d=await api('addProspect',{prospect});msg.textContent=d.message||'Added.';msg.style.color='#52652d';e.target.reset();await loadData();showToast(d.message||'Prospect added.')}
 catch(err){msg.textContent=err.message;msg.style.color='#b8463d'}
});
$('audit-btn').addEventListener('click',async()=>{
 const btn=$('audit-btn');btn.disabled=true;btn.textContent='Auditing…';
 try{const d=await api('audit');$('audit-result').innerHTML=`<div class="audit-stats"><div class="audit-stat"><strong>${d.checked??0}</strong><span>Pages checked</span></div><div class="audit-stat"><strong>${d.live??0}</strong><span>Links confirmed live</span></div><div class="audit-stat"><strong>${d.moved??0}</strong><span>Moved to Broken Links</span></div></div><p class="muted">Audit complete. Links not verified were moved to the <b>Broken Links</b> tab for manual review. Check the audit note before removing or rebuilding any link.</p>`;await loadData();showToast(`Audit complete: ${d.live||0} live, ${d.moved||0} moved for review.`)}
 catch(err){$('audit-result').textContent=err.message;showToast(err.message)}
 finally{btn.disabled=false;btn.textContent='✓ Run backlink audit'}
});
