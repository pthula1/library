import { BrowserMultiFormatReader } from 'https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.5/+esm';

const $ = id => document.getElementById(id);
const STORAGE_KEY = 'pocket-library-v1';
let books = loadBooks();
let reader = null;
let controls = null;
let pendingBook = null;
let activeFilter = 'all';
let toastTimer;

function loadBooks(){ try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; } }
function persist(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(books)); render(); }
function uid(){ return `${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function esc(s=''){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function toast(message){ const el=$('toast'); el.textContent=message; el.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove('show'),2800); }
function today(){ const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function isLoaned(b){ return !!b.loan && !b.loan.returnedAt; }
function isOverdue(b){ return isLoaned(b) && b.loan.dueDate && b.loan.dueDate < today(); }
function render(){
  $('totalCount').textContent=books.length; $('loanCount').textContent=books.filter(isLoaned).length; $('overdueCount').textContent=books.filter(isOverdue).length;
  const q=$('searchInput').value.trim().toLowerCase();
  const visible=books.filter(b=>{
    const matches=[b.title,b.author,b.isbn,b.borrower,b.shelf].some(v=>String(v||'').toLowerCase().includes(q));
    const filter=activeFilter==='all'||(activeFilter==='available'&&!isLoaned(b))||(activeFilter==='loaned'&&isLoaned(b))||(activeFilter==='overdue'&&isOverdue(b));
    return matches&&filter;
  });
  $('bookList').innerHTML=visible.map(b=>`<article class="book-card" data-id="${esc(b.id)}"><div class="cover">${b.cover?`<img src="${esc(b.cover)}" alt="">`:'▤'}</div><div class="book-info"><h3>${esc(b.title)}</h3><p>${esc(b.author||'Author unknown')}</p><p class="muted">${esc(b.isbn||'No ISBN')}${b.shelf?' · '+esc(b.shelf):''}</p><span class="pill ${isOverdue(b)?'overdue':isLoaned(b)?'loaned':'available'}">${isOverdue(b)?'Overdue':isLoaned(b)?'Checked out':'Available'}</span>${isLoaned(b)?`<p class="muted">${esc(b.loan.borrower)} · Due ${esc(b.loan.dueDate||'not set')}</p>`:''}<div class="card-actions"><button class="small-button" data-action="details">Details</button>${isLoaned(b)?'<button class="small-button" data-action="return">Return</button>':'<button class="small-button" data-action="checkout">Check out</button>'}</div></div></article>`).join('');
  $('emptyState').hidden=books.length>0;
}
function openDialog(id){ $(id).showModal(); }
function closeDialog(id){ if($(id).open) $(id).close(); }
async function startScanner(){
  openDialog('scannerDialog'); $('scannerStatus').textContent='Starting camera…';
  if(!navigator.mediaDevices?.getUserMedia){ $('scannerStatus').textContent='Camera access is not available in this browser. Open the HTTPS website in Safari.'; return; }
  try {
    stopScanner(); reader=new BrowserMultiFormatReader();
    controls=await reader.decodeFromVideoDevice(undefined,$('scannerVideo'),(result,error)=>{
      if(result){ const raw=result.getText(); const isbn=normalizeIsbn(raw); if(isbn){ $('isbnInput').value=isbn; stopScanner(); closeDialog('scannerDialog'); lookupIsbn(isbn); } else { $('scannerStatus').textContent='Barcode detected, but it does not look like an ISBN. Aim at the book’s ISBN barcode, not a retail price barcode.'; } }
    });
    $('scannerStatus').textContent='Camera ready. Center the ISBN barcode in the frame and hold still.';
  } catch(e){ $('scannerStatus').textContent=`Could not start scanning: ${e?.message||'camera error'}. Check Safari camera permission and try again.`; }
}
function stopScanner(){ try{ if(controls?.stop) controls.stop(); }catch{} controls=null; try{ if(reader?.reset) reader.reset(); }catch{} reader=null; const v=$('scannerVideo'); if(v?.srcObject){v.srcObject.getTracks().forEach(t=>t.stop());v.srcObject=null;} }
function normalizeIsbn(raw){ const s=String(raw||'').replace(/[^0-9Xx]/g,'').toUpperCase(); if(s.length===13 && /^(978|979)/.test(s)) return s; if(s.length===10) return s; return ''; }
async function lookupIsbn(isbn){
  $('isbnInput').value=isbn; toast('Looking up book…');
  try{
    const url=`https://openlibrary.org/api/books?bibkeys=ISBN:${encodeURIComponent(isbn)}&format=json&jscmd=data`;
    const r=await fetch(url); if(!r.ok) throw new Error('Lookup service returned an error'); const data=await r.json(); const item=data[`ISBN:${isbn}`];
    if(item){ pendingBook={title:item.title||'',author:(item.authors||[]).map(a=>a.name).join(', '),isbn,publisher:(item.publishers||[]).map(p=>p.name).join(', ')+(item.publish_date?' / '+item.publish_date:''),cover:item.cover?.medium||item.cover?.small||'',shelf:''}; }
    else { pendingBook={title:'',author:'',isbn,publisher:'',cover:'',shelf:''}; }
    fillBookForm(pendingBook); $('lookupNotice').hidden=!!item; $('lookupNotice').textContent=item?'Book details found. Review them before saving.':'No matching record found. Enter the details manually, then save or check out.'; $('bookDialogTitle').textContent=item?'Review book details':'Book not found — enter details'; openDialog('bookDialog');
  }catch(e){ pendingBook={title:'',author:'',isbn,publisher:'',cover:'',shelf:''}; fillBookForm(pendingBook); $('lookupNotice').hidden=false; $('lookupNotice').textContent='Online lookup failed. Check your connection or enter the details manually.'; $('bookDialogTitle').textContent='Enter book details'; openDialog('bookDialog'); }
}
function fillBookForm(b){ $('editTitle').value=b.title||''; $('editAuthor').value=b.author||''; $('editIsbn').value=b.isbn||''; $('editPublisher').value=b.publisher||''; $('editShelf').value=b.shelf||''; $('previewTitle').textContent=b.title||'Book title'; $('previewAuthor').textContent=b.author||''; $('previewMeta').textContent=b.publisher||b.isbn||''; const img=$('previewCover'); img.hidden=!b.cover; img.src=b.cover||''; $('previewPlaceholder').hidden=!!b.cover; img.onerror=()=>{img.hidden=true;$('previewPlaceholder').hidden=false;}; }
function formBook(){ return {title:$('editTitle').value.trim(),author:$('editAuthor').value.trim(),isbn:$('editIsbn').value.trim(),publisher:$('editPublisher').value.trim(),shelf:$('editShelf').value.trim(),cover:pendingBook?.cover||''}; }
function saveBook(){ const b=formBook(); if(!b.title){toast('Please enter a book title.');$('editTitle').focus();return null;} const existing=books.find(x=>b.isbn&&x.isbn===b.isbn); if(existing){Object.assign(existing,b);persist();toast('Book already in your library; details updated.');return existing;} const book={id:uid(),...b,addedAt:new Date().toISOString(),loan:null,history:[]}; books.unshift(book);persist();toast('Book added to your library.');return book; }
function beginCheckout(book){ if(!book){book=saveBook(); if(!book)return;} pendingBook=null; $('checkoutBookName').textContent=book.title; $('borrowerInput').value=''; $('checkoutDate').value=today(); const due=new Date();due.setDate(due.getDate()+14);$('dueDate').value=`${due.getFullYear()}-${String(due.getMonth()+1).padStart(2,'0')}-${String(due.getDate()).padStart(2,'0')}`; $('checkoutForm').dataset.bookId=book.id; closeDialog('bookDialog');openDialog('checkoutDialog'); }
function confirmCheckout(e){ e.preventDefault();const id=$('checkoutForm').dataset.bookId;const b=books.find(x=>x.id===id);if(!b)return;const borrower=$('borrowerInput').value.trim();if(!borrower)return;b.loan={borrower,checkoutDate:$('checkoutDate').value,dueDate:$('dueDate').value,returnedAt:null};b.history=b.history||[];b.history.push({...b.loan});persist();closeDialog('checkoutDialog');toast('Checkout saved.'); }
function returnBook(b){if(!b||!isLoaned(b))return;const returnedAt=today();b.loan.returnedAt=returnedAt;b.history=b.history||[];const last=[...b.history].reverse().find(x=>x.borrower===b.loan.borrower&&!x.returnedAt);if(last)last.returnedAt=returnedAt;persist();toast('Book marked as returned.');}
function showDetails(b){ if(!b)return; $('detailContent').innerHTML=`<h3>${esc(b.title)}</h3><p>${esc(b.author||'Author unknown')}</p><p class="muted">ISBN: ${esc(b.isbn||'—')}<br>Publisher/year: ${esc(b.publisher||'—')}<br>Shelf: ${esc(b.shelf||'—')}</p><h3>Lending history</h3>${(b.history||[]).length?(b.history||[]).map(h=>`<p>${esc(h.borrower)}: ${esc(h.checkoutDate)} → ${esc(h.returnedAt||'Not returned')} (due ${esc(h.dueDate||'—')})</p>`).join(''):'<p>No checkout history yet.</p>'}<div class="button-stack">${isLoaned(b)?'<button class="primary-button" id="detailReturn">Mark returned</button>':'<button class="primary-button" id="detailCheckout">Check out this book</button>'}<button class="danger-button" id="deleteBook">Delete book</button></div>`;openDialog('detailDialog');$('detailReturn')?.addEventListener('click',()=>{returnBook(b);closeDialog('detailDialog');});$('detailCheckout')?.addEventListener('click',()=>{closeDialog('detailDialog');beginCheckout(b);});$('deleteBook')?.addEventListener('click',()=>{if(confirm('Delete this book and its lending history?')){books=books.filter(x=>x.id!==b.id);persist();closeDialog('detailDialog');toast('Book deleted.');}}); }
function exportFile(name,content,type){const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('scanBtn').addEventListener('click',startScanner);$('emptyScanBtn').addEventListener('click',startScanner);$('manualBtn').addEventListener('click',()=>{pendingBook={};fillBookForm(pendingBook);$('lookupNotice').hidden=true;openDialog('bookDialog');});$('lookupBtn').addEventListener('click',()=>{const isbn=normalizeIsbn($('isbnInput').value);if(!isbn){toast('Enter a valid ISBN-10 or ISBN-13.');return;}stopScanner();closeDialog('scannerDialog');lookupIsbn(isbn);});$('saveBookBtn').addEventListener('click',()=>{const b=saveBook();if(b)closeDialog('bookDialog');});$('checkoutFromLookupBtn').addEventListener('click',()=>beginCheckout(saveBook()));$('checkoutForm').addEventListener('submit',confirmCheckout);$('searchInput').addEventListener('input',render);
document.querySelectorAll('[data-filter]').forEach(btn=>btn.addEventListener('click',()=>{activeFilter=btn.dataset.filter;document.querySelectorAll('[data-filter]').forEach(x=>x.classList.toggle('active',x===btn));render();}));
$('bookList').addEventListener('click',e=>{const btn=e.target.closest('button[data-action]');if(!btn)return;const card=btn.closest('[data-id]');const b=books.find(x=>x.id===card?.dataset.id);if(btn.dataset.action==='details')showDetails(b);if(btn.dataset.action==='checkout')beginCheckout(b);if(btn.dataset.action==='return')returnBook(b);});
document.querySelectorAll('[data-close]').forEach(btn=>btn.addEventListener('click',()=>{const id=btn.dataset.close;if(id==='scannerDialog')stopScanner();closeDialog(id);}));$('scannerDialog').addEventListener('close',stopScanner);
$('backupBtn').addEventListener('click',()=>openDialog('backupDialog'));$('exportBtn').addEventListener('click',()=>exportFile('pocket-library-backup.json',JSON.stringify({version:1,exportedAt:new Date().toISOString(),books},null,2),'application/json'));$('exportCsvBtn').addEventListener('click',()=>{const fields=['title','author','isbn','publisher','shelf','borrower','checkoutDate','dueDate','returnedAt'];const csv=[fields.join(','),...books.map(b=>fields.map(k=>{const v=k==='borrower'?b.loan?.borrower:k==='checkoutDate'?b.loan?.checkoutDate:k==='dueDate'?b.loan?.dueDate:k==='returnedAt'?b.loan?.returnedAt:b[k];return '"'+String(v||'').replace(/"/g,'""')+'"';}).join(','))].join('\n');exportFile('pocket-library.csv',csv,'text/csv');});$('importFile').addEventListener('change',async e=>{const f=e.target.files?.[0];if(!f)return;try{const data=JSON.parse(await f.text());const incoming=Array.isArray(data)?data:data.books;if(!Array.isArray(incoming))throw new Error();if(confirm(`Restore ${incoming.length} books? This replaces the current library.`)){books=incoming;persist();closeDialog('backupDialog');toast('Backup restored.');}}catch{toast('That backup file could not be read.');}e.target.value='';});$('clearDataBtn').addEventListener('click',()=>{if(confirm('Delete all books and lending history? This cannot be undone.')){books=[];persist();closeDialog('backupDialog');toast('Library cleared.');}});
render();
