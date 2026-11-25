'use strict';
(() => {
 const core=window.KairuImport;
 let state=null,serial=0;
 const escape=coreText=>String(coreText??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const select=(values,current)=>values.map(([v,l])=>'<option value="'+escape(v)+'"'+(String(v)===String(current)?' selected':'')+'>'+escape(l)+'</option>').join('');
 const action=(key,label,extra='')=>'<button type="button" data-import-action="'+key+'" '+extra+'>'+label+'</button>';
 function download(blob,name){const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 async function template(){
  if(!window.ExcelJS)throw Error('Falta el archivo vendor/exceljs.min.js. Revisa la actualización del CRM.');
  const book=new ExcelJS.Workbook(),sheet=book.addWorksheet('Oportunidades');
  sheet.addRow(core.columns.map(([,label])=>label));sheet.getRow(1).font={bold:true};sheet.views=[{state:'frozen',ySplit:1}];
  sheet.columns.forEach(c=>c.width=25);
  download(new Blob([await book.xlsx.writeBuffer()],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),'Plantilla_Oportunidades_KairuTech.xlsx');
 }
 function render(){
  if(!state)return;
  const s=state;
  $('modal-content').innerHTML='<header class="dialog-head"><h2>Importar oportunidades</h2>'+action('close','Cerrar',s.saving?'disabled':'')+'</header><div class="dialog-body"><p>Importa oportunidades nuevas desde Excel (.xlsx) o CSV. Primero revisa las columnas y la vista previa. No se actualizan ni eliminan fichas existentes.</p><p>'+action('template','Descargar plantilla Excel')+'</p><p class="sub">Primera fila: encabezados. Una oportunidad por fila. Máximo 500 filas, 50 columnas y 5 MB. Para renovar licencias utiliza su ficha.</p><label>Archivo<input type="file" id="import-file" accept=".xlsx,.csv,.tsv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"></label>'+(s.sheets.length?'<label>Hoja<select id="import-sheet">'+select(s.sheets.map((x,i)=>[i,x.name]),s.sheet)+'</select></label>':'')+(s.table?mappingForm():'')+'<p id="import-error" class="error" role="alert">'+escape(s.error||'')+'</p><div id="import-preview"></div><p id="import-status" role="status"></p></div>';
  if(!$('modal').open)$('modal').showModal();
 }
 function mappingForm(){
  const s=state,table=s.table;
  const shown=new Set(['name','project','accountRole','channelType','channelPartner',...Object.keys(s.mapping)]);
  const mappingControl=([key,label])=>'<label>'+escape(label)+'<select data-import-map="'+key+'">'+select([['','Sin columna'],...table.headers.map((h,i)=>[i,(i+1)+'. '+h])],s.mapping[key]??'')+'</select></label>';
  return '<p class="sub">Archivo: '+escape(s.fileName)+' · '+table.data.length+' filas. Los datos se revisan en este navegador; se envían a tu CRM al confirmar la importación.</p><form id="import-map"><h3>Valores para las filas que no los tengan</h3><div class="fields"><label>Proyecto<select name="defaultProject">'+select([['','Seleccionar'],...core.enums.project.map(x=>[x,x])],s.defaults.project)+'</select></label><label>Tipo de cuenta<select name="defaultRole">'+select(core.enums.accountRole.map(x=>[x,x]),s.defaults.accountRole||'Por clasificar')+'</select></label><label>Canal comercial<select name="defaultChannel">'+select([['','Seleccionar'],...core.enums.channelType.map(x=>[x,x])],s.defaults.channelType)+'</select></label><label>Partner / distribuidor<input name="defaultPartner" value="'+escape(s.defaults.channelPartner||'')+'" placeholder="Ej. SATARA SEGURIDAD"></label></div><details class="editor-section" open><summary>Relacionar columnas del archivo</summary><p class="sub">Comprueba las asignaciones automáticas. Las columnas sin asignar también se conservarán en los datos originales de cada oportunidad.</p><div class="fields">'+core.columns.filter(([key])=>shown.has(key)).map(mappingControl).join('')+'</div><details class="editor-section"><summary>Más columnas opcionales</summary><div class="fields">'+core.columns.filter(([key])=>!shown.has(key)).map(mappingControl).join('')+'</div></details></details><p><button type="submit" class="primary">Revisar oportunidades</button></p></form>';
 }
 function applySheet(){
  const s=state,sheet=s.sheets[s.sheet];
  s.table=core.grid(sheet.rows);s.table.data.forEach(r=>{r.originalCells=sheet.original?.[r.row-1];});
  const chars=JSON.stringify(s.table.data).length;
  if(chars>1000000)throw Error('El contenido es demasiado grande. Divide el archivo en varios lotes.');
  s.mapping=core.guess(s.table.headers);s.plan=null;render();
 }
 function value(cell){
  const v=cell.value;
  if(v==null)return '';
  if(Object.prototype.toString.call(v)==='[object Date]')return v.toISOString().slice(0,10);
  if(typeof v==='number'&&String(cell.numFmt||'').includes('%'))return String(v*100)+'%';
  if(typeof v==='object'){
   if('formula'in v||'sharedFormula'in v){if(v.result==null)throw Error('Hay una fórmula sin resultado guardado. Abre y guarda el Excel o pega sus valores antes de importar.');return Object.prototype.toString.call(v.result)==='[object Date]'?v.result.toISOString().slice(0,10):typeof v.result==='number'&&String(cell.numFmt||'').includes('%')?String(v.result*100)+'%':String(v.result);}
   if(v.richText)return v.richText.map(x=>x.text).join('');
   if(v.text)return String(v.text);
   if(v.error)throw Error('El Excel contiene una celda con error: '+v.error);
   return cell.text||'';
  }
  // Mantener ceros iniciales de teléfonos o identificadores con formato numérico.
  if(typeof v==='number'&&/^0{2,}$/.test(cell.numFmt||''))return String(v).padStart(cell.numFmt.length,'0');
  return String(v);
 }
 async function readFile(file){
  if(!state||!file)return;
  const ticket=++serial;state.error='';
  try{
   if(file.size>5*1024*1024)throw Error('El archivo supera 5 MB. Divide el contenido.');
   let sheets=[];
   if(/\.xlsx$/i.test(file.name)){
    if(!window.ExcelJS)throw Error('Falta vendor/exceljs.min.js. Revisa los archivos subidos.');
    const book=new ExcelJS.Workbook();await book.xlsx.load(await file.arrayBuffer(),{ignoreNodes:['picture','drawing']});
    sheets=book.worksheets.map(sheet=>{
     if(sheet.rowCount>501||sheet.columnCount>50)throw Error('Máximo 500 filas de datos y 50 columnas por hoja. Elimina filas vacías con formato si es necesario.');
     const rows=[],original=[];
     for(let r=1;r<=sheet.rowCount;r++){
      const row=sheet.getRow(r),cells=[],raw=[];
      for(let c=1;c<=sheet.columnCount;c++){const cell=row.getCell(c);cells.push(value(cell));raw.push(cell.value);}
      rows.push(cells);original.push(JSON.parse(JSON.stringify(raw)));
     }
     return {name:sheet.name,rows,original};
    });
   }else if(/\.(csv|tsv)$/i.test(file.name)){
    const bytes=new Uint8Array(await file.arrayBuffer());
    const encoding=bytes[0]===255&&bytes[1]===254?'utf-16le':bytes[0]===254&&bytes[1]===255?'utf-16be':'utf-8';
    let text;try{text=new TextDecoder(encoding,{fatal:true}).decode(bytes);}catch{throw Error('Guarda el CSV como CSV UTF-8 para conservar acentos y caracteres.');}
    sheets=[{name:'CSV',rows:core.parseDelimited(text,/\.tsv$/i.test(file.name)?'\t':undefined)}];
   }else throw Error('Utiliza Excel .xlsx o CSV. Convierte los archivos .xls antiguos a .xlsx.');
   if(ticket!==serial||!state)return;
   if(!sheets.length)throw Error('El libro no tiene hojas.');
   state.fileName=file.name;state.sheets=sheets;state.sheet=0;applySheet();
  }catch(error){if(ticket!==serial||!state)return;state.error=error.message;state.sheets=[];state.table=null;state.plan=null;render();}
 }
 function preview(){
  if(!state?.plan)return;
  const plan=state.plan,selected=plan.filter(r=>r.selected&&!r.errors.length),errors=plan.filter(r=>r.errors.length).length,duplicates=plan.filter(r=>r.duplicate).length;
  $('import-preview').innerHTML='<h3>Vista previa</h3><p>'+selected.length+' seleccionadas · '+errors+' con errores · '+duplicates+' posibles duplicados.</p><p>Las coincidencias se desmarcan. Solo márcalas si representan una oportunidad distinta. Los importes están sin IVA y las probabilidades se expresan de 0 a 100.</p><div class="scroll import-table"><table><thead><tr><th>Importar</th><th>Fila</th><th>Cuenta / proyecto</th><th>Tipo de cuenta</th><th>Canal de origen</th><th>Estado</th><th>Contacto</th><th>Importe</th><th>Cierre / probabilidad</th><th>Seguimiento</th><th>Revisión</th></tr></thead><tbody>'+plan.map((r,i)=>'<tr><td><input type="checkbox" aria-label="Importar fila '+r.row+'" data-import-row="'+i+'"'+(r.selected?' checked':'')+(r.errors.length||state.attempted||state.saving?' disabled':'')+'></td><td>'+r.row+'</td><td>'+escape(r.data.name)+'<div class="meta">'+escape(r.data.project)+'</div></td><td>'+escape(r.data.accountRole)+'</td><td>'+escape(r.data.channelType)+'<div class="meta">'+escape(r.data.channelPartner)+'</div></td><td>'+escape(r.data.stage)+'</td><td>'+escape(r.data.contact)+'</td><td>'+escape(r.data.amount||'Sin importe')+' '+escape(r.data.currency)+'</td><td>'+escape(r.data.closeDate||'Sin fecha')+'<div class="meta">'+escape(r.data.probability||'Sin probabilidad')+'</div></td><td>'+escape((r.data.next||'').slice(0,160))+'<div class="meta">'+escape(r.data.nextDate)+'</div></td><td>'+r.errors.map(x=>'<p class="error">'+escape(x)+'</p>').join('')+r.warnings.map(x=>'<p class="sub">'+escape(x)+'</p>').join('')+'</td></tr>').join('')+'</tbody></table></div><p><button type="button" class="primary" data-import-action="save"'+(!selected.length||state.saving?' disabled':'')+'>'+(state.attempted?'Reintentar la misma importación':'Importar '+selected.length+' oportunidades')+'</button></p>'+(state.attempted?'<p class="sub">El reintento utiliza los mismos identificadores para evitar volver a crear las oportunidades de este lote.</p>':'');
 }
 function freeze(){
  for(const control of $('modal-content').querySelectorAll('#import-map input,#import-map select,#import-map button,#import-sheet,#import-file,[data-import-row]'))control.disabled=true;
 }
 async function commit(){
  const s=state;if(!s||s.saving||!s.plan)return;
  const selected=s.selectedIds?s.plan.filter(r=>s.selectedIds.has(r.data.id)):s.plan.filter(r=>r.selected&&!r.errors.length);
  if(!selected.length)return;
  s.saving=true;freeze();preview();$('import-error').textContent='';$('import-status').textContent='Comprobando coincidencias y guardando…';
  try{
   const fresh=await api('');if(state!==s)return;
   if(!s.attempted){
    const newlyConflicting=selected.filter(r=>!r.duplicate&&fresh.some(x=>x.data.project===r.data.project&&[x.data.name,x.data.organisation].some(n=>n&&core.normalize(n)===core.normalize(r.data.name))));
    if(newlyConflicting.length){
     for(const r of newlyConflicting){r.duplicate=true;r.selected=false;r.warnings.push('Ha aparecido otra ficha con esta cuenta desde la revisión. Comprueba la coincidencia.');}
     s.saving=false;for(const control of $('modal-content').querySelectorAll('#import-map input,#import-map select,#import-map button,#import-sheet,#import-file'))control.disabled=false;preview();$('import-status').textContent='Revisa las nuevas coincidencias antes de importar.';return;
    }
    s.selectedIds=new Set(selected.map(r=>r.data.id));s.attempted=true;
   }
   const payload=selected.map(r=>({id:r.data.id,project_id:projectIds[r.data.project],kind:'opportunity',name:r.data.name,data:r.data,parent_id:null,client_id:null,change_reason:'Importación '+s.fileName+' · fila '+r.row}));
   await crmConnection.request('crm_records?on_conflict=id',{method:'POST',headers:{Prefer:'resolution=ignore-duplicates,return=representation'},body:JSON.stringify(payload)});
   if(state!==s)return;
   await load();
   if(state!==s)return;
   const saved=selected.filter(r=>get(r.data.id));
   if(saved.length!==selected.length)throw Error('No se ha podido confirmar el lote completo. Pulsa reintentar para comprobarlo sin duplicar.');
   s.saving=false;
   $('modal-content').innerHTML='<header class="dialog-head"><h2>Importación completada</h2>'+action('close','Cerrar')+'</header><div class="dialog-body"><p>'+saved.length+' oportunidades guardadas. '+(s.plan.length-saved.length)+' filas no importadas.</p><p>Se conserva la información original del archivo y cada ficha tiene su historial.</p><p>'+action('pipeline','Ver pipeline')+'</p></div>';
   toast('Oportunidades importadas');
  }catch(error){
   if(state!==s)return;s.saving=false;preview();$('import-error').textContent=error.message;$('import-status').textContent=s.attempted?'No se ha confirmado el resultado. Reintenta desde esta ventana; no vuelvas a cargar el archivo hasta comprobar el pipeline.':'No se ha importado el lote.';
   if(!s.attempted)for(const control of $('modal-content').querySelectorAll('#import-map input,#import-map select,#import-map button,#import-sheet,#import-file'))control.disabled=false;
  }
 }
 document.addEventListener('click',async e=>{
  if(e.target.closest('[data-action="import"]')){
   state={sheets:[],sheet:0,table:null,mapping:{},defaults:{project:project||'',channelType:'',channelPartner:''},error:'',fileName:'',plan:null,saving:false,attempted:false};serial++;render();return;
  }
  const el=e.target.closest('[data-import-action]');if(!el)return;
  const key=el.dataset.importAction;
  if(key==='save'){await commit();return;}
  if(state?.saving)return;
  if(key==='template'){try{await template();}catch(error){$('import-error').textContent=error.message;}}
  if(key==='close'||key==='pipeline'){
   if(state?.attempted&&$('import-preview')&&!confirm('Puede haberse guardado el lote. Comprueba el pipeline antes de volver a cargar el archivo. ¿Cerrar?'))return;
   state=null;serial++;$('modal').close();if(key==='pipeline')jump('pipeline');
  }
 });
 document.addEventListener('change',async e=>{
  if(!state)return;
  if(e.target.id==='import-file')await readFile(e.target.files[0]);
  if(e.target.id==='import-sheet'){
   state.sheet=Number(e.target.value);try{applySheet();}catch(error){state.error=error.message;state.table=null;render();}
  }
  if(e.target.matches('[data-import-row]')){state.plan[Number(e.target.dataset.importRow)].selected=e.target.checked;preview();}
  if(e.target.closest('#import-map')){state.plan=null;$('import-preview').textContent='Vuelve a pulsar Revisar oportunidades para aplicar los cambios.';}
 });
 document.addEventListener('submit',e=>{
  if(e.target.id!=='import-map'||!state)return;e.preventDefault();
  const form=e.target;
  state.defaults={project:form.elements.defaultProject.value,accountRole:form.elements.defaultRole.value,channelType:form.elements.defaultChannel.value,channelPartner:form.elements.defaultPartner.value};
  state.mapping=Object.fromEntries([...form.querySelectorAll('[data-import-map]')].filter(el=>el.value!=='').map(el=>[el.dataset.importMap,Number(el.value)]));
  try{
   state.plan=core.makePlan(state.table,state.mapping,{...state.defaults,fileName:state.fileName,sheetName:state.sheets[state.sheet].name},rows.filter(r=>['opportunity','client','license'].includes(r.data.kind)).map(r=>r.data),()=>crypto.randomUUID());
   $('import-error').textContent='';preview();$('import-preview').scrollIntoView({block:'start'});
  }catch(error){$('import-error').textContent=error.message;}
 });
 $('modal').addEventListener('cancel',e=>{if(state?.saving){e.preventDefault();return;}if(state?.attempted&&$('import-preview')){e.preventDefault();return;}state=null;serial++;});
 addEventListener('crm-locked',()=>{state=null;serial++;});
})();
