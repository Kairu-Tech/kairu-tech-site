'use strict';
const $=id=>document.getElementById(id);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const projects=['Zentynel','Flowity','Metadology'];
const colors=['zentynel','flowity','metadology'];
const stages=['Prospección','Contacto inicial','Cualificación','Reunión / demo','Propuesta','Negociación','Cierre ganado','Cierre perdido','Renovación','Seguimiento','En pausa'];
const priorities=['Alta','Media','Baja','Por revisar'];
const countries=['España','Portugal','México','Chile','Reino Unido','Colombia','Brasil','Perú','Paraguay','Países Bajos','Grecia','Austria','Bélgica','Alemania','Italia','Chequia','Irlanda','EE. UU.'];
const regions=['España','Portugal','Latinoamérica','Europa','Norteamérica'];
const types=['Cliente directo','Partner','Proveedor','Piloto','Licitación','Renovación','Por cualificar'];
const dateFormat=new Intl.DateTimeFormat('es-ES',{day:'numeric',month:'short',timeZone:'Europe/Madrid'});
const dateLong=new Intl.DateTimeFormat('es-ES',{day:'numeric',month:'long',year:'numeric',timeZone:'Europe/Madrid'});
const localDate=d=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Madrid'}).format(d);
const today=()=>localDate(new Date());
const addDays=(d,n)=>new Date(Date.parse(d+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
const week=()=>{const d=today();const w=new Date(d+'T12:00Z').getUTCDay();const start=addDays(d,-((w+6)%7));return [start,addDays(start,6)];};
const short=d=>d?dateFormat.format(new Date(d+'T12:00:00Z')):'Sin fecha';
const money=(n,c='EUR')=>new Intl.NumberFormat('es-ES',{style:'currency',currency:c||'EUR',maximumFractionDigits:2,minimumFractionDigits:0}).format(n);
const quarterFor=d=>d?d.slice(0,4)+'-T'+Math.ceil(Number(d.slice(5,7))/3):'';
const value=x=>x!==''&&x!=null;
const active=d=>!['Cierre ganado','Cierre perdido','En pausa'].includes(d.stage);
const hasAction=d=>!['Cierre perdido','En pausa'].includes(d.stage)&&d.next;
const filterFields=[['project','Proyecto'],['country','País'],['region','Región'],['sector','Sector'],['priority','Prioridad'],['stage','Estado comercial'],['type','Tipo']];
const navItems=[['home','▦','Esta semana'],['pipeline','☷','Pipeline'],['forecast','◴','Forecast trimestral'],['reviews','◷','Revisiones']];
const subsets={
  Zentynel:[['','Todas'],['spain','España'],['portugal','Portugal'],['latam','Latinoamérica']],
  Flowity:[['','Todas'],['dip','Diputaciones'],['road','Carreteras']]
};
const fields=[
  ['name','Cuenta / oportunidad','text',true],['project','Proyecto',projects,true],['stage','Estado comercial',stages,true],
  ['organisation','Organismo, empresa, proveedor o partner'],['type','Tipo de oportunidad',types],['sector','Sector'],
  ['country','País','country'],['region','Región','region'],['territory','Comunidad / territorio'],
  ['priority','Prioridad',priorities],['risk','Riesgo'],['contact','Contacto'],
  ['source','Fuente','textarea'],['need','Necesidad detectada','textarea'],['proposal','Propuesta de valor','textarea'],
  ['meetings','Reuniones','textarea'],['demos','Demos','textarea'],['emails','Emails y comunicaciones','textarea'],
  ['objections','Objeciones','textarea'],['amount','Importe estimado','amount'],['currency','Moneda',['EUR','USD','GBP','MXN','CLP','BRL','COP','PEN']],['probability','Probabilidad (%)','prob'],
  ['relevantDate','Fecha relevante','date'],['closeDate','Cierre previsto / efectivo','date'],['nextDate','Fecha de la próxima acción','date'],
  ['next','Próximo paso','textarea'],['notes','Notas','textarea']
];
let rows=[],error='',view='home',project='',subset='',filters={},query='',layout='list',fQuarter=quarterFor(today()),fProject='',editor=null,toastTimer;
const entries=kind=>rows.filter(x=>x.data.kind===kind);
const opportunities=()=>entries('opportunity').map(x=>x.data);
const get=id=>rows.find(r=>r.record_id===id);
const openBtn=(d,label,meta='')=>'<button type="button" class="open" data-action="open" data-id="'+esc(d.id)+'">'+esc(label)+(meta?'<span class="meta">'+esc(meta)+'</span>':'')+'</button>';
const button=(a,label,extra='',cl='')=>'<button type="button" class="'+cl+'" data-action="'+a+'" '+extra+'>'+label+'</button>';
const dot=p=>'<span aria-hidden="true" class="dot '+colors[projects.indexOf(p)]+'"></span>';
const tag=(s,c='')=>'<span class="tag '+c+'">'+esc(s)+'</span>';
const priority=d=>tag(d.priority||'Por revisar',d.priority==='Alta'?'warm':d.priority==='Baja'?'neutral':'');
const blank=t=>'<div class="empty">'+esc(t)+'</div>';
const metric=(l,n,sub)=>'<div class="metric"><span class="label">'+esc(l)+'</span><b>'+esc(n)+'</b><small>'+esc(sub)+'</small></div>';
const head=(title,detail,action='')=>'<div class="heading"><div><h1>'+esc(title)+'</h1><p>'+esc(detail)+'</p></div>'+action+'</div>';
const cardHead=(title,detail='',action='')=>'<div class="card-head"><div><h2>'+esc(title)+'</h2>'+(detail?'<p class="sub">'+esc(detail)+'</p>':'')+'</div>'+action+'</div>';
function opts(list,current,placeholder='') {
  const options=list.map(x=>Array.isArray(x)?x:[x,x]);
  return (placeholder?'<option value="">'+esc(placeholder)+'</option>':'')+options.map(([v,l])=>'<option value="'+esc(v)+'"'+(v===current?' selected':'')+'>'+esc(l)+'</option>').join('');
}
const projectIds={Zentynel:'zentynel',Flowity:'flowity',Metadology:'metadology'};
function fromDatabase(row) {
  const name=Object.keys(projectIds).find(key=>projectIds[key]===row.project_id)||'';
  return {record_id:row.id,version:row.version,timestamp:row.updated_at,reason:row.change_reason,
    data:{...row.data,id:row.id,kind:row.kind,name:row.name,project:name}};
}
async function api(path, options) {
  if (!options) {
    if (path) {
      const versions=await crmConnection.request('crm_versions?record_id=eq.'+encodeURIComponent(path.slice(1))+'&select=*&order=version.desc');
      return versions.map(row=>({...fromDatabase(row.snapshot),timestamp:row.changed_at,reason:row.change_reason}));
    }
    const records=[];
    let offset=0;
    while (true) {
      const page=await crmConnection.request('crm_records?select=*&order=id&limit=1000&offset='+offset);
      records.push(...page.map(fromDatabase));
      if (page.length<1000) return records;
      offset+=1000;
    }
  }
  const {data,version,reason}=JSON.parse(options.body);
  const payload={
    id:data.id,project_id:projectIds[data.project]||null,kind:data.kind,
    name:data.name,data,change_reason:reason.trim()||'Actualización'
  };
  const saved=await crmConnection.request('crm_records'+(version>=0?'?id=eq.'+data.id+'&version=eq.'+version:''),{
    method:version>=0?'PATCH':'POST',
    headers:{Prefer:'return=representation'},
    body:JSON.stringify(payload)
  });
  if(!saved?.length) throw Object.assign(Error('Hay una versión más reciente. Cierra la ficha y vuelve a abrirla antes de guardar.'),{status:409});
  return {ok:true};
}
async function load() {
  try {rows=await api('');error='';}
  catch(e){error=e.message;}
  render();
}
function toast(s){$('toast').textContent=s;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,3500);}
function route(){
  const [next,p]=location.hash.slice(1).split('/');
  view=navItems.some(x=>x[0]===next)||next==='project'?next:'home';
  project=projects.find((_,i)=>colors[i]===p)||'';
  filters={};query='';subset='';render();
}
function jump(v,p=''){location.hash=v+(p?'/'+colors[projects.indexOf(p)]:'');}
function render(){
  $('nav').innerHTML='<div class="nav-label">Seguimiento</div>'+navItems.map(([v,i,l])=>button('nav','<span class="nav-icon" aria-hidden="true">'+i+'</span>'+l,'data-view="'+v+'"',view===v?'active':'')).join('')+'<div class="nav-label">Proyectos</div>'+projects.map(p=>button('project',dot(p)+p,'data-project="'+p+'"',view==='project'&&project===p?'active':'')).join('');
  $('breadcrumb').textContent=view==='project'?project:(navItems.find(x=>x[0]===view)?.[2]||'Seguimiento comercial');
  $('page').innerHTML=error?'<div class="card"><p class="error">'+esc(error)+'</p>'+button('reload','Volver a cargar')+'</div>':({home,pipeline,project:pipeline,forecast,reviews}[view]||home)();
}
function home(){
  const all=opportunities(), open=all.filter(active), [start,end]=week();
  const outstanding=all.filter(hasAction);
  const weekTasks=outstanding.filter(d=>d.nextDate&&d.nextDate<=end).sort((a,b)=>a.nextDate.localeCompare(b.nextDate));
  const later=outstanding.filter(d=>!d.nextDate||d.nextDate>end).sort((a,b)=>(a.nextDate||'z').localeCompare(b.nextDate||'z'));
  const eur=open.filter(d=>d.currency==='EUR'&&value(d.amount));const top=open.filter(d=>d.priority==='Alta');
  const task=(d,done=false)=>'<div class="task">'+(done?button('done','✓','data-id="'+esc(d.id)+'" aria-label="Completar acción de '+esc(d.name)+'"','tick'):'')+openBtn(d,d.next,d.name+' · '+d.project)+'<span class="tag '+(d.nextDate&&d.nextDate<today()?'warm':'neutral')+'">'+esc(short(d.nextDate))+'</span></div>';
  const max=Math.max(1,...stages.map(s=>all.filter(d=>d.stage===s).length));
  return '<section class="hero"><div><p class="eyebrow">Semana comercial</p><h1>Seguimiento comercial</h1><p>Prioridades, oportunidades y próximos pasos de KairuTech.</p></div><span class="hero-date">'+esc(short(start)+' — '+dateLong.format(new Date(end+'T12:00Z')))+'</span></section>'+
  '<div class="grid metrics">'+metric('Pipeline abierto',open.filter(d=>d.stage!=='Prospección').length,open.filter(d=>d.stage==='Prospección').length+' fichas en prospección')+metric('Acciones pendientes',weekTasks.length,'Esta semana y vencidas')+metric('Prioridad alta',top.length,'Oportunidades activas')+metric('Valor estimado en EUR',eur.length?money(eur.reduce((s,d)=>s+Number(d.amount),0)):'—',eur.length+' fichas con importe')+'</div>'+
  '<div class="grid split"><section class="card">'+cardHead('Tareas de esta semana','Incluye acciones pendientes de semanas anteriores.')+(weekTasks.length?weekTasks.map(d=>task(d,true)).join(''):blank('Sin tareas con fecha para esta semana.'))+'</section><section class="card">'+cardHead('Estado del pipeline','',button('nav','Ver pipeline →','data-view="pipeline"','text-button'))+stages.filter(s=>all.some(d=>d.stage===s)).map(s=>{const n=all.filter(d=>d.stage===s).length;return '<div class="bar-row"><span>'+esc(s)+'</span><progress aria-label="'+esc(s)+'" max="'+max+'" value="'+n+'"></progress><b>'+n+'</b></div>';}).join('')+'</section></div>'+
  '<div class="grid split"><section class="card">'+cardHead('Próximas acciones','Acciones futuras y pendientes de programar.')+(later.length?later.map(d=>task(d,true)).join(''):blank('Sin próximas acciones registradas.'))+'</section>'+
  '<section class="card">'+cardHead('Revisión de prioridades','Registra decisiones y consulta revisiones anteriores.')+button('nav','Ir a revisiones →','data-view="reviews"','text-button')+'</section></div>'+
  '<section class="card">'+cardHead('Proyectos')+'<div class="grid projects">'+projects.map(p=>button('project',dot(p)+esc(p)+'<small>'+open.filter(d=>d.project===p).length+' activas</small>','data-project="'+p+'"','project-card')).join('')+'</div></section>';
}
function scoped(){
  return opportunities().filter(d=>{
    if(view==='project'&&d.project!==project)return false;
    if(subset==='spain'&&d.country!=='España')return false;
    if(subset==='portugal'&&d.country!=='Portugal')return false;
    if(subset==='latam'&&d.region!=='Latinoamérica')return false;
    if(subset==='dip'&&!/diputaci/i.test([d.name,d.organisation,d.sector,d.tags].join(' ')))return false;
    if(subset==='road'&&!/carreter|infraestructura viaria/i.test([d.name,d.sector,d.need,d.tags].join(' ')))return false;
    return true;
  });
}
function filtered(){
  const normalize=s=>String(s??'').normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();
  return scoped().filter(d=>filterFields.every(([k])=>!filters[k]||d[k]===filters[k])&&(!query||normalize([d.name,d.organisation,d.contact,d.next,d.sector].join(' ')).includes(normalize(query))));
}
function pipeline(){
  const scope=scoped(), title=view==='project'?project:'Pipeline comercial';
  const specialized=view==='project'&&subsets[project];
  const filter=filterFields.filter(([k])=>view!=='project'||k!=='project').map(([k,l])=>'<label>'+l+'<select data-filter="'+k+'">'+opts([...new Set(scope.map(d=>d[k]).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es')),filters[k],'Todos')+'</select></label>').join('');
  return head(title,view==='project'?'Oportunidades y seguimiento del proyecto.':'Prospección, cierre, renovación y seguimiento en una sola vista.')+
    (specialized?'<div class="chips">'+specialized.map(([k,l])=>button('subset',l,'data-key="'+k+'"',k===subset?'selected':'')).join('')+'</div>':'')+
    '<div class="card"><div class="filters"><label class="filter-search">Buscar<input type="search" id="query" value="'+esc(query)+'" placeholder="Cuenta, contacto o próximo paso"></label>'+filter+'</div>'+
    '<div class="chips">'+button('layout','Lista','data-key="list"',layout==='list'?'selected':'')+button('layout','Por etapa','data-key="board"',layout==='board'?'selected':'')+button('clear','Limpiar filtros')+'</div><div id="results">'+resultTable()+'</div></div>';
}
function resultTable(){
  const data=filtered().sort((a,b)=>(priorities.indexOf(a.priority||'Por revisar')-priorities.indexOf(b.priority||'Por revisar'))||a.name.localeCompare(b.name,'es'));
  if(!data.length)return blank('No hay oportunidades en esta vista. Puedes crear una desde el botón superior.');
  const count='<p class="sub">'+data.length+' '+(data.length===1?'oportunidad':'oportunidades')+'</p>';
  if(layout==='board')return count+'<div class="board">'+stages.map(s=>'<section class="lane"><h3>'+esc(s)+' · '+data.filter(d=>d.stage===s).length+'</h3>'+data.filter(d=>d.stage===s).map(d=>openBtn(d,d.name,d.project+' · '+(d.priority||'Por revisar'))).join('')+'</section>').join('')+'</div>';
  return count+'<div class="scroll"><table><thead><tr><th>Cuenta / oportunidad</th><th>País</th><th>Estado comercial</th><th>Prioridad</th><th>Importe</th><th>Próxima acción</th></tr></thead><tbody>'+data.map(d=>'<tr><td>'+openBtn(d,d.name,d.project+' · '+(d.type||'Por cualificar'))+'</td><td>'+esc(d.country||'—')+'</td><td>'+tag(d.stage||'Prospección',d.stage==='Cierre ganado'?'green':'neutral')+'</td><td>'+priority(d)+'</td><td class="nobr">'+(value(d.amount)?esc(money(Number(d.amount),d.currency)):'—')+'</td><td>'+esc(d.next||'—')+(d.nextDate?'<div class="meta">'+esc(short(d.nextDate))+'</div>':'')+'</td></tr>').join('')+'</tbody></table></div>';
}
const goalFields=[['name','Objetivo','text',true],['project','Proyecto',projects,true],['quarter','Trimestre (AAAA-T1 a AAAA-T4)','quarter',true],['currency','Moneda',['EUR','USD','GBP','MXN','CLP','BRL','COP','PEN'],true],['conservative','Conservador','amount'],['base','Base','amount'],['upside','Optimista','amount'],['linked','Sustituir por una oportunidad','link'],['notes','Notas y supuestos','textarea']];
const reviewFields=[['name','Título','text',true],['reviewDate','Fecha de revisión','date',true],['project','Proyecto',projects],['reviewNext','Próxima revisión','date'],['notes','Decisiones, cambios de prioridad y próximos pasos','textarea',true]];
function forecast(){
  const all=opportunities();
  const goals=entries('goal').map(r=>r.data).filter(d=>d.quarter===fQuarter&&(!fProject||d.project===fProject));
  const candidates=all.filter(d=>quarterFor(d.closeDate)===fQuarter&&(!fProject||d.project===fProject)&&(active(d)||d.stage==='Cierre ganado'));
  const real=candidates.filter(d=>value(d.amount)&&(d.stage==='Cierre ganado'||value(d.probability)));
  const missing=candidates.length-real.length;
  const totals=new Map();
  for(const d of real){
    const c=d.currency||'EUR', a=Number(d.amount), p=d.stage==='Cierre ganado'?1:Number(d.probability)/100;
    const sum=totals.get(c)||[0,0,0];
    [d.stage==='Cierre ganado'?1:Math.max(0,p-.2),p,d.stage==='Cierre ganado'?1:Math.min(1,p+.2)].forEach((x,i)=>sum[i]+=a*x);
    totals.set(c,sum);
  }
  for(const g of goals.filter(d=>!d.linked&&['conservative','base','upside'].some(k=>value(d[k])))){
    const c=g.currency||'EUR',sum=totals.get(c)||[0,0,0];
    ['conservative','base','upside'].forEach((k,i)=>sum[i]+=Number(g[k]||0));
    totals.set(c,sum);
  }
  const format=i=>[...totals.entries()].sort().map(([c,a])=>money(a[i],c)).join(' · ')||'—';
  const year=Number(fQuarter.slice(0,4));
  const periods=[...new Set([year-1,year,year+1,Number(today().slice(0,4)),...entries('goal').map(x=>Number(x.data.quarter?.slice(0,4))).filter(Boolean),...all.map(x=>Number(x.closeDate?.slice(0,4))).filter(Boolean)])].sort((a,b)=>a-b).flatMap(y=>[1,2,3,4].map(q=>y+'-T'+q));
  return head('Forecast trimestral','Proyección por moneda a partir de oportunidades fechadas y objetivos por validar.',button('goal','＋ Objetivo','','primary'))+
  '<div class="forecast-controls"><label class="sub" for="quarter">Trimestre</label><select id="quarter">'+opts(periods,fQuarter)+'</select><label class="sub" for="forecast-project">Proyecto</label><select id="forecast-project">'+opts(projects,fProject,'Todos los proyectos')+'</select></div>'+
  '<div class="grid metrics forecast-metrics">'+metric('Conservador',format(0),'Probabilidad −20 puntos')+metric('Base',format(1),'Probabilidad de la ficha')+metric('Optimista',format(2),'Probabilidad +20 puntos')+'</div>'+
  '<div class="grid split"><section class="card">'+cardHead('Oportunidades del trimestre',missing?missing+' con importe o probabilidad pendiente.':'Las ganadas computan al 100 %.')+
  (candidates.length?candidates.map(d=>'<div class="record">'+openBtn(d,d.name,d.project+' · '+short(d.closeDate))+'</div>').join(''):blank('Añade una fecha de cierre a una oportunidad para incluirla aquí.'))+'</section>'+
  '<section class="card">'+cardHead('Objetivos por validar','Al vincular una oportunidad, su valor sustituye al del objetivo.')+
  (goals.length?goals.map(d=>'<div class="record">'+openBtn(d,d.name,d.linked?'Sustituido por '+(get(d.linked)?.data.name||'oportunidad vinculada'):(value(d.base)?money(Number(d.base),d.currency):'Sin importe base'))+(d.linked?(real.some(x=>x.id===d.linked)?tag('Sustituido','green'):tag('Vínculo por revisar','warm')):tag('Genérico','neutral'))+'</div>').join(''):blank('Todavía no hay objetivos genéricos para este trimestre.'))+'</section></div>';
}
function reviews(){
  const history=entries('review').map(r=>r.data).sort((a,b)=>b.reviewDate.localeCompare(a.reviewDate));
  const attention=opportunities().filter(d=>active(d)&&['Alta','Por revisar'].includes(d.priority||'Por revisar')).filter(d=>d.next||(d.priority==='Alta'&&d.stage!=='Prospección'));
  const nextReview=history.find(d=>d.reviewNext)?.reviewNext;
  return head('Revisión de prioridades',nextReview?'Próxima revisión · '+short(nextReview):'Revisa el pipeline y guarda las decisiones de cada revisión.',button('review','＋ Registrar revisión','','primary'))+
  '<div class="grid split"><section class="card">'+cardHead('Prioridad alta o por revisar')+
  (attention.length?attention.map(d=>'<div class="record">'+openBtn(d,d.name,d.project+' · '+(d.next||'Sin próxima acción'))+priority(d)+'</div>').join(''):blank('Sin oportunidades destacadas.'))+'</section>'+
  '<section class="card">'+cardHead('Revisiones anteriores')+
  (history.length?history.map(d=>'<div class="record">'+openBtn(d,d.name,short(d.reviewDate)+' · '+(d.project||'Todos los proyectos')+(d.reviewNext?' · Próxima '+short(d.reviewNext):''))+'</div>').join(''):blank('Todavía no hay revisiones registradas.'))+'</section></div>';
}
function formField([key,label,typ='text',required=false],data){
  const v=data[key]??'', name=' name="'+key+'"'+(required?' required':'');
  const list=Array.isArray(typ)?typ:typ==='country'?[...new Set([...countries,...opportunities().map(x=>x.country).filter(Boolean)])].sort((a,b)=>a.localeCompare(b,'es')):typ==='region'?[...new Set([...regions,...opportunities().map(x=>x.region).filter(Boolean)])]:typ==='link'?opportunities().filter(d=>(d.project===data.project||d.id===v)&&(quarterFor(d.closeDate)===data.quarter||d.id===v)).map(d=>[d.id,d.name]):null;
  let control;
  if(list)control='<select'+name+'>'+opts(list,v,'Seleccionar')+'</select>';
  else if(typ==='textarea')control='<textarea'+name+'>'+esc(v)+'</textarea>';
  else{
    const number=typ==='amount'||typ==='prob';
    const type=number?'number':typ==='date'?'date':'text';
    control='<input'+name+' type="'+type+'" value="'+esc(v)+'"'+(number?' min="0" step="0.01"':'')+(typ==='prob'?' max="100"':'')+(typ==='quarter'?' pattern="[0-9]{4}-T[1-4]" placeholder="2026-T4"':'')+'>';
  }
  return '<label'+(typ==='textarea'?' class="wide"':'')+'>'+esc(label)+control+'</label>';
}
const fieldsFor=d=>d.kind==='opportunity'?fields:d.kind==='goal'?goalFields:reviewFields;
function showEditor(row,kind='opportunity'){
  const d=row?.data||{id:crypto.randomUUID(),kind,project:view==='project'?project:kind==='goal'?fProject:'',stage:'Prospección',priority:'Por revisar',currency:'EUR',quarter:fQuarter,reviewDate:today()};
  editor={row,data:d};
  const title=row?d.name:kind==='goal'?'Nuevo objetivo':kind==='review'?'Registrar revisión':'Nueva oportunidad';
  $('modal-content').innerHTML='<header class="dialog-head"><h2>'+esc(title)+'</h2>'+button('close','✕','aria-label="Cerrar ficha"')+'</header>'+
  '<div class="dialog-body"><form id="editor"><div class="fields">'+fieldsFor(d).map(f=>formField(f,d)).join('')+'<label class="wide">Motivo del cambio<input name="reason" placeholder="Ej. Confirmación tras la reunión"></label></div>'+
  (d.sourceUrl?'<p class="sub"><a target="_blank" rel="noopener" href="'+esc(d.sourceUrl)+'">Abrir archivo de origen ↗</a></p>':'')+
  '<p id="form-error" class="error" role="alert"></p><div class="dialog-foot">'+(row?button('history','Ver historial','data-id="'+esc(d.id)+'"'):'')+'<button type="submit" class="primary">Guardar</button></div></form><div id="history"></div></div>';
  if(!$('modal').open)$('modal').showModal();
  $('modal').scrollTop=0;
}
async function save(d,version,reason){
  return api('/'+d.id,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({data:d,version,reason})});
}
async function history(id){
  const target=$('history');target.textContent='Cargando historial…';
  try{
    const versions=await api('/'+id);
    if(!$('modal').open||$('history')!==target)return;
    target.innerHTML='<h3>Historial de versiones</h3>'+versions.map((r,i)=>{
      const d=r.data;
      const items=fieldsFor(d).filter(([k])=>value(d[k])).map(([k,l])=>'<dt>'+esc(l)+'</dt><dd>'+esc(k==='linked'?(get(d[k])?.data.name||d[k]):d[k])+'</dd>').join('');
      const originalData=d.raw?'<details><summary>Fila de origen completa</summary><dl>'+Object.entries(d.raw).filter(([,v])=>value(v)).map(([k,v])=>'<dt>'+esc(k)+'</dt><dd>'+esc(Array.isArray(v)?v.join(' · '):v)+'</dd>').join('')+'</dl></details>':'';
      return '<details class="version"><summary>'+esc((r.version===0?'Versión original':'Versión '+r.version)+' · '+dateLong.format(new Date(r.timestamp))+' · '+r.reason)+'</summary><dl>'+items+'</dl>'+originalData+
        (i?button('restore','Restaurar como nueva versión','data-id="'+esc(id)+'" data-version="'+r.version+'"'):'')+'</details>';
    }).join('');
    target.scrollIntoView({block:'start'});
  }catch(e){target.textContent=e.message;}
}
document.addEventListener('submit',async e=>{
  if(e.target.id!=='editor')return;
  e.preventDefault();
  const {row,data}=editor, form=new FormData(e.target);
  const d={...data};
  for(const [k] of fieldsFor(data))d[k]=String(form.get(k)??'').trim();
  const submit=e.target.querySelector('[type=submit]');submit.disabled=true;
  try {
    if(d.kind==='goal'&&d.linked){
      const linked=get(d.linked)?.data;
      if(!linked||linked.project!==d.project||quarterFor(linked.closeDate)!==d.quarter||!value(linked.amount)||!(linked.stage==='Cierre ganado'||(active(linked)&&value(linked.probability))))throw Error('La oportunidad vinculada debe tener importe, probabilidad (o estar ganada) y fecha de cierre en el mismo proyecto y trimestre.');
    }
    if(d.kind==='opportunity'&&data.next!==d.next&&data.actionDoneAt)delete d.actionDoneAt;
    await save(d,row?.version??-1,String(form.get('reason')??''));
    $('modal').close();await load();toast('Versión guardada');
  }catch(err){if(err.status===409)await load();$('form-error').textContent=err.message;submit.disabled=false;}
});
document.addEventListener('input',e=>{
  if(e.target.id==='query'){query=e.target.value;$('results').innerHTML=resultTable();}
});
document.addEventListener('change',e=>{
  const el=e.target;
  if(el.dataset.filter){filters[el.dataset.filter]=el.value;$('results').innerHTML=resultTable();}
  if(el.id==='quarter'){fQuarter=el.value;render();}
  if(el.id==='forecast-project'){fProject=el.value;render();}
  if(editor?.data.kind==='goal'&&el.closest('#editor')&&['project','quarter'].includes(el.name)){
    const form=el.closest('form'),current=new FormData(form);
    form.elements.linked.parentElement.outerHTML=formField(goalFields.find(([k])=>k==='linked'),Object.fromEntries(current));
  }
});
document.addEventListener('click',async e=>{
  const el=e.target.closest('[data-action]');
  if(!el)return;
  const {action,id,key,view:target,project:p,version}=el.dataset;
  const row=id?get(id):null;
  if(action==='nav')jump(target);
  if(action==='project')jump('project',p);
  if(action==='subset'){subset=key;filters={};query='';render();}
  if(action==='layout'){layout=key;render();}
  if(action==='clear'){filters={};query='';render();}
  if(action==='reload')await load();
  if(action==='logout')await crmConnection.logout();
  if(action==='export')exportRecords();
  if(action==='new')showEditor(null);
  if(action==='goal'||action==='review')showEditor(null,action);
  if(action==='open'&&row)showEditor(row);
  if(action==='close')$('modal').close();
  if(action==='history')await history(id);
  if(action==='done'&&row){
    el.disabled=true;
    try{
      const data={...row.data,next:'',nextDate:'',actionDoneAt:today()};
      await save(data,row.version,'Acción completada: '+row.data.next);await load();toast('Acción completada y guardada en el historial');
    }catch(err){if(err.status===409)await load();el.disabled=false;toast(err.message);}
  }
  if(action==='restore'&&row&&confirm('¿Restaurar esta versión como una nueva revisión de la ficha?')){
    el.disabled=true;
    try{
      const versions=await api('/'+id);
      const selected=versions.find(v=>v.version===Number(version));
      if(!selected)throw Error('No se encontró la versión.');
      await save(selected.data,row.version,'Restauración de la versión '+version);
      await load();if(get(id))showEditor(get(id));toast('Versión restaurada');
    }catch(err){if(err.status===409)await load();el.disabled=false;toast(err.message);}
  }
});
addEventListener('hashchange',route);
route();
addEventListener('crm-ready',()=>load());
addEventListener('crm-locked',()=>{
  rows=[];editor=null;error='';
  $('page').textContent='Inicia sesión para consultar el CRM.';
  $('modal-content').textContent='';
});
setInterval(()=>{
  if(crmConnection.isSignedIn()&&!document.hidden&&!$('modal').open&&!document.activeElement?.matches('input,select,textarea'))load();
},60000);


function exportRecords(){
  const data=(view==='pipeline'||view==='project')?filtered():opportunities();
  const columns=fields.map(([key,label])=>[key,label]);
  const csvCell=value=>'"'+String(value??'').replace(/^[=+@\t\r-]/,"'$&").replace(/"/g,'""')+'"';
  const csv=[columns.map(([,label])=>csvCell(label)).join(';'),...data.map(row=>columns.map(([key])=>csvCell(row[key])).join(';'))].join('\r\n');
  const url=URL.createObjectURL(new Blob(['\ufeff',csv],{type:'text/csv;charset=utf-8'}));
  const link=document.createElement('a');
  link.href=url;link.download='KairuTech_seguimiento_'+today()+'.csv';
  link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
