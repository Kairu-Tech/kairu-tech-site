'use strict';
(() => {
 const $=id=>document.getElementById(id);
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const labels={stage:'Estado comercial',licenseStatus:'Estado de renovación',endDate:'Vencimiento',renewalNotice:'Aviso de renovación',renewalAmount:'Importe de renovación sin IVA',renewalCloseDate:'Cierre de renovación',amount:'Importe sin IVA',currency:'Moneda',closeDate:'Fecha de cierre',quoteStatus:'Estado del presupuesto',quoteReference:'Referencia del presupuesto',quoteDate:'Envío del presupuesto',next:'Próxima acción',nextDate:'Fecha de seguimiento',need:'Necesidad detectada',proposal:'Propuesta de valor',country:'País',sector:'Sector',users:'Usuarios contratados'};
 const projects={zentynel:'Zentynel',flowity:'Flowity',metadology:'Metadology'};
 const kinds={opportunity:'Oportunidad',client:'Cliente',license:'Licencia'};
 const dateNow=new Date(),localToday=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Madrid'}).format(dateNow);
 let selectedQuarter=localToday.slice(0,4)+'-T'+Math.ceil(Number(localToday.slice(5,7))/3),selectedCurrency='EUR';
 let context=null,admin=null,projectAdmin=null,dashboards=[],forecasts=[],forecastError='',records=[],filter='',busy=false,generation=0;
 const expanded=new Set();
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
 const metric=(label,count,sub='')=>'<div class="metric"><span class="label">'+esc(label)+'</span><b>'+esc(count)+'</b><small>'+esc(sub)+'</small></div>';
 const money=(amount,currency)=>new Intl.NumberFormat('es-ES',{style:'currency',currency,useGrouping:'always',minimumFractionDigits:Number(amount)%1?2:0,maximumFractionDigits:2}).format(Number(amount));
 const quarterLabel=q=>q.slice(5)+' '+q.slice(0,4);
 function financialPanel(panel,preview){
  const fc=forecasts.find(f=>f.project===panel.project&&f.quarter===selectedQuarter);
  const choices=[...new Set([...(panel.amounts||[]).map(a=>a.currency),...(fc?.currencies||[]).map(a=>a.currency)])].filter(c=>/^[A-Z]{3}$/.test(c));
  const currency=preview&&!choices.includes(selectedCurrency)?choices[0]||selectedCurrency:selectedCurrency;
  const pipeline=panel.amounts?.find(a=>a.currency===currency),numbers=fc?.model==='categorical-v1'?fc.currencies?.find(a=>a.currency===currency):null;
  const val=key=>numbers?money(numbers[key],currency):'—';
  const explanation=forecastError||fc&&fc.model!=='categorical-v1'?'Previsión por categorías pendiente de activar':numbers?'Confirmado + probable · importes completos':'Sin operaciones calculables en '+currency;
  const amounts='<div class="portal-finance"><article class="finance-card"><span>Pipeline abierto</span><strong>'+esc(pipeline?money(Number(pipeline.sales)+Number(pipeline.renewals),currency):'—')+'</strong><small>Importes completos · todas las fechas de cierre</small></article><article class="finance-card finance-primary"><span>Previsión de trabajo · '+esc(quarterLabel(selectedQuarter))+'</span><strong>'+esc(val('base'))+'</strong><small>'+esc(explanation)+(numbers?' · '+esc(money(numbers.won,currency))+' ganados':'')+'</small></article><article class="finance-card"><span>Ventas confirmadas · trimestre</span><strong>'+esc(val('won'))+'</strong><small>Ya incluidas al 100 % en el forecast · no son cobros</small></article></div>';
  const pending=fc?.model==='categorical-v1'?'<p class="forecast-note">'+esc(fc.missingCount)+' operaciones incompletas o por clasificar · '+esc(fc.undatedCount)+' sin fecha de cierre. '+(numbers?'Ganado indica cierre comercial, no cobro.':'Completa importe, fecha y categoría de previsión.')+'</p>':'<p class="forecast-note">'+esc(context?.owner?'Activa la consulta 14 de previsión por categorías en Supabase.':'La previsión aparecerá cuando esté disponible y tenga datos completos.')+'</p>';
  return amounts+'<section class="portal-scenarios"><div><h3>Escenarios del trimestre</h3><small>Importes completos · sin IVA · escenarios acumulados</small></div>'+[['conservative','Confirmado'],['base','Previsión de trabajo'],['optimistic','Si sale todo lo previsto']].map(([key,label])=>'<div class="scenario '+(key==='base'?'scenario-base':'')+'"><span>'+label+'</span><strong>'+esc(val(key))+'</strong></div>').join('')+'</section>'+sourceBreakdown(numbers,currency)+pending+'<p class="portal-potential-note">Una estimación por usuarios entra como Posible o Probable si trabajas esa operación para el trimestre. El crecimiento futuro sin operación concreta queda fuera. Los escenarios no se suman entre sí.</p>';
 }
 function sourceBreakdown(numbers,currency){
  if(!numbers)return '<section class="portal-source-breakdown"><h3>Origen de la previsión de trabajo</h3><p class="sub">Sin operaciones con datos completos para esta moneda y trimestre.</p></section>';
  const sources=numbers.sourceBreakdown;
  if(!sources)return '<section class="portal-source-breakdown"><h3>Origen de la previsión de trabajo</h3><p class="sub">'+esc(context?.owner?'Ejecuta la consulta 14 en Supabase para activar la previsión por categorías.':'Desglose por origen pendiente de actualización.')+'</p></section>';
  const estimateHint=sources.usersCount+' por usuarios · '+sources.manualCount+' manuales o de renovación';
  return '<section class="portal-source-breakdown"><div class="source-heading"><h3>Origen de la previsión de trabajo</h3><span>'+esc(money(numbers.base,currency))+' en total</span></div><div class="source-grid">'+[
    ['Estimado',sources.estimated,estimateHint],['Presupuestado',sources.budgeted,'Presupuestos registrados · importes completos'],['Confirmado',sources.confirmed,'Ventas ganadas · al 100 %']
   ].map(([title,amount,hint])=>'<article><span>'+esc(title)+'</span><strong>'+esc(money(amount,currency))+'</strong><small>'+esc(hint)+'</small></article>').join('')+'</div><p class="sub">Un único importe activo por operación. Las tres aportaciones suman confirmado + probable. Posibles: '+esc(money(numbers.possible||0,currency))+' adicionales solo en el último escenario. Renovaciones ya incluidas: '+esc(money(numbers.renewals,currency))+'.</p></section>';
 }
 function dashboard(panel,financial=panel.financial,preview=false){
  const key=panel.project+(preview?'-preview':'');
  return '<section class="portal-dashboard"><div class="portal-project-heading"><h2>'+esc(projects[panel.project]||panel.project)+'</h2><span class="sub">'+esc(new Date(panel.asOf).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Madrid'}))+'</span></div>'+(financial?financialPanel(panel,preview):'')+'<div class="portal-kpis">'+metric('Oportunidades abiertas',panel.opportunities)+metric('Acciones pendientes',panel.actionsWeek)+metric('Cuentas',panel.clients)+metric('Por renovar',panel.renewals)+'</div><div class="portal-details"><details class="portal-fold" data-portal-detail="'+esc(key+'-stages')+'"'+(expanded.has(key+'-stages')?' open':'')+'><summary><span>Pipeline por estado</span><small>'+esc(panel.stages?.length||0)+' estados</small></summary>'+(panel.stages?.length?'<div class="scroll"><table><thead><tr><th>Estado</th><th>Oportunidades</th></tr></thead><tbody>'+panel.stages.map(r=>'<tr><td>'+esc(r.stage)+'</td><td>'+esc(r.count)+'</td></tr>').join('')+'</tbody></table></div>':'<p>Sin oportunidades registradas.</p>')+'</details><details class="portal-fold" data-portal-detail="'+esc(key+'-renewals')+'"'+(expanded.has(key+'-renewals')?' open':'')+'><summary><span>Renovaciones y seguimiento</span><small class="'+(panel.expiredUnconfirmed?'warm-badge':'')+'">'+esc(panel.expiredUnconfirmed)+' vencidas por confirmar</small></summary><div class="renewal-summary">'+[['Renovadas',panel.renewed],['Finalizadas',panel.ended],['Vencen en 90 días',panel.due90],['Acciones vencidas',panel.overdueActions]].map(([label,count])=>'<div><span>'+label+'</span><strong>'+esc(count)+'</strong></div>').join('')+'</div><p class="sub">Los vencimientos no se consideran pérdidas automáticamente. Se cuentan periodos de licencia.</p></details></div></section>';
 }
 function quarterOptions(){
  const year=Number(localToday.slice(0,4)),options=[];
  for(let y=year-1;y<=year+2;y++)for(let q=1;q<=4;q++)options.push(y+'-T'+q);
  return options.map(q=>'<option value="'+q+'"'+(q===selectedQuarter?' selected':'')+'>'+esc(quarterLabel(q))+'</option>').join('');
 }
 function renderClient(){
  const visible=records.filter(r=>!filter||r.project===filter),panels=dashboards.filter(p=>!filter||p.project===filter);
  const available=[...new Set([...dashboards.map(p=>p.project),...records.map(r=>r.project)])];
  const financial=panels.some(p=>p.financial);
  const currencies=[...new Set(panels.filter(p=>p.financial).flatMap(p=>[...(p.amounts||[]).map(a=>a.currency),...(forecasts.find(f=>f.project===p.project)?.currencies||[]).map(a=>a.currency)]))].filter(c=>/^[A-Z]{3}$/.test(c));
  if(currencies.length&&!currencies.includes(selectedCurrency))selectedCurrency=currencies.includes('EUR')?'EUR':currencies[0];
  const choices=currencies.length?currencies:['EUR'];
  $('page').innerHTML='<div class="portal-toolbar"><div><h1>Resumen comercial</h1><p>Información compartida · solo lectura</p></div><div class="portal-selectors"><label>Proyecto<select id="portal-project"><option value="">Todos</option>'+available.map(p=>'<option value="'+esc(p)+'"'+(p===filter?' selected':'')+'>'+esc(projects[p]||p)+'</option>').join('')+'</select></label>'+(financial?'<label>Trimestre<select id="portal-quarter">'+quarterOptions()+'</select></label><label>Moneda<select id="portal-currency">'+choices.map(c=>'<option value="'+esc(c)+'"'+(c===selectedCurrency?' selected':'')+'>'+esc(c)+'</option>').join('')+'</select></label>':'')+'</div></div><p id="portal-status" role="status"></p>'+panels.map(p=>dashboard(p)).join('')+(visible.length?'<details class="portal-fold"><summary>Fichas compartidas individualmente ('+visible.length+')</summary><div class="portal-records">'+visible.map(card).join('')+'</div></details>':'')+(!panels.length&&!visible.length?'<div class="card"><h2>Todavía no tienes proyectos compartidos</h2><p>Cuando KairuTech te dé acceso, aparecerán aquí.</p></div>':'')+'<p class="portal-footer">Actualización cada 30 s · Las monedas se muestran por separado, sin conversión.</p>';
 }
 function projectAccessForm(){
  return '<div class="card"><h2>Compartir el resumen de un proyecto</h2><p>Autoriza a varias personas de una vez. Verán los contadores y el resumen de todas las fichas actuales y futuras de ese proyecto. No recibirán las fichas, contactos ni notas internas.</p><form id="project-access-form"><div class="fields"><label class="wide">Emails del equipo<textarea name="emails" required placeholder="persona1@empresa.com&#10;persona2@empresa.com"></textarea><small>Un email por línea, separados por coma o punto y coma. Las cuentas deben existir en Supabase Authentication.</small></label><label>Proyecto<select name="project" id="summary-project" required>'+projectAdmin.projects.map(p=>'<option value="'+esc(p.id)+'"'+(p.id==='zentynel'?' selected':'')+'>'+esc(p.name)+'</option>').join('')+'</select></label></div><div class="share-fields"><label><input type="checkbox" name="financial" id="summary-financial">Incluir importes agregados</label></div><h3>Vista previa del resumen compartido</h3><div id="project-preview"></div><p id="project-access-error" class="error" role="alert"></p><button class="primary" type="submit">Compartir resumen con el equipo</button></form></div><section class="card"><h2>Personas con acceso al resumen</h2><div class="scroll"><table><thead><tr><th>Email</th><th>Proyecto</th><th>Importes</th><th>Estado</th><th>Acción</th></tr></thead><tbody>'+projectAdmin.access.map((a,i)=>'<tr><td>'+esc(a.email)+'</td><td>'+esc(projects[a.project]||a.project)+'</td><td>'+esc(a.financial?'Incluidos':'Ocultos')+'</td><td>'+esc(a.enabled?'Activo':'Retirado')+'</td><td><button type="button" data-edit-project="'+i+'">Modificar</button> '+(a.enabled?'<button type="button" data-revoke-project="'+i+'">Retirar</button>':'')+'</td></tr>').join('')+'</tbody></table></div><details class="editor-section"><summary>Historial de permisos del resumen</summary><ul>'+projectAdmin.history.map(h=>'<li>'+esc(new Date(h.changedAt).toLocaleString('es-ES')+' · '+h.email+' · '+(projects[h.project]||h.project)+' · '+(h.enabled?'Activo':'Retirado')+' · Importes '+(h.financial?'incluidos':'ocultos'))+'</li>').join('')+'</ul></details></section>';
 }
 function summaryPreview(){
  const panel=dashboards.find(p=>p.project===$('summary-project')?.value);
  if($('project-preview'))$('project-preview').innerHTML=panel?dashboard(panel,$('summary-financial').checked,true):'Selecciona un proyecto.';
 }
 function renderAdmin(){
  $('page').innerHTML='<section class="hero"><div><h1>Accesos de clientes</h1><p>Comparte contadores y un resumen por proyecto con tu equipo.</p></div></section><p><a href="../">Volver a mi CRM</a></p>'+(admin.shares.some(s=>s.enabled)?'<p class="card">Hay permisos individuales anteriores activos. Puedes retirarlos en el desplegable inferior si quieres compartir únicamente el resumen.</p>':'')+projectAccessForm()+'<details class="card"><summary>Permisos individuales anteriores (opcional)</summary><div><h2>Compartir una ficha</h2><p>La cuenta debe existir en Supabase Authentication. El nombre de la ficha, proyecto, tipo y fecha de actualización siempre serán visibles. El resto se selecciona aquí. Las fichas vinculadas y los nuevos periodos requieren su propio permiso.</p><form id="share-form"><div class="fields"><label>Email del usuario<input type="email" name="email" required autocomplete="off"></label><label>Ficha<select name="record" id="share-record" required><option value="">Seleccionar ficha</option>'+admin.records.map(r=>'<option value="'+esc(r.id)+'">'+esc((projects[r.project]||r.project)+' · '+kinds[r.kind]+' · '+r.name)+'</option>').join('')+'</select></label></div><details class="editor-section" open><summary>Campos visibles para este usuario</summary><div id="share-fields" class="share-fields">Selecciona una ficha.</div></details><p class="sub">Los campos de texto que compartas mostrarán todo su contenido. Revísalos en la vista previa.</p><h3>Vista previa de la ficha compartida</h3><div id="share-preview">Selecciona una ficha para revisar la vista previa.</div><p id="share-error" class="error" role="alert"></p><button class="primary" type="submit">Guardar acceso</button></form></div><section class="card"><h2>Accesos concedidos</h2><p>Modificar carga el permiso en el formulario. Retirar corta las próximas consultas del usuario.</p><div class="scroll"><table><thead><tr><th>Usuario</th><th>Ficha</th><th>Campos compartidos</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>'+admin.shares.map(s=>'<tr><td>'+esc(s.email)+'</td><td>'+esc(s.name)+'</td><td>'+esc(s.fields.map(f=>labels[f]||f).join(', ')||'Solo nombre y proyecto')+'</td><td>'+esc(s.enabled?'Activo':'Retirado')+'</td><td><button type="button" data-edit-share="'+esc(s.id)+'">Modificar</button> '+(s.enabled?'<button type="button" data-revoke-share="'+esc(s.id)+'">Retirar</button>':'')+'</td></tr>').join('')+'</tbody></table></div><details class="editor-section"><summary>Historial de accesos (últimos 50 cambios)</summary><ul>'+(admin.history||[]).map(h=>'<li>'+esc(new Date(h.changedAt).toLocaleString('es-ES')+' · '+(h.email||'Cuenta eliminada')+' · '+(h.name||'Ficha eliminada')+' · '+(h.enabled?'Activo':'Retirado')+' · '+(h.fields||[]).map(f=>labels[f]||f).join(', '))+'</li>').join('')+'</ul></details></section></details>';
  summaryPreview();
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
  busy=true;const ticket=generation,requestedQuarter=selectedQuarter;
  try{
   const nextContext=await rpc('crm_portal_context');
   const managing=nextContext.owner&&new URLSearchParams(location.search).has('manage');
   const [data,summary,access,forecastResult]=await Promise.all([
    rpc(managing?'crm_portal_admin':'crm_portal_read'),rpc('crm_portal_dashboard'),
    managing?rpc('crm_portal_project_admin'):Promise.resolve(null),
    rpc('crm_portal_forecast',{p_quarter:requestedQuarter}).then(data=>({data,error:''})).catch(error=>({data:[],error:error.message}))
   ]);
   if(ticket!==generation||!crmConnection.isSignedIn())return;
   if(requestedQuarter!==selectedQuarter)return;
   context=nextContext;dashboards=summary;projectAdmin=access;forecasts=forecastResult.data;forecastError=forecastResult.error;
   $('portal-nav').innerHTML='<a href="./">Resumen</a>'+(context.owner?'<a href="?manage=1">Gestionar accesos</a><a href="../">Mi CRM</a>':'');
   if(managing){admin=data;renderAdmin();}else{records=data;renderClient();}
  }catch(error){
   if(ticket!==generation||!crmConnection.isSignedIn())return;
   if(initial)$('page').innerHTML='<div class="card"><h1>No se pudo cargar el portal</h1><p>'+esc(error.message)+'</p><p>Si estás preparando el portal, comprueba que has ejecutado la consultas 07 y 08 en Supabase. Pulsa Actualizar para reintentar.</p></div>';
   else {const status=$('portal-status');if(status)status.textContent='No se ha podido actualizar. Los datos mostrados pueden estar desactualizados.';else $('page').insertAdjacentHTML('afterbegin','<p role="alert" class="error">'+esc(error.message)+'</p>');}
  }finally{busy=false;if(ticket===generation&&requestedQuarter!==selectedQuarter&&crmConnection.isSignedIn())load();}
 }
 addEventListener('crm-ready',()=>load(true));
 addEventListener('crm-locked',()=>{generation++;records=[];dashboards=[];forecasts=[];forecastError='';expanded.clear();projectAdmin=null;admin=null;context=null;$('page').textContent='';$('portal-nav').textContent='';});
 $('portal-refresh').addEventListener('click',()=>load(true));
 $('portal-logout').addEventListener('click',()=>crmConnection.logout());
 document.addEventListener('change',e=>{
  if(['summary-project','summary-financial'].includes(e.target.id))summaryPreview();
  if(e.target.id==='portal-quarter'){selectedQuarter=e.target.value;load(true);}
  if(e.target.id==='portal-currency'){selectedCurrency=e.target.value;renderClient();}
  if(e.target.id==='portal-project'){filter=e.target.value;renderClient();}
  if(e.target.id==='share-record')fields();
  if(e.target.name==='fields')preview();
 });
 document.addEventListener('submit',async e=>{
  if(e.target.id==='project-access-form'){
   e.preventDefault();const form=e.target,button=form.querySelector('[type="submit"]');button.disabled=true;
   const data=new FormData(form),emails=[...new Set(String(data.get('emails')).split(/[\s,;]+/).filter(Boolean).map(x=>x.toLowerCase()))];
   try{await rpc('crm_portal_project_grant',{p_emails:emails,p_project:data.get('project'),p_financial:data.has('financial'),p_enabled:true});await load(true);}
   catch(error){$('project-access-error').textContent=error.message;}finally{button.disabled=false;}
   return;
  }
  if(e.target.id!=='share-form')return;
  e.preventDefault();const form=e.target,submit=form.querySelector('[type="submit"]');submit.disabled=true;
  const data=new FormData(form);
  try{
   await rpc('crm_portal_share',{p_email:data.get('email'),p_record_id:data.get('record'),p_fields:data.getAll('fields'),p_enabled:true});
   await load(true);
  }catch(error){$('share-error').textContent=error.message;}finally{submit.disabled=false;}
 });
 document.addEventListener('click',async e=>{
  const projectEdit=e.target.closest('[data-edit-project]'),projectRevoke=e.target.closest('[data-revoke-project]');
  if(projectEdit){
   const access=projectAdmin.access[Number(projectEdit.dataset.editProject)];if(!access)return;
   const form=$('project-access-form');form.elements.emails.value=access.email;form.elements.project.value=access.project;form.elements.financial.checked=access.financial;summaryPreview();form.scrollIntoView({block:'start'});return;
  }
  if(projectRevoke){
   const access=projectAdmin.access[Number(projectRevoke.dataset.revokeProject)];if(!access)return;
   projectRevoke.disabled=true;
   try{await rpc('crm_portal_project_grant',{p_emails:[access.email],p_project:access.project,p_financial:access.financial,p_enabled:false});await load(true);}
   catch(error){projectRevoke.disabled=false;alert(error.message);}return;
  }
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
 document.addEventListener('toggle',e=>{const key=e.target.dataset?.portalDetail;if(!key||!e.target.isConnected)return;if(e.target.open)expanded.add(key);else expanded.delete(key);},true);
 setInterval(()=>{if(!document.hidden&&context&&!new URLSearchParams(location.search).has('manage'))load();},30000);
})();
