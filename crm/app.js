'use strict';
const $=id=>document.getElementById(id);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const projects=['Zentynel','Flowity','Metadology'];
const colors=['zentynel','flowity','metadology'];
const stages=['Prospección','Contacto inicial','Cualificación','Reunión / demo','Propuesta','Negociación','Cierre ganado','Cierre perdido','Renovación','Seguimiento','En pausa'];
const channelTypes=['Venta directa','Partner / distribuidor'];
const accountRoles=['Cliente final','Partner / distribuidor','Proveedor','Por clasificar'];
const marketSectors=['Público','Privado','Mixto','Por clasificar'];
const entityTypes=['Ayuntamiento','Diputación','Comunidad autónoma','Cabildo / Consell','Ministerio / Administración del Estado','Administración pública','Empresa pública','Empresa privada','Universidad / centro educativo','Centro sanitario','Asociación','Otro'];
const legacyCollectives=['Policía local','Policía nacional','Guardia Civil','Bomberos','Protección Civil','Emergencias','Agentes medioambientales','Transporte público','Sanidad','Universidad / educación','Empresa de uniformidad','Industria','Seguridad privada'];
function classification(d){
  const source=d.kind==='license'?(get(d.clientId)?.data||{}):d;
  const legacy=String(source.sector||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const marketSector=marketSectors.includes(source.marketSector)?source.marketSector:['publico','sector publico'].includes(legacy)?'Público':['privado','sector privado'].includes(legacy)?'Privado':'Por clasificar';
  return {marketSector,entityType:source.entityType||'',sector:source.sector||d.sector||''};
}
function knownEntityTypes(includeLegacy=true){return [...new Set([...entityTypes,...rows.filter(r=>['client','opportunity'].includes(r.data.kind)).map(r=>r.data.entityType).filter(v=>v&&(includeLegacy||!legacyCollectives.includes(v)))])].sort((a,b)=>a.localeCompare(b,'es'));}

function accountRole(d){
  if(d.kind==='license')return accountRole(get(d.clientId)?.data||{});
  if(['Partner','Distribuidor','Colaborador'].includes(d.accountRole))return 'Partner / distribuidor';
  if(accountRoles.includes(d.accountRole))return d.accountRole;
  if(d.type==='Partner')return 'Partner / distribuidor';
  if(d.type==='Proveedor')return 'Proveedor';
  if(d.type==='Cliente directo')return 'Cliente final';
  if(d.kind==='client'&&String(d.sourceUrl||'').includes('file_id=libfile_01fab3fd7c5c819181dff525e6a09787'))return 'Cliente final';
  return 'Por clasificar';
}

const channelFields=[['channelType','Canal comercial',channelTypes,true],['channelPartner','Partner / distribuidor','partner']];
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
const types=['Cliente directo','Partner','Proveedor','Piloto','Licitación','Renovación','Ampliación','Por cualificar'];
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
const filterFields=[['project','Proyecto'],['forecastCategory','Previsión de cierre'],['accountRole','Tipo de cuenta'],['country','País'],['region','Región'],['marketSector','Sector público / privado'],['entityType','Tipo de organismo'],['department','Departamento / colectivo'],['municipality','Municipio'],['province','Provincia'],['sector','Actividad'],['priority','Prioridad'],['stage','Estado comercial'],['type','Tipo'],['commercialMonth','Mes cierre / renovación'],['channelType','Canal comercial'],['channelPartner','Partner / distribuidor'],['commercialOwnerName','Responsable comercial']];
const navItems=[['home','▦','Esta semana'],['pipeline','☷','Pipeline'],['clients','▤','Cuentas y licencias'],['sales','€','Ventas y cobros'],['forecast','◴','Forecast trimestral'],['reviews','◷','Revisión semanal']];
const subsets={
  Zentynel:[['','Todas'],['spain','España'],['portugal','Portugal'],['latam','Latinoamérica']],
  Flowity:[['','Todas'],['dip','Diputaciones'],['road','Carreteras']]
};
const departmentOptions=['Policía Local','Policía Nacional','Guardia Civil','Bomberos','Protección Civil','Emergencias','Agentes medioambientales','Servicios municipales','Todo el Ayuntamiento'];
const locationFields=[['municipalityCode','Municipio de España','municipality'],['municipality','Municipio'],['province','Provincia'],['autonomousCommunity','Comunidad autónoma']];
const paymentFields=[['paymentStatus','Estado de cobro',['Por confirmar','Pendiente de pago','Pagado']],['paymentDate','Fecha de cobro','date'],['invoiceReference','Referencia de factura'],['payer','Pagador']];
const potentialFields=[['potentialUsers','Usuarios potenciales','users'],['potentialAnnual','Potencial anual recurrente (€ sin IVA)','calculated'],['potentialFirstYear','Potencial del primer año (€ sin IVA)','calculated'],['potentialTariffVersion','Versión de tarifa aplicada','calculated'],['potentialBasis','Detalle del cálculo','calculatedText']];
const forecastLabels={'Probable':'Cierre previsto','Posible':'En evaluación','Fuera de previsión':'Sin fecha de decisión','Confirmada':'Venta confirmada'};
const forecastCategories=Object.entries(forecastLabels);
const forecastCategoryLabel=v=>forecastLabels[v]||v;
const operationFields=[['operationUsers','Usuarios de la operación actual','users'],['operationAnnual','Estimación anual del alcance actual (€ sin IVA)','calculated'],['operationFirstYear','Estimación del primer año (€ sin IVA)','calculated'],['operationBasis','Cálculo de la operación actual','calculatedText'],['operationTariffVersion','Tarifa aplicada a la operación','calculated'],['forecastBasis','Importe estimado a prever',[['annual','Anual recurrente'],['firstYear','Primer año con onboarding']]]];
const commercialValueFields=[['budgetAmount','Importe del presupuesto sin IVA','amount'],['confirmedAmount','Importe final acordado sin IVA','amount'],['amountOrigin','Origen del importe para forecast','calculated']];
const fields=[
  ['name','Cuenta / oportunidad','text',true],['project','Proyecto',projects,true],['accountRole','Tipo de cuenta',accountRoles],...channelFields,['stage','Estado comercial',stages,true],...ownerFields,...responseFields,
  ['accountId','Cuenta vinculada','client'],...paymentFields,['organisation','Organismo, empresa, proveedor o partner'],['type','Tipo de oportunidad',types],['marketSector','Sector público / privado',marketSectors],['entityType','Tipo de organismo','entity'],['department','Departamento / colectivo','department'],...locationFields,['sector','Actividad / sector específico'],
  ['country','País','country'],['region','Región','region'],['territory','Comunidad / territorio'],
  ...operationFields,...commercialValueFields,...potentialFields,['priority','Prioridad',priorities],['risk','Riesgo'],['contacts','Contactos','contacts'],
  ['source','Fuente','textarea'],['need','Necesidad detectada','textarea'],['proposal','Propuesta de valor','textarea'],
  ['meetings','Reuniones','textarea'],['demos','Demos','textarea'],['emails','Emails y comunicaciones','textarea'],
  ['objections','Objeciones','textarea'],...quoteFields,['amount','Valor de la oportunidad sin IVA','amount',true],['currency','Moneda',['EUR','USD','GBP','MXN','CLP','BRL','COP','PEN'],true],['forecastCategory','Previsión de cierre',forecastCategories,true],['probability','Probabilidad anterior (%)','historical'],
  ['relevantDate','Fecha relevante','date'],['closeDate','Fecha de cierre prevista / efectiva','date',true],['nextDate','Fecha de la próxima acción','date'],
  ['next','Próximo paso','textarea'],['notes','Notas','textarea']
];
let clientTab='clients',customerRole='',customerMarket='',customerEntity='',customerQuery='',customerProject='',licenseFilter='all',renewalStateFilter='all',customerChannel='',customerPartner='';
let pipelineBucket='open';
let quickState=null,quickLinkVersion=null;
const pipelineMatches=(d,bucket=pipelineBucket)=>bucket==='all'||(bucket==='closed'?['Cierre ganado','Cierre perdido'].includes(d.stage):bucket==='paused'?d.stage==='En pausa':active(d));
let rows=[],error='',view='home',project='',subset='',filters={},query='',layout='list',fQuarter=quarterFor(today()),fProject='',fChannel='',fPartner='',editor=null,toastTimer;
const entries=kind=>rows.filter(x=>x.data.kind===kind);
const opportunities=()=>[
  ...entries('opportunity').map(x=>({...x.data,forecastCategory:forecastCategoryFor(x.data),...publicLocation(x.data),...classification(x.data),accountRole:accountRole(x.data),...channelDetails(x.data),commercialMonth:(x.data.closeDate||'').slice(0,7)})),
  ...renewalOpportunities().map(d=>({...d,forecastCategory:forecastCategoryFor(d),...publicLocation(get(d.id)?.data||d)}))
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
  const [next,p,v]=location.hash.slice(1).split('/');
  if(next==='quick'){quickLinkVersion=/^\d+$/.test(v||'')?Number(v):null;quickState=null;}
  view=navItems.some(x=>x[0]===next)||['project','quick'].includes(next)?next:'home';
  project=projects.find((_,i)=>colors[i]===p)||'';
  filters={};query='';subset='';pipelineBucket='open';render();
}
function jump(v,p=''){location.hash=v+(p?'/'+colors[projects.indexOf(p)]:'');}
function render(){
  $('nav').innerHTML='<div class="nav-label">Seguimiento</div>'+navItems.map(([v,i,l])=>button('nav','<span class="nav-icon" aria-hidden="true">'+i+'</span>'+l,'data-view="'+v+'"',view===v?'active':'')).join('')+'<a class="portal-admin-link" href="./portal/?manage=1">Accesos de clientes</a><div class="nav-label">Proyectos</div>'+projects.map(p=>button('project',dot(p)+p,'data-project="'+p+'"',view==='project'&&project===p?'active':'')).join('');
  $('breadcrumb').textContent=view==='quick'?'Actualización rápida':view==='project'?project:(navItems.find(x=>x[0]===view)?.[2]||'Seguimiento comercial');
  $('page').innerHTML=error?'<div class="card"><p class="error">'+esc(error)+'</p>'+button('reload','Volver a cargar')+'</div>':({home,pipeline,project:pipeline,forecast,reviews,clients,sales,quick:quickFollowup}[view]||home)();
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
  return scoped().filter(d=>pipelineMatches(d)&&filterFields.every(([k])=>!filters[k]||d[k]===filters[k])&&(!query||normalize([d.name,d.organisation,d.contact,d.next,d.sector,d.entityType,d.department,d.municipality,d.marketSector,d.channelPartner,commercialOwner(d).commercialOwnerName].join(' ')).includes(normalize(query))));
}
function pipeline(){
  const all=scoped(),scope=all.filter(d=>pipelineMatches(d)),title=view==='project'?project:'Pipeline comercial';
  const specialized=view==='project'&&subsets[project];
  const filter=filterFields.filter(([k])=>view!=='project'||k!=='project').map(([k,l])=>'<label>'+l+'<select data-filter="'+k+'">'+opts([...new Set(scope.map(d=>d[k]).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es')).map(v=>k==='commercialMonth'?[v,monthLabel(v)]:k==='forecastCategory'?[v,forecastCategoryLabel(v)]:v),filters[k],'Todos')+'</select></label>').join('');
  return head(title,view==='project'?'Oportunidades y seguimiento del proyecto.':'Prospección, cierre, renovación y seguimiento en una sola vista.')+
    (specialized?'<div class="chips">'+specialized.map(([k,l])=>button('subset',l,'data-key="'+k+'"',k===subset?'selected':'')).join('')+'</div>':'')+
    '<div class="chips">'+[['open','Abiertas'],['closed','Cerradas'],['paused','En pausa'],['all','Todas']].map(([bucket,label])=>button('pipeline-bucket',label+' ('+all.filter(d=>pipelineMatches(d,bucket)).length+')','data-key="'+bucket+'"',pipelineBucket===bucket?'selected':'')).join('')+'</div>'+
    '<div class="card"><div class="filters"><label class="filter-search">Buscar<input type="search" id="query" value="'+esc(query)+'" placeholder="Cuenta, contacto o próximo paso"></label>'+filter+'</div>'+
    '<div class="chips">'+button('layout','Lista','data-key="list"',layout==='list'?'selected':'')+button('layout','Por etapa','data-key="board"',layout==='board'?'selected':'')+button('clear','Limpiar filtros')+'</div><div id="results">'+resultTable()+'</div></div>';
}
function resultTable(){
  const data=filtered().sort((a,b)=>(priorities.indexOf(a.priority||'Por revisar')-priorities.indexOf(b.priority||'Por revisar'))||a.name.localeCompare(b.name,'es'));
  if(!data.length)return blank('No hay oportunidades en esta vista. Puedes crear una desde el botón superior.');
  const count='<p class="sub">'+data.length+' '+(data.length===1?'oportunidad':'oportunidades')+'</p>';
  if(layout==='board')return count+'<div class="board">'+stages.filter(stage=>pipelineMatches({stage})).map(s=>'<section class="lane"><h3>'+esc(s)+' · '+data.filter(d=>d.stage===s).length+'</h3>'+data.filter(d=>d.stage===s).map(d=>openBtn(d,d.name)).join('')+'</section>').join('')+'</div>';
  const showProject=view!=='project';
  const dateCell=d=>d.nextDate?new Intl.DateTimeFormat('es-ES',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'Europe/Madrid'}).format(new Date(d.nextDate+'T12:00Z')):'—';
  const origin=d=>{const channel=channelDetails(d);return channel.channelType==='Venta directa'?'Venta directa':channel.channelPartner||channel.channelType;};
  return count+'<div class="scroll"><table class="crm-list"><thead><tr><th>Cuenta</th>'+(showProject?'<th>Proyecto</th>':'')+'<th>Tipo</th><th>Departamento / colectivo</th><th>Origen</th><th>Estado</th><th>Importe</th><th>Cobro</th><th>Próxima acción</th><th>Fecha</th></tr></thead><tbody>'+data.map(d=>'<tr><td><div class="pipeline-account">'+openBtn(d,d.name)+priority(d)+'</div></td>'+(showProject?'<td>'+esc(d.project)+'</td>':'')+'<td>'+esc(accountRole(d))+'</td><td>'+esc(d.department||'—')+'</td><td>'+esc(origin(d))+'</td><td>'+tag(d.kind==='license'?renewalStatus(get(d.id).data):d.stage||'Prospección',d.stage==='Cierre ganado'?'green':'neutral')+'<small class="amount-origin">'+esc(forecastCategoryLabel(forecastCategoryFor(d)))+'</small></td><td class="nobr">'+(value(d.amount)?esc(money(Number(d.amount),d.currency))+(d.amountOrigin?'<small class="amount-origin">'+esc(d.amountOrigin)+'</small>':''):d.project==='Zentynel'&&value(d.potentialAnnual)?'<span class="potential-amount">Potencial '+esc(money(Number(d.potentialAnnual),'EUR'))+'/año</span>':'—')+'</td><td>'+esc(d.stage==='Cierre ganado'?(d.kind==='license'?get(d.id)?.data.renewalPaymentStatus:d.paymentStatus)||'Por confirmar':'—')+'</td><td>'+esc(d.next||'—')+'</td><td class="nobr">'+esc(dateCell(d))+'</td></tr>').join('')+'</tbody></table></div>';
}
const goalFields=[['name','Objetivo','text',true],['project','Proyecto',projects,true],['quarter','Trimestre (AAAA-T1 a AAAA-T4)','quarter',true],['currency','Moneda',['EUR','USD','GBP','MXN','CLP','BRL','COP','PEN'],true],['conservative','Conservador','amount'],['base','Base','amount'],['upside','Optimista','amount'],['linked','Sustituir por una oportunidad','link'],['notes','Notas y supuestos','textarea']];
const reviewFields=[['name','Título','text',true],['reviewDate','Fecha de revisión','date',true],['project','Proyecto',projects],['reviewNext','Próxima revisión','date'],['notes','Decisiones, cambios de prioridad y próximos pasos','textarea',true]];
function forecast(){
 const all=opportunities().filter(d=>(!fChannel||channelDetails(d).channelType===fChannel)&&(!fPartner||channelDetails(d).channelPartner===fPartner)&&(!fProject||d.project===fProject));
 const candidates=all.filter(d=>quarterFor(d.closeDate)===fQuarter&&!['Cierre perdido','En pausa'].includes(d.stage)&&d.quoteStatus!=='Rechazado');
 const ready=candidates.filter(d=>value(d.amount)&&Number(d.amount)>0&&['Confirmada','Probable','Posible'].includes(forecastCategoryFor(d)));
 const pending=all.filter(d=>active(d)&&d.quoteStatus!=='Rechazado'&&forecastCategoryFor(d)!=='Fuera de previsión'&&(!d.closeDate||!value(d.amount)||forecastCategoryFor(d)==='Por clasificar'));
 const totals=new Map();for(const d of ready){const c=d.currency||'EUR',a=Number(d.amount),cat=forecastCategoryFor(d),sum=totals.get(c)||[0,0,0];if(cat==='Confirmada')sum[0]+=a;if(['Confirmada','Probable'].includes(cat))sum[1]+=a;sum[2]+=a;totals.set(c,sum);}
 const format=i=>[...totals].sort().map(([c,a])=>money(a[i],c)).join(' · ')||'—';
 const year=Number(fQuarter.slice(0,4)),periods=[...new Set([year-1,year,year+1,Number(today().slice(0,4)),...all.map(d=>Number(d.closeDate?.slice(0,4))).filter(Boolean)])].sort((a,b)=>a-b).flatMap(y=>[1,2,3,4].map(q=>y+'-T'+q));
 const record=d=>'<div class="record">'+openBtn(d,d.name,d.project+' · '+(d.amountOrigin||'Importe de la ficha')+' · '+(value(d.amount)?money(Number(d.amount),d.currency):'Sin importe')+' · '+short(d.closeDate))+tag(forecastCategoryLabel(forecastCategoryFor(d)))+'</div>';
 const goals=entries('goal').map(r=>r.data).filter(d=>d.quarter===fQuarter&&(!fProject||d.project===fProject));
 return head('Previsión trimestral','Importes completos, sin porcentajes. Los escenarios son acumulados y no se suman entre sí.')+
 '<div class="forecast-controls"><label>Trimestre<select id="quarter">'+opts(periods,fQuarter)+'</select></label><label>Proyecto<select id="forecast-project">'+opts(projects,fProject,'Todos')+'</select></label><label>Canal<select id="forecast-channel">'+opts(channelTypes,fChannel,'Todos')+'</select></label><label>Partner / distribuidor<select id="forecast-partner">'+opts(knownPartners(),fPartner,'Todos')+'</select></label></div>'+
 '<div class="grid metrics forecast-metrics">'+metric('Ya vendido',format(0),'Ventas aceptadas formalmente')+metric('Vendido + cierres previstos',format(1),'Incluye los cierres que esperas conseguir')+metric('Si se cierra lo que está en evaluación',format(2),'Vendido + cierres previstos + en evaluación')+'</div>'+
 '<p class="sub">Una estimación por usuarios puede estar En evaluación o en Cierre previsto sin presupuesto enviado. El potencial futuro no se añade mientras no sea una operación concreta.</p>'+
 '<section class="card">'+cardHead('Operaciones del trimestre',ready.length+' incluidas en los escenarios.')+(candidates.length?candidates.map(record).join(''):blank('Sin operaciones para este trimestre.'))+'</section>'+
 '<details class="card"'+(pending.length?' open':'')+'><summary>Datos pendientes o previsión por clasificar · '+pending.length+'</summary><p class="sub">No se han convertido los porcentajes anteriores en categorías. Revisa valor, cierre y previsión antes de incluir cada operación.</p>'+pending.map(record).join('')+'</details>'+
 (goals.length?'<details class="card"><summary>Objetivos anteriores · no incluidos en estos escenarios</summary>'+goals.map(d=>'<div class="record">'+openBtn(d,d.name,d.project)+'</div>').join('')+'</details>':'');
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
  if(typ==='historical')return '<input type="hidden" name="'+key+'" value="'+esc(data[key]??'')+'">';
  if(typ==='calculated'||typ==='calculatedText')return '<label'+(typ==='calculatedText'?' class="wide"':'')+'>'+esc(label)+(typ==='calculatedText'?'<textarea readonly name="'+key+'">'+esc(data[key]||'')+'</textarea>':'<input readonly name="'+key+'" value="'+esc(data[key]??'')+'">')+'</label>';
  if(typ==='users')return '<label>'+esc(label)+'<input type="number" name="'+key+'" value="'+esc(data[key]??'')+'" min="1" step="1" placeholder="Ej. 200"></label>';
  if(typ==='municipality')return municipalityEditor(data);
  if(['municipality','province','autonomousCommunity'].includes(key))return '<input type="hidden" name="'+key+'" value="'+esc(data[key]||'')+'">';
  if(typ==='department')return '<label>'+esc(label)+'<input name="department" value="'+esc(data.department||'')+'" list="department-options" placeholder="Ej. Policía Local"><datalist id="department-options">'+departmentOptions.map(v=>'<option value="'+esc(v)+'"></option>').join('')+'</datalist></label>';
  if(typ==='contacts')return contactsEditor(readContacts(data));
  if(key==='payerName')return '<label>Nombre de otra entidad<input name="payerName" value="'+esc(data.payerName||'')+'"'+(data.payerType==='Otra entidad'?'':' disabled')+'></label>';
  if(typ==='partner'){
    const direct=data.channelType==='Venta directa';
    return '<label'+(direct?' hidden':'')+'>Partner / distribuidor<input name="channelPartner" list="channel-partners" value="'+esc(direct?'':data.channelPartner||'')+'"'+(direct?' disabled':' required')+'><datalist id="channel-partners">'+
      knownPartners().map(name=>'<option value="'+esc(name)+'"></option>').join('')+'</datalist></label>';
  }
  if(typ==='entity')return '<label>'+esc(label)+'<input name="'+key+'" list="entity-types" value="'+esc(data[key]||'')+'" placeholder="Selecciona o escribe otro"><datalist id="entity-types">'+knownEntityTypes(false).map(name=>'<option value="'+esc(name)+'"></option>').join('')+'</datalist></label>';
  const v=key==='accountRole'?accountRole(data):key==='marketSector'?classification(data).marketSector:key==='channelType'?channelDetails(data).channelType:data[key]??'', name=' name="'+key+'"'+(required?' required':'');
  const list=typ==='client'?entries('client').map(r=>r.data).filter(d=>d.project===data.project||d.id===v).map(d=>[d.id,d.name]):Array.isArray(typ)?typ:typ==='country'?[...new Set([...countries,...opportunities().map(x=>x.country).filter(Boolean)])].sort((a,b)=>a.localeCompare(b,'es')):typ==='region'?[...new Set([...regions,...opportunities().map(x=>x.region).filter(Boolean)])]:typ==='link'?opportunities().filter(d=>(d.project===data.project||d.id===v)&&(quarterFor(d.closeDate)===data.quarter||d.id===v)).map(d=>[d.id,d.name]):null;
  let control;
  if(list)control='<select'+name+'>'+opts(list,v,'Seleccionar')+'</select>';
  else if(typ==='textarea')control='<textarea'+name+'>'+esc(v)+'</textarea>';
  else{
    const number=typ==='amount'||typ==='prob';
    const type=number?'number':['date','email','tel'].includes(typ)?typ:'text';
    control='<input'+name+' type="'+type+'" value="'+esc(v)+'"'+(number?' min="0" step="0.01"':'')+(typ==='prob'?' max="100"':'')+(typ==='quarter'?' pattern="[0-9]{4}-T[1-4]" placeholder="2026-T4"':'')+'>';
  }
  return '<label'+(typ==='textarea'?' class="wide"':'')+'>'+esc(label)+control+(key==='closeDate'?'<small class="sub">Opcional solo en Sin fecha de decisión.</small>':'')+(['forecastCategory','renewalForecastCategory'].includes(key)?'<small class="sub">En evaluación: hay interés. Cierre previsto: propuesta validada, fondos y decisión previstos. Venta confirmada: cierre ganado.</small>':'')+'</label>'+(key==='name'&&['client','opportunity'].includes(data.kind)?'<div class="wide" id="municipality-name-suggestion"></div>':'');
}
const fieldsFor=d=>d.kind==='client'?clientFields:d.kind==='license'?licenseFields:d.kind==='opportunity'?fields:d.kind==='goal'?goalFields:reviewFields;
function accountEditorFields(d,all){
  const used=new Set();
  const render=keys=>all.filter(f=>keys.includes(f[0])).map(f=>{used.add(f[0]);return formField(f,d);}).join('');
  const identity=['name','project','accountRole','channelType','channelPartner','country','marketSector','entityType','department','sector'];
  let html='<div id="required-fields"><section class="editor-section editor-primary"><h3>Identificación</h3><div id="identity-fields" class="fields">'+render(identity)+'</div></section></div>';
  html+='<section class="editor-section editor-primary"><h3>Contactos</h3><div class="fields">'+render(['contacts'])+'</div></section>';
  html+='<section class="editor-section editor-primary"><h3>Seguimiento</h3><div class="fields">'+render(['clientStatus','priority','next','nextDate','responseStatus'])+'</div></section>';
  html+='<details id="potential-area" class="editor-section"'+(d.project==='Zentynel'?'':' hidden')+'><summary>Potencial de la cuenta</summary><div class="fields">'+render(potentialFields.map(f=>f[0]))+'</div><p class="sub">Capacidad total de la cuenta. No se suma al forecast: crea una oportunidad concreta para prever una venta.</p><p id="potential-notice" role="status"></p>'+button('potential-recalculate','Recalcular con tarifa actual')+'</details>';
  html+='<details class="editor-section"><summary>Municipio y ubicación</summary><div class="fields">'+render(['municipalityCode','municipality','province','autonomousCommunity','region'])+'</div></details>';
  html+='<details class="editor-section"><summary>Notas de la cuenta</summary><div class="fields">'+all.filter(f=>!used.has(f[0])).map(f=>formField(f,d)).join('')+'<label class="wide">Motivo del cambio (opcional)<input name="reason" placeholder="Ej. Datos confirmados con el cliente"></label></div></details>';
  return html;
}
function editorFields(d){
  const all=fieldsFor(d);
  if(d.kind==='client')return accountEditorFields(d,all);
  if(!['license','opportunity','client'].includes(d.kind))return '<section class="editor-section"><h3>Datos obligatorios</h3><div id="required-fields" class="fields">'+all.filter(f=>f[3]).map(f=>formField(f,d)).join('')+'</div></section><div class="fields">'+all.filter(f=>!f[3]).map(f=>formField(f,d)).join('')+'</div>';
  const essential=d.kind==='license'
    ?['name','project','clientId','department','licenseStatus','priority','endDate','renewalAmount','currency','renewalCloseDate','next','nextDate']
    :d.kind==='client'
    ?['name','project','accountRole','department','country','clientStatus','contacts','priority','next','nextDate']
    :['name','project','accountRole','department','country','stage','priority','contacts','amount','currency','closeDate','next','nextDate'];
  const groups=[
    ['Alcance actual — Zentynel',operationFields.map(f=>f[0])],
    ['Presupuesto e importe final',[...commercialValueFields.map(f=>f[0]),'quoteStatus','quoteReference','quoteDate']],
    ['Potencial Zentynel',potentialFields.map(f=>f[0])],
    ['Compras y cobros',['accountId','saleDate','paymentStatus','paymentDate','invoiceReference','payer','renewalPaymentStatus','renewalPaymentDate','renewalInvoiceReference','renewalPayer']],
    ['Clasificación',['marketSector','entityType','sector']],
    ['Municipio y ubicación',['municipalityCode','municipality','province','autonomousCommunity']],
    ['Canal, responsable y respuesta',['channelType','channelPartner','commercialOwnerName','commercialOwnerEmail','commercialOwnerPhone','responseStatus','payerType','payerName']],
    ['Presupuesto y previsión',['quoteStatus','quoteReference','quoteDate','renewalForecastCategory','probability','renewalProbability']],
    ['Datos del contrato',['startDate','renewalNotice','users','amount','renewalTerms']],
    ['Contexto comercial',['organisation','type','sector','country','region','territory','need','proposal','risk','relevantDate']],
    ['Notas y comunicaciones',['meetings','demos','emails','objections','source','notes']]
  ];
  const required=all.filter(f=>f[3]||['channelPartner','country'].includes(f[0])||d.kind==='license'&&f[0]==='renewalForecastCategory');
  const used=new Set([...essential,...required.map(f=>f[0])]);
  const simple=['client','opportunity'].includes(d.kind);
  const valueKeys=['amount','currency','forecastCategory','closeDate'];
  const identity=required.filter(f=>!simple||!valueKeys.includes(f[0]));
  const economics=required.filter(f=>simple&&valueKeys.includes(f[0]));
  const optional=all.filter(f=>essential.includes(f[0])&&!required.includes(f));
  const block=(title,items,id='')=>items.length?'<section class="editor-section editor-primary"><h3>'+esc(title)+'</h3><div'+(id?' id="'+id+'"':'')+' class="fields">'+items.map(f=>formField(f,d)).join('')+'</div></section>':'';
  let html=(simple?'<div id="required-fields">':'')+block(simple?'Identificación':'Datos obligatorios',identity,simple?'identity-fields':'required-fields');
  if(simple){
    html+=block('Seguimiento',optional.filter(f=>['stage','clientStatus','priority','next','nextDate'].includes(f[0])));
    html+=block('Valor y previsión',economics)+'</div>';
    html+=block('Cuenta y contacto',optional.filter(f=>!['stage','clientStatus','priority','next','nextDate'].includes(f[0])));
  }else html+=block('Seguimiento y datos opcionales',optional);
  if(d.kind==='license')html+=licenseClassification(d);
  for(const [title,keys] of groups){
    const selected=all.filter(f=>keys.includes(f[0])&&!used.has(f[0]));
    selected.forEach(f=>used.add(f[0]));
    if(selected.length&&selected.every(f=>f[2]==='historical')){html+=selected.map(f=>formField(f,d)).join('');continue;}
    if(selected.length)html+='<details class="editor-section"'+(title==='Alcance actual — Zentynel'?' id="operation-area"'+(d.project==='Zentynel'?' open':' hidden'):'')+(title==='Potencial Zentynel'?' id="potential-area"'+(d.project==='Zentynel'?'':' hidden'):'')+(!simple&&title==='Clasificación'?' open':'')+'><summary>'+esc(title)+'</summary><div class="fields">'+selected.map(f=>formField(f,d)).join('')+'</div>'+(title==='Alcance actual — Zentynel'?'<p class="sub">Solo los usuarios que intentas contratar ahora. Elige En evaluación o Cierre previsto y una fecha de cierre para incluir su valor completo en los escenarios.</p><p id="operation-value-notice" role="status"></p>'+button('operation-copy-potential','Usar usuarios del potencial para esta operación')+' '+button('operation-estimate','Usar estimación por usuarios'):'')+(title==='Potencial Zentynel'?'<p class="sub">Paquete completo del tramo · EUR · sin IVA. El primer año incluye 400 € de onboarding. No incluye soporte adicional. Este potencial no se suma por separado: usa sus usuarios en Alcance actual y clasifica la operación como En evaluación o Cierre previsto.</p><p id="potential-notice" role="status"></p>'+button('potential-recalculate','Recalcular con tarifa actual'):'')+'</details>';
  }
  const rest=all.filter(f=>!used.has(f[0]));
  if(rest.length)html+='<details class="editor-section"><summary>Otros detalles</summary><div class="fields">'+rest.map(f=>formField(f,d)).join('')+'</div></details>';
  return html+'<details class="editor-section"><summary>Motivo del cambio (opcional)</summary><div class="fields"><label class="wide">Motivo del cambio<input name="reason" placeholder="Ej. Confirmación tras la reunión"></label></div></details>';
}
document.addEventListener('invalid',e=>{
  for(let section=e.target.closest('details');section;section=section.parentElement.closest('details'))section.open=true;
},true);
function licenseClassification(d){
  const client=get(d.clientId)?.data,c=classification(d);
  return '<details id="license-classification" class="editor-section" open><summary>Clasificación de la cuenta titular</summary>'+(client?'<div class="fields"><div><strong>Sector público / privado</strong><p>'+esc(c.marketSector)+'</p></div><div><strong>Tipo de organismo</strong><p>'+esc(c.entityType||'Por clasificar')+'</p></div></div><p class="sub">Se actualiza desde la ficha de '+esc(client.name)+'.</p>':'<p class="sub">Selecciona la cuenta titular para ver su clasificación.</p>')+'</details>';
}
function importOriginDetails(d){
  const source=d.importOriginal;
  if(!source)return '';
  return '<details class="editor-section"><summary>Datos originales importados</summary><p>'+esc(source.file)+' · '+esc(source.sheet)+' · Fila '+esc(source.row)+'</p><dl>'+source.headers.map((header,i)=>'<dt>'+esc(header)+'</dt><dd>'+esc(source.cells[i]??'')+'</dd>').join('')+'</dl></details>';
}
function initialLicenseFields(){
  return '<section class="initial-license editor-section"><label class="initial-license-check"><input type="checkbox" name="createInitialLicense" id="create-initial-license" checked> Crear licencia inicial vinculada</label><p class="sub">Se guardarán la cuenta y su licencia juntas. Después se abrirá la licencia para revisarla. Puedes desmarcarlo si no corresponde.</p><div id="initial-license-fields" class="fields"><label>Inicio (opcional)<input type="date" name="initialStart"></label><label>Vencimiento (opcional)<input type="date" name="initialEnd"></label><label>Importe del periodo sin IVA (opcional)<input type="number" name="initialAmount" min="0" step="0.01"></label><label>Moneda<select name="initialCurrency">'+opts(['EUR','USD','GBP','MXN','CLP','BRL','COP','PEN'],'EUR')+'</select></label></div><p class="sub">No se inventan fechas ni importes. Los datos que falten se completan en la licencia.</p></section>';
}
async function persistAccountLicense(entry){
  if(entry.saving)return;
  entry.saving=true;
  const form=$('editor'),submit=form.querySelector('[type=submit]');
  form.querySelectorAll('input,select,textarea,button').forEach(el=>el.disabled=true);
  $('form-error').textContent='';
  try{
    await crmConnection.request('rpc/crm_create_account_license',{method:'POST',body:JSON.stringify(entry.creationPayload)});
    entry.creationComplete=true;
    if(editor!==entry)return;
    $('modal').close();await load();
    toast('Cuenta y licencia inicial creadas');
    const license=get(entry.initialLicenseId);if(license)showEditor(license);
  }catch(error){
    if(editor!==entry||!$('form-error'))return;
    $('form-error').textContent=error.code==='PGRST202'?'Activa primero la consulta 12 en Supabase. Puedes cerrar esta ventana y reintentar después.':error.message+' Reintenta desde esta ventana para conservar los mismos identificadores.';
    submit.disabled=false;submit.textContent='Reintentar creación';
  }finally{entry.saving=false;}
}
function showEditor(row,kind='opportunity'){
  const d=row?.data||{licenseStatus:'Por renovar',id:crypto.randomUUID(),kind,project:view==='project'?project:kind==='goal'?fProject:'',stage:'Prospección',priority:'Por revisar',accountRole:'Por clasificar',currency:'EUR',quarter:fQuarter,reviewDate:today()};
  editor={row,data:d,...(!row&&kind==='client'?{initialLicenseId:crypto.randomUUID()}: {})};
  const title=row?d.name:kind==='client'?'Nueva cuenta':kind==='license'?'Nueva licencia':kind==='goal'?'Nuevo objetivo':kind==='review'?'Registrar revisión semanal':'Nueva oportunidad';
  $('modal-content').innerHTML='<header class="dialog-head"><div><span class="record-kind">'+esc(d.kind==='client'?'Cuenta':d.kind==='opportunity'?'Oportunidad':d.kind==='license'?'Licencia':'Ficha')+'</span><h2>'+esc(title)+'</h2></div>'+button('close','✕','aria-label="Cerrar ficha"')+'</header>'+
  '<div class="dialog-body">'+(d.kind==='license'?'<p class="sub">'+esc(accountRole(d))+' · '+esc(channelSummary(d))+' (canal de origen) · Pagador: '+esc(payerDisplay(d))+' · Responsable: '+esc(commercialOwner(d).commercialOwnerName||'Por asignar')+'.</p>':['client','opportunity'].includes(d.kind)?'<p class="editor-intro">'+(d.kind==='client'?'Cuenta · contactos, seguimiento y compras':'Oportunidad · próximos pasos, valor y cierre')+'</p>':'')+'<form id="editor">'+editorFields(d)+(!row&&d.kind==='client'?initialLicenseFields():'')+
  (d.sourceUrl?'<p class="sub"><a target="_blank" rel="noopener" href="'+esc(d.sourceUrl)+'">Abrir archivo de origen ↗</a></p>':'')+
  '<p id="form-error" class="error" role="alert"></p><div class="dialog-foot">'+(row?button('history','Ver historial','data-id="'+esc(d.id)+'"'):'')+
  (row&&['client','opportunity','license'].includes(d.kind)?button('activity','Actualizar','data-id="'+esc(d.id)+'"'):'')+
  (row&&d.kind==='license'?licensePeriodButton(d):'')+'<button type="submit" class="primary">Guardar</button></div></form>'+importOriginDetails(d)+(row&&d.kind==='client'?'<details class="editor-section"><summary>Compras y licencias</summary>'+accountPurchases(d)+'</details>':'')+(row?'<details class="editor-section editor-activity"><summary>Actividad y comunicaciones</summary>'+activityTimeline(d)+'</details>':'')+'<div id="history"></div></div>';
  syncMunicipalityVisibility();syncConditionalRequired();syncPotential();syncOperationValue();
  if(!$('modal').open)$('modal').showModal();
  $('modal').scrollTop=0;
}
async function save(d,version,reason){
  return api('/'+d.id,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({data:d,version,reason})});
}
async function showRecordHistory(id){
  const target=$('history');target.textContent='Cargando historial…';
  try{
    const versions=await api('/'+id);
    if(!$('modal').open||$('history')!==target)return;
    target.innerHTML='<h3>Historial de versiones</h3>'+versions.map((r,i)=>{
      const d=r.data;
      const items=fieldsFor(d).filter(([k])=>value(d[k])).map(([k,l,type])=>'<dt>'+esc(l)+'</dt><dd>'+esc(type==='contacts'?contactSummary(readContacts(d)):k==='linked'?(get(d[k])?.data.name||d[k]):['forecastCategory','renewalForecastCategory'].includes(k)?forecastCategoryLabel(d[k]):d[k])+'</dd>').join('');
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
  if(editor.creationPayload){await persistAccountLicense(editor);return;}
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
    if(d.kind==='client')applyPotential(d);
    if(d.kind==='opportunity'){applyPotential(d);applyOperationValue(d);validateOpportunityForecast(d);}
    if(['client','opportunity'].includes(d.kind)){
      d.municipalityNotApplicable=form.has('municipalityNotApplicable');
      if(d.country==='España'&&!d.municipalityNotApplicable&&!d.municipalityCode)throw Error('Selecciona el municipio o marca No corresponde si la cuenta no es municipal.');
      const typed=e.target.elements.municipalitySearch?.value.trim();
      if(typed&&!municipalityMatch(typed))throw Error('Selecciona un municipio de las sugerencias o deja el buscador vacío.');
      if(typed&&municipalityMatch(typed)?.[0]!==d.municipalityCode)throw Error('Selecciona el municipio para completar su ubicación.');
      if(d.municipalityCode){const m=municipalityByCode(d.municipalityCode);if(!m)throw Error('El municipio seleccionado no está en el catálogo.');[d.municipality,d.province,d.autonomousCommunity]=m.slice(1);}
      if(d.kind==='client'&&d.entityType==='Ayuntamiento'&&d.municipalityCode&&entries('client').some(r=>r.data.id!==d.id&&r.data.project===d.project&&r.data.entityType==='Ayuntamiento'&&r.data.municipalityCode===d.municipalityCode))throw Error('Este Ayuntamiento ya tiene una cuenta en el proyecto. Abre esa cuenta para añadir el departamento o la ampliación.');
      if(!channelTypes.includes(d.channelType))throw Error('Selecciona el canal comercial.');
      if(d.channelType==='Venta directa')d.channelPartner='';
      else{
        d.channelPartner=canonicalPartner(d.channelPartner);
        if(!d.channelPartner)throw Error('Indica el distribuidor o colaborador.');
      }
    }
    if(['opportunity','license'].includes(d.kind)){
      for(const [status,date] of [['paymentStatus','paymentDate'],...(d.kind==='license'?[['renewalPaymentStatus','renewalPaymentDate']]:[])]){
        if(d[status]==='Pagado'&&!d[date])throw Error('Indica la fecha de cobro para marcar Pagado.');
        if(d[status]!=='Pagado'&&d[date])throw Error('Marca Pagado o borra la fecha de cobro.');
      }
      if(d.kind==='opportunity'){
        if(d.accountId){const account=get(d.accountId)?.data;if(!account||account.kind!=='client'||account.project!==d.project)throw Error('Selecciona una cuenta del mismo proyecto.');}
        if(d.paymentStatus==='Pagado'&&(d.stage!=='Cierre ganado'||!d.closeDate||!value(d.amount)))throw Error('Para registrar un cobro, confirma la venta como Cierre ganado, con importe y fecha de cierre.');
      }else{
        if(d.paymentStatus==='Pagado'&&(!d.saleDate||!value(d.amount)||d.previousLicenseId))throw Error('Registra el cobro del periodo inicial con fecha de venta e importe. Si procede de una renovación, registra el cobro en la licencia anterior.');
        if(d.renewalPaymentStatus==='Pagado'&&(renewalStatus(d)!=='Renovado'||!d.renewalCloseDate||!value(d.renewalAmount)))throw Error('Confirma la renovación con importe y fecha de cierre antes de registrar su cobro.');
      }
    }
    if(d.kind==='license'){
      if(d.licenseStatus==='Renovado')d.renewalForecastCategory='Confirmada';else if(d.licenseStatus==='Finalizada')d.renewalForecastCategory='Fuera de previsión';else if(value(d.renewalAmount)&&!['Probable','Posible','Fuera de previsión'].includes(d.renewalForecastCategory))throw Error('Clasifica la renovación: Cierre previsto, En evaluación o Sin fecha de decisión.');
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
      if(!linked||linked.project!==d.project||quarterFor(linked.closeDate)!==d.quarter||!value(linked.amount)||!(linked.stage==='Cierre ganado'||(active(linked)&&['Probable','Posible'].includes(forecastCategoryFor(linked)))))throw Error('La oportunidad vinculada debe tener importe, categoría de previsión (o estar ganada) y fecha de cierre en el mismo proyecto y trimestre.');
    }
    if(['opportunity','license','client'].includes(d.kind)&&data.next!==d.next&&data.actionDoneAt)delete d.actionDoneAt;
    if(!row&&d.kind==='client'&&form.has('createInitialLicense')){
      const start=String(form.get('initialStart')||''),end=String(form.get('initialEnd')||''),amount=String(form.get('initialAmount')||'');
      if(start&&end&&end<start)throw Error('El vencimiento debe ser posterior o igual al inicio de la licencia');
      if(amount!==''&&(!Number.isFinite(Number(amount))||Number(amount)<0))throw Error('Revisa el importe de la licencia');
      editor.creationPayload={p_account_id:d.id,p_license_id:editor.initialLicenseId,p_project_id:projectIds[d.project],p_account_data:d,p_license_data:{startDate:start,endDate:end,amount,department:d.department||'',currency:String(form.get('initialCurrency')||'EUR')},p_reason:String(form.get('reason')||'')};
      await persistAccountLicense(editor);return;
    }
    await save(d,row?.version??-1,String(form.get('reason')??''));
    $('modal').close();await load();toast('Versión guardada');
  }catch(err){if(err.status===409)await load();$('form-error').textContent=err.message;submit.disabled=false;}
});
document.addEventListener('input',e=>{
  if(e.target.name==='renewalAmount'&&e.target.closest('#editor'))syncConditionalRequired();
  if(e.target.closest('#editor')&&['operationUsers','budgetAmount','confirmedAmount','amount'].includes(e.target.name)){if(e.target.name==='amount')editor.operationManual=true;syncOperationValue();}
  if(e.target.name==='potentialUsers'&&e.target.closest('#editor'))syncPotential();
  if(e.target.id==='municipality-search'){municipalitySuggestions(e.target.value);const f=e.target.form;if(f?.elements.municipalityCode)f.elements.municipalityCode.value='';if($('municipality-location'))$('municipality-location').textContent='Selecciona un resultado para confirmar la ubicación.';updateMunicipalAccountName();}

  if(e.target.name==='entityType'&&e.target.closest('#editor'))updateMunicipalAccountName();
  if(e.target.id==='customer-query'){customerQuery=e.target.value;$('customer-results').innerHTML=customerResults();}
  if(e.target.id==='query'){query=e.target.value;$('results').innerHTML=resultTable();}
});
document.addEventListener('change',e=>{
  const el=e.target;
  if(el.name==='project'&&el.closest('#editor')){syncPotential();syncOperationValue();}
  if(el.closest('#editor')&&['forecastBasis','stage','quoteStatus','forecastCategory'].includes(el.name))syncOperationValue();
  if(['paymentStatus','renewalPaymentStatus','payerType','licenseStatus'].includes(el.name)&&el.closest('#editor'))syncConditionalRequired();
  if(el.id==='municipality-search'){if(el.value.trim())selectMunicipality(el.value);else{for(const k of ['municipalityCode','municipality','province','autonomousCommunity'])if(el.form.elements[k])el.form.elements[k].value='';$('municipality-notice').textContent='';$('municipality-location').textContent='Sin municipio asignado';updateMunicipalAccountName();}}
  if(el.closest('#editor')&&['marketSector','country'].includes(el.name))syncMunicipalityVisibility();
  if(el.closest('#editor')&&el.name==='entityType')updateMunicipalAccountName();
  if(el.id==='municipality-not-applicable'){if(el.checked){for(const k of ['municipalityCode','municipality','province','autonomousCommunity','municipalitySearch'])el.form.elements[k].value='';$('municipality-notice').textContent='';$('municipality-location').textContent='Sin municipio asignado';} $('municipality-search-area').hidden=el.checked;syncMunicipalityVisibility();}
  if(el.closest('#editor')&&el.name==='accountId'){const a=get(el.value)?.data;const f=el.form;if(a&&f.elements.department&&!f.elements.department.value)f.elements.department.value=a.department||'';}
  if(el.closest('#editor')&&el.name==='clientId'){const a=get(el.value)?.data;if(a&&el.form.elements.department&&!el.form.elements.department.value)el.form.elements.department.value=a.department||'';}
  if(el.id==='sales-period'){salesPeriod=el.value;render();}
  if(el.id==='sales-project'){salesProject=el.value;render();}
  if(el.id==='sales-currency'){salesCurrency=el.value;render();}
  if(el.id==='create-initial-license'){$('initial-license-fields').hidden=!el.checked;$('initial-license-fields').querySelectorAll('input,select').forEach(input=>input.disabled=!el.checked);}
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
      partner.disabled=el.value==='Venta directa';partner.required=!partner.disabled;partner.closest('label').hidden=partner.disabled;
      if(partner.disabled)partner.value='';
    }
  }
  if(el.id==='customer-market'){customerMarket=el.value;render();}
  if(el.id==='customer-entity'){customerEntity=el.value;render();}
  if(editor?.data.kind==='license'&&el.closest('#editor')&&el.name==='clientId'&&$('license-classification'))$('license-classification').outerHTML=licenseClassification({...editor.data,clientId:el.value});
  if(el.id==='customer-role'){customerRole=el.value;render();}
  if(el.id==='customer-channel'){customerChannel=el.value;customerPartner='';render();}
  if(el.id==='customer-partner'){customerPartner=el.value;render();}
  if(el.id==='forecast-channel'){fChannel=el.value;fPartner='';render();}
  if(el.id==='forecast-partner'){fPartner=el.value;render();}
  if(el.id==='customer-project'){customerProject=el.value;render();}
  if(el.id==='license-filter'){licenseFilter=el.value;render();}
  if(el.id==='renewal-state-filter'){renewalStateFilter=el.value;render();}
  if(editor?.data.kind==='opportunity'&&el.closest('#editor')&&el.name==='project'){
    const form=el.closest('form');form.elements.accountId.parentElement.outerHTML=formField(fields.find(([k])=>k==='accountId'),{project:el.value});
  }
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
  if(action==='pipeline-bucket'&&['open','closed','paused','all'].includes(key)){pipelineBucket=key;delete filters.stage;render();}
  if(action==='clear'){filters={};query='';render();}
  if(action==='reload')await load();
  if(action==='logout')await crmConnection.logout();
  if(action==='export')exportRecords();
  if(action==='new')showEditor(null);
  if(action==='client-tab'){clientTab=key;customerRole='';render();}
  if(action==='account-view'){clientTab='clients';customerRole=key;render();}
  if(action==='add-contact'){
    const list=$('contact-editor-list');
    list.insertAdjacentHTML('beforeend',contactEditorRow({}));
  }
  if(action==='remove-contact')el.closest('.contact-edit-row').remove();
  if(action==='add-purchase'&&row){showEditor(null,'opportunity');editor.data={...editor.data,project:row.data.project,accountId:id,department:row.data.department||'',channelType:channelDetails(row.data).channelType,channelPartner:channelDetails(row.data).channelPartner,stage:'Cierre ganado',paymentStatus:'Por confirmar'};const d=editor.data;document.getElementById('editor').innerHTML=editorFields(d)+'<p id="form-error" class="error" role="alert"></p><div class="dialog-foot"><button type="submit" class="primary">Guardar compra</button></div>';document.querySelector('.dialog-head h2').textContent='Añadir compra · '+row.data.name;syncMunicipalityVisibility();syncConditionalRequired();syncPotential();syncOperationValue();}
  if(action==='municipal-name')updateMunicipalAccountName(true);
  if(action==='expansion'&&row)showExpansion(row);
  if(action==='operation-copy-potential'){const f=$('editor');if(f.elements.potentialUsers.value){f.elements.operationUsers.value=f.elements.potentialUsers.value;editor.useOperationEstimate=true;editor.operationManual=false;syncOperationValue();}}
  if(action==='operation-estimate'){editor.useOperationEstimate=true;editor.operationManual=false;syncOperationValue();}
  if(action==='potential-recalculate')syncPotential(true);
  if(action==='quick-open'){location.hash='quick/'+id+'/'+(row?.version??0);}
  if(action==='quick-full'&&row&&!quickState?.saving)showEditor(row);
  if(action==='new-client')showEditor(null,'client');
  if(action==='new-license')showEditor(null,'license');
  if(action==='goal'||action==='review')showEditor(null,action);
  if(action==='open'&&row)showEditor(row);
  if(action==='activity'&&row)showActivity(row);
  if(action==='renew-license'&&row)showRenewal(row);
  if(action==='close'){if(editor?.creationPayload&&$('editor')&&!editor.creationComplete){if(editor.saving)return;if(!confirm('La solicitud puede haberse guardado. Comprueba la cuenta antes de volver a crearla. ¿Cerrar?'))return;}$('modal').close();}
  if(action==='history')await showRecordHistory(id);
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
  rows=[];editor=null;operation=null;quickState=null;error='';
  $('page').textContent='Inicia sesión para consultar el CRM.';
  $('modal-content').textContent='';
});
setInterval(()=>{
  if(view!=='quick'&&crmConnection.isSignedIn()&&!document.hidden&&!$('modal').open&&!document.activeElement?.matches('input,select,textarea'))load();
},60000);


function exportRecords(){
  const data=view==='clients'?customerData():(view==='pipeline'||view==='project')?filtered():opportunities();
  const columns=(view==='clients'?(clientTab==='licenses'?licenseFields:clientFields):fields).flatMap(([key,label])=>key==='contacts'?
    [['_contactName','Nombre del contacto'],['_contactEmail','Email'],['_contactPhone','Teléfono'],['_contactRole','Cargo']]:[[key,label]]);
  if(view==='clients'&&clientTab==='licenses')columns.splice(2,0,['marketSector','Sector público / privado'],['entityType','Tipo de organismo'],['department','Departamento / colectivo'],['municipality','Municipio'],['province','Provincia'],['accountRole','Tipo de cuenta'],['channelType','Canal comercial'],['channelPartner','Partner / distribuidor']);
  const csvCell=value=>'"'+String(value??'').replace(/^[=+@\t\r-]/,"'$&").replace(/"/g,'""')+'"';
  const csv=[columns.map(([,label])=>csvCell(label)).join(';'),...data.map(row=>columns.map(([key])=>csvCell(exportValue(row,key))).join(';'))].join('\r\n');
  const url=URL.createObjectURL(new Blob(['\ufeff',csv],{type:'text/csv;charset=utf-8'}));
  const link=document.createElement('a');
  link.href=url;link.download='KairuTech_seguimiento_'+today()+'.csv';
  link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

const clientFields=[
  ['name','Cuenta / entidad','text',true],['project','Proyecto',projects,true],['accountRole','Tipo de cuenta',accountRoles],...channelFields,
  ['clientStatus','Situación',['Actual','En pausa','Baja']],...ownerFields,...responseFields,
  ['marketSector','Sector público / privado',marketSectors],['entityType','Tipo de organismo','entity'],['department','Departamento / colectivo','department'],...locationFields,['sector','Actividad / sector específico'],['country','País','country'],['region','Región','region'],
  ['contacts','Contactos','contacts'],...potentialFields,
  ['next','Próxima acción','textarea'],['nextDate','Fecha de seguimiento','date'],
  ['priority','Prioridad',priorities],['risk','Riesgo / datos por confirmar','textarea'],
  ['source','Fuente','textarea'],['notes','Notas de seguimiento','textarea']
];
const licenseFields=[
  ['name','Licencia / contrato','text',true],['project','Proyecto',projects,true],
  ['clientId','Cuenta titular de la licencia','client',true],['department','Departamento / colectivo contratado','department'],
  ['licenseStatus','Estado de renovación',['Por renovar','Renovado','Finalizada'],true],
  ['priority','Prioridad',priorities],
  ['startDate','Fecha de inicio','date'],['endDate','Fecha de vencimiento','date'],
  ['renewalNotice','Fecha de aviso de renovación','date'],
  ['users','Usuarios contratados'],['amount','Importe del periodo','amount'],
  ['currency','Moneda',['EUR','USD','GBP','MXN','CLP']],
  ['renewalTerms','Condiciones de renovación','textarea'],
  ...ownerFields,...responseFields,
  ['payerType','Quién paga',['Por confirmar','Cliente','Partner / distribuidor','Otra entidad']],
  ['payerName','Nombre del pagador (si difiere del cliente o partner)'],
  ...quoteFields,
  ['saleDate','Fecha de venta del periodo inicial','date'],...paymentFields,
  ['renewalPaymentStatus','Cobro de la renovación',['Por confirmar','Pendiente de pago','Pagado']],['renewalPaymentDate','Fecha de cobro de la renovación','date'],['renewalInvoiceReference','Factura de renovación'],['renewalPayer','Pagador de la renovación'],
  ['renewalAmount','Importe presupuesto de renovación sin IVA','amount'],
  ['renewalForecastCategory','Previsión de renovación',forecastCategories],['renewalProbability','Probabilidad anterior de renovación (%)','historical'],
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
    (!customerRole||accountRole(d)===customerRole)&&
    (!customerMarket||classification(d).marketSector===customerMarket)&&
    (!customerEntity||classification(d).entityType===customerEntity)&&
    (!customerChannel||channelDetails(d).channelType===customerChannel)&&
    (!customerPartner||channelDetails(d).channelPartner===customerPartner)&&
    (kind!=='license'||renewalStateFilter==='all'||renewalStatus(d)===renewalStateFilter)&&
    (!customerQuery||normalize([d.name,d.contact,d.next,classification(d).marketSector,classification(d).entityType,d.department,publicLocation(d).municipality,publicLocation(d).province,get(d.clientId)?.data.name,channelDetails(d).channelPartner,commercialOwner(d).commercialOwnerName].join(' ')).includes(normalize(customerQuery)))&&
    (kind!=='license'||licenseFilter==='all'||licenseTiming(d).key===licenseFilter)
  ).sort((a,b)=>kind==='license'?(a.endDate||'z').localeCompare(b.endDate||'z'):a.name.localeCompare(b.name,'es'));
}
function customerResults(){
  const data=customerData();
  if(!data.length)return blank('No hay registros en esta vista.');
  const licenses=clientTab==='licenses',showProject=!customerProject;
  const date=d=>d?new Intl.DateTimeFormat('es-ES',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'Europe/Madrid'}).format(new Date(d+'T12:00Z')):'—';
  const origin=d=>{const channel=channelDetails(d);return channel.channelType==='Venta directa'?'Venta directa':channel.channelPartner||channel.channelType;};
  const columns=licenses?'<th>Cuenta titular</th><th>Departamento / colectivo</th><th>Origen</th><th>Estado</th><th>Vencimiento</th>':'<th>Tipo</th><th>Departamento / colectivo</th><th>Municipio</th><th>Origen</th><th>Contacto</th><th>Email</th><th>Teléfono</th>';
  const body=data.map(d=>{
    let details;
    if(licenses){
      const status=renewalStatus(d);
      details='<td>'+esc(get(d.clientId)?.data.name||'—')+'</td><td>'+esc(d.department||'—')+'</td><td>'+esc(origin(d))+'</td><td>'+tag(status,status==='Renovado'?'green':status==='Finalizada'?'neutral':'warm')+'</td><td class="nobr">'+esc(date(d.endDate))+'</td>';
    }else{
      const contacts=readContacts(d),cell=key=>contacts.length?contacts.map(c=>'<div class="contact-line">'+esc(c[key]||'—')+'</div>').join(''):'—';
      details='<td>'+esc(accountRole(d))+'</td><td>'+esc(d.department||'—')+'</td><td>'+esc(publicLocation(d).municipality||'—')+'</td><td>'+esc(origin(d))+'</td><td>'+cell('name')+'</td><td>'+cell('email')+'</td><td>'+cell('phone')+'</td>';
    }
    return '<tr><td>'+openBtn(d,d.name)+'</td>'+(showProject?'<td>'+esc(d.project)+'</td>':'')+details+'<td>'+esc(d.next||'—')+'</td><td class="nobr">'+esc(date(d.nextDate))+'</td></tr>';
  }).join('');
  return '<div class="scroll"><table class="crm-list"><thead><tr><th>'+(licenses?'Licencia':'Cuenta')+'</th>'+(showProject?'<th>Proyecto</th>':'')+columns+'<th>Próxima acción</th><th>Fecha</th></tr></thead><tbody>'+body+'</tbody></table></div>';
}

function clients(){
  return head('Cuentas y licencias','Clientes finales y partners / distribuidores. El canal indica de dónde procede la relación.',
    '<div class="top-actions">'+button('new-client','＋ Cuenta')+button('new-license','＋ Licencia','','primary')+'</div>')+
    '<div class="chips">'+[['','Todas las cuentas'],['Cliente final','Clientes finales'],['Partner / distribuidor','Partners / distribuidores']].map(([role,label])=>button('account-view',label,'data-key="'+role+'"',clientTab==='clients'&&customerRole===role?'selected':'')).join('')+
    button('client-tab','Licencias','data-key="licenses"',clientTab==='licenses'?'selected':'')+'</div>'+
    '<section class="card"><div class="filters"><label class="filter-search">Buscar<input id="customer-query" type="search" value="'+esc(customerQuery)+'" placeholder="Cliente, contacto o acción"></label>'+
    '<label>Proyecto<select id="customer-project">'+opts(projects,customerProject,'Todos')+'</select></label>'+
    '<label>Tipo de cuenta<select id="customer-role">'+opts(accountRoles,customerRole,'Todos')+'</select></label>'+
    '<label>Sector público / privado<select id="customer-market">'+opts(marketSectors,customerMarket,'Todos')+'</select></label>'+
    '<label>Tipo de organismo<select id="customer-entity">'+opts(knownEntityTypes(),customerEntity,'Todos')+'</select></label>'+
    '<label>Canal de origen<select id="customer-channel">'+opts(channelTypes,customerChannel,'Todos')+'</select></label>'+
    '<label>Partner / distribuidor<select id="customer-partner">'+opts(knownPartners(),customerPartner,'Todos')+'</select></label>'+
    (clientTab==='licenses'?'<label>Estado<select id="renewal-state-filter">'+opts([['all','Todos'],['Por renovar','Por renovar'],['Renovado','Renovado'],['Finalizada','Finalizada']],renewalStateFilter)+'</select></label><label>Vencimiento<select id="license-filter">'+opts([['all','Todos'],['past','Periodo vencido'],['30','Hasta 30 días'],['60','De 31 a 60 días'],['90','De 61 a 90 días'],['later','Más de 90 días'],['closed','Renovadas / finalizadas'],['unknown','Sin fecha']],licenseFilter)+'</select></label>':'')+
    '</div><div id="customer-results">'+customerResults()+'</div></section>';
}



function renewalStart(d){
  return d.renewalNotice || (d.endDate?addDays(d.endDate,-90):'');
}

function renewalOpportunities(){
  return entries('license').map(row=>row.data).filter(d=>{
    if(['Renovado','Finalizada'].includes(renewalStatus(d))){
      return true;
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
      ...classification(d),
      accountRole:accountRole(d),
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
  if(['forecastCategory','renewalForecastCategory'].includes(key))return forecastCategoryLabel(row[key]);
  if(['municipality','province','autonomousCommunity'].includes(key))return publicLocation(row)[key];
  if(['marketSector','entityType'].includes(key))return classification(row)[key];
  if(key==='accountRole')return accountRole(row);
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
  const original=source?.channelType;
  const channelType=['Distribuidor','Colaborador','Partner'].includes(original)?'Partner / distribuidor':original||'Por clasificar';
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
  return [...new Set(['SATARA SEGURIDAD',...rows.filter(r=>r.data.kind==='client'&&accountRole(r.data)==='Partner / distribuidor').map(r=>canonicalPartner(r.data.name)),...rows.filter(r=>['client','opportunity'].includes(r.data.kind)).map(r=>channelDetails(r.data).channelPartner).filter(Boolean)])]
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
  if(record.payerType==='Partner / distribuidor')return channelDetails(record).channelPartner||'Partner por indicar';
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
      '<td>'+button('activity','Actualizar','data-id="'+esc(d.id)+'"')+'</td></tr>';
  }).join('');
  return dashboardSection('contact-list','A quién contactar',data.length,controls+
    (data.length?'<div class="scroll"><table><thead><tr><th>Cuenta y contacto</th><th>Motivo</th><th>Responsable</th><th>Próximo paso</th><th></th></tr></thead><tbody>'+body+'</tbody></table></div>':blank('No hay seguimientos en este periodo.')));
}

function forecastReadiness(data){
  const pending=data.filter(d=>active(d)||d.stage==='Cierre ganado').map(d=>{
    const missing=[];
    if(!value(d.amount))missing.push('importe');
    if(forecastCategoryFor(d)==='Por clasificar')missing.push('previsión por clasificar');
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
  showOperation('Actualizar seguimiento · '+d.name,'<form id="activity-form"><div class="fields">'+
    inputs.map(field=>formField(field,{type:'Llamada',date:today(),next:d.next||'',nextDate:d.nextDate||'',responseStatus:d.responseStatus||''})).join('')+
    '</div><p id="operation-error" class="error" role="alert"></p><div class="dialog-foot">'+
    '<button type="submit" class="primary">Guardar actualización</button></div></form>');
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
    ['payerType','Quién paga',['Por confirmar','Cliente','Partner / distribuidor','Otra entidad'],true],
    ['payerName','Nombre del pagador (si es otra entidad)'],
    ['users','Usuarios contratados'],
    ['department','Departamento / colectivo del nuevo periodo','department'],
    ['renewalTerms','Condiciones del nuevo periodo','textarea'],
    ['notes','Notas del nuevo periodo','textarea']
  ];
  showOperation('Renovar licencia','<p>'+esc(get(d.clientId)?.data.name||d.name)+'</p>'+
    '<p class="sub">Confirma las fechas y el importe del nuevo periodo. El anterior quedará renovado y conservará su histórico. El aviso del siguiente periodo se programará 90 días antes de vencer.</p>'+
    '<form id="renewal-form"><div class="fields">'+inputs.map(field=>formField(field,{
      amount:d.renewalAmount||'',currency:d.currency||'EUR',closeDate:today(),
      department:d.department||'',payerType:d.payerType||'Por confirmar',payerName:d.payerName||'',users:d.users||'',renewalTerms:d.renewalTerms||''
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
    id,project:old.project,kind:'license',clientId:old.clientId,startDate,endDate,amount,department:String(form.get('department')??old.department??'').trim(),
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


$('modal').addEventListener('cancel',event=>{if(editor?.creationPayload&&$('editor')&&!editor.creationComplete){event.preventDefault();if(!editor.saving&&confirm('Comprueba la cuenta y sus licencias antes de crearla otra vez. ¿Cerrar?'))$('modal').close();}});


// One commercial operation per source record/period; payments use their own date.
let salesPeriod=quarterFor(today()),salesProject='',salesCurrency='EUR';
function commercialLedger(){
  const list=[];
  for(const {data:d} of rows){
    if(d.kind==='opportunity')list.push({id:d.id,account:d.accountId||'',project:d.project,name:d.name,department:d.department||'',amount:d.amount,currency:d.currency||'EUR',status:d.stage==='Cierre ganado'?'Confirmado':['Cierre perdido','En pausa'].includes(d.stage)||d.quoteStatus==='Rechazado'?'Excluido':d.amountOrigin?.startsWith('Estimado')?'Estimado':'Presupuestado',date:d.closeDate||'',payment:d.paymentStatus||'Por confirmar',paidDate:d.paymentDate||'',invoice:d.invoiceReference||'',payer:d.payer||''});
    if(d.kind==='license'){
      // A period produced by renewal is already represented by the previous record's renewal.
      if(!d.previousLicenseId)list.push({id:d.id,account:d.clientId,project:d.project,name:d.name+' · Periodo contratado',department:d.department||'',amount:d.amount,currency:d.currency||'EUR',status:d.saleDate?'Confirmado':'Por confirmar',date:d.saleDate||'',payment:d.paymentStatus||'Por confirmar',paidDate:d.paymentDate||'',invoice:d.invoiceReference||'',payer:d.payer||''});
      if(value(d.renewalAmount)||d.renewalCloseDate||d.quoteReference)list.push({id:d.id,account:d.clientId,project:d.project,name:d.name+' · Renovación',department:d.department||'',amount:d.renewalAmount,currency:d.currency||'EUR',status:renewalStatus(d)==='Renovado'?'Confirmado':renewalStatus(d)==='Finalizada'||d.quoteStatus==='Rechazado'?'Excluido':'Presupuestado',date:d.renewalCloseDate||'',payment:d.renewalPaymentStatus||'Por confirmar',paidDate:d.renewalPaymentDate||'',invoice:d.renewalInvoiceReference||'',payer:d.renewalPayer||''});
    }
  }
  return list;
}
function inSalesPeriod(date,period=salesPeriod){return Boolean(date)&&(period==='all'||(period.includes('-T')?quarterFor(date)===period:date.slice(0,4)===period));}
function salesTotals(list,period=salesPeriod){
 const total={quoted:0,won:0,pending:0,paid:0,unconfirmed:0};
 for(const d of list){
  if(!value(d.amount)||!Number.isFinite(Number(d.amount))||Number(d.amount)<0)continue;
  const n=Number(d.amount);
  if(inSalesPeriod(d.date,period)){
   if(d.status==='Presupuestado')total.quoted+=n;
   if(d.status==='Confirmado'){total.won+=n;if(d.payment==='Pendiente de pago')total.pending+=n;else if(d.payment!=='Pagado')total.unconfirmed+=n;}
  }
  if(d.status==='Confirmado'&&d.payment==='Pagado'&&inSalesPeriod(d.paidDate,period))total.paid+=n;
 }
 return total;
}
function purchaseTable(list){
 return list.length?'<div class="scroll"><table><thead><tr><th>Compra / concepto</th><th>Cuenta</th><th>Departamento / colectivo</th><th>Venta / cierre previsto</th><th>Importe sin IVA</th><th>Estado comercial</th><th>Cobro</th><th>Fecha de cobro</th><th>Factura / pagador</th></tr></thead><tbody>'+list.slice().sort((a,b)=>(b.date||'').localeCompare(a.date||'')).map(d=>'<tr><td>'+openBtn({id:d.id},d.name)+'</td><td>'+esc(get(d.account)?.data.name||'Sin vincular')+'</td><td>'+esc(d.department||'—')+'</td><td>'+esc(d.date||'Por confirmar')+'</td><td>'+esc(value(d.amount)?money(Number(d.amount),d.currency):'Por confirmar')+'</td><td>'+tag(d.status)+'</td><td>'+esc(d.status==='Confirmado'?d.payment:'—')+'</td><td>'+esc(d.status==='Confirmado'&&d.payment==='Pagado'?d.paidDate||'Por confirmar':'—')+'</td><td>'+esc([d.invoice,d.payer].filter(Boolean).join(' · ')||'—')+'</td></tr>').join('')+'</tbody></table></div>':blank('Todavía no hay operaciones en esta selección.');
}
function accountPurchases(d){
 const data=commercialLedger().filter(x=>x.account===d.id);
 return '<section class="editor-section"><h3>Compras y licencias</h3><p class="sub">Histórico completo. Abre una operación para actualizar sus datos. Los importes se muestran por moneda.</p>'+button('add-purchase','＋ Añadir compra','data-id="'+esc(d.id)+'"')+' '+button('expansion','＋ Ampliación','data-id="'+esc(d.id)+'"')+purchaseTable(data)+'</section>';
}
function sales(){
 const all=commercialLedger(),years=[...new Set([today().slice(0,4),...all.flatMap(d=>[d.date,d.paidDate]).filter(Boolean).map(d=>d.slice(0,4))])].sort().reverse();
 const periods=[['all','Todo el histórico'],...years.flatMap(y=>[[y,'Año '+y],...[1,2,3,4].map(q=>[y+'-T'+q,'T'+q+' '+y])])];
 const currencies=[...new Set(['EUR',...all.map(d=>d.currency)])];
 const data=all.filter(d=>(!salesProject||d.project===salesProject)&&d.currency===salesCurrency),t=salesTotals(data);
 const selected=data.filter(d=>salesPeriod==='all'||inSalesPeriod(d.date)||d.status==='Confirmado'&&d.payment==='Pagado'&&inSalesPeriod(d.paidDate));
 const unknown=data.filter(d=>!d.date||!value(d.amount)||d.status==='Confirmado'&&d.payment==='Pagado'&&!d.paidDate);
 return head('Ventas y cobros','Presupuestos, ventas confirmadas y cobros. Cada operación conserva sus versiones.')+
 '<section class="card"><div class="filters"><label>Periodo<select id="sales-period">'+opts(periods,salesPeriod)+'</select></label><label>Proyecto<select id="sales-project">'+opts(projects,salesProject,'Todos')+'</select></label><label>Moneda<select id="sales-currency">'+opts(currencies,salesCurrency)+'</select></label></div></section>'+
 '<div class="grid metrics">'+metric('Presupuestado abierto',money(t.quoted,salesCurrency),'Sin ponderar · fecha de cierre prevista')+metric('Ventas confirmadas',money(t.won,salesCurrency),'Fecha de venta · sin IVA')+metric('Pendiente de cobro',money(t.pending,salesCurrency),'Ventas del periodo · pendiente confirmado')+metric('Cobrado',money(t.paid,salesCurrency),'Fecha de cobro · sin IVA')+'</div>'+
 '<p class="sub">Cobro por confirmar en ventas del periodo: '+esc(money(t.unconfirmed,salesCurrency))+'. Los contadores no se suman entre sí. Las monedas no se convierten. Pendiente de cobro refleja el estado actual de las ventas del periodo.</p>'+
 '<section class="card">'+cardHead('Historial del periodo')+purchaseTable(selected)+'</section>'+
 '<details class="card"><summary>Datos pendientes de completar · '+unknown.length+'</summary><p class="sub">Sin importe o fecha no se incluye la cifra en los totales del periodo. No se presupone que una licencia esté cobrada.</p>'+purchaseTable(unknown)+'</details>';
}


function normalizeMunicipality(s){return String(s??'').normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().trim();}
function municipalityByCode(code){return (window.crmMunicipalities?.municipalities||[]).find(m=>m[0]===code);}
function municipalityLabel(m){return m[1]+' — '+m[2];}
function municipalityMatch(input){
 const list=window.crmMunicipalities?.municipalities||[],n=normalizeMunicipality(input);
 const exact=list.find(m=>municipalityLabel(m)===input||m[0]===input);if(exact)return exact;
 const matches=list.filter(m=>normalizeMunicipality(m[1])===n);return matches.length===1?matches[0]:null;
}
function municipalAccountName(m){return 'Ayuntamiento de '+m[1];}
function publicLocation(d){const a=get(d.kind==='license'?d.clientId:d.accountId)?.data||d;return Object.fromEntries(['municipalityCode','municipality','province','autonomousCommunity'].map(k=>[k,d[k]||a[k]||'']));}
function municipalityEditor(d){
 const m=municipalityByCode(d.municipalityCode),na=d.municipalityNotApplicable===true;
 return '<div class="wide" id="municipality-selector"><label class="initial-license-check"><input type="checkbox" name="municipalityNotApplicable" id="municipality-not-applicable"'+(na?' checked':'')+'> No corresponde · no es una cuenta municipal</label><div id="municipality-search-area"'+(na?' hidden':'')+'><label>Buscar municipio<input id="municipality-search" name="municipalitySearch" list="municipality-options" value="'+esc(m?municipalityLabel(m):'')+'" placeholder="Escribe, por ejemplo, Jumi" autocomplete="off"><datalist id="municipality-options"></datalist></label><p class="sub" id="municipality-location">'+esc(m?m.slice(1).join(' · '):'Selecciona un resultado para completar la ubicación.')+'</p></div><input type="hidden" name="municipalityCode" value="'+esc(d.municipalityCode||'')+'"><div id="municipality-notice" role="status"></div>'+'</div>';
}

function municipalitySuggestions(input){
 const n=normalizeMunicipality(input),list=window.crmMunicipalities?.municipalities||[];
 const matched=n.length>=2?list.filter(m=>normalizeMunicipality(municipalityLabel(m)).includes(n)).slice(0,40):[];
 if($('municipality-options'))$('municipality-options').innerHTML=matched.map(m=>'<option value="'+esc(municipalityLabel(m))+'"></option>').join('');
}
function syncMunicipalityVisibility(){
 const f=$('editor'),el=$('municipality-selector'),top=$('identity-fields')||$('required-fields');if(!f||!el||!top)return;
 const eligible=f.elements.country?.value==='España';
 if(!el._homeSection)el._homeSection=el.closest('details');
 if(el._homeSection)el._homeSection.hidden=true;
 // Geography and organisation are visible at the start as soon as Spain is chosen.
 for(const key of ['marketSector','entityType']){const input=f.elements[key];if(!input)continue;const label=input.closest('label');if(!label)continue;
  let marker=f.querySelector('[data-location-home="'+key+'"]');if(!marker){marker=document.createElement('span');marker.dataset.locationHome=key;marker.hidden=true;label.before(marker);}
  if(eligible)top.append(label);else marker.after(label);
 }
 top.append(el);el.hidden=!eligible;
 f.elements.municipalitySearch.required=eligible&&!f.elements.municipalityNotApplicable.checked;
 if(eligible)municipalitySuggestions(f.elements.municipalitySearch.value);
 updateMunicipalAccountName();
}

function selectMunicipality(input){
 const f=$('editor'),m=municipalityMatch(input);if(!f||!m)return;
 f.elements.municipalityCode.value=m[0];f.elements.municipalitySearch.value=municipalityLabel(m);
 for(const [k,v] of [['municipality',m[1]],['province',m[2]],['autonomousCommunity',m[3]],['territory',m[3]],['region','España']])if(f.elements[k])f.elements[k].value=v;
 updateMunicipalAccountName();
 if($('municipality-location'))$('municipality-location').textContent=m.slice(1).join(' · ');
 const duplicate=entries('client').find(r=>r.data.id!==editor.data.id&&r.data.project===f.elements.project.value&&r.data.entityType==='Ayuntamiento'&&r.data.municipalityCode===m[0]);
 $('municipality-notice').innerHTML=duplicate?'<p>Ya existe una cuenta para este Ayuntamiento. Añade la ampliación en ella.</p>'+button('open','Abrir cuenta existente','data-id="'+esc(duplicate.data.id)+'"'):editor.row?'<p class="sub">El nombre actual se conserva. Puedes cambiarlo expresamente con el botón siguiente.</p>':'';
}
function showExpansion(row){
 showEditor(null,'opportunity');const a=row.data;
 editor.data={...editor.data,project:a.project,accountId:a.id,name:'Ampliación · '+a.name,type:'Ampliación',stage:'Prospección',department:'Todo el Ayuntamiento',marketSector:classification(a).marketSector,entityType:classification(a).entityType,country:a.country||'',...publicLocation(a),...channelDetails(a)};
 $('editor').innerHTML=editorFields(editor.data)+'<p class="sub">Se vincula a la misma cuenta. La licencia y compras anteriores conservan su alcance. Al ganar la ampliación, actualiza la licencia con motivo de cambio o añade una licencia adicional según el contrato.</p><p id="form-error" class="error" role="alert"></p><div class="dialog-foot"><button type="submit" class="primary">Guardar ampliación</button></div>';
 document.querySelector('.dialog-head h2').textContent='Ampliación · '+a.name;syncMunicipalityVisibility();syncPotential();syncOperationValue();
}

function updateMunicipalAccountName(force=false){
 const f=$('editor');if(!f||!['client','opportunity'].includes(editor?.data.kind))return;
 const official=entityTypes.find(v=>normalizeMunicipality(v)===normalizeMunicipality(f.elements.entityType?.value));if(official)f.elements.entityType.value=official;
 const m=municipalityByCode(f.elements.municipalityCode?.value),eligible=normalizeMunicipality(f.elements.entityType?.value)==='ayuntamiento'&&f.elements.country?.value==='España'&&!f.elements.municipalityNotApplicable?.checked;
 const suggestion=eligible&&m?municipalAccountName(m):'';
 if(suggestion&&(force||!editor.row&&(!f.elements.name.value||f.elements.name.value===editor.autoMunicipalName))){f.elements.name.value=suggestion;editor.autoMunicipalName=suggestion;}
 else if(!suggestion&&!editor.row&&editor.autoMunicipalName&&f.elements.name.value===editor.autoMunicipalName){f.elements.name.value='';editor.autoMunicipalName='';}
 const box=$('municipality-name-suggestion');if(box){const hint=suggestion?'Nombre sugerido: '+suggestion:f.elements.country?.value!=='España'?'Para sugerir el nombre, elige España, Ayuntamiento y municipio.':normalizeMunicipality(f.elements.entityType?.value)!=='ayuntamiento'?'Elige Ayuntamiento en Tipo de organismo para sugerir el nombre municipal.':f.elements.municipalityNotApplicable?.checked?'Sin municipio: escribe el nombre del organismo.':'Selecciona un municipio para generar el nombre de la cuenta.';box.innerHTML='<p class="sub" role="status">'+esc(hint)+'</p>'+button('municipal-name','Usar nombre sugerido',suggestion?'':'disabled');}
}

function prepareMunicipalName(){
 const f=$('editor');if(!f)return;
 const input=f.elements.municipalitySearch;if(input?.value&&municipalityMatch(input.value))selectMunicipality(input.value);
 updateMunicipalAccountName();
}
// Run before the browser checks required inputs, including Enter submission.
document.addEventListener('click',e=>{if(e.target.closest('#editor button[type="submit"]'))prepareMunicipalName();},true);
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.closest('#editor')&&!e.target.matches('textarea'))prepareMunicipalName();},true);
function syncConditionalRequired(){
 const f=$('editor'),top=$('required-fields');if(!f||!top)return;
 if(f.elements.renewalForecastCategory){const cat=f.elements.renewalForecastCategory,status=f.elements.licenseStatus.value;if(status==='Renovado')cat.value='Confirmada';else if(status==='Finalizada')cat.value='Fuera de previsión';else if(cat.value==='Confirmada')cat.value='';cat.required=status==='Por renovar'&&Number(f.elements.renewalAmount.value)>0;}
 const checks=[['payerName',f.elements.payerType?.value==='Otra entidad'],['paymentDate',f.elements.paymentStatus?.value==='Pagado'],['renewalPaymentDate',f.elements.renewalPaymentStatus?.value==='Pagado']];
 for(const [key,needed] of checks){const input=f.elements[key];if(!input)continue;const label=input.closest('label');if(!label)continue;input.required=needed;
  let marker=f.querySelector('[data-optional-home="'+key+'"]');
  if(needed&&!top.contains(label)){if(!marker){marker=document.createElement('span');marker.dataset.optionalHome=key;marker.hidden=true;label.before(marker);}top.append(label);}
  else if(!needed&&marker&&top.contains(label))marker.after(label);
 }
}

function potentialQuote(users,force=false){
 if(!window.zentynelPricing)throw Error('No se ha cargado la tarifa. Recarga la página y comprueba el archivo zentynel-pricing.js.');
 const stored=editor.potentialDraft||editor.data.potentialQuote;
 if(!force&&stored&&stored.users===Number(users)&&stored.version)return stored;
 return {...zentynelPricing.calculate(users),calculatedAt:new Date().toISOString()};
}
function potentialBasis(q){
 if(q.status==='outside-tariff')return 'Más de 5.000 usuarios: solicitar presupuesto personalizado. No se extrapola la tarifa.';
 return 'Paquete hasta '+q.packageUsers+' usuarios × '+money(q.rate,'EUR')+' = '+money(q.userFee,'EUR')+'; licencia base anual '+money(q.annualBase,'EUR')+'; onboarding '+money(q.onboarding,'EUR')+'. Soporte adicional no incluido.';
}
function syncPotential(force=false){
 const f=$('editor'),area=$('potential-area');if(!f||!area)return;
 area.hidden=f.elements.project.value!=='Zentynel';
 if(area.hidden)return;
 const input=f.elements.potentialUsers,notice=$('potential-notice');
 const set=(key,v)=>{if(f.elements[key])f.elements[key].value=v??'';};
 if(!input.value){editor.potentialDraft=null;for(const key of ['potentialAnnual','potentialFirstYear','potentialTariffVersion','potentialBasis'])set(key,'');notice.textContent='Indica los usuarios potenciales para calcular el paquete correspondiente.';return;}
 try{const q=potentialQuote(input.value,force);editor.potentialDraft=q;set('potentialAnnual',q.annual);set('potentialFirstYear',q.firstYear);set('potentialTariffVersion',q.version);set('potentialBasis',potentialBasis(q));notice.textContent=q.status==='outside-tariff'?'Fuera de tarifa. Puedes guardar los usuarios sin asignar un importe.':'Estimación potencial · '+q.users+' usuarios previstos · paquete hasta '+q.packageUsers+' usuarios. Se conserva esta tarifa al guardar.';}
 catch(e){notice.textContent=e.message;for(const key of ['potentialAnnual','potentialFirstYear','potentialTariffVersion','potentialBasis'])set(key,'');}
}
function applyPotential(d){
 const f=$('editor');
 // Other projects keep their saved snapshot unchanged until explicitly used in Zentynel.
 if(d.project!=='Zentynel'){for(const key of potentialFields.map(f=>f[0])){if(Object.hasOwn(editor.data,key))d[key]=editor.data[key];else delete d[key];}return;}
 const users=f.elements.potentialUsers?.value.trim()||'';
 if(!users){d.potentialQuote=null;for(const key of potentialFields.map(f=>f[0]))d[key]='';return;}
 const q=potentialQuote(users);d.potentialQuote=q;d.potentialUsers=String(q.users);d.potentialAnnual=q.annual===null?'':String(q.annual);d.potentialFirstYear=q.firstYear===null?'':String(q.firstYear);d.potentialTariffVersion=q.version;d.potentialBasis=potentialBasis(q);
}

function readOperationValue(){
 const f=$('editor'),d={...editor.data,amountOrigin:editor.operationOrigin||editor.data.amountOrigin};for(const key of ['project','stage','quoteStatus','amount','currency','budgetAmount','confirmedAmount','operationUsers','forecastBasis'])if(f.elements[key])d[key]=f.elements[key].value;
 return d;
}
function resolveOperationValue(d){
 const has=n=>value(n)&&Number.isFinite(Number(n))&&Number(n)>=0;
 const manual=!['Estimado por usuarios','Presupuestado','Confirmado'].includes(d.amountOrigin)||editor.operationManual;
 if(d.stage==='Cierre ganado'){
  if(has(d.confirmedAmount))return {amount:d.confirmedAmount,currency:d.currency||'EUR',origin:'Confirmado'};
  if(has(d.budgetAmount))return {amount:d.budgetAmount,currency:d.currency||'EUR',origin:'Confirmado'};
  if(has(d.amount)&&manual&&!editor.useOperationEstimate)return {amount:d.amount,currency:d.currency||'EUR',origin:'Confirmado'};
  return {amount:'',origin:'Confirmado',error:'Indica el importe final acordado antes de cerrar como ganada una estimación por usuarios.'};
 }
 if(has(d.budgetAmount))return {amount:d.budgetAmount,currency:d.currency||'EUR',origin:'Presupuestado'};
 if(['Enviado','Aceptado'].includes(d.quoteStatus)){
  if(has(d.amount)&&manual&&!editor.useOperationEstimate)return {amount:d.amount,currency:d.currency||'EUR',origin:'Presupuestado'};
  return {amount:'',origin:'Presupuestado',error:'Introduce el importe del presupuesto enviado para sustituir la estimación por usuarios.'};
 }
 if(has(d.amount)&&manual&&!editor.useOperationEstimate)return {amount:d.amount,currency:d.currency||'EUR',origin:'Estimado manual'};
 if(d.project==='Zentynel'&&d.operationUsers){
  if(!window.zentynelPricing)throw Error('Falta cargar zentynel-pricing.js.');
  const q=currentOperationQuote(d.operationUsers);
  return {amount:q.status==='calculated'?String(d.forecastBasis==='firstYear'?q.firstYear:q.annual):'',currency:'EUR',origin:'Estimado por usuarios',quote:q};
 }
 return {amount:'',currency:d.currency||'EUR',origin:'Sin importe'};
}
function currentOperationQuote(users){let q=editor.operationDraft||editor.data.operationQuote;if(!q||q.users!==Number(users))q={...zentynelPricing.calculate(users),calculatedAt:new Date().toISOString()};return q;}
function syncOperationValue(){
 const f=$('editor'),area=$('operation-area');if(!f||editor?.data.kind!=='opportunity'||!area)return;
 area.hidden=f.elements.project.value!=='Zentynel';
 const users=f.elements.operationUsers,top=$('required-fields');if(users&&top){const label=users.closest('label');if(!users._optionalHome){users._optionalHome=document.createElement('span');users._optionalHome.hidden=true;label.before(users._optionalHome);}if(!area.hidden)f.elements.amount.closest('label').parentElement.insertBefore(label,f.elements.amount.closest('label'));else users._optionalHome.after(label);users.required=!area.hidden&&(editor.operationOrigin||editor.data.amountOrigin)==='Estimado por usuarios';}
 if(f.elements.amount){f.elements.amount.required=true;f.elements.amount.min='0.01';}
 if(f.elements.forecastCategory){if(f.elements.stage.value==='Cierre ganado')f.elements.forecastCategory.value='Confirmada';else if(['Cierre perdido','En pausa'].includes(f.elements.stage.value))f.elements.forecastCategory.value='Fuera de previsión';else if(f.elements.forecastCategory.value==='Confirmada')f.elements.forecastCategory.value='';if(f.elements.closeDate)f.elements.closeDate.required=f.elements.forecastCategory.value!=='Fuera de previsión';}
 if(!f.elements.forecastBasis.value)f.elements.forecastBasis.value=editor.row?'annual':'firstYear';
 const set=(k,v)=>{if(f.elements[k])f.elements[k].value=v??'';};
 try{
  const d=readOperationValue();
  if(d.project==='Zentynel'&&d.operationUsers){const q=currentOperationQuote(d.operationUsers);editor.operationDraft=q;set('operationAnnual',q.annual);set('operationFirstYear',q.firstYear);set('operationBasis',potentialBasis(q));set('operationTariffVersion',q.version);}
  const result=resolveOperationValue(d);
  const useButton=f.querySelector('[data-action="operation-estimate"]');if(useButton)useButton.disabled=value(d.budgetAmount)||['Enviado','Aceptado'].includes(d.quoteStatus)||d.stage==='Cierre ganado';
  if(result.quote){editor.operationDraft=result.quote;set('operationAnnual',result.quote.annual);set('operationFirstYear',result.quote.firstYear);set('operationBasis',potentialBasis(result.quote));set('operationTariffVersion',result.quote.version);}
  else if(!d.operationUsers){for(const k of ['operationAnnual','operationFirstYear','operationBasis','operationTariffVersion'])set(k,'');}
  set('amountOrigin',result.origin);
  // An invalid commercial transition must not erase an entered amount before validation.
  if(f.elements.amount){f.elements.amount.readOnly=['Estimado por usuarios','Presupuestado','Confirmado'].includes(result.origin);f.elements.amount.title=f.elements.amount.readOnly?'Importe calculado: modifica los usuarios, el presupuesto o el importe final en sus campos.':'';}
  if(result.error){const input=f.elements.confirmedAmount;const group=input?.closest('details');if(group)group.open=true;}
  if(!result.error){editor.operationOrigin=result.origin;set('amount',result.amount);if(result.origin==='Confirmado'&&value(result.amount))set('confirmedAmount',result.amount);if(result.origin==='Presupuestado'&&value(result.amount))set('budgetAmount',result.amount);if(result.amount!=='')set('currency',result.currency);}
  const note=$('operation-value-notice');if(note)note.textContent=result.error||(result.quote?.status==='outside-tariff'?'Fuera de tarifa. Más de 5.000 usuarios requiere presupuesto.':result.origin+' · '+(value(result.amount)?money(Number(result.amount),result.currency):'Sin importe')+'. Se usa una sola vez en el forecast, si tiene fecha de cierre y categoría de previsión.');
 }catch(e){if($('operation-value-notice'))$('operation-value-notice').textContent=e.message;}
}
function applyOperationValue(d){
 if(d.kind!=='opportunity')return;
 // Resolve from saved provenance, not the read-only preview label.
 const source=d.amountOrigin;d.amountOrigin=editor.operationOrigin||editor.data.amountOrigin;
 if(editor.operationManual)d.amountOrigin='Estimado manual';
 const current=d.project==='Zentynel'&&d.operationUsers?currentOperationQuote(d.operationUsers):null;
 const result=resolveOperationValue(d);if(current&&!result.quote)result.quote=current;if(result.error){d.amountOrigin=source;throw Error(result.error);}
 d.amount=result.amount;d.amountOrigin=result.origin;
 if(result.origin==='Presupuestado'&&value(result.amount))d.budgetAmount=result.amount;
 if(result.origin==='Confirmado'&&value(result.amount))d.confirmedAmount=result.amount;if(value(result.amount))d.currency=result.currency;
 if(result.quote)d.operationQuote=result.quote;
 else if(!d.operationUsers){d.operationQuote=null;for(const k of ['operationAnnual','operationFirstYear','operationBasis','operationTariffVersion'])d[k]='';}
 if(result.quote){d.operationAnnual=result.quote.annual===null?'':String(result.quote.annual);d.operationFirstYear=result.quote.firstYear===null?'':String(result.quote.firstYear);d.operationBasis=potentialBasis(result.quote);d.operationTariffVersion=result.quote.version;}
}

function validateOpportunityForecast(d){
 if(!value(d.amount)||!Number.isFinite(Number(d.amount))||Number(d.amount)<=0)throw Error('Indica un valor de la oportunidad mayor que cero, calculado por usuarios o introducido manualmente.');
 if(!['EUR','USD','GBP','MXN','CLP','BRL','COP','PEN'].includes(d.currency))throw Error('Selecciona la moneda de la oportunidad.');
 if(d.stage==='Cierre ganado')d.forecastCategory='Confirmada';else if(['Cierre perdido','En pausa'].includes(d.stage))d.forecastCategory='Fuera de previsión';
 if((!d.closeDate&&d.forecastCategory!=='Fuera de previsión')||(d.closeDate&&(!/^\d{4}-\d{2}-\d{2}$/.test(d.closeDate)||Number.isNaN(Date.parse(d.closeDate+'T12:00:00Z'))||new Date(d.closeDate+'T12:00:00Z').toISOString().slice(0,10)!==d.closeDate)))throw Error('Indica una fecha de cierre válida; solo es opcional en Sin fecha de decisión.');
 if(!['Confirmada','Probable','Posible','Fuera de previsión'].includes(d.forecastCategory)||d.stage!=='Cierre ganado'&&d.forecastCategory==='Confirmada')throw Error('Selecciona Cierre previsto, En evaluación o Sin fecha de decisión. Venta confirmada requiere Cierre ganado.');
 d.amount=String(Number(d.amount));
}

function forecastCategoryFor(d){
 if(['Cierre perdido','En pausa'].includes(d.stage)||d.kind==='license'&&d.licenseStatus==='Finalizada')return 'Fuera de previsión';
 if(d.stage==='Cierre ganado'||d.kind==='license'&&(['Renovado','Renovada'].includes(d.licenseStatus)||d.renewalStage==='Cierre ganado'))return 'Confirmada';
 const cat=d.kind==='license'?d.renewalForecastCategory:d.forecastCategory;
 return ['Probable','Posible','Fuera de previsión'].includes(cat)?cat:'Por clasificar';
}

function quickFollowup(){
 const id=location.hash.split('/')[1]||'';
 if(!/^[0-9a-f-]{36}$/i.test(id))return head('Seguimiento no disponible','El enlace no identifica una ficha válida.');
 const row=get(id);if(!row)return head('Actualización rápida','Inicia sesión y espera a que se cargue la ficha. Si no está disponible, comprueba tus permisos.')+button('reload','Actualizar');
 if(!['client','license','opportunity'].includes(row.data.kind))return blank('Esta ficha no tiene seguimiento comercial.');
 if(!quickState||quickState.id!==id||(!quickState.payload&&quickState.version!==row.version))quickState={id,version:row.version,requestId:crypto.randomUUID(),row};
 const d=row.data,client=d.kind==='license'?get(d.clientId)?.data:d;
 if(quickState.saved)return '<section class="card quick-followup"><h1>Seguimiento guardado</h1><p>La misma ficha se ha actualizado y el cambio está en su historial.</p>'+button('quick-full','Ver ficha completa','data-id="'+esc(id)+'"')+' '+button('nav','Volver a Esta semana','data-view="home"')+'</section>';
 return '<section class="card quick-followup"><p class="sub">KairuTech · Sesión privada</p><h1>Actualización rápida</h1><h2>'+esc(client?.name||d.name)+'</h2><p>'+esc([d.department,d.project].filter(Boolean).join(' · '))+'</p><p class="quick-task">Tarea actual: '+esc(d.next||'Revisar seguimiento de '+d.name)+'</p>'+(quickLinkVersion!==null&&quickLinkVersion!==row.version?'<p class="sub">La ficha ha cambiado desde el correo. Revisa la tarea actual antes de guardar.</p>':'')+
 '<form id="quick-form"><label>Resultado de la tarea<select name="status">'+opts(['Completada','Pendiente','Sin respuesta'],'Completada')+'</select></label><label>Qué ha pasado<textarea name="notes" rows="3" placeholder="Añade una nota breve (opcional)"></textarea></label><label>Próxima acción<input name="next" placeholder="Si no queda otra acción, déjalo vacío"></label><label>Fecha del próximo seguimiento<input type="date" name="nextDate"></label><p id="quick-error" class="error" role="alert"></p><button type="submit" class="primary">Guardar en el CRM</button></form><div class="quick-links">'+button('quick-full','Ver ficha completa','data-id="'+esc(id)+'"')+' '+button('nav','Volver a Esta semana','data-view="home"')+'</div></section>';
}
document.addEventListener('change',e=>{if(e.target.name==='status'&&e.target.closest('#quick-form')&&quickState){const f=e.target.form,d=quickState.row.data;if(e.target.value!=='Completada'&&!f.elements.next.value){f.elements.next.value=d.next||'Revisar seguimiento';f.elements.nextDate.value=d.nextDate||today();}}});
document.addEventListener('submit',async e=>{
 if(e.target.id!=='quick-form')return;e.preventDefault();const state=quickState,form=e.target;if(!state||state.saving)return;
 if(!state.payload){const values=new FormData(form),next=String(values.get('next')||'').trim(),date=String(values.get('nextDate')||'');if(Boolean(next)!==Boolean(date)){ $('quick-error').textContent='Completa juntos próxima acción y fecha.';return; }if(values.get('status')!=='Completada'&&!next){$('quick-error').textContent='Indica el seguimiento pendiente y su fecha.';return;}
 state.payload={p_parent_id:state.id,p_expected_version:state.version,p_request_id:state.requestId,p_payload:{status:String(values.get('status')),notes:String(values.get('notes')||'').trim(),next,nextDate:date}};}
 state.saving=true;form.querySelectorAll('input,select,textarea,button').forEach(el=>el.disabled=true);$('quick-error').textContent='';
 try{await crmConnection.request('rpc/crm_quick_followup',{method:'POST',body:JSON.stringify(state.payload)});state.saved=true;if(quickState===state&&view==='quick')await load();}
 catch(err){if(quickState!==state||!$('quick-error'))return;$('quick-error').textContent=err.code==='PGRST202'?'Activa la consulta 15 en Supabase.':err.message+' Si la respuesta se perdió, reintenta desde esta ventana. Si la ficha cambió, vuelve a abrir el seguimiento.';const submit=form.querySelector('[type=submit]');submit.disabled=false;submit.textContent='Reintentar el mismo guardado';}
 finally{state.saving=false;}
});

route();
