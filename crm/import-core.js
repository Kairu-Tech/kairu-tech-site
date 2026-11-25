/* Importación local de oportunidades. No realiza peticiones de red. */
(function(root){
 'use strict';
 const normalize=x=>String(x??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
 const columns=[
  ['name','Cuenta / oportunidad',['cuenta','oportunidad','nombre','empresa','cliente']],
  ['project','Proyecto',['project','producto']],
  ['accountRole','Tipo de cuenta',['tipo cuenta','cliente final partner distribuidor','rol de cuenta']],
  ['channelType','Canal comercial',['canal','origen comercial']],
  ['channelPartner','Partner / distribuidor',['distribuidor','colaborador','partner','distribuidor colaborador']],
  ['stage','Estado comercial',['estado','fase','etapa','stage']],
  ['contactName','Nombre del contacto',['contacto','nombre contacto','contact name']],
  ['contactEmail','Email del contacto',['email','correo','correo electronico']],
  ['contactPhone','Teléfono del contacto',['telefono','movil','phone']],
  ['contactRole','Cargo del contacto',['cargo','puesto']],
  ['organisation','Organismo / empresa',['organismo','organizacion']],
  ['type','Tipo de oportunidad',['tipo']],['country','País',['pais','country']],['region','Región',[]],['territory','Territorio',['comunidad','territorio']],
  ['sector','Sector',[]],['priority','Prioridad',[]],['need','Necesidad detectada',['necesidad']],['proposal','Propuesta de valor',['propuesta']],
  ['amount','Importe sin IVA',['importe','presupuesto','importe estimado','valor']],['currency','Moneda',['divisa']],['probability','Probabilidad (%)',['probabilidad']],
  ['closeDate','Cierre previsto',['fecha cierre','fecha prevista cierre','fecha de cierre']],['next','Próximo paso',['proxima accion','proximo paso','siguiente accion']],['nextDate','Fecha de seguimiento',['fecha seguimiento','proxima fecha','fecha proxima accion']],
  ['source','Fuente',[]],['notes','Notas',['observaciones','comentarios']],['risk','Riesgo',[]],['meetings','Reuniones',[]],['demos','Demos',[]],['emails','Comunicaciones',['emails']],['objections','Objeciones',[]],
  ['commercialOwnerName','Responsable comercial',['responsable']],['commercialOwnerEmail','Email del responsable',[]],['commercialOwnerPhone','Teléfono del responsable',[]],
  ['quoteStatus','Estado del presupuesto',[]],['quoteReference','Referencia del presupuesto',[]],['quoteDate','Fecha de envío del presupuesto',[]]
 ];
 const enums={accountRole:['Cliente final','Partner / distribuidor','Proveedor','Por clasificar'],project:['Zentynel','Flowity','Metadology'],channelType:['Venta directa','Partner / distribuidor'],stage:['Prospección','Contacto inicial','Cualificación','Reunión / demo','Propuesta','Negociación','Cierre ganado','Cierre perdido','Renovación','Seguimiento','En pausa'],priority:['Alta','Media','Baja','Por revisar'],currency:['EUR','USD','GBP','MXN','CLP','BRL','COP','PEN'],type:['Cliente directo','Partner','Proveedor','Piloto','Licitación','Renovación','Por cualificar'],quoteStatus:['Por confirmar','Pendiente de enviar','Enviado','Aceptado','Rechazado']};
 function enumValue(key,input){
  const aliases={accountRole:{partner:'Partner / distribuidor',distribuidor:'Partner / distribuidor',colaborador:'Partner / distribuidor'},project:{metaology:'Metadology'},channelType:{directa:'Venta directa',directo:'Venta directa','cliente directo':'Venta directa',distribucion:'Partner / distribuidor',distribuidor:'Partner / distribuidor',colaborador:'Partner / distribuidor',partner:'Partner / distribuidor'},stage:{ganada:'Cierre ganado',ganado:'Cierre ganado',perdida:'Cierre perdido',perdido:'Cierre perdido',demo:'Reunión / demo',reunion:'Reunión / demo'},currency:{euro:'EUR',euros:'EUR',dolares:'USD'}};
  return enums[key].find(x=>normalize(x)===normalize(input))||aliases[key]?.[normalize(input)]||null;
 }
 function parseDelimited(text,delimiter){
  text=String(text).replace(/^\uFEFF/,'');
  if(!delimiter){
   let sample='',quoted=false;
   for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){i++;continue;}quoted=!quoted;}if(!quoted&&/[\r\n]/.test(c))break;if(!quoted)sample+=c;}
   delimiter=[';',',','\t'].sort((a,b)=>sample.split(b).length-sample.split(a).length)[0];
  }
  const rows=[];let row=[],cell='',quoted=false,closed=false;
  const finish=()=>{row.push(cell);rows.push(row);row=[];cell='';closed=false;};
  for(let i=0;i<text.length;i++){
   const c=text[i];
   if(quoted){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=c;continue;}
   if(c==='"'){if(cell!==''||closed)throw Error('CSV con comillas mal cerradas. Guarda otra vez como CSV UTF-8.');quoted=true;}
   else if(c===delimiter){row.push(cell);cell='';closed=false;}
   else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;finish();}
   else {if(closed&&!/\s/.test(c))throw Error('CSV con texto después de una comilla de cierre.');if(!closed)cell+=c;}
   if(rows.length>501)throw Error('Máximo 500 oportunidades por importación.');
  }
  if(quoted)throw Error('CSV con comillas sin cerrar.');
  if(cell!==''||row.length)finish();
  return rows;
 }
 function grid(raw){
  const first=raw.findIndex(row=>row.some(v=>String(v??'').trim()));
  if(first<0)throw Error('El archivo está vacío.');
  const headers=raw[first].map((x,i)=>String(x??'').trim()||'Columna '+(i+1));
  if(headers.length>50)throw Error('Máximo 50 columnas.');
  const data=raw.slice(first+1).map((cells,i)=>({cells,row:first+i+2})).filter(r=>r.cells.some(v=>String(v??'').trim()));
  if(data.length>500)throw Error('Máximo 500 oportunidades por importación.');
  if(data.some(r=>r.cells.length>headers.length))throw Error('Hay filas con más columnas que la cabecera. Revisa el separador o los encabezados.');
  return {headers,data};
 }
 function guess(headers){
  const used=new Set(),mapping={};
  for(const [key,label,aliases] of columns){
   const index=headers.findIndex((header,i)=>!used.has(i)&&[key,label,...aliases].some(alias=>normalize(alias)===normalize(header)));
   if(index>=0){mapping[key]=index;used.add(index);}
  }
  return mapping;
 }
 function date(input){
  let y,m,d;const iso=String(input).match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/),local=String(input).match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/);
  if(iso)[,y,m,d]=iso;else if(local)[,d,m,y]=local;else throw Error('Usa fechas dd/mm/aaaa o aaaa-mm-dd');
  const value=[y,m.padStart(2,'0'),d.padStart(2,'0')].join('-');
  const parsed=new Date(value+'T12:00:00Z');
  if(isNaN(parsed)||parsed.toISOString().slice(0,10)!==value)throw Error('Fecha no válida');
  return value;
 }
 function number(input,percentage=false){
  let s=String(input).trim().replace(/\s/g,'');const percent=s.endsWith('%');if(percent)s=s.slice(0,-1);
  s=s.replace(/(?:EUR|USD|GBP|MXN|CLP|BRL|COP|PEN|€|\$|£)/gi,'');
  if(s.includes(',')&&s.includes('.')){const decimal=s.lastIndexOf(',')>s.lastIndexOf('.')?',':'.';s=s.replace(decimal===','?/\./g:/,/g,'').replace(',','.');}
  else if(s.includes(',')){if((s.match(/,/g)||[]).length>1){if(!/^\d{1,3}(,\d{3})+$/.test(s))throw Error('Número no válido');s=s.replace(/,/g,'');}else s=s.replace(',','.');}
  else if(!percentage&&/^\d{1,3}(\.\d{3})+$/.test(s))s=s.replace(/\./g,'');
  if(!/^\d+(\.\d+)?$/.test(s)||!Number.isFinite(Number(s))||Number(s)>1e15)throw Error('Número no válido');
  const n=Number(s);if(percentage&&n>100)throw Error('La probabilidad debe estar entre 0 y 100');
  return String(n);
 }
 function makePlan(table,mapping,defaults,existing,uuid){
  const seen=new Map(),batchId=uuid();
  const mapped=Object.entries(mapping).filter(([,index])=>index!==''&&index!=null);
  const indexes=mapped.map(([,i])=>Number(i));if(new Set(indexes).size!==indexes.length)throw Error('Cada columna del archivo debe asignarse a un solo campo.');
  if(mapping.name==null||mapping.name==='')throw Error('Asigna la columna Cuenta / oportunidad.');
  return table.data.map(record=>{
   const errors=[],warnings=[],data={kind:'opportunity',stage:'Prospección',priority:'Por revisar',type:'Por cualificar',currency:'EUR',accountRole:'Por clasificar',channelType:'',project:'',...defaults};
   for(const [key,index] of mapped){const v=String(record.cells[index]??'').trim();if(v)data[key]=v;}
   for(const key of Object.keys(enums)){
    if(!data[key])continue;
    const parsed=enumValue(key,data[key]);if(parsed)data[key]=parsed;else errors.push((columns.find(c=>c[0]===key)?.[1]||key)+': valor no reconocido «'+data[key]+'»');
   }
   if(!data.name)errors.push('Falta cuenta / oportunidad');
   if(!data.project)errors.push('Falta proyecto');
   if(!data.channelType)errors.push('Falta canal comercial');
   if(data.channelType==='Venta directa')data.channelPartner='';
   else if(!data.channelPartner)errors.push('Falta distribuidor / colaborador');
   if(normalize(data.channelPartner)==='satara'||normalize(data.channelPartner)==='satara seguridad')data.channelPartner='SATARA SEGURIDAD';
   if(data.type==='Renovación'||data.stage==='Renovación')errors.push('Gestiona esta renovación desde su licencia para evitar duplicarla');
   for(const key of ['closeDate','nextDate','quoteDate'])if(data[key]){try{data[key]=date(data[key]);}catch(e){errors.push((columns.find(c=>c[0]===key)?.[1]||key)+': '+e.message);}}
   if(data.amount&&/^\d{1,3}[,.]\d{3}$/.test(String(data.amount).trim()))warnings.push('Formato ambiguo del importe original «'+data.amount+'»: revisa el valor de la vista previa');
   for(const key of ['amount','probability'])if(data[key]){try{data[key]=number(data[key],key==='probability');}catch(e){errors.push((key==='amount'?'Importe':'Probabilidad')+': '+e.message);}}
   if(data.contactEmail&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.contactEmail))errors.push('Email del contacto no válido');
   data.contacts=[{name:data.contactName||'',email:data.contactEmail||'',phone:data.contactPhone||'',role:data.contactRole||''}].filter(c=>Object.values(c).some(Boolean));
   data.contact=data.contacts.map(c=>[c.name,c.email,c.phone,c.role].filter(Boolean).join(' · ')).join(' / ');
   for(const key of ['contactName','contactEmail','contactPhone','contactRole'])delete data[key];
   const identity=normalize(data.project)+'|'+normalize(data.name);
   const match=existing.find(r=>r.project===data.project&&[r.name,r.organisation].some(n=>n&&normalize(n)===normalize(data.name)));
   if(match)warnings.push('Coincide con '+({client:'un cliente',license:'una licencia',opportunity:'una oportunidad'}[match.kind]||'una ficha')+' existente: '+match.name);
   if(seen.has(identity))warnings.push('Cuenta repetida en la fila '+seen.get(identity));else seen.set(identity,record.row);
   if(!data.amount)warnings.push('Sin importe');if(!data.nextDate)warnings.push('Sin fecha de seguimiento');
   data.id=uuid();data.importOriginal={batchId,file:defaults.fileName||'',sheet:defaults.sheetName||'',row:record.row,headers:[...table.headers],cells:[...record.cells],originalCells:record.originalCells||[...record.cells],mapping:{...mapping}};
   delete data.fileName;delete data.sheetName;
   return {data,row:record.row,errors,warnings,duplicate:Boolean(match||warnings.some(w=>w.startsWith('Cuenta repetida'))),selected:!errors.length&&!match&&!warnings.some(w=>w.startsWith('Cuenta repetida'))};
  });
 }
 root.KairuImport={normalize,columns,enums,parseDelimited,grid,guess,date,number,makePlan};
})(typeof window==='undefined'?globalThis:window);
