'use strict';
(() => {
 const $=id=>document.getElementById(id);
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const labels={stage:'Estado comercial',licenseStatus:'Estado de renovación',endDate:'Vencimiento',renewalNotice:'Aviso de renovación',renewalAmount:'Importe de renovación sin IVA',renewalCloseDate:'Cierre de renovación',amount:'Importe sin IVA',currency:'Moneda',closeDate:'Fecha de cierre',quoteStatus:'Estado del presupuesto',quoteReference:'Referencia del presupuesto',quoteDate:'Envío del presupuesto',next:'Próxima acción',nextDate:'Fecha de seguimiento',need:'Necesidad detectada',proposal:'Propuesta de valor',country:'País',sector:'Sector',users:'Usuarios contratados'};
 const projects={zentynel:'Zentynel',flowity:'Flowity',metadology:'Metadology'};
 const kinds={opportunity:'Oportunidad',client:'Cliente',license:'Licencia'};
 let context=null,admin=null,records=[],filter='',busy=false,generation=0;
 const rpc=(name,args={})=>crmConnection.request('rpc/'+name,{method:'POST',body:JSON.stringify(args)});
 function display(key,value){
  if(value==null||value==='')return 'Sin completar';
  if(['amount','renewalAmount'].includes(key))return new Intl.NumberFormat('es-ES',{maximumFractionDigits:2}).format(Number(value));
  if(/Date$/.test(key)||['endDate','renewalNotice'].includes(key)){
   const date=new Date(value+'T12:00:00Z');
   if(!isNaN(date))return new Intl.DateTimeFormat('es-ES',{dateStyle:'long'}).format(date);
  }
  return String(value);
 }
 function card(record){
  const items=Object.entries(record.data||{}).filter(([key])=>labels[key]);
  return '<article class="card portal-record"><h2>'+esc(record.name)+'</h2><p class="sub">'+esc(projects[record.project]||record.project)+' · '+esc(kinds[record.kind]||record.kind)+'</p><dl class="portal-data">'+items.map(([key,val])=>'<div><dt>'+esc(labels[key])+'</dt><dd>'+esc(display(key,val))+'</dd></div>').join('')+'</dl>'+(record.updatedAt?'<p class="sub">Último cambio de la ficha: '+esc(new Date(record.updatedAt).toLocaleString('es-ES'))+'</p>':'')+'</article>';
 }
 function renderClient(){
  const visible=records.filter(r=>!filter||r.project===filter);
  $('page').innerHTML='<section class="hero"><div><h1>Tu información compartida</h1><p>Consulta el seguimiento que KairuTech comparte contigo.</p></div></section><p class="sub">Actualización automática cada 30 segundos mientras el portal está abierto. Puedes actualizar ahora con el botón superior.</p><label class="portal-filter">Proyecto<select id="portal-project"><option value="">Todos</option>'+[...new Set(records.map(r=>r.project))].map(p=>'<option value="'+esc(p)+'"'+(p===filter?' selected':'')+'>'+esc(projects[p]||p)+'</option>').join('')+'</select></label><p id="portal-status" role="status"></p>'+(visible.length?'<div class="portal-records">'+visible.map(card).join('')+'</div>':'<div class="card"><h2>No hay fichas compartidas</h2><p>Cuando KairuTech te dé acceso, aparecerán aquí.</p></div>');
 }
 function renderAdmin(){
  $('page').innerHTML='<section class="hero"><div><h1>Accesos de clientes</h1><p>Elige una cuenta, una ficha y los campos que podrá consultar.</p></div></section><p><a href="../">Volver a mi CRM</a></p><div class="card"><h2>Compartir una ficha</h2><p>La cuenta debe existir en Supabase Authentication. El nombre de la ficha, proyecto, tipo y fecha de actualización siempre serán visibles. El resto se selecciona aquí. Las fichas vinculadas y los nuevos periodos requieren su propio permiso.</p><form id="share-form"><div class="fields"><label>Email del usuario<input type="email" name="email" required autocomplete="off"></label><label>Ficha<select name="record" id="share-record" required><option value="">Seleccionar ficha</option>'+admin.records.map(r=>'<option value="'+esc(r.id)+'">'+esc((projects[r.project]||r.project)+' · '+kinds[r.kind]+' · '+r.name)+'</option>').join('')+'</select></label></div><details class="editor-section" open><summary>Campos visibles para este usuario</summary><div id="share-fields" class="share-fields">Selecciona una ficha.</div></details><p class="sub">Los campos de texto que compartas mostrarán todo su contenido. Revísalos en la vista previa.</p><h3>Vista previa de la ficha compartida</h3><div id="share-preview">Selecciona una ficha para revisar la vista previa.</div><p id="share-error" class="error" role="alert"></p><button class="primary" type="submit">Guardar acceso</button></form></div><section class="card"><h2>Accesos concedidos</h2><p>Modificar carga el permiso en el formulario. Retirar corta las próximas consultas del usuario.</p><div class="scroll"><table><thead><tr><th>Usuario</th><th>Ficha</th><th>Campos compartidos</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>'+admin.shares.map(s=>'<tr><td>'+esc(s.email)+'</td><td>'+esc(s.name)+'</td><td>'+esc(s.fields.map(f=>labels[f]||f).join(', ')||'Solo nombre y proyecto')+'</td><td>'+esc(s.enabled?'Activo':'Retirado')+'</td><td><button type="button" data-edit-share="'+esc(s.id)+'">Modificar</button> '+(s.enabled?'<button type="button" data-revoke-share="'+esc(s.id)+'">Retirar</button>':'')+'</td></tr>').join('')+'</tbody></table></div><details class="editor-section"><summary>Historial de accesos (últimos 50 cambios)</summary><ul>'+(admin.history||[]).map(h=>'<li>'+esc(new Date(h.changedAt).toLocaleString('es-ES')+' · '+(h.email||'Cuenta eliminada')+' · '+(h.name||'Ficha eliminada')+' · '+(h.enabled?'Activo':'Retirado')+' · '+(h.fields||[]).map(f=>labels[f]||f).join(', '))+'</li>').join('')+'</ul></details></section>';
 }
 function selectedRecord(){return admin?.records.find(r=>r.id===$('share-record')?.value);}
 function preview(){
  const record=selectedRecord();
  if(!record)return;
  const keys=[...$('share-form').querySelectorAll('input[name="fields"]:checked')].map(el=>el.value);
  $('share-preview').innerHTML=card({...record,data:Object.fromEntries(keys.map(k=>[k,record.data[k]]))});
 }
 function fields(selected=[]){
  const record=selectedRecord();
  $('share-fields').innerHTML=record?Object.entries(labels).filter(([k])=>record.kind==='license'?!['stage','closeDate','need','proposal','country','sector'].includes(k):record.kind==='client'?['next','nextDate','country','sector'].includes(k):!['licenseStatus','endDate','renewalNotice','renewalAmount','renewalCloseDate','users'].includes(k)).map(([key,label])=>'<label><input type="checkbox" name="fields" value="'+esc(key)+'"'+(selected.includes(key)?' checked':'')+'>'+esc(label)+'</label>').join(''):'Selecciona una ficha.';
  preview();
 }
 async function load(initial=false){
  if(busy||!crmConnection.isSignedIn())return;
  busy=true;const ticket=generation;
  try{
   const nextContext=await rpc('crm_portal_context');
   const managing=nextContext.owner&&new URLSearchParams(location.search).has('manage');
   const data=await rpc(managing?'crm_portal_admin':'crm_portal_read');
   if(ticket!==generation||!crmConnection.isSignedIn())return;
   context=nextContext;
   $('portal-nav').innerHTML='<a href="./">Mi información</a>'+(context.owner?'<a href="?manage=1">Gestionar accesos</a><a href="../">Mi CRM</a>':'');
   if(managing){admin=data;renderAdmin();}else{records=data;renderClient();}
  }catch(error){
   if(ticket!==generation||!crmConnection.isSignedIn())return;
   if(initial)$('page').innerHTML='<div class="card"><h1>No se pudo cargar el portal</h1><p>'+esc(error.message)+'</p><p>Si estás preparando el portal, comprueba que has ejecutado la consulta 07 en Supabase. Pulsa Actualizar para reintentar.</p></div>';
   else {const status=$('portal-status');if(status)status.textContent='No se ha podido actualizar. Los datos mostrados pueden estar desactualizados.';else $('page').insertAdjacentHTML('afterbegin','<p role="alert" class="error">'+esc(error.message)+'</p>');}
  }finally{busy=false;}
 }
 addEventListener('crm-ready',()=>load(true));
 addEventListener('crm-locked',()=>{generation++;records=[];admin=null;context=null;$('page').textContent='';$('portal-nav').textContent='';});
 $('portal-refresh').addEventListener('click',()=>load(true));
 $('portal-logout').addEventListener('click',()=>crmConnection.logout());
 document.addEventListener('change',e=>{
  if(e.target.id==='portal-project'){filter=e.target.value;renderClient();}
  if(e.target.id==='share-record')fields();
  if(e.target.name==='fields')preview();
 });
 document.addEventListener('submit',async e=>{
  if(e.target.id!=='share-form')return;
  e.preventDefault();const form=e.target,submit=form.querySelector('[type="submit"]');submit.disabled=true;
  const data=new FormData(form);
  try{
   await rpc('crm_portal_share',{p_email:data.get('email'),p_record_id:data.get('record'),p_fields:data.getAll('fields'),p_enabled:true});
   await load(true);
  }catch(error){$('share-error').textContent=error.message;}finally{submit.disabled=false;}
 });
 document.addEventListener('click',async e=>{
  const edit=e.target.closest('[data-edit-share]'),revoke=e.target.closest('[data-revoke-share]');
  if(edit){
   const share=admin.shares.find(s=>s.id===edit.dataset.editShare);if(!share)return;
   const form=$('share-form');form.elements.email.value=share.email;form.elements.record.value=share.recordId;fields(share.fields);form.scrollIntoView({block:'start'});
  }
  if(revoke){
   const share=admin.shares.find(s=>s.id===revoke.dataset.revokeShare);if(!share)return;
   revoke.disabled=true;
   try{await rpc('crm_portal_share',{p_email:share.email,p_record_id:share.recordId,p_fields:share.fields,p_enabled:false});await load(true);}catch(error){revoke.disabled=false;alert(error.message);}
  }
 });
 setInterval(()=>{if(!document.hidden&&context&&!new URLSearchParams(location.search).has('manage'))load();},30000);
})();
