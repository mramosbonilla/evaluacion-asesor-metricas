/* MVM · Evaluación técnica. Estado local con receptor privado opcional y acuse verificable. */
(function(){
"use strict";
const INVITE_CODE=(()=>{const code=(new URLSearchParams(location.search).get("tester")||"").trim().toUpperCase();return /^P(?:0[1-9]|1[0-5])$/.test(code)?code:"";})();
const ACTIVE=INVITE_CODE?"mvm-assessment-active-v25-"+INVITE_CODE:"mvm-pilot-active-v16";
const ARCHIVE=INVITE_CODE?"mvm-assessment-archive-v25-"+INVITE_CODE:"mvm-pilot-archive-v16";
const now=()=>new Date().toISOString();
function createAttemptSuffix(){
 if(window.crypto?.getRandomValues){const a=new Uint8Array(10);window.crypto.getRandomValues(a);return Array.from(a,v=>v.toString(16).padStart(2,"0")).join("").toUpperCase();}
 return Math.random().toString(36).slice(2,13).toUpperCase();
}
const lookup=key=>{try{return JSON.parse(localStorage.getItem(key)||"null");}catch(e){return null;}};
let storageWorks=true;
const store=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));return true;}catch(e){storageWorks=false;return false;}};
function fresh(){
 return {schema:"MVM_PILOT_16",attemptId:"MVM-"+new Date().toISOString().slice(0,10).replace(/-/g,"")+"-"+createAttemptSuffix(),
 createdAt:now(),startedAt:null,finishedAt:null,finishReason:null,
 name:"",email:"",inviteCode:INVITE_CODE,integrityAcknowledgedAt:null,feedback:{device:"",clarity:"",navigation:"",technicalIssues:"",suggestions:""},stage:0,knowledgeIndex:0,caseIndex:0,
 objective:Array(15).fill(-1),openCases:["","",""],excel:null,pivot:null,sql:null,python:null};
}
let archive=lookup(ARCHIVE);if(!Array.isArray(archive))archive=[];
let current=lookup(ACTIVE);if(!current||current.schema!=="MVM_PILOT_16")current=fresh();
if(!Array.isArray(current.objective)||current.objective.length!==15)current.objective=Array(15).fill(-1);
if(!Array.isArray(current.openCases)||current.openCases.length!==3)current.openCases=["","",""];
if(!current.feedback)current.feedback={device:"",clarity:"",navigation:"",technicalIssues:"",suggestions:""};
if(!("integrityAcknowledgedAt" in current))current.integrityAcknowledgedAt=null;
if(INVITE_CODE)current.inviteCode=INVITE_CODE;
if(!current.monitoring)current.monitoring={consentAt:null,parent:null,tools:{}};
if(!current.monitoring.tools)current.monitoring.tools={};
window.__MVMMonitoringConsentGranted=!!current.monitoring.consentAt;
if(window.MVMInteractionMonitor){
 window.MVMInteractionMonitor.restore(current.monitoring.parent);
 window.MVMInteractionMonitor.onChange=snapshot=>{
  current.monitoring.parent=snapshot;
  store(ACTIVE,current);
 };
 if(current.startedAt&&!current.finishedAt&&current.monitoring.consentAt)window.MVMInteractionMonitor.start();
}
function restore(){
 for(let i=0;i<15;i++)knowledgeAnswers[i]=Number.isInteger(current.objective[i])?current.objective[i]:-1;
 for(let i=0;i<3;i++)caseAnswers[i]=String(current.openCases[i]||"");
 knowledgeIndex=Math.max(0,Math.min(14,Number(current.knowledgeIndex)||0));
 caseIndex=Math.max(0,Math.min(2,Number(current.caseIndex)||0));
 excelPilotReport=current.excel||null;pivotPilotReport=current.pivot||null;
 const forced=new URLSearchParams(location.search).has("etapa");
 at=Math.max(0,Math.min(8,forced?at:(Number(current.stage)||0)));
 // Los invitados no pueden saltarse la bienvenida y el aviso de monitoreo mediante una URL directa.
 if(INVITE_CODE&&!current.startedAt)at=0;
}
restore();
function monitoringSummary(){
 const data=current.monitoring||{parent:null,tools:{}};
 const parent=data.parent||{};
 const sources=[];
 for(const sessions of Object.values(data.tools||{}))
  for(const item of Object.values(sessions||{}))
   if(item&&item.schema==="MVM_MONITOR_1")sources.push(item);
 const fields={};
 for(const item of [parent,...sources]){
  for(const [field,f] of Object.entries(item.fields||{})){
   const origin=item.source||"evaluation",key=origin+"."+field;
   const total=fields[key]||{source:origin,field,typedCharacters:0,deletedCharacters:0,backspacePresses:0,deletePresses:0,inputEvents:0,activeTypingMs:0,correctionCycles:0,longestUninterruptedCharacters:0,writingSpanMs:0,pausesOver5Seconds:0,pausesOver10Seconds:0,longestInterInputPauseMs:0,substantialRevisionCount:0,multilineRevisionCount:0,minorDeletionEvents:0,maxDeletionSequenceChars:0};
   for(const k of ["typedCharacters","deletedCharacters","backspacePresses","deletePresses","inputEvents","activeTypingMs","correctionCycles","writingSpanMs","pausesOver5Seconds","pausesOver10Seconds","substantialRevisionCount","multilineRevisionCount","minorDeletionEvents"])total[k]+=Number(f[k]||0);
   for(const k of ["longestUninterruptedCharacters","longestInterInputPauseMs","maxDeletionSequenceChars"])
    total[k]=Math.max(total[k],Number(f[k]||0));
   total.activeCharactersPerSecond=total.activeTypingMs>=1000?Number((total.typedCharacters/(total.activeTypingMs/1000)).toFixed(2)):null;
   total.sustainedCharactersPerSecond=total.writingSpanMs>=30000?Number((total.typedCharacters/(total.writingSpanMs/1000)).toFixed(2)):null;
   total.deletionRatio=total.typedCharacters?Number((total.deletedCharacters/total.typedCharacters).toFixed(3)):null;
   fields[key]=total;
  }
 }
 const copyEvents=[parent,...sources].reduce((z,x)=>z+Number(x.copyAttempts||0),0);
 const pasteEvents=[parent,...sources].reduce((z,x)=>z+Number(x.pasteAttempts||0),0);
 const dropEvents=[parent,...sources].reduce((z,x)=>z+Number(x.dropAttempts||0),0);
 const legacyBlockedPaste=[parent,...sources].filter(x=>x.pasteAllowed!==true).reduce((z,x)=>z+Number(x.pasteAttempts||0),0);
 const tabs=Number(parent.visibilityHiddenCount||0),blur=Number(parent.focusLossCount||0);
 const alerts=[];
 if(tabs)alerts.push({code:"TAB_HIDDEN",level:"revisar",count:tabs,message:"La pestaña del examen dejó de estar visible "+tabs+" veces. No es posible saber qué pantalla se utilizó."});
 if(blur)alerts.push({code:"FOCUS_LOST",level:"informativo",count:blur,message:"La ventana perdió el foco "+blur+" veces; también puede suceder por funciones normales del navegador."});
 if(pasteEvents||dropEvents)alerts.push({code:"PASTE_DETECTED",level:"revisar",count:pasteEvents+dropEvents,message:"Se registraron "+pasteEvents+" eventos de pegado y "+dropEvents+" de arrastrar contenido en respuestas. El evento no permite conocer el origen del texto; revisar con el candidato."});
 if(copyEvents)alerts.push({code:"COPY_DETECTED",level:"informativo",count:copyEvents,message:"Se registraron "+copyEvents+" acciones de copiar contenido dentro de áreas de respuesta. No permite saber si también se copió información en otras aplicaciones."});
 for(const f of Object.values(fields)){
  const longForm=f.field.startsWith("caso_")||f.field==="consulta_sql"||f.field==="codigo_python";
  // Calibration rule, not a diagnosis: all indicators are required at once.
  // Excel formulas often require little revision even when solved independently.
  const continuousRapid=longForm&&f.typedCharacters>=300&&f.writingSpanMs>=45000&&
   f.sustainedCharactersPerSecond>=3.5&&f.pausesOver5Seconds<=1&&
   f.substantialRevisionCount===0&&f.multilineRevisionCount===0&&
   f.deletionRatio!==null&&f.deletionRatio<=0.05&&
   f.longestUninterruptedCharacters>=180;
  if(continuousRapid){
   alerts.push({
    code:"FAST_CONTINUOUS_LOW_REVISION",level:"revisar",source:f.source,field:f.field,
    evidence:{typedCharacters:f.typedCharacters,writingSeconds:Math.round(f.writingSpanMs/1000),
     sustainedCharactersPerSecond:f.sustainedCharactersPerSecond,pausesOver5Seconds:f.pausesOver5Seconds,
     deletedCharacters:f.deletedCharacters,deletionRatio:f.deletionRatio,
     substantialRevisionCount:f.substantialRevisionCount,multilineRevisionCount:f.multilineRevisionCount,
     longestUninterruptedCharacters:f.longestUninterruptedCharacters},
    message:"Se observó escritura sostenida rápida, con muy pocas pausas y sin revisiones extensas detectables en "+f.field+". El patrón podría ser compatible con transcripción, pero también con otras formas legítimas de redacción; requiere revisión contextual, no demuestra consulta de otro equipo."
   });
  }
 }
 return{enabled:!!data.consentAt,consentAt:data.consentAt||null,
  policy:"Los umbrales de escritura son orientativos y no validados como detector de fraude. Las métricas no afectan la calificación ni constituyen prueba de irregularidad; requieren revisión contextual y posibilidad de aclaración.",
  tabHiddenCount:tabs,hiddenSeconds:Math.round(Number(parent.hiddenMilliseconds||0)/1000),
  windowFocusLossCount:blur,windowUnfocusedSeconds:Math.round(Number(parent.focusLossMilliseconds||0)/1000),
  copyEvents,pasteEvents,pasteAttempts:pasteEvents,dropEvents,blockedPasteAttempts:legacyBlockedPaste,blockedDropAttempts:0,fields,alerts,detail:{parent,tools:data.tools||{}}};
}
function collect(){
 const elapsed=current.startedAt?Math.max(0,Math.round((Date.now()-Date.parse(current.startedAt))/1000)):0;
 return {
 schema:"MVM_PILOT_16",assessment:"Asesor de Métricas · MVM",attemptId:current.attemptId,
 candidate:{name:current.name.trim()||"Sin nombre",email:current.email.trim()||""},
 createdAt:current.createdAt,startedAt:current.startedAt,finishedAt:current.finishedAt,
 finishReason:current.finishReason||"en curso",timeLimitSeconds:4500,
 pilot:{invitationCode:current.inviteCode||INVITE_CODE||null,feedback:{...current.feedback},mode:INVITE_CODE?"PRUEBA_DE_USABILIDAD":"PILOTO_GENERAL",integrityAcknowledgedAt:current.integrityAcknowledgedAt},
 monitoring:monitoringSummary(),
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
function feedbackMarkup(){
 const deviceChoices=["","PC Windows","Mac","iPhone","Android","Tableta","Otro"];
 const scores=[["","Sin responder"],["1","1 · Muy difícil"],["2","2 · Difícil"],["3","3 · Aceptable"],["4","4 · Fácil"],["5","5 · Muy fácil"]];
 const deviceOptions=deviceChoices.map(v=>'<option value="'+safeHtml(v)+'">'+safeHtml(v||"Selecciona el equipo")+'</option>').join("");
 const scoreOptions=scores.map(v=>'<option value="'+v[0]+'">'+v[1]+'</option>').join("");
 return '<section class="question" id="feedbackSection"><h3>Comentarios sobre la prueba (fuera del cronómetro)</h3>'+
 '<p>Ayúdanos a mejorar la experiencia. Tus comentarios son opcionales y no afectan los resultados de la evaluación.</p>'+
 '<label for="feedbackDevice"><strong>¿En qué dispositivo hiciste la prueba?</strong></label><select id="feedbackDevice" style="width:100%;padding:10px;margin:5px 0 12px;border:1px solid #b9cce0;border-radius:8px">'+deviceOptions+'</select>'+
 '<label for="feedbackClarity"><strong>Claridad de las instrucciones</strong></label><select id="feedbackClarity" style="width:100%;padding:10px;margin:5px 0 12px;border:1px solid #b9cce0;border-radius:8px">'+scoreOptions+'</select>'+
 '<label for="feedbackNavigation"><strong>Facilidad de navegación y uso</strong></label><select id="feedbackNavigation" style="width:100%;padding:10px;margin:5px 0 12px;border:1px solid #b9cce0;border-radius:8px">'+scoreOptions+'</select>'+
 '<label for="feedbackIssues"><strong>¿Detectaste errores, bloqueos o dificultades técnicas?</strong></label><textarea id="feedbackIssues" placeholder="Indica la etapa, dispositivo y qué ocurrió…"></textarea>'+
 '<label for="feedbackSuggestions"><strong>¿Qué mejorarías de la evaluación?</strong></label><textarea id="feedbackSuggestions" placeholder="Comentarios sobre el contenido, duración y experiencia…"></textarea>'+
 '<p class="muted">Tus comentarios quedarán incluidos en la entrega de la evaluación.</p></section>';
}
function bindFeedback(){
 const fields=[["feedbackDevice","device"],["feedbackClarity","clarity"],["feedbackNavigation","navigation"],["feedbackIssues","technicalIssues"],["feedbackSuggestions","suggestions"]];
 for(const [id,key] of fields){
  const input=document.getElementById(id);if(!input)continue;
  input.value=String(current.feedback?.[key]||"");
  input.addEventListener(id==="feedbackIssues"||id==="feedbackSuggestions"?"input":"change",event=>{
   current.feedback[key]=event.target.value;save();
   if(current.finishedAt){
    const index=archive.findIndex(x=>x.attemptId===current.attemptId);
    if(index!==-1){archive[index]=collect();store(ARCHIVE,archive);}
   }
  });
 }
}
async function shareReport(){
 if(typeof navigator==="undefined"||typeof File==="undefined"||!navigator.share){
  alert("Este dispositivo no permite compartir el archivo directamente. Usa el botón Guardar evaluación y envía el documento al responsable del proceso.");
  return;
 }
 const data=JSON.stringify(collect(),null,2),file=new File([data],filename(current),{type:"application/json"});
 try{
  if(navigator.canShare&&!navigator.canShare({files:[file]}))throw Error("No admite adjuntos JSON");
  await navigator.share({files:[file],title:"Evaluación MVM · "+(current.inviteCode||""),text:"Adjunto mi evaluación técnica MVM."});
 }catch(error){
  if(error&&error.name==="AbortError")return;
  alert("No fue posible compartir la evaluación. Guarda el archivo y envíalo como documento adjunto al responsable del proceso.");
 }
}
let originalRender=render;
render=function(){
 originalRender();
 if(at===0){
  const area=document.getElementById("body");
  area.insertAdjacentHTML("beforeend",'<div class="question"><h3>Instrucciones generales</h3><p>La evaluación dispone de <strong>75 minutos</strong>. Resuelve las preguntas y las actividades de manera individual. Puedes guardar los avances dentro de cada herramienta y continuar con las siguientes secciones.</p><p>Al terminar tendrás la oportunidad de dejar comentarios sobre la experiencia y completar la entrega de la evaluación.</p></div>');

  area.insertAdjacentHTML("beforeend",'<div class="question" style="border:2px solid #c87923;background:#fff8eb"><h3>IMPORTANTE · Prueba individual de conocimientos</h3><p><strong>Esta evaluación comprueba tus conocimientos y razonamiento, no tu habilidad para obtener respuestas de herramientas de inteligencia artificial.</strong> No se permite consultar ChatGPT, Copilot, Gemini, otras IA, sitios web, personas o dispositivos externos para recibir, copiar y pegar, o transcribir respuestas. Debes resolver cada actividad por tus propios medios, utilizando únicamente los datos y herramientas incorporados en esta evaluación. <strong>Incumplir estas reglas constituye una falta a la integridad de la prueba.</strong></p><label style="display:flex;gap:10px;align-items:flex-start"><input id="integrityAgreement" type="checkbox" style="margin-top:4px"> He leído las reglas, me comprometo a resolver la evaluación sin ayuda externa y acepto el registro de mis respuestas e interacciones dentro de la prueba con fines de integridad.</label></div>');
  const integrity=document.getElementById("integrityAgreement");if(integrity)integrity.checked=!!current.integrityAcknowledgedAt;
  const startButton=document.getElementById("beginPilot");if(startButton)area.append(startButton);
  if(startButton&&window.MVMDelivery?.secureRequired?.()&&!window.MVMDelivery?.available?.()){
   startButton.disabled=true;startButton.textContent="Evaluación aún no habilitada";
   area.insertAdjacentHTML("beforeend",'<p class="muted" role="status">Esta evaluación todavía no está disponible para ser presentada. Contacta al responsable del proceso.</p>');
  }
  document.getElementById("beginPilot").onclick=()=>start();
 }
 if(at===1){
  const name=document.querySelector('#body input[type="text"]'),email=document.querySelector('#body input[type="email"]');
  if(name){name.value=current.name;name.setAttribute("autocomplete","off");name.addEventListener("input",e=>{current.name=e.target.value;save();});}
  if(email){email.value=current.email;email.setAttribute("autocomplete","off");email.addEventListener("input",e=>{current.email=e.target.value;save();});}
 }
 if(at===8){
  const area=document.getElementById("body"),n=knowledgeAnswers.filter(x=>x>=0).length,
   open=caseAnswers.filter(x=>x.trim()).length;
  area.innerHTML='<h2>'+(current.finishedAt?'Evaluación finalizada':'Revisión antes de entregar')+'</h2>'+
   '<p>Participante: <strong>'+safeHtml(current.name||"Sin nombre")+'</strong></p>'+
   '<div class="question"><p>Preguntas respondidas: <strong>'+n+' de 15</strong> · Casos desarrollados: <strong>'+open+' de 3</strong></p>'+
   '<p>Excel: '+(excelPilotReport?'completado':'pendiente')+' · Tablas dinámicas: '+(pivotPilotReport?'registradas':'pendientes')+
   ' · SQL: '+(current.sql?'completado':'pendiente')+' · Python: '+(current.python?'completado':'pendiente')+'</p></div>'+
   (current.finishedAt?
    '<p>Has finalizado las actividades. Antes de entregar, puedes dejar tus comentarios sobre la experiencia.</p>':
    '<p>Revisa que hayas completado las actividades. Una vez finalizada la evaluación, no podrás modificar tus respuestas.</p><button class="btn" id="closePilot" type="button">Finalizar actividades</button>');
  if(current.finishedAt){
   area.insertAdjacentHTML("beforeend",feedbackMarkup());
   bindFeedback();
   const auto=!!window.MVMDelivery?.available?.();
   area.insertAdjacentHTML("beforeend",auto?
    '<div class="question"><h3>Entrega de la evaluación</h3><p>Cuando hayas terminado tus comentarios, pulsa el botón para enviar tus respuestas al responsable del proceso.</p><button class="btn" id="submitEvaluation" type="button">Guardar y enviar evaluación</button><p id="deliveryStatus" role="status" aria-live="polite"></p><div id="deliveryBackup" style="display:none"><button class="btn secondary" id="exportReport" type="button">Guardar copia de respaldo</button></div></div>':
    (window.MVMDelivery?.secureRequired?.()?
     '<div class="question"><h3>Entrega de la evaluación</h3><p>La recepción segura no está disponible en este momento. Contacta al responsable y conserva esta página abierta.</p><button class="btn secondary" id="exportReport" type="button">Guardar copia de respaldo</button></div>':
     '<div class="question"><h3>Entrega de la evaluación</h3><p>Guarda tu evaluación y envíala al responsable del proceso.</p><div class="actions"><button class="btn" id="exportReport" type="button">Guardar evaluación</button><button class="btn secondary" id="shareReport" type="button">Compartir evaluación</button></div></div>'));
   const sendBtn=document.getElementById("submitEvaluation");
   // A frozen snapshot guarantees that retries after a timeout send identical bytes.
   if(current.submissionSnapshot){
    const inputs=area.querySelectorAll("#feedbackSection input,#feedbackSection textarea,#feedbackSection select");
    inputs.forEach(field=>field.disabled=true);
   }
   if(sendBtn)sendBtn.onclick=async()=>{
    if(current.delivery?.state==="confirmed"){return;}
    sendBtn.disabled=true;
    const st=document.getElementById("deliveryStatus");
    st.textContent="Enviando evaluación…";
    if(!current.submissionSnapshot){
     current.submissionSnapshot=collect();
     if(!store(ACTIVE,current)){
      st.textContent="No se pudo guardar la copia de seguridad en este dispositivo. No cierres la pantalla y contacta al responsable.";
      sendBtn.disabled=false;return;
     }
     const inputs=area.querySelectorAll("#feedbackSection input,#feedbackSection textarea,#feedbackSection select");
     inputs.forEach(field=>field.disabled=true);
    }
    try{
      const receipt=await window.MVMDelivery.send(current.submissionSnapshot);
      current.delivery={state:"confirmed",attemptId:receipt.attemptId,receivedAt:receipt.receivedAt||now()};
      store(ACTIVE,current);
      const found=archive.findIndex(x=>x.attemptId===current.attemptId);
      if(found!==-1){archive[found]=current.submissionSnapshot;store(ARCHIVE,archive);}
      st.textContent="Entrega recibida y confirmada. Puedes cerrar esta ventana.";
      sendBtn.textContent="Evaluación recibida ✓";
    }catch(error){
      st.textContent="No pudimos confirmar la recepción. Puedes reintentar sin perder los datos guardados.";
      const backup=document.getElementById("deliveryBackup");if(backup)backup.style.display="block";
      sendBtn.disabled=false;
    }
   };
   if(current.delivery?.state==="confirmed"&&sendBtn){
    sendBtn.textContent="Evaluación recibida ✓";sendBtn.disabled=true;
    const st=document.getElementById("deliveryStatus");if(st)st.textContent="Entrega recibida y confirmada.";
   }
  }
  const close=document.getElementById("closePilot");if(close)close.onclick=()=>finish("entrega_manual");
  const exp=document.getElementById("exportReport");if(exp)exp.onclick=()=>download(collect(),filename(current));
  const share=document.getElementById("shareReport");if(share)share.onclick=shareReport;
 }
 updateTop();
};
const originalGo=go;
go=function(i){
 if(current.finishedAt&&Number(i)!==8){alert("Esta evaluación ya fue finalizada y no puede editarse.");return;}
 if(!current.startedAt&&Number(i)!==0){alert("Primero pulsa «Comenzar prueba de 75 minutos» en Bienvenida.");return;}
 if(INVITE_CODE&&at===1&&Number(i)>1&&!current.name.trim()){alert("Escribe tu nombre en Identificación antes de continuar.");return;}
 if(INVITE_CODE&&at===4&&Number(i)>4&&Object.keys(pivotPilotReport?.snapshots||{}).length<3){alert("Primero debes guardar u omitir los tres ejercicios de tablas dinámicas. Al terminar el tercero avanzarás automáticamente.");return;}
 originalGo(i);save();
};
function start(){
 if(window.MVMDelivery?.secureRequired?.()&&!window.MVMDelivery?.available?.()){
  alert("La recepción segura de esta evaluación aún no está habilitada para este enlace. Contacta al responsable antes de comenzar.");
  return;
 }
 if(!current.integrityAcknowledgedAt&&!document.getElementById("integrityAgreement")?.checked){
  alert("Para comenzar debes leer y aceptar las reglas de conocimientos propios y ausencia de asistencia externa.");return;
 }
 if(!current.integrityAcknowledgedAt)current.integrityAcknowledgedAt=now();
 if(!current.monitoring.consentAt)current.monitoring.consentAt=current.integrityAcknowledgedAt||now();
 window.__MVMMonitoringConsentGranted=true;
 if(window.MVMInteractionMonitor)window.MVMInteractionMonitor.start();
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
 return "Archivo-"+(a.inviteCode?a.inviteCode+"-":"")+person+"-PruebaAsesor-"+id+".json";
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
 if(window.MVMInteractionMonitor){
  window.MVMInteractionMonitor.stop();
  current.monitoring.parent=window.MVMInteractionMonitor.snapshot();
 }
 const report=collect();
 archive.push(report);store(ARCHIVE,archive);store(ACTIVE,current);
 const last=at;at=8;updateCurrentStageUrl();render();save();
 if(reason==="tiempo_agotado")alert("Se agotó el tiempo de la evaluación. Las respuestas quedaron cerradas. Completa los pasos de entrega.");
 else if(!INVITE_CODE&&!window.MVMDelivery?.available?.())download(report,filename(current));
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
 '<div><strong>Evaluación MVM</strong> · '+safeHtml(current.name||"Participante")+
 ' <span class="chip">'+(current.finishedAt?'Finalizada':current.startedAt?'En curso':'Sin iniciar')+'</span>'+
 '</div>'+
 '<div style="display:flex;gap:9px;align-items:center"><strong id="pilotTimer" style="font-variant-numeric:tabular-nums;font-size:21px">'+clock+'</strong>'+
 '<button type="button" class="btn secondary" id="savePilot" style="padding:7px 10px">Guardar avance</button></div></div>'+
 '<p class="muted" style="margin:4px 0;font-size:12px">'+(storageWorks?'Avance guardado en este dispositivo.':'No se pudo guardar el avance. No cierres la página hasta finalizar.')+'</p>';
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
 if(msg.type==="MVM_PIVOT_RESTORE_REQUEST"&&msg.version===21&&at===4){
  const frame=document.getElementById("pivotPreviewFrame");
  if(frame?.contentWindow&&(!event.source||event.source===frame.contentWindow)){
   frame.contentWindow.postMessage({type:"MVM_PIVOT_RESTORE",version:21,snapshots:current.pivot?.snapshots||{}},location.origin);
  }
  return;
 }
 if(msg.type==="MVM_MONITOR_UPDATE"&&msg.version===1){
  if(!current.monitoring.consentAt)return;
  const source=String(msg.source||""),sid=String(msg.sessionId||"");
  if(!["excel","sql","python","pivot"].includes(source)||!/^S[a-z0-9-]+$/i.test(sid)||!msg.snapshot||msg.snapshot.source!==source)return;
  current.monitoring.tools[source] ||= {};
  current.monitoring.tools[source][sid]=msg.snapshot;
  const keys=Object.keys(current.monitoring.tools[source]);
  if(keys.length>30)delete current.monitoring.tools[source][keys[0]];
  store(ACTIVE,current);
  return;
 }
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
