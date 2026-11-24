'use strict';
const $=id=>document.getElementById(id);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const projects=['Zentynel','Flowity','Metadology'];
const colors=['zentynel','flowity','metadology'];
const stages=['Prospección','Contacto inicial','Cualificación','Reunión / demo','Propuesta','Negociación','Cierre ganado','Cierre perdido','Renovación','Seguimiento','En pausa'];
const channelTypes=['Venta directa','Distribuidor','Colaborador'];
const channelFields=[['channelType','Canal comercial',channelTypes,true],['channelPartner','Distribuidor / colaborador','partner']];
const ownerFields=[
  ['commercialOwnerName','Responsable comercial — nombre'],
  ['commercialOwnerEmail','Responsable comercial — email','email'],
  ['commercialOwnerPhone','Responsable comercial — teléfono','tel']
];
const quoteFields=[
  ['quoteStatus','Presupuesto',['Por confirmar','Pendiente de enviar','Enviado','Aceptado','Rechazado']],
  ['quoteReference','Referencia del presupuesto'],
  ['quoteDate','Fecha de envío del presupuesto','date']
];
const responseFields=[['responseStatus','Respuesta',['Pendiente de respuesta','Respondido','No requiere respuesta']]];
let operation=null;
const expandedDashboardSections=new Set();
let weeklyContactWindow='week';
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
const filterFields=[['project','Proyecto'],['country','País'],['region','Región'],['sector','Sector'],['priority','Prioridad'],['stage','Estado comercial'],['type','Tipo'],['commercialMonth','Mes cierre / renovación'],['channelType','Canal comercial'],['channelPartner','Distribuidor / colaborador'],['commercialOwnerName','Responsable comercial']];
const navItems=[['home','▦','Esta semana'],['pipeline','☷','Pipeline'],['clients','▤','Clientes y licencias'],['forecast','◴','Forecast trimestral'],['reviews','◷','Revisión semanal']];
const subsets={
  Zentynel:[['','Todas'],['spain','España'],['portugal','Portugal'],['latam','Latinoamérica']],
  Flowity:[['','Todas'],['dip','Diputaciones'],['road','Carreteras']]
};
const fields=[
  ['name','Cuenta / oportunidad','text',true],['project','Proyecto',projects,true],...channelFields,['stage','Estado comercial',stages,true],...ownerFields,...responseFields,
  ['organisation','Organismo, empresa, proveedor o partner'],['type','Tipo de oportunidad',types],['sector','Sector'],
  ['country','País','country'],['region','Región','region'],['territory','Comunidad / territorio'],
  ['priority','Prioridad',priorities],['risk','Riesgo'],['contacts','Contactos','contacts'],
  ['source','Fuente','textarea'],['need','Necesidad detectada','textarea'],['proposal','Propuesta de valor','textarea'],
  ['meetings','Reuniones','textarea'],['demos','Demos','textarea'],['emails','Emails y comunicaciones','textarea'],
  ['objections','Objeciones','textarea'],...quoteFields,['amount','Importe presupuesto / estimado sin IVA','amount'],['currency','Moneda',['EUR','USD','GBP','MXN','CLP','BRL','COP','PEN']],['probability','Probabilidad (%)','prob'],
  ['relevantDate','Fecha relevante','date'],['closeDate','Cierre previsto / efectivo','date'],['nextDate','Fecha de la próxima acción','date'],
  ['next','Próximo paso','textarea'],['notes','Notas','textarea']
];
let clientTab='clients',customerQuery='',customerProject='',licenseFilter='all',renewalStateFilter='all',customerChannel='',customerPartner='';
let rows=[],error='',view='home',project='',subset='',filters={},query='',layout='list',fQuarter=quarterFor(today()),fProject='',fChannel='',fPartner='',editor=null,toastTimer;
const entries=kind=>rows.filter(x=>x.data.kind===kind);
const opportunities=()=>[
  ...entries('opportunity').map(x=>({...x.data,...channelDetails(x.data),commercialMonth:(x.data.closeDate||'').slice(0,7)})),
  ...renewalOpportunities()
];
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
    data:{...row.data,id:row.id,kind:row.kind,name:row.name,project:name,clientId:row.client_id||'',parentId:row.parent_id||row.data?.parentId||'',
      ...(['client','opportunity'].includes(row.kind)?{contacts:readContacts(row.data)}:{}),
      ...(row.kind==='license'?{licenseStatus:renewalStatus(row.data)}:{})}};
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
    name:data.name,data,parent_id:data.kind==='activity'?data.parentId:null,client_id:data.kind==='license'?data.clientId:null,change_reason:reason.trim()||'Actualización'
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
  $('page').innerHTML=error?'<div class="card"><p class="error">'+esc(error)+'</p>'+button('reload','Volver a cargar')+'</div>':({home,pipeline,project:pipeline,forecast,reviews,clients}[view]||home)();
}
function dashboardSection(key,title,count,content,description=''){
  const opened=expandedDashboardSections.has(key)?' open':'';
  const badge=count==null?'':'<span class="dashboard-count">'+esc(count)+'</span>';
  return '<details class="card dashboard-section" data-dashboard-section="'+esc(key)+'"'+opened+'>'+
    '<summary><span>'+esc(title)+'</span>'+badge+'</summary>'+
    '<div class="dashboard-content">'+(description?'<p class="sub">'+esc(description)+'</p>':'')+content+'</div></details>';
}

