/* MVM · Evaluación piloto v16. Persistencia local; no enviar datos a servidores.
   Los informes se exportan explícitamente por el evaluador. */
(function(){
"use strict";
const ACTIVE="mvm-pilot-active-v16",ARCHIVE="mvm-pilot-archive-v16";
const now=()=>new Date().toISOString();
const lookup=key=>{try{return JSON.parse(localStorage.getItem(key)||"null");}catch(e){return null;}};
let storageWorks=true;
const store=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));return true;}catch(e){storageWorks=false;return false;}};
function fresh(){
 return {schema:"MVM_PILOT_16",attemptId:"MVM-"+new Date().toISOString().slice(0,10).replace(/-/g,"")+"-"+Math.random().toString(36).slice(2,8).toUpperCase(),
 createdAt:now(),startedAt:null,finishedAt:null,finishReason:null,
 name:"",email:"",stage:0,knowledgeIndex:0,caseIndex:0,
 objective:Array(15).fill(-1),openCases:["","",""],excel:null,pivot:null,sql:null,python:null};
}
let archive=lookup(ARCHIVE);if(!Array.isArray(archive))archive=[];
let current=lookup(ACTIVE);if(!current||current.schema!=="MVM_PILOT_16")current=fresh();
if(!Array.isArray(current.objective)||current.objective.length!==15)current.objective=Array(15).fill(-1);
if(!Array.isArray(current.openCases)||current.openCases.length!==3)current.openCases=["","",""];
function restore(){
 for(let i=0;i<15;i++)knowledgeAnswers[i]=Number.isInteger(current.objective[i])?current.objective[i]:-1;
 for(let i=0;i<3;i++)caseAnswers[i]=String(current.openCases[i]||"");
 knowledgeIndex=Math.max(0,Math.min(14,Number(current.knowledgeIndex)||0));
 caseIndex=Math.max(0,Math.min(2,Number(current.caseIndex)||0));
 excelPilotReport=current.excel||null;pivotPilotReport=current.pivot||null;
 const forced=new URLSearchParams(location.search).has("etapa");
 at=Math.max(0,Math.min(8,forced?at:(Number(current.stage)||0)));
}
restore();
function collect(){
 const elapsed=current.startedAt?Math.max(0,Math.round((Date.now()-Date.parse(current.startedAt))/1000)):0;
 return {
 schema:"MVM_PILOT_16",assessment:"Asesor de Métricas · MVM",attemptId:current.attemptId,
 candidate:{name:current.name.trim()||"Sin nombre",email:current.email.trim()||""},
 createdAt:current.createdAt,startedAt:current.startedAt,finishedAt:current.finishedAt,
 finishReason:current.finishReason||"en curso",timeLimitSeconds:4500,
 elapsedSeconds:current.finishedAt&&current.startedAt?Math.max(0,Math.round((Date.parse(current.finishedAt)-Date.parse(current.startedAt))/1000)):elapsed,
 overtime:elapsed>4500,
 progress:{stage:at,objectiveAnswered:knowledgeAnswers.filter(x=>x>=0).length,casesAnswered:caseAnswers.filter(x=>x.trim()).length},
 knowledge:knowledgeData.map((entry,i)=>({number:i+1,question:entry[0],selected:knowledgeAnswers[i]<0?null:"ABCD"[knowledgeAnswers[i]],selectedText:knowledgeAnswers[i]<0?null:entry[1][knowledgeAnswers[i]]})),
 openCases:caseData.map((entry,i)=>({number:i+1,title:entry[0],prompt:entry[1],response:caseAnswers[i]})),
 practical:{excel:excelPilotReport,pivot:pivotPilotReport,sql:current.sql||null,python:current.python||null},
 review:{status:"PENDIENTE_DE_REVISION",note:"Sin respuestas correctas en el archivo público. Revisión y ranking deben hacerse fuera de GitHub Pages."}
 };
}
function save(){
 current.objective=[...knowledgeAnswers];current.openCases=[...caseAnswers];
 current.knowledgeIndex=knowledgeIndex;current.caseIndex=caseIndex;current.stage=at;
 current.excel=excelPilotReport;current.pivot=pivotPilotReport;
 store(ACTIVE,current);updateTop();
}
let originalRender=render;
render=function(){
 originalRender();
 if(at===0){
  const area=document.getElementById("body");
  area.insertAdjacentHTML("beforeend",'<div class="question"><h3>Prueba de selección simulada</h3><p>Usa un nombre distinto en cada intento (por ejemplo, «Candidato 1» y «Candidato 2»). Se conservarán temporalmente los avances en este navegador; al finalizar deberás descargar y compartir el archivo JSON para recibir la calificación, observaciones y ranking. No uses información confidencial.</p><button class="btn" id="beginPilot" type="button">'+(current.startedAt?"Continuar prueba iniciada":"Comenzar prueba de 75 minutos")+'</button></div>');
  document.getElementById("beginPilot").onclick=()=>start();
 }
 if(at===1){
  const name=document.querySelector('#body input[type="text"]'),email=document.querySelector('#body input[type="email"]');
  if(name){name.value=current.name;name.setAttribute("autocomplete","off");name.addEventListener("input",e=>{current.name=e.target.value;save();});}
  if(email){email.value=current.email;email.setAttribute("autocomplete","off");email.addEventListener("input",e=>{current.email=e.target.value;save();});}
 }
 if(at===8){
  const area=document.getElementById("body"),n=knowledgeAnswers.filter(x=>x>=0).length,
   open=caseAnswers.filter(x=>x.trim()).length,
   pivotCompleted=pivotPilotReport&&pivotPilotReport.snapshots?Object.keys(pivotPilotReport.snapshots).length:0;
  area.innerHTML='<h2>'+(current.finishedAt?'Entrega piloto finalizada':'Revisión y cierre de la prueba')+'</h2>'+
   '<p>Identificación: <strong>'+safeHtml(current.name||"Sin nombre")+'</strong> · Intento <code>'+safeHtml(current.attemptId)+'</code></p>'+
   '<div class="question"><p>Preguntas respondidas: <strong>'+n+'/15</strong> · Casos desarrollados: <strong>'+open+'/3</strong></p>'+
   '<p>Excel: <strong>'+(excelPilotReport?'registrado':'sin entrega')+'</strong> · Tablas dinámicas: <strong>'+pivotCompleted+'/3 ejercicios guardados</strong></p>'+
   '<p>SQL: <strong>'+(current.sql?'registrado':'sin entrega')+'</strong> · Python: <strong>'+(current.python?'registrado':'sin entrega')+'</strong></p></div>'+
   '<p><strong>La calificación y el ranking son privados.</strong> Se elaborarán después de que compartas los informes de tus dos pruebas. No se mostrarán las claves en esta página.</p>'+
   (current.finishedAt?
    '<div class="question"><p>Tu intento está cerrado. Descarga el archivo para que podamos revisar las fórmulas, consultas, código y respuestas abiertas.</p><p><strong>Archivo:</strong> <code>'+safeHtml(filename(current))+'</code></p><div class="actions"><button class="btn" id="exportReport" type="button">Descargar resultado de este intento (.json)</button><button class="btn secondary" id="copyReport" type="button">Copiar informe</button><button class="btn secondary" id="exportAll" type="button">Descargar todos los intentos</button><button class="btn secondary" id="startAnother" type="button">Crear siguiente candidato simulado</button></div></div>':
    '<div class="question"><p>Si algo quedó incompleto, puedes volver a la sección correspondiente antes de entregar. Al cerrar se archivará este intento.</p><button class="btn" id="closePilot" type="button">Finalizar prueba y descargar informe</button></div>');
  const close=document.getElementById("closePilot");if(close)close.onclick=()=>finish("entrega_manual");
  const exp=document.getElementById("exportReport");if(exp)exp.onclick=()=>download(collect(),filename(current));
  const cp=document.getElementById("copyReport");if(cp)cp.onclick=copyReport;
  const all=document.getElementById("exportAll");if(all)all.onclick=()=>download({schema:"MVM_PILOT_BUNDLE_16",exportedAt:now(),attempts:archive},"Archivo-TodosLosCandidatos-PruebaAsesor.json");
  const next=document.getElementById("startAnother");if(next)next.onclick=createAnother;
 }
 updateTop();
};
const originalGo=go;
go=function(i){
 if(current.finishedAt&&Number(i)!==8){alert("Este intento ya fue finalizado. Usa «Crear siguiente candidato simulado» para hacer otra prueba.");return;}
 if(!current.startedAt&&Number(i)!==0){alert("Primero pulsa «Comenzar prueba de 75 minutos» en Bienvenida.");return;}
 originalGo(i);save();
};
function start(){
 if(!current.startedAt)current.startedAt=now();
 save();go(1);
}
function sync(){
 current.objective=[...knowledgeAnswers];
 current.openCases=[...caseAnswers];current.knowledgeIndex=knowledgeIndex;current.caseIndex=caseIndex;
 current.stage=at;current.excel=excelPilotReport;current.pivot=pivotPilotReport;
}
function filename(a){
 // Nombre reconocible por candidato; sufijo del intento para no sobrescribir otras pruebas.
 const person=String(a.name||"SinNombre").trim()
  .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
  .replace(/[^A-Za-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,64)||"SinNombre";
 const id=String(a.attemptId||"").replace(/[^A-Za-z0-9-]/g,"").replace(/^MVM-/,"")||"Intento";
 return "Archivo-"+person+"-PruebaAsesor-"+id+".json";
}
function download(obj,fileName){
 try{
  const blob=new Blob([JSON.stringify(obj,null,2)],{type:"application/json;charset=utf-8"});
  const url=URL.createObjectURL(blob),link=document.createElement("a");
  link.href=url;link.download=fileName;document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),60000);
 }catch(e){alert("No se pudo descargar el archivo. Prueba desde otro navegador o utiliza el botón de copiar.");}
}
async function copyReport(){
 const text=JSON.stringify(collect(),null,2);
 try{
  if(navigator.clipboard&&navigator.clipboard.writeText){await navigator.clipboard.writeText(text);}
  else{
   const a=document.createElement("textarea");a.value=text;a.style.position="fixed";a.style.opacity="0";document.body.append(a);a.select();
   if(!document.execCommand("copy"))throw Error("clipboard unavailable");a.remove();
  }
  const b=document.getElementById("copyReport");if(b)b.textContent="Informe copiado ✓";
 }catch(e){alert("No fue posible copiar el informe. Usa «Descargar resultado de este intento» y adjunta el archivo JSON.");}
}
function finish(reason){
 if(current.finishedAt)return;
 sync();
 if(!current.name.trim()&&reason!=="tiempo_agotado"){
  if(!confirm("No has escrito el nombre del candidato. ¿Terminar igualmente?")){go(1);return;}
 }
 const missing=[
 knowledgeAnswers.filter(x=>x<0).length+" preguntas sin responder",
 caseAnswers.filter(x=>!x.trim()).length+" casos sin respuesta",
 !excelPilotReport?"Excel sin finalizar":null,
 !pivotPilotReport?"Tabla dinámica sin finalizar":null,
 !current.sql?"SQL sin finalizar":null,
 !current.python?"Python sin finalizar":null
 ].filter(x=>x&&x[0]!=="0");
 if(reason!=="tiempo_agotado"&&missing.length&&!confirm("Hay actividades pendientes: "+missing.join("; ")+". ¿Finalizar de todas formas?"))return;
 current.finishedAt=now();current.finishReason=reason;
 const report=collect();
 archive.push(report);store(ARCHIVE,archive);store(ACTIVE,current);
 const last=at;at=8;updateCurrentStageUrl();render();save();
 if(reason!=="tiempo_agotado")download(report,filename(current));
 else alert("Se alcanzó el tiempo límite de 75 minutos. La prueba quedó cerrada y guardada localmente. Descarga el informe desde la pantalla final.");
}
function createAnother(){
 if(!current.finishedAt&&!confirm("El intento actual está sin finalizar. ¿Descartarlo y crear otro?"))return;
 current=fresh();
 knowledgeAnswers.fill(-1);caseAnswers.fill("");
 knowledgeIndex=0;caseIndex=0;excelPilotReport=null;pivotPilotReport=null;
 store(ACTIVE,current);
 at=0;updateCurrentStageUrl();render();save();
 window.scrollTo({top:0,behavior:"smooth"});
}
function updateTop(){
 const panel=document.getElementById("pilotTop");if(!panel)return;
 const elapsed=current.startedAt?Math.max(0,Math.floor((Date.now()-Date.parse(current.startedAt))/1000)):0;
 const rest=Math.max(0,4500-elapsed);
 const clock=String(Math.floor(rest/60)).padStart(2,"0")+":"+String(rest%60).padStart(2,"0");
 panel.innerHTML='<div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;justify-content:space-between">'+
 '<div><strong>Prueba piloto</strong> · '+safeHtml(current.name||"Candidato sin identificar")+
 ' <span class="chip">'+(current.finishedAt?'Finalizada':current.startedAt?'En curso':'Sin iniciar')+'</span>'+
 ' <span class="chip">Intentos cerrados en este navegador: '+archive.length+'</span></div>'+
 '<div style="display:flex;gap:9px;align-items:center"><strong id="pilotTimer" style="font-variant-numeric:tabular-nums;font-size:21px">'+clock+'</strong>'+
 '<button type="button" class="btn secondary" id="savePilot" style="padding:7px 10px">Guardar avance</button></div></div>'+
 '<p class="muted" style="margin:4px 0;font-size:12px">'+(storageWorks?'Guardado local en este navegador; no se transmite a ningún servidor.':'Este navegador no permite guardar el avance. Finaliza y descarga el archivo sin cerrar la página.')+'</p>';
 const saveBtn=document.getElementById("savePilot");
 if(saveBtn)saveBtn.onclick=()=>{save();saveBtn.textContent="Guardado ✓";};
}
function tick(){
 if(current.finishedAt||!current.startedAt){const el=document.getElementById("pilotTimer");if(el&&!current.startedAt)el.textContent="75:00";return;}
 const elapsed=Math.max(0,Math.floor((Date.now()-Date.parse(current.startedAt))/1000));
 const rest=Math.max(0,4500-elapsed);
 const el=document.getElementById("pilotTimer");
 if(el)el.textContent=String(Math.floor(rest/60)).padStart(2,"0")+":"+String(rest%60).padStart(2,"0");
 if(rest===0)finish("tiempo_agotado");
}
document.addEventListener("input",e=>{
 if(e.target?.id==="caseResponse"){caseAnswers[caseIndex]=e.target.value;save();}
});
document.addEventListener("change",e=>{if(e.target?.name==="knowAnswer"){knowledgeAnswers[knowledgeIndex]=Number(e.target.value);save();}});
window.addEventListener("message",event=>{
 if(event.origin!==location.origin||!event.data||!current.startedAt||current.finishedAt)return;
 const msg=event.data;
 if(msg.type==="MVM_EXCEL_COMPLETE"&&msg.version===7){
  // The existing page listener updates excelPilotReport and navigates.
  current.excel={score:Number(msg.score)||0,answers:msg.answers||{},helperFormulas:msg.helperFormulas||[],formulaChecks:msg.formulaChecks||[],completedAt:now()};
  excelPilotReport=current.excel;save();
 }
 if(msg.type==="MVM_PIVOT_PROGRESS"&&msg.version===16){
  current.pivot={...(current.pivot||{}),snapshots:msg.snapshots||{},lastSavedAt:now(),completed:false};
  pivotPilotReport=current.pivot;save();
 }
 if(msg.type==="MVM_PIVOT_COMPLETE"&&msg.version===16){
  current.pivot={snapshots:msg.snapshots||{},completedAt:now(),completed:true};
  pivotPilotReport=current.pivot;save();
 }
 if(msg.type==="MVM_SQL_COMPLETE"&&msg.version===16){
  current.sql={completedAt:msg.completedAt||now(),code:String(msg.code||""),lastExecution:msg.lastExecution||null,executions:Number(msg.executions)||0};
  save();if(at===5)go(6);
 }
 if(msg.type==="MVM_PYTHON_COMPLETE"&&msg.version===16){
  current.python={completedAt:msg.completedAt||now(),code:String(msg.code||""),lastExecution:msg.lastExecution||null,executions:Number(msg.executions)||0,engineReady:!!msg.engineReady};
  save();if(at===6)go(7);
 }
});
function readPending(){
 for(const [key,target,next] of [
 ["mvm-pilot-pivot-pending","pivot",5],
 ["mvm-pilot-sql-pending","sql",6],
 ["mvm-pilot-python-pending","python",7]
 ]){
  const value=lookup(key);if(!value)continue;
  try{localStorage.removeItem(key);}catch(e){}
  if(target==="pivot"){current.pivot={snapshots:value.snapshots||{},completedAt:value.completedAt,completed:true};pivotPilotReport=current.pivot;}
  else current[target]={...value,completedAt:value.completedAt||now()};
  at=next;
 }
}
readPending();save();
render();
setInterval(tick,1000);
window.addEventListener("beforeunload",()=>{sync();store(ACTIVE,current);});
})();