function home(){
  const [start,end]=week();
  const open=opportunities().filter(active);
  const sales=open.filter(d=>d.kind!=='license');
  const renewals=open.length-sales.length;
  const pending=followupItems().filter(d=>d.nextDate&&d.nextDate<=end);
  const high=open.filter(d=>d.priority==='Alta');
  const eur=open.filter(d=>d.currency==='EUR'&&d.quoteStatus!=='Rechazado'&&value(d.amount));
  return '<section class="hero"><h1>Esta semana</h1><span class="hero-date">'+
    esc(short(start)+' — '+dateLong.format(new Date(end+'T12:00Z')))+'</span></section>'+
    '<div class="grid metrics">'+
      metric('Pipeline abierto',open.length,sales.length+' oportunidades · '+renewals+' renovaciones')+
      metric('Acciones pendientes',pending.length,'Esta semana y vencidas')+
      metric('Prioridad alta',high.length,'Marcadas como alta en la ficha')+
      metric('Valor estimado en EUR',eur.length?money(eur.reduce((sum,d)=>sum+Number(d.amount),0)):'—',eur.length+' fichas con importe')+
    '</div>'+todayContactsPanel()+renewalAlertPanel();
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
  return scoped().filter(d=>filterFields.every(([k])=>!filters[k]||d[k]===filters[k])&&(!query||normalize([d.name,d.organisation,d.contact,d.next,d.sector,d.channelPartner,commercialOwner(d).commercialOwnerName].join(' ')).includes(normalize(query))));
}
function pipeline(){
  const scope=scoped(), title=view==='project'?project:'Pipeline comercial';
  const specialized=view==='project'&&subsets[project];
  const filter=filterFields.filter(([k])=>view!=='project'||k!=='project').map(([k,l])=>'<label>'+l+'<select data-filter="'+k+'">'+opts([...new Set(scope.map(d=>d[k]).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es')).map(v=>k==='commercialMonth'?[v,monthLabel(v)]:v),filters[k],'Todos')+'</select></label>').join('');
  return head(title,view==='project'?'Oportunidades y seguimiento del proyecto.':'Prospección, cierre, renovación y seguimiento en una sola vista.')+
    (specialized?'<div class="chips">'+specialized.map(([k,l])=>button('subset',l,'data-key="'+k+'"',k===subset?'selected':'')).join('')+'</div>':'')+
    '<div class="card"><div class="filters"><label class="filter-search">Buscar<input type="search" id="query" value="'+esc(query)+'" placeholder="Cuenta, contacto o próximo paso"></label>'+filter+'</div>'+
    '<div class="chips">'+button('layout','Lista','data-key="list"',layout==='list'?'selected':'')+button('layout','Por etapa','data-key="board"',layout==='board'?'selected':'')+button('clear','Limpiar filtros')+'</div><div id="results">'+resultTable()+'</div></div>';
}
function resultTable(){
  const data=filtered().sort((a,b)=>(priorities.indexOf(a.priority||'Por revisar')-priorities.indexOf(b.priority||'Por revisar'))||a.name.localeCompare(b.name,'es'));
  if(!data.length)return blank('No hay oportunidades en esta vista. Puedes crear una desde el botón superior.');
  const count='<p class="sub">'+data.length+' '+(data.length===1?'oportunidad':'oportunidades')+'</p>';
  if(layout==='board')return count+'<div class="board">'+stages.map(s=>'<section class="lane"><h3>'+esc(s)+' · '+data.filter(d=>d.stage===s).length+'</h3>'+data.filter(d=>d.stage===s).map(d=>openBtn(d,d.name,d.project+' · '+channelSummary(d)+' · '+(d.priority||'Por revisar'))).join('')+'</section>').join('')+'</div>';
  return count+'<div class="scroll"><table><thead><tr><th>Cuenta / oportunidad</th><th>Canal</th><th>Distribuidor / colaborador</th><th>Estado comercial</th><th>Prioridad</th><th>Importe</th><th>Próxima acción</th></tr></thead><tbody>'+data.map(d=>'<tr><td>'+openBtn(d,d.name,d.project+(d.country?' · '+d.country:'')+' · '+(d.type||'Por cualificar')+(d.commercialMonth?' · '+monthLabel(d.commercialMonth):''))+'</td><td>'+esc(channelDetails(d).channelType)+'</td><td>'+esc(channelDetails(d).channelPartner||'—')+ownerMeta(d)+'</td><td>'+tag(d.kind==='license'?renewalStatus(get(d.id).data):d.stage||'Prospección',d.stage==='Cierre ganado'?'green':'neutral')+'</td><td>'+priority(d)+'</td><td class="nobr">'+(value(d.amount)?esc(money(Number(d.amount),d.currency)):'—')+quoteMeta(d)+'</td><td>'+esc(d.next||'—')+(d.nextDate?'<div class="meta">'+esc(short(d.nextDate))+'</div>':'')+(d.kind==='license'?'<div class="meta">'+esc((renewalAlert(get(d.id).data)?.label||'Sin revisión pendiente'))+'</div>':'')+'</td></tr>').join('')+'</tbody></table></div>';
}
const goalFields=[['name','Objetivo','text',true],['project','Proyecto',projects,true],['quarter','Trimestre (AAAA-T1 a AAAA-T4)','quarter',true],['currency','Moneda',['EUR','USD','GBP','MXN','CLP','BRL','COP','PEN'],true],['conservative','Conservador','amount'],['base','Base','amount'],['upside','Optimista','amount'],['linked','Sustituir por una oportunidad','link'],['notes','Notas y supuestos','textarea']];
const reviewFields=[['name','Título','text',true],['reviewDate','Fecha de revisión','date',true],['project','Proyecto',projects],['reviewNext','Próxima revisión','date'],['notes','Decisiones, cambios de prioridad y próximos pasos','textarea',true]];
function forecast(){
  const all=opportunities().filter(d=>(!fChannel||channelDetails(d).channelType===fChannel)&&(!fPartner||channelDetails(d).channelPartner===fPartner));
  const goals=entries('goal').map(r=>r.data).filter(d=>!fChannel&&!fPartner&&d.quarter===fQuarter&&(!fProject||d.project===fProject));
  const candidates=all.filter(d=>quarterFor(d.closeDate)===fQuarter&&(!fProject||d.project===fProject)&&(active(d)||d.stage==='Cierre ganado'));
  const real=candidates.filter(d=>d.quoteStatus!=='Rechazado'&&value(d.amount)&&(d.stage==='Cierre ganado'||value(d.probability)));
  const missing=candidates.length-real.length;
  const undated=all.filter(d=>d.kind==='license'&&!d.closeDate&&active(d)&&(!fProject||d.project===fProject));
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
  return head('Forecast trimestral','Oportunidades y renovaciones por trimestre. Para renovaciones sin cierre previsto se usa el vencimiento futuro como referencia.',button('goal','＋ Objetivo','','primary'))+
  '<div class="forecast-controls"><label class="sub" for="quarter">Trimestre</label><select id="quarter">'+opts(periods,fQuarter)+'</select><label class="sub" for="forecast-project">Proyecto</label><select id="forecast-project">'+opts(projects,fProject,'Todos los proyectos')+'</select><label class="sub" for="forecast-channel">Canal</label><select id="forecast-channel">'+opts(channelTypes,fChannel,'Todos')+'</select><label class="sub" for="forecast-partner">Distribuidor / colaborador</label><select id="forecast-partner">'+opts(knownPartners(),fPartner,'Todos')+'</select></div>'+
  '<div class="grid metrics forecast-metrics">'+metric('Conservador',format(0),'Probabilidad −20 puntos')+metric('Base',format(1),'Probabilidad de la ficha')+metric('Optimista',format(2),'Probabilidad +20 puntos')+'</div>'+
  '<div class="grid split"><section class="card">'+cardHead('Oportunidades del trimestre',missing?missing+' con datos pendientes para la previsión.':'Las ganadas computan al 100 %.')+
  (candidates.length?candidates.map(d=>'<div class="record">'+openBtn(d,d.name,d.project+' · '+(d.type||'Cliente directo')+' · '+short(d.closeDate))+'</div>').join(''):blank('Añade una fecha de cierre a una oportunidad para incluirla aquí.'))+'</section>'+
  '<section class="card">'+cardHead('Objetivos por validar','Al vincular una oportunidad, su valor sustituye al del objetivo.')+
  (goals.length?goals.map(d=>'<div class="record">'+openBtn(d,d.name,d.linked?'Sustituido por '+(get(d.linked)?.data.name||'oportunidad vinculada'):(value(d.base)?money(Number(d.base),d.currency):'Sin importe base'))+(d.linked?(real.some(x=>x.id===d.linked)?tag('Sustituido','green'):tag('Vínculo por revisar','warm')):tag('Genérico','neutral'))+'</div>').join(''):blank(fChannel||fPartner?'Los objetivos genéricos se consultan con todos los canales seleccionados.':'Todavía no hay objetivos genéricos para este trimestre.'))+'</section></div>'+
    '<section class="card">'+cardHead('Renovaciones pendientes de fechar','Programa su cierre para asignarlas a un trimestre.')+
    (undated.length?undated.map(d=>'<div class="record">'+openBtn(d,d.name,d.project+' · '+(value(d.amount)?money(Number(d.amount),d.currency):'Importe por confirmar'))+'</div>').join(''):blank('Todas las renovaciones abiertas tienen una fecha de referencia o de cierre.'))+'</section>'+forecastReadiness(all.filter(d=>!fProject||d.project===fProject));
}
function reviews(){
  const history=entries('review').map(r=>r.data).sort((a,b)=>b.reviewDate.localeCompare(a.reviewDate));
  const attention=opportunities().filter(d=>active(d)&&['Alta','Por revisar'].includes(d.priority||'Por revisar')).filter(d=>d.next||(d.priority==='Alta'&&d.stage!=='Prospección'));
  const nextReview=history.find(d=>d.reviewNext)?.reviewNext;
  return head('Revisión semanal',nextReview?'Próximo seguimiento · '+short(nextReview):'Revisa el pipeline y guarda las decisiones de cada revisión.',button('review','＋ Registrar revisión semanal','','primary'))+
  '<div class="grid split"><section class="card">'+cardHead('Prioridad alta o por revisar')+
  (attention.length?attention.map(d=>'<div class="record">'+openBtn(d,d.name,d.project+' · '+(d.next||'Sin próxima acción'))+priority(d)+'</div>').join(''):blank('Sin oportunidades destacadas.'))+'</section>'+
  '<section class="card">'+cardHead('Histórico de revisiones semanales')+
  (history.length?history.map(d=>'<div class="record">'+openBtn(d,d.name,short(d.reviewDate)+' · '+(d.project||'Todos los proyectos')+(d.reviewNext?' · Próxima '+short(d.reviewNext):''))+'</div>').join(''):blank('Todavía no hay revisiones registradas.'))+'</section></div>';
}
function formField([key,label,typ='text',required=false],data){
  if(typ==='contacts')return contactsEditor(readContacts(data));
  if(key==='payerName')return '<label>Nombre de otra entidad<input name="payerName" value="'+esc(data.payerName||'')+'"'+(data.payerType==='Otra entidad'?'':' disabled')+'></label>';
  if(typ==='partner'){
    const direct=data.channelType==='Venta directa';
    return '<label>Distribuidor / colaborador<input name="channelPartner" list="channel-partners" value="'+esc(direct?'':data.channelPartner||'')+'"'+(direct?' disabled':'')+'><datalist id="channel-partners">'+
      knownPartners().map(name=>'<option value="'+esc(name)+'"></option>').join('')+'</datalist></label>';
  }
  const v=data[key]??'', name=' name="'+key+'"'+(required?' required':'');
  const list=typ==='client'?entries('client').map(r=>r.data).filter(d=>d.project===data.project||d.id===v).map(d=>[d.id,d.name]):Array.isArray(typ)?typ:typ==='country'?[...new Set([...countries,...opportunities().map(x=>x.country).filter(Boolean)])].sort((a,b)=>a.localeCompare(b,'es')):typ==='region'?[...new Set([...regions,...opportunities().map(x=>x.region).filter(Boolean)])]:typ==='link'?opportunities().filter(d=>(d.project===data.project||d.id===v)&&(quarterFor(d.closeDate)===data.quarter||d.id===v)).map(d=>[d.id,d.name]):null;
  let control;
  if(list)control='<select'+name+'>'+opts(list,v,'Seleccionar')+'</select>';
  else if(typ==='textarea')control='<textarea'+name+'>'+esc(v)+'</textarea>';
  else{
    const number=typ==='amount'||typ==='prob';
    const type=number?'number':['date','email','tel'].includes(typ)?typ:'text';
    control='<input'+name+' type="'+type+'" value="'+esc(v)+'"'+(number?' min="0" step="0.01"':'')+(typ==='prob'?' max="100"':'')+(typ==='quarter'?' pattern="[0-9]{4}-T[1-4]" placeholder="2026-T4"':'')+'>';
  }
  return '<label'+(typ==='textarea'?' class="wide"':'')+'>'+esc(label)+control+'</label>';
}
const fieldsFor=d=>d.kind==='client'?clientFields:d.kind==='license'?licenseFields:d.kind==='opportunity'?fields:d.kind==='goal'?goalFields:reviewFields;
function editorFields(d){
  const all=fieldsFor(d);
  if(!['license','opportunity','client'].includes(d.kind))return '<div class="fields">'+all.map(f=>formField(f,d)).join('')+'</div>';
  const essential=d.kind==='license'
    ?['name','project','clientId','licenseStatus','priority','endDate','renewalAmount','currency','renewalCloseDate','next','nextDate']
    :d.kind==='client'
    ?['name','project','clientStatus','contacts','priority','next','nextDate']
    :['name','project','stage','priority','contacts','amount','currency','closeDate','next','nextDate'];
  const groups=[
    ['Canal, responsable y respuesta',['channelType','channelPartner','commercialOwnerName','commercialOwnerEmail','commercialOwnerPhone','responseStatus','payerType','payerName']],
    ['Presupuesto y previsión',['quoteStatus','quoteReference','quoteDate','probability','renewalProbability']],
    ['Datos del contrato',['startDate','renewalNotice','users','amount','renewalTerms']],
    ['Contexto comercial',['organisation','type','sector','country','region','territory','need','proposal','risk','relevantDate']],
    ['Notas y comunicaciones',['meetings','demos','emails','objections','source','notes']]
  ];
  const used=new Set(essential);
  let html='<div class="fields">'+all.filter(f=>used.has(f[0])).map(f=>formField(f,d)).join('')+'</div>';
  for(const [title,keys] of groups){
    const selected=all.filter(f=>keys.includes(f[0])&&!used.has(f[0]));
    selected.forEach(f=>used.add(f[0]));
    if(selected.length)html+='<details class="editor-section"><summary>'+esc(title)+'</summary><div class="fields">'+selected.map(f=>formField(f,d)).join('')+'</div></details>';
  }
  const rest=all.filter(f=>!used.has(f[0]));
  if(rest.length)html+='<details class="editor-section"><summary>Otros detalles</summary><div class="fields">'+rest.map(f=>formField(f,d)).join('')+'</div></details>';
  return html+'<details class="editor-section"><summary>Motivo del cambio (opcional)</summary><div class="fields"><label class="wide">Motivo del cambio<input name="reason" placeholder="Ej. Confirmación tras la reunión"></label></div></details>';
}
document.addEventListener('invalid',e=>{
  for(let section=e.target.closest('details');section;section=section.parentElement.closest('details'))section.open=true;
},true);
function showEditor(row,kind='opportunity'){
  const d=row?.data||{licenseStatus:'Por renovar',id:crypto.randomUUID(),kind,project:view==='project'?project:kind==='goal'?fProject:'',stage:'Prospección',priority:'Por revisar',currency:'EUR',quarter:fQuarter,reviewDate:today()};
  editor={row,data:d};
  const title=row?d.name:kind==='client'?'Nuevo cliente':kind==='license'?'Nueva licencia':kind==='goal'?'Nuevo objetivo':kind==='review'?'Registrar revisión semanal':'Nueva oportunidad';
  $('modal-content').innerHTML='<header class="dialog-head"><h2>'+esc(title)+'</h2>'+button('close','✕','aria-label="Cerrar ficha"')+'</header>'+
  '<div class="dialog-body">'+(d.kind==='license'?'<p class="sub">'+esc(channelSummary(d))+' (canal del cliente) · Pagador: '+esc(payerDisplay(d))+' · Responsable: '+esc(commercialOwner(d).commercialOwnerName||'Por asignar')+'.</p>':'')+'<form id="editor">'+editorFields(d)+
  (d.sourceUrl?'<p class="sub"><a target="_blank" rel="noopener" href="'+esc(d.sourceUrl)+'">Abrir archivo de origen ↗</a></p>':'')+
  '<p id="form-error" class="error" role="alert"></p><div class="dialog-foot">'+(row?button('history','Ver historial','data-id="'+esc(d.id)+'"'):'')+
  (row&&['client','opportunity','license'].includes(d.kind)?button('activity','＋ Actividad','data-id="'+esc(d.id)+'"'):'')+
  (row&&d.kind==='license'?licensePeriodButton(d):'')+'<button type="submit" class="primary">Guardar</button></div></form>'+(row?activityTimeline(d):'')+'<div id="history"></div></div>';
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
      const items=fieldsFor(d).filter(([k])=>value(d[k])).map(([k,l,type])=>'<dt>'+esc(l)+'</dt><dd>'+esc(type==='contacts'?contactSummary(readContacts(d)):k==='linked'?(get(d[k])?.data.name||d[k]):d[k])+'</dd>').join('');
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
  for(const [k,,type] of fieldsFor(data)){
    if(type==='contacts')continue;
    d[k]=String(form.get(k)??'').trim();
  }
  if(['client','opportunity'].includes(d.kind)){
    d.contacts=Array.from(e.target.querySelectorAll('.contact-edit-row')).map(el=>({
      name:el.querySelector('[data-contact="name"]').value.trim(),
      email:el.querySelector('[data-contact="email"]').value.trim(),
      phone:el.querySelector('[data-contact="phone"]').value.trim(),
      role:el.querySelector('[data-contact="role"]').value.trim()
    })).filter(c=>Object.values(c).some(Boolean));
    d.contact=contactSummary(d.contacts);
  }
  const submit=e.target.querySelector('[type=submit]');submit.disabled=true;
  try {
    if(['client','opportunity'].includes(d.kind)){
      if(!channelTypes.includes(d.channelType))throw Error('Selecciona el canal comercial.');
      if(d.channelType==='Venta directa')d.channelPartner='';
      else{
        d.channelPartner=canonicalPartner(d.channelPartner);
        if(!d.channelPartner)throw Error('Indica el distribuidor o colaborador.');
      }
    }
    if(d.kind==='license'){
      if(d.payerType!=='Otra entidad')d.payerName='';
      if(d.payerType==='Otra entidad'&&!d.payerName)throw Error('Indica la entidad que paga la licencia.');
      if(d.licenseStatus==='Renovado'){
        d.renewalStage='Cierre ganado';
      }else if(d.licenseStatus==='Finalizada'){
        d.renewalStage='Cierre perdido';
      }else if(['Cierre ganado','Cierre perdido'].includes(d.renewalStage)){
        d.renewalStage='Renovación';
      }
      const client=get(d.clientId)?.data;
      if(!client||client.kind!=='client'||client.project!==d.project)throw Error('Elige un cliente del mismo proyecto.');
      if(d.startDate&&d.endDate&&d.endDate<d.startDate)throw Error('El vencimiento debe ser posterior o igual al inicio.');
    }
    if(d.kind==='goal'&&d.linked){
      const linked=opportunities().find(item=>item.id===d.linked);
      if(!linked||linked.project!==d.project||quarterFor(linked.closeDate)!==d.quarter||!value(linked.amount)||!(linked.stage==='Cierre ganado'||(active(linked)&&value(linked.probability))))throw Error('La oportunidad vinculada debe tener importe, probabilidad (o estar ganada) y fecha de cierre en el mismo proyecto y trimestre.');
    }
    if(['opportunity','license','client'].includes(d.kind)&&data.next!==d.next&&data.actionDoneAt)delete d.actionDoneAt;
    await save(d,row?.version??-1,String(form.get('reason')??''));
    $('modal').close();await load();toast('Versión guardada');
  }catch(err){if(err.status===409)await load();$('form-error').textContent=err.message;submit.disabled=false;}
});
document.addEventListener('input',e=>{
  if(e.target.id==='customer-query'){customerQuery=e.target.value;$('customer-results').innerHTML=customerResults();}
  if(e.target.id==='query'){query=e.target.value;$('results').innerHTML=resultTable();}
});
document.addEventListener('change',e=>{
  const el=e.target;
  if(el.id==='weekly-contact-window'){
    weeklyContactWindow=el.value;
    expandedDashboardSections.add('contact-list');
    render();
  }
  if(el.name==='payerType'&&el.closest('form')){
    const name=el.closest('form').elements.payerName;
    if(name){name.disabled=el.value!=='Otra entidad';if(name.disabled)name.value='';}
  }
  if(el.name==='channelType'&&el.closest('#editor')){
    const partner=el.closest('form').elements.channelPartner;
    if(partner){
      partner.disabled=el.value==='Venta directa';
      if(partner.disabled)partner.value='';
    }
  }
  if(el.id==='customer-channel'){customerChannel=el.value;customerPartner='';render();}
  if(el.id==='customer-partner'){customerPartner=el.value;render();}
  if(el.id==='forecast-channel'){fChannel=el.value;fPartner='';render();}
  if(el.id==='forecast-partner'){fPartner=el.value;render();}
  if(el.id==='customer-project'){customerProject=el.value;render();}
  if(el.id==='license-filter'){licenseFilter=el.value;render();}
  if(el.id==='renewal-state-filter'){renewalStateFilter=el.value;render();}
  if(editor?.data.kind==='license'&&el.closest('#editor')&&el.name==='project'){
    const form=el.closest('form');
    form.elements.clientId.parentElement.outerHTML=formField(licenseFields.find(([k])=>k==='clientId'),{project:el.value});
  }
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
  if(action==='client-tab'){clientTab=key;render();}
  if(action==='add-contact'){
    const list=$('contact-editor-list');
    list.insertAdjacentHTML('beforeend',contactEditorRow({}));
  }
  if(action==='remove-contact')el.closest('.contact-edit-row').remove();
  if(action==='new-client')showEditor(null,'client');
  if(action==='new-license')showEditor(null,'license');
  if(action==='goal'||action==='review')showEditor(null,action);
  if(action==='open'&&row)showEditor(row);
  if(action==='activity'&&row)showActivity(row);
  if(action==='renew-license'&&row)showRenewal(row);
  if(action==='close')$('modal').close();
  if(action==='history')await history(id);
  if(action==='done'&&row){
    el.disabled=true;
    try{
      const data={...row.data,next:'',nextDate:'',actionDoneAt:today(),responseStatus:row.data.responseStatus==='Pendiente de respuesta'?'Respondido':row.data.responseStatus};
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
addEventListener('crm-ready',()=>load());
addEventListener('crm-locked',()=>{
  rows=[];editor=null;operation=null;error='';
  $('page').textContent='Inicia sesión para consultar el CRM.';
  $('modal-content').textContent='';
});
setInterval(()=>{
  if(crmConnection.isSignedIn()&&!document.hidden&&!$('modal').open&&!document.activeElement?.matches('input,select,textarea'))load();
},60000);


function exportRecords(){
  const data=view==='clients'?customerData():(view==='pipeline'||view==='project')?filtered():opportunities();
  const columns=(view==='clients'?(clientTab==='licenses'?licenseFields:clientFields):fields).flatMap(([key,label])=>key==='contacts'?
    [['_contactName','Nombre del contacto'],['_contactEmail','Email'],['_contactPhone','Teléfono'],['_contactRole','Cargo']]:[[key,label]]);
  if(view==='clients'&&clientTab==='licenses')columns.splice(2,0,['channelType','Canal comercial'],['channelPartner','Distribuidor / colaborador']);
  const csvCell=value=>'"'+String(value??'').replace(/^[=+@\t\r-]/,"'$&").replace(/"/g,'""')+'"';
  const csv=[columns.map(([,label])=>csvCell(label)).join(';'),...data.map(row=>columns.map(([key])=>csvCell(exportValue(row,key))).join(';'))].join('\r\n');
  const url=URL.createObjectURL(new Blob(['\ufeff',csv],{type:'text/csv;charset=utf-8'}));
  const link=document.createElement('a');
  link.href=url;link.download='KairuTech_seguimiento_'+today()+'.csv';
  link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

const clientFields=[
  ['name','Cliente','text',true],['project','Proyecto',projects,true],...channelFields,
  ['clientStatus','Situación',['Actual','En pausa','Baja']],...ownerFields,...responseFields,
  ['sector','Sector'],['country','País','country'],['region','Región','region'],
  ['contacts','Contactos','contacts'],
  ['next','Próxima acción','textarea'],['nextDate','Fecha de seguimiento','date'],
  ['priority','Prioridad',priorities],['risk','Riesgo / datos por confirmar','textarea'],
  ['source','Fuente','textarea'],['notes','Notas de seguimiento','textarea']
];
const licenseFields=[
  ['name','Licencia / contrato','text',true],['project','Proyecto',projects,true],
  ['clientId','Cliente','client',true],
  ['licenseStatus','Estado de renovación',['Por renovar','Renovado','Finalizada'],true],
  ['priority','Prioridad',priorities],
  ['startDate','Fecha de inicio','date'],['endDate','Fecha de vencimiento','date'],
  ['renewalNotice','Fecha de aviso de renovación','date'],
  ['users','Usuarios contratados'],['amount','Importe del periodo','amount'],
  ['currency','Moneda',['EUR','USD','GBP','MXN','CLP']],
  ['renewalTerms','Condiciones de renovación','textarea'],
  ...ownerFields,...responseFields,
  ['payerType','Quién paga',['Por confirmar','Cliente','Distribuidor / colaborador','Otra entidad']],
  ['payerName','Nombre del pagador (si difiere del cliente o partner)'],
  ...quoteFields,
  ['renewalAmount','Importe presupuesto de renovación sin IVA','amount'],
  ['renewalProbability','Probabilidad de renovación (%)','prob'],
  ['renewalCloseDate','Fecha prevista / efectiva de cierre de renovación','date'],
  ['next','Próxima acción','textarea'],['nextDate','Fecha de seguimiento','date'],
  ['risk','Datos por confirmar','textarea'],['source','Fuente','textarea'],
  ['notes','Notas','textarea']
];
function licenseTiming(d){
  if(['Renovado','Finalizada'].includes(renewalStatus(d)))return {key:'closed',label:renewalStatus(d),color:'neutral'};
  if(!d.endDate)return {key:'unknown',label:'Sin vencimiento',color:'neutral'};
  const days=Math.round((Date.parse(d.endDate+'T12:00Z')-Date.parse(today()+'T12:00Z'))/86400000);
  if(days<0)return {key:'past',label:'Periodo vencido · confirmar renovación',color:'warm'};
  if(days<=30)return {key:'30',label:'Vence en '+days+' días',color:'warm'};
  if(days<=60)return {key:'60',label:'Vence en '+days+' días',color:''};
  if(days<=90)return {key:'90',label:'Vence en '+days+' días',color:''};
  return {key:'later',label:'En plazo según fechas',color:'green'};
}
function customerData(){
  const kind=clientTab==='licenses'?'license':'client';
  const normalize=s=>String(s??'').normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();
  return entries(kind).map(r=>r.data).filter(d=>
    (!customerProject||d.project===customerProject)&&
    (!customerChannel||channelDetails(d).channelType===customerChannel)&&
    (!customerPartner||channelDetails(d).channelPartner===customerPartner)&&
    (kind!=='license'||renewalStateFilter==='all'||renewalStatus(d)===renewalStateFilter)&&
    (!customerQuery||normalize([d.name,d.contact,d.next,get(d.clientId)?.data.name,channelDetails(d).channelPartner,commercialOwner(d).commercialOwnerName].join(' ')).includes(normalize(customerQuery)))&&
    (kind!=='license'||licenseFilter==='all'||licenseTiming(d).key===licenseFilter)
  ).sort((a,b)=>kind==='license'?(a.endDate||'z').localeCompare(b.endDate||'z'):a.name.localeCompare(b.name,'es'));
}
function customerResults(){
  const data=customerData();
  if(!data.length)return blank('No hay registros en esta vista.');
  const licenses=clientTab==='licenses';
  const columns=licenses
    ? '<th>Estado</th><th>Quién paga</th><th>Vencimiento</th><th>Seguimiento de renovación</th>'
    : '<th>Nombre del contacto</th><th>Email</th><th>Teléfono</th><th>Licencias</th>';
  const body=data.map(d=>{
    let details;
    if(licenses){
      const status=renewalStatus(d);
      const notice=renewalAlert(d);
      details='<td>'+tag(status,status==='Renovado'?'green':status==='Finalizada'?'neutral':'warm')+'</td><td>'+esc(payerDisplay(d))+'</td>'+
        '<td>'+esc(short(d.endDate))+'</td>'+
        '<td>'+esc(notice?.label||'Sin seguimiento pendiente')+'</td>';
    }else{
      const contacts=readContacts(d);
      const contactColumn=key=>contacts.length
        ? contacts.map(c=>'<div class="contact-line">'+esc(c[key]||'—')+'</div>').join('')
        : '—';
      const count=entries('license').filter(r=>r.data.clientId===d.id).length;
      details='<td>'+contactColumn('name')+'</td><td>'+contactColumn('email')+'</td>'+
        '<td>'+contactColumn('phone')+'</td><td>'+count+'</td>';
    }
    return '<tr><td>'+openBtn(d,d.name,licenses?(get(d.clientId)?.data.name||'Cliente por revisar')+' · '+d.project:d.project)+'</td>'+
      '<td>'+esc(channelDetails(d).channelType)+'</td><td>'+esc(channelDetails(d).channelPartner||'—')+ownerMeta(d)+'</td>'+details+'<td>'+esc(d.next||'—')+
      (d.nextDate?'<div class="meta">'+esc(short(d.nextDate))+'</div>':'')+'</td></tr>';
  }).join('');
  return '<div class="scroll"><table><thead><tr><th>'+(licenses?'Licencia':'Cliente')+'</th>'+
    '<th>Canal</th><th>Distribuidor / colaborador</th>'+columns+'<th>Próximo paso</th></tr></thead><tbody>'+body+'</tbody></table></div>';
}
function clients(){
  return head('Clientes y licencias','Clientes actuales, periodos contratados y seguimiento de renovaciones.',
    '<div class="top-actions">'+button('new-client','＋ Cliente')+button('new-license','＋ Licencia','','primary')+'</div>')+
    '<div class="chips">'+button('client-tab','Clientes','data-key="clients"',clientTab==='clients'?'selected':'')+
    button('client-tab','Licencias','data-key="licenses"',clientTab==='licenses'?'selected':'')+'</div>'+
    '<section class="card"><div class="filters"><label class="filter-search">Buscar<input id="customer-query" type="search" value="'+esc(customerQuery)+'" placeholder="Cliente, contacto o acción"></label>'+
    '<label>Proyecto<select id="customer-project">'+opts(projects,customerProject,'Todos')+'</select></label>'+
    '<label>Canal<select id="customer-channel">'+opts(channelTypes,customerChannel,'Todos')+'</select></label>'+
    '<label>Distribuidor / colaborador<select id="customer-partner">'+opts(knownPartners(),customerPartner,'Todos')+'</select></label>'+
    (clientTab==='licenses'?'<label>Estado<select id="renewal-state-filter">'+opts([['all','Todos'],['Por renovar','Por renovar'],['Renovado','Renovado'],['Finalizada','Finalizada']],renewalStateFilter)+'</select></label><label>Vencimiento<select id="license-filter">'+opts([['all','Todos'],['past','Periodo vencido'],['30','Hasta 30 días'],['60','De 31 a 60 días'],['90','De 61 a 90 días'],['later','Más de 90 días'],['closed','Renovadas / finalizadas'],['unknown','Sin fecha']],licenseFilter)+'</select></label>':'')+
    '</div><div id="customer-results">'+customerResults()+'</div></section>';
}



function renewalStart(d){
  return d.renewalNotice || (d.endDate?addDays(d.endDate,-90):'');
}

function renewalOpportunities(){
  return entries('license').map(row=>row.data).filter(d=>{
    if(['Renovado','Finalizada'].includes(renewalStatus(d))){
      return ['Cierre ganado','Cierre perdido'].includes(d.renewalStage);
    }
    return Boolean(d.endDate||d.renewalNotice||d.renewalStage||d.renewalCloseDate);
  }).map(d=>{
    const client=get(d.clientId)?.data;
    const successor=successorLicense(d)?.data;
    const stage=renewalStatus(d)==='Renovado'?'Cierre ganado':renewalStatus(d)==='Finalizada'?'Cierre perdido':d.renewalStage||'Renovación';
    const closed=['Cierre ganado','Cierre perdido'].includes(stage);
    const manualAction=Boolean(d.next);
    const nextDate=d.nextDate||(!d.actionDoneAt?renewalStart(d):'');
    return {
      ...d,
      name:'Renovación · '+(client?.name||d.name),
      organisation:client?.name||d.name,
      country:client?.country||d.country||'',
      region:client?.region||d.region||'',
      sector:client?.sector||d.sector||'',
      contact:client?.contact||'',
      ...channelDetails(d),
      ...commercialOwner(d),
      payerType:successor?(successor.payerType||'Por confirmar'):d.payerType,
      payerName:successor?(successor.payerName||''):d.payerName,
      stage,type:'Renovación',
      priority:d.priority||'Por revisar',
      amount:d.renewalAmount??'',probability:d.renewalProbability??'',
      closeDate:d.renewalCloseDate||(!closed&&d.endDate&&d.endDate>=today()?d.endDate:''),
      commercialMonth:(d.renewalCloseDate||d.endDate||'').slice(0,7),
      next:closed?'':manualAction?d.next:d.actionDoneAt?'Programar siguiente seguimiento':'Contactar al cliente para preparar la renovación',
      nextDate:closed?'':nextDate
    };
  });
}

function renewalAlert(d){
  if(licenseTiming(d).key==='closed'||['Cierre ganado','Cierre perdido'].includes(d.renewalStage))return null;
  const reviewDate=d.nextDate||(!d.actionDoneAt?renewalStart(d):'');
  if(reviewDate&&reviewDate<today())return {date:reviewDate,label:'Seguimiento pendiente desde '+short(reviewDate),color:'warm'};
  if(reviewDate&&reviewDate<=week()[1])return {date:reviewDate,label:'Contactar esta semana · '+short(reviewDate),color:'warm'};
  if(d.endDate&&d.endDate<today())return {date:reviewDate||d.endDate,label:'Periodo vencido · confirmar vigencia'+(reviewDate?' · Próximo seguimiento '+short(reviewDate):''),color:'warm'};
  if(reviewDate)return {date:reviewDate,label:'Próximo seguimiento · '+short(reviewDate),color:'neutral'};
  if(d.endDate&&d.endDate<=addDays(today(),90))return {date:d.endDate,label:'Programar seguimiento antes del '+short(d.endDate),color:''};
  return null;
}

function renewalAlertPanel(){
  const endOfWeek=week()[1],limit=addDays(today(),90);
  const alerts=entries('license').map(row=>({data:row.data,alert:renewalAlert(row.data)}))
    .filter(({data,alert})=>alert&&((data.endDate&&data.endDate<=limit)||alert.date<=endOfWeek))
    .sort((a,b)=>{
      const overdueA=Boolean(a.data.endDate&&a.data.endDate<today());
      const overdueB=Boolean(b.data.endDate&&b.data.endDate<today());
      return Number(overdueB)-Number(overdueA)||a.alert.date.localeCompare(b.alert.date);
    });
  const content=alerts.length?'<div class="scroll"><table><thead><tr><th>Cliente / licencia</th><th>Qué revisar</th><th>Vencimiento</th><th></th></tr></thead><tbody>'+
    alerts.map(({data,alert})=>'<tr><td>'+openBtn(data,get(data.clientId)?.data.name||data.name,data.project)+'</td>'+
      '<td>'+tag(alert.label,alert.color)+'</td>'+
      '<td>'+esc(data.endDate?dateLong.format(new Date(data.endDate+'T12:00Z')):'Sin fecha')+'</td><td>'+
      button('open','Abrir licencia','data-id="'+esc(data.id)+'"')+'</td></tr>').join('')+'</tbody></table></div>':
    blank('No hay renovaciones que requieran atención en este periodo.');
  return dashboardSection('renewal-attention','Renovaciones que requieren atención',alerts.length,content,
    'Periodos vencidos por confirmar, vencimientos en los próximos 90 días y seguimientos previstos para esta semana.');
}

function monthLabel(month){
  return new Intl.DateTimeFormat('es-ES',{month:'long',year:'numeric',timeZone:'Europe/Madrid'}).format(new Date(month+'-01T12:00:00Z'));
}



function renewalStatus(d){
  if(d.licenseStatus==='Finalizada'||d.renewalStage==='Cierre perdido')return 'Finalizada';
  if(['Renovado','Renovada'].includes(d.licenseStatus)||d.renewalStage==='Cierre ganado')return 'Renovado';
  return 'Por renovar';
}

function readContacts(d){
  if(Array.isArray(d.contacts))return d.contacts;
  const sourceRows=d.raw?.filas;
  if(Array.isArray(sourceRows)){
    const contacts=sourceRows.map(row=>{
      const cells=row.celdas||{};
      return {
        name:[cells['4'],cells['5']].filter(Boolean).join(' '),
        role:String(cells['6']??''),
        email:String(cells['7']??''),
        phone:String(cells['8']??'')
      };
    }).filter(c=>Object.values(c).some(Boolean));
    if(contacts.length)return contacts;
  }
  if(!d.contact)return [];
  return String(d.contact).split('\n').filter(Boolean).map(line=>{
    const parts=line.split(' · ').map(x=>x.trim()).filter(Boolean);
    const email=parts.find(x=>/^[^\s@]+@[^\s@]+$/.test(x))||'';
    const phone=parts.find(x=>!x.includes('@')&&/^[+()\d .-]+$/.test(x)&&x.replace(/\D/g,'').length>=6)||'';
    const rest=parts.filter(x=>x!==email&&x!==phone);
    return {name:rest[0]||'',role:rest.slice(1).join(' · '),email,phone};
  });
}

function contactSummary(contacts){
  return contacts.map(c=>[c.name,c.role,c.email,c.phone].filter(Boolean).join(' · ')).join('\n');
}

function contactEditorRow(contact){
  const controls=[['name','Nombre del contacto','text'],['email','Email','email'],['phone','Teléfono','tel'],['role','Cargo','text']]
    .map(([key,label,type])=>'<label>'+label+'<input data-contact="'+key+'" type="'+type+'" value="'+esc(contact[key]||'')+'"></label>').join('');
  return '<div class="contact-edit-row">'+controls+
    button('remove-contact','Quitar contacto','aria-label="Quitar este contacto"','text-button')+'</div>';
}

function contactsEditor(contacts){
  return '<fieldset class="contacts-editor wide"><legend>Contactos</legend><div id="contact-editor-list">'+
    (contacts.length?contacts:[{}]).map(contactEditorRow).join('')+'</div>'+
    button('add-contact','＋ Añadir contacto')+'</fieldset>';
}

function exportValue(row,key){
  if(key==='channelType'||key==='channelPartner')return channelDetails(row)[key];
  const fields={_contactName:'name',_contactEmail:'email',_contactPhone:'phone',_contactRole:'role'};
  if(fields[key])return readContacts(row).map(c=>c[fields[key]]||'').join('\n');
  if(key==='clientId')return get(row[key])?.data.name||row[key];
  return row[key];
}



function canonicalPartner(value){
  const name=String(value||'').trim();
  return /^satara(?: seguridad)?$/i.test(name)?'SATARA SEGURIDAD':name;
}

function channelDetails(record){
  const source=record.kind==='license'?get(record.clientId)?.data:record;
  const channelType=source?.channelType||'Por clasificar';
  return {
    channelType,
    channelPartner:channelType==='Venta directa'?'':canonicalPartner(source?.channelPartner)
  };
}

function channelSummary(record){
  const channel=channelDetails(record);
  return channel.channelType+(channel.channelPartner?' · '+channel.channelPartner:'');
}

function knownPartners(){
  return [...new Set(['SATARA SEGURIDAD',...rows.filter(r=>['client','opportunity'].includes(r.data.kind)).map(r=>channelDetails(r.data).channelPartner).filter(Boolean)])]
    .sort((a,b)=>a.localeCompare(b,'es'));
}


function commercialOwner(record){
  const hasOwnOwner=Boolean(record.commercialOwnerName||record.commercialOwnerEmail||record.commercialOwnerPhone);
  const source=record.kind==='license'&&!hasOwnOwner?get(record.clientId)?.data:record;
  return {
    commercialOwnerName:source?.commercialOwnerName||'',
    commercialOwnerEmail:source?.commercialOwnerEmail||'',
    commercialOwnerPhone:source?.commercialOwnerPhone||''
  };
}

function ownerMeta(record){
  const owner=commercialOwner(record);
  return owner.commercialOwnerName?'<div class="meta">Responsable · '+esc(owner.commercialOwnerName)+'</div>':'';
}

function payerDisplay(record){
  if(record.payerType==='Cliente')return get(record.clientId)?.data.name||record.organisation||record.name;
  if(record.payerType==='Distribuidor / colaborador')return channelDetails(record).channelPartner||'Partner por indicar';
  if(record.payerType==='Otra entidad')return record.payerName||'Entidad por indicar';
  return 'Por confirmar';
}

function followupItems(){
  const sales=opportunities();
  const projected=new Set(sales.filter(d=>d.kind==='license').map(d=>d.id));
  return [
    ...sales.filter(active),
    ...entries('client').map(r=>r.data).filter(d=>!['Baja','En pausa'].includes(d.clientStatus)),
    ...entries('license').map(r=>r.data).filter(d=>!projected.has(d.id)&&licenseTiming(d).key!=='closed')
  ].filter(d=>d.next||d.responseStatus==='Pendiente de respuesta');
}

function contactWindowMatches(record,window){
  const date=record.nextDate||'';
  switch(window){
    case 'overdue':return Boolean(date&&date<today());
    case 'today':return date===today();
    case 'future':return Boolean(date&&date>week()[1]);
    case 'undated':return !date;
    case 'all':return true;
    default:return Boolean(date&&date<=week()[1]);
  }
}

function todayContactsPanel(){
  const items=followupItems().sort((a,b)=>(a.nextDate||'9999').localeCompare(b.nextDate||'9999')||
    priorities.indexOf(a.priority||'Por revisar')-priorities.indexOf(b.priority||'Por revisar'));
  const data=items.filter(d=>contactWindowMatches(d,weeklyContactWindow));
  const windows=[
    ['week','Esta semana y vencidos'],
    ['overdue','Solo vencidos'],
    ['today','Solo hoy'],
    ['future','Semanas siguientes'],
    ['undated','Sin fecha'],
    ['all','Todos los seguimientos']
  ];
  const choices=windows.map(([key,label])=>[key,label+' ('+items.filter(d=>contactWindowMatches(d,key)).length+')']);
  const controls='<div class="weekly-controls"><label for="weekly-contact-window">Mostrar</label>'+
    '<select id="weekly-contact-window">'+opts(choices,weeklyContactWindow)+'</select></div>';
  const body=data.map(d=>{
    const client=d.kind==='license'?get(d.clientId)?.data:d;
    const person=readContacts(client||{}).find(c=>c.name||c.email);
    const reason=d.responseStatus==='Pendiente de respuesta'?'Respuesta pendiente':d.kind==='license'?'Renovación':'Seguimiento';
    return '<tr><td>'+openBtn(d,d.name,person?[person.name,person.email,person.phone].filter(Boolean).join(' · '):d.project)+'</td>'+
      '<td>'+tag(reason,d.nextDate&&d.nextDate<today()?'warm':'neutral')+'</td>'+
      '<td>'+esc(commercialOwner(d).commercialOwnerName||'Por asignar')+'</td>'+
      '<td>'+esc(d.next||'Solicitar respuesta')+'<div class="meta">'+esc(d.nextDate?dateLong.format(new Date(d.nextDate+'T12:00Z')):'Sin fecha')+'</div></td>'+
      '<td>'+button('activity','＋ Actividad','data-id="'+esc(d.id)+'"')+'</td></tr>';
  }).join('');
  return dashboardSection('contact-list','A quién contactar',data.length,controls+
    (data.length?'<div class="scroll"><table><thead><tr><th>Cuenta y contacto</th><th>Motivo</th><th>Responsable</th><th>Próximo paso</th><th></th></tr></thead><tbody>'+body+'</tbody></table></div>':blank('No hay seguimientos en este periodo.')));
}

function forecastReadiness(data){
  const pending=data.filter(d=>active(d)||d.stage==='Cierre ganado').map(d=>{
    const missing=[];
    if(!value(d.amount))missing.push('importe');
    if(d.stage!=='Cierre ganado'&&!value(d.probability))missing.push('probabilidad');
    if(!d.closeDate)missing.push('fecha de cierre');
    if(d.stage!=='Cierre ganado'&&!['Enviado','Aceptado'].includes(d.quoteStatus))missing.push(d.quoteStatus==='Rechazado'?'presupuesto rechazado':'confirmar o enviar presupuesto');
    if(d.stage!=='Cierre ganado'&&['Enviado','Aceptado'].includes(d.quoteStatus)&&!d.quoteDate)missing.push('fecha de envío');
    if(d.kind==='license'&&(!d.payerType||d.payerType==='Por confirmar'))missing.push('quién paga');
    return {data:d,missing};
  }).filter(x=>x.missing.length);
  return '<section class="card license-summary">'+cardHead('Datos pendientes para completar el forecast',pending.length+' operaciones para revisar.')+
    (pending.length?pending.map(({data,missing})=>'<div class="record">'+openBtn(data,data.name,missing.join(' · '))+'</div>').join(''):blank('Las operaciones tienen los datos necesarios para la previsión.'))+'</section>';
}

function successorLicense(record){
  return entries('license').find(r=>r.data.previousLicenseId===record.id||r.record_id===record.nextLicenseId);
}

function licensePeriodButton(record){
  const next=successorLicense(record);
  return next?button('open','Ver periodo siguiente','data-id="'+esc(next.record_id)+'"'):
    button('renew-license','Renovar y crear periodo','data-id="'+esc(record.id)+'"');
}

function activityTimeline(record){
  if(!['client','license','opportunity'].includes(record.kind))return '';
  const linked=new Set([record.id]);
  if(record.kind==='client')entries('license').filter(r=>r.data.clientId===record.id).forEach(r=>linked.add(r.record_id));
  const activities=entries('activity').filter(r=>linked.has(r.data.parentId))
    .sort((a,b)=>String(b.data.date||b.timestamp).localeCompare(String(a.data.date||a.timestamp))||String(b.timestamp).localeCompare(String(a.timestamp)));
  return '<section class="activity-timeline"><h3>Actividad</h3>'+
    (activities.length?activities.map(row=>'<article class="version"><strong>'+esc(row.data.type)+' · '+esc(short(row.data.date))+'</strong>'+
      '<div class="meta">'+esc(get(row.data.parentId)?.data.name||'Ficha asociada')+'</div>'+
      '<p class="activity-detail">'+esc(row.data.description)+'</p>'+
      (row.data.responseStatus?tag(row.data.responseStatus,'neutral'):'')+'</article>').join(''):blank('Todavía no hay actividad registrada.'))+'</section>';
}

function showOperation(title,body){
  editor=null;
  $('modal-content').innerHTML='<header class="dialog-head"><h2>'+esc(title)+'</h2>'+
    button('close','✕','aria-label="Cerrar"')+'</header><div class="dialog-body">'+body+'</div>';
  if(!$('modal').open)$('modal').showModal();
}

function showActivity(row){
  operation={mode:'activity',row,requestId:crypto.randomUUID()};
  const d=row.data;
  const inputs=[
    ['type','Actividad',['Llamada','Email','Reunión','Demo','Nota'],true],
    ['date','Fecha','date',true],
    ['description','Qué ha ocurrido','textarea',true],
    ['responseStatus','Resultado',['Pendiente de respuesta','Respondido','No requiere respuesta']],
    ['next','Próximo paso','textarea'],
    ['nextDate','Fecha del siguiente seguimiento','date']
  ];
  showOperation('Registrar actividad · '+d.name,'<form id="activity-form"><div class="fields">'+
    inputs.map(field=>formField(field,{type:'Llamada',date:today(),next:d.next||'',nextDate:d.nextDate||'',responseStatus:d.responseStatus||''})).join('')+
    '</div><p id="operation-error" class="error" role="alert"></p><div class="dialog-foot">'+
    '<button type="submit" class="primary">Guardar actividad y seguimiento</button></div></form>');
}

function showRenewal(row){
  const next=successorLicense(row.data);
  if(next){showEditor(next);return;}
  operation={mode:'renewal',row,requestId:crypto.randomUUID()};
  const d=row.data;
  const inputs=[
    ['startDate','Inicio del nuevo periodo','date',true],
    ['endDate','Vencimiento del nuevo periodo','date',true],
    ['amount','Importe acordado sin IVA','amount',true],
    ['currency','Moneda',['EUR','USD','GBP','MXN','CLP','BRL','COP','PEN'],true],
    ['closeDate','Fecha de cierre de la renovación','date',true],
    ['payerType','Quién paga',['Por confirmar','Cliente','Distribuidor / colaborador','Otra entidad'],true],
    ['payerName','Nombre del pagador (si es otra entidad)'],
    ['users','Usuarios contratados'],
    ['renewalTerms','Condiciones del nuevo periodo','textarea'],
    ['notes','Notas del nuevo periodo','textarea']
  ];
  showOperation('Renovar licencia','<p>'+esc(get(d.clientId)?.data.name||d.name)+'</p>'+
    '<p class="sub">Confirma las fechas y el importe del nuevo periodo. El anterior quedará renovado y conservará su histórico. El aviso del siguiente periodo se programará 90 días antes de vencer.</p>'+
    '<form id="renewal-form"><div class="fields">'+inputs.map(field=>formField(field,{
      amount:d.renewalAmount||'',currency:d.currency||'EUR',closeDate:today(),
      payerType:d.payerType||'Por confirmar',payerName:d.payerName||'',users:d.users||'',renewalTerms:d.renewalTerms||''
    })).join('')+'</div><p id="operation-error" class="error" role="alert"></p>'+
    '<div class="dialog-foot"><button type="submit" class="primary">Confirmar renovación y crear periodo</button></div></form>');
}

async function operationRpc(name,payload){
  try{
    return await crmConnection.request('rpc/'+name,{method:'POST',body:JSON.stringify(payload)});
  }catch(error){
    if(['PGRST202','PGRST203'].includes(error.code))throw Error('Ejecuta primero la consulta 06 en Supabase y vuelve a intentarlo.');
    throw error;
  }
}

function renewalPayload(old,form,id){
  const startDate=String(form.get('startDate')||'');
  const endDate=String(form.get('endDate')||'');
  const amount=String(form.get('amount')||'').trim();
  if(!startDate||!endDate||endDate<startDate)throw Error('Revisa las fechas del nuevo periodo.');
  if(old.endDate&&startDate<old.endDate)throw Error('El nuevo periodo debe comenzar al terminar el anterior.');
  if(!amount||!Number.isFinite(Number(amount))||Number(amount)<0)throw Error('Indica el importe acordado.');
  const payerType=String(form.get('payerType')||'Por confirmar');
  const payerName=payerType==='Otra entidad'?String(form.get('payerName')||'').trim():'';
  if(payerType==='Otra entidad'&&!payerName)throw Error('Indica el nombre de la entidad que paga.');
  return {
    name:(get(old.clientId)?.data.name||old.name)+' · '+startDate+' — '+endDate,
    id,project:old.project,kind:'license',clientId:old.clientId,startDate,endDate,amount,
    currency:String(form.get('currency')||old.currency||'EUR'),payerType,payerName,
    users:String(form.get('users')||'').trim(),
    renewalTerms:String(form.get('renewalTerms')||'').trim(),
    notes:String(form.get('notes')||'').trim(),
    commercialOwnerName:old.commercialOwnerName||'',
    commercialOwnerEmail:old.commercialOwnerEmail||'',
    commercialOwnerPhone:old.commercialOwnerPhone||''
  };
}

document.addEventListener('submit',async event=>{
  const form=event.target;
  if(!['activity-form','renewal-form'].includes(form.id))return;
  event.preventDefault();
  const current=operation;
  if(!current)return;
  const submit=form.querySelector('[type=submit]');
  submit.disabled=true;
  const errorNode=$('operation-error');
  errorNode.textContent='';
  try{
    const values=new FormData(form);
    let result;
    if(form.id==='activity-form'){
      const activity={type:String(values.get('type')||''),date:String(values.get('date')||''),description:String(values.get('description')||'').trim(),responseStatus:String(values.get('responseStatus')||'')};
      if(!activity.description)throw Error('Escribe qué ha ocurrido.');
      result=await operationRpc('crm_log_activity',{
        p_parent_id:current.row.record_id,p_expected_version:current.row.version,p_activity_id:current.requestId,
        p_activity:activity,p_next:String(values.get('next')||'').trim(),
        p_next_date:String(values.get('nextDate')||'')||null,p_response_status:activity.responseStatus
      });
    }else{
      const data=renewalPayload(current.row.data,values,current.requestId);
      result=await operationRpc('crm_renew_license',{
        p_license_id:current.row.record_id,p_expected_version:current.row.version,
        p_new_id:current.requestId,p_new_data:data,p_close_date:String(values.get('closeDate')||'')
      });
    }
    $('modal').close();
    await load();
    const target=get(result?.new_id||current.row.record_id);
    if(target)showEditor(target);
    toast(form.id==='activity-form'?'Actividad y seguimiento guardados':'Renovación guardada y nuevo periodo creado');
  }catch(error){
    errorNode.textContent=error.message;
    submit.disabled=false;
  }
});


function quoteMeta(record){
  return '<div class="meta">'+esc(record.quoteStatus||'Presupuesto por confirmar')+
    (record.quoteDate?' · '+esc(short(record.quoteDate)):'')+'</div>';
}


document.addEventListener('toggle',event=>{
  const section=event.target;
  if(!section.matches?.('details[data-dashboard-section]')||!section.isConnected)return;
  const key=section.dataset.dashboardSection;
  if(section.open)expandedDashboardSections.add(key);
  else expandedDashboardSections.delete(key);
},true);

route();
