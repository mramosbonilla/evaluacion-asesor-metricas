/* MVM · Evaluación piloto: métricas de interacción transparentes (sin keylogging).
   Sólo recuenta tiempos, pulsaciones y acciones dentro de la evaluación.
   No lee el portapapeles, otras pestañas, URLs externas, pantalla ni actividad de otras apps.
   Las alertas son orientativas: no demuestran fraude ni alteran la nota. */
(function(){
"use strict";
const filename=String(location.pathname||"").split("/").pop().toLowerCase();
const SOURCE=filename==="vista-previa.html"?"evaluation":filename==="index.html"?"excel":filename==="sql.html"?"sql":filename==="python.html"?"python":filename==="excel-pivot.html"?"pivot":"other";
const PARENT=SOURCE==="evaluation";
const EMBEDDED=new URLSearchParams(location.search).get("embed")==="1";
const sessionId="S"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,8);
const empty=()=>({
 schema:"MVM_MONITOR_1",source:SOURCE,sessionId,firstAt:null,lastAt:null,
 pasteAttempts:0,dropAttempts:0,pasteAllowed:true,visibilityHiddenCount:0,hiddenMilliseconds:0,
 focusLossCount:0,focusLossMilliseconds:0,hiddenSince:null,blurSince:null,
 fields:{},events:[]
});
const parentConsent=()=>{
 if(PARENT||!EMBEDDED||window.parent===window)return false;
 try{return window.parent.__MVMMonitoringConsentGranted===true;}
 catch(e){return false;}
};
let state=empty(),enabled=!PARENT&&EMBEDDED&&parentConsent(),finished=false,lastPaste=0,lastReport=0;
const previous=new WeakMap(),beforeInput=new WeakMap();
function time(){return Date.now();}
function newField(){return{typedCharacters:0,deletedCharacters:0,backspacePresses:0,deletePresses:0,inputEvents:0,activeTypingMs:0,activeGaps:0,longestUninterruptedCharacters:0,currentUninterruptedCharacters:0,correctionCycles:0,typingAfterDeletion:false,firstAt:null,lastAt:null,firstInputAt:null,lastInputAt:null,writingSpanMs:0,pausesOver5Seconds:0,pausesOver10Seconds:0,longestInterInputPauseMs:0,substantialRevisionCount:0,multilineRevisionCount:0,minorDeletionEvents:0,maxDeletionSequenceChars:0,medianGapSamplesMs:[],_deletionRunChars:0,_deletionRunCounted:false,_deletionLineCounted:false,_lastDeletionAt:null};}
function fieldName(el){
 if(!el||!el.matches)return null;
 if(PARENT&&el.matches("#caseResponse")){
  const n=typeof caseIndex==="number"?caseIndex+1:0;
  return "caso_"+n;
 }
 if(SOURCE==="excel"){
  const parentCell=el.closest?.("td[data-cell]")?.dataset?.cell;
  if(el.matches("#fx, .inline-edit"))return "formula_"+String(parentCell||document.getElementById("cellname")?.textContent||"sin_celda").toUpperCase();
 }
 if(SOURCE==="sql"&&el.matches("#editor"))return "consulta_sql";
 if(SOURCE==="python"&&el.matches("#code"))return "codigo_python";
 if(SOURCE==="pivot"&&el.matches(".pivot-answer"))return "pivot_"+String(el.dataset?.answer||"respuesta");
 return null;
}
function accessibleTarget(el){
 if(!enabled||finished)return null;
 const field=fieldName(el);
 if(!field)return null;
 return {field};
}
function mark(kind,detail){
 const event={at:new Date().toISOString(),source:SOURCE,type:kind};
 if(detail)for(const [k,v] of Object.entries(detail))if(v!==undefined)event[k]=v;
 state.events.push(event);
 if(state.events.length>100)state.events.shift();
 state.lastAt=event.at;
 changed(true);
}
function observe(field){
 const f=state.fields[field]||(state.fields[field]=newField());
 if(!f.firstAt)f.firstAt=new Date().toISOString();
 f.lastAt=new Date().toISOString();
 return f;
}
function changed(immediate){
 if(!enabled||finished)return;
 const now=time();
 if(PARENT){
  if(typeof window.MVMInteractionMonitor.onChange==="function")window.MVMInteractionMonitor.onChange(snapshot());
 }else if(EMBEDDED&&window.parent!==window){
  if(immediate||now-lastReport>=1100)sendToParent();
 }
}
function sendToParent(){
 if(!enabled||finished||PARENT||!EMBEDDED||window.parent===window)return;
 lastReport=time();
 try{window.parent.postMessage({type:"MVM_MONITOR_UPDATE",version:1,source:SOURCE,sessionId,snapshot:snapshot()},location.origin);}catch(e){}
}
function showPasteWarning(field){
 if(!document.body)return;
 let alert=document.getElementById("mvmPasteWarning");
 if(!alert){
  alert=document.createElement("div");
  alert.id="mvmPasteWarning";
  alert.setAttribute("role","alert");
  alert.style.cssText="position:fixed;top:12px;right:12px;max-width:min(560px,calc(100vw - 24px));background:#fff3e8;color:#752713;border:2px solid #bc4b22;border-radius:10px;box-shadow:0 8px 28px #0003;z-index:99999;padding:14px 17px;font:14px/1.45 system-ui,sans-serif";
  const title=document.createElement("strong");title.textContent="ALERTA IMPORTANTE · Regla de integridad";
  const text=document.createElement("p");
  text.textContent="Se ha registrado una acción de pegado en un área de respuesta. Está prohibido recibir, copiar y pegar, o transcribir respuestas obtenidas de IA o fuentes externas: hacerlo constituye una falta a la integridad de la evaluación. El evento quedará registrado para revisión.";
  text.style.margin="7px 0";
  const button=document.createElement("button");
  button.type="button";button.textContent="Entendido";
  button.style.cssText="padding:6px 13px;border:1px solid #bc4b22;border-radius:6px;background:#fff;color:#752713;cursor:pointer";
  button.onclick=()=>alert.remove();
  alert.append(title,text,button);document.body.append(alert);
 }
 alert.setAttribute("data-field",field);
}
function pasteAttempt(type,field,event){
 const now=time();
 // Ctrl+V, paste and beforeinput commonly describe ONE action. Deduplicate them.
 if(now-lastPaste<=350)return;
 lastPaste=now;
 if(type==="paste")state.pasteAttempts++;
 else state.dropAttempts++;
 mark(type==="paste"?"paste_detected":"drop_detected",{field,allowed:true});
 showPasteWarning(field);
 if(!PARENT&&EMBEDDED&&window.parent!==window){
  try{window.parent.postMessage({type:"MVM_PASTE_NOTICE",version:21,field,source:SOURCE,at:new Date().toISOString()},location.origin);}catch(e){}
 }
 // Deliberately do not call preventDefault(): the browser may insert the pasted text.
}
document.addEventListener("focusin",e=>{
 const field=accessibleTarget(e.target)?.field;
 if(field)previous.set(e.target,{key:field,value:String(e.target.value||"")});
},true);
document.addEventListener("keydown",e=>{
 const field=accessibleTarget(e.target)?.field;
 if(!field)return;
 if((e.ctrlKey||e.metaKey)&&String(e.key||"").toLowerCase()==="v"){
  pasteAttempt("paste",field,e);return;
 }
 if(e.key==="Backspace"||e.key==="Delete"){
  const f=observe(field);
  if(e.key==="Backspace")f.backspacePresses++;
  else f.deletePresses++;
  // A correction sequence may be followed by a new writing segment.
  f.typingAfterDeletion=true;f.currentUninterruptedCharacters=0;
  changed(false);
 }
},true);
document.addEventListener("paste",e=>{
 const field=accessibleTarget(e.target)?.field;
 if(field)pasteAttempt("paste",field,e);
},true);
document.addEventListener("drop",e=>{
 const field=accessibleTarget(e.target)?.field;
 if(field)pasteAttempt("drop",field,e);
},true);
document.addEventListener("beforeinput",e=>{
 const field=accessibleTarget(e.target)?.field;if(!field)return;
 if(e.inputType==="insertFromPaste"||e.inputType==="insertFromPasteAsQuotation"){pasteAttempt("paste",field,e);return;}
 if(e.inputType==="insertFromDrop"){pasteAttempt("drop",field,e);return;}
 beforeInput.set(e.target,{key:field,value:String(e.target.value||"")});
},true);
document.addEventListener("input",e=>{
 const field=accessibleTarget(e.target)?.field;if(!field)return;
 const next=String(e.target.value||""),before=beforeInput.get(e.target),last=previous.get(e.target);
 const old=(before?.key===field?before.value:last?.key===field?last.value:next);
 beforeInput.delete(e.target);
 previous.set(e.target,{key:field,value:next});
 const item=observe(field),now=time();
 item.inputEvents++;
 if(!item.firstInputAt)item.firstInputAt=new Date(now).toISOString();
 if(item._lastInputAt!=null){
  const gap=Math.max(0,now-item._lastInputAt);
  if(gap<=2500){
   item.activeTypingMs+=gap;item.activeGaps++;
   item.medianGapSamplesMs.push(gap);
   if(item.medianGapSamplesMs.length>150)item.medianGapSamplesMs.shift();
  }
  if(gap>=5000)item.pausesOver5Seconds++;
  if(gap>=10000)item.pausesOver10Seconds++;
  item.longestInterInputPauseMs=Math.max(item.longestInterInputPauseMs,gap);
 }
 item._lastInputAt=now;
 item.lastInputAt=new Date(now).toISOString();
 item.writingSpanMs=Math.max(0,now-Date.parse(item.firstInputAt));
 const min=Math.min(old.length,next.length);let prefix=0;
 while(prefix<min&&old[prefix]===next[prefix])prefix++;
 let suffix=0;
 while(suffix<min-prefix&&old[old.length-1-suffix]===next[next.length-1-suffix])suffix++;
 const del=old.length-prefix-suffix,add=next.length-prefix-suffix;
 if(del>0){
  item.deletedCharacters+=del;
  if(del<=3)item.minorDeletionEvents++;
  const sameRun=item._lastDeletionAt!=null&&now-item._lastDeletionAt<=1800&&item._deletionRunChars>0;
  if(!sameRun){
   item._deletionRunChars=0;item._deletionRunCounted=false;item._deletionLineCounted=false;
  }
  item._deletionRunChars+=del;item._lastDeletionAt=now;
  item.maxDeletionSequenceChars=Math.max(item.maxDeletionSequenceChars,item._deletionRunChars);
  if(item._deletionRunChars>=20&&!item._deletionRunCounted){
   item.substantialRevisionCount++;
   item._deletionRunCounted=true;
  }
  const removed=old.slice(prefix,old.length-suffix);
  if(removed.includes("\n")&&!item._deletionLineCounted){
   item.multilineRevisionCount++;
   item._deletionLineCounted=true;
  }
  item.typingAfterDeletion=true;
  item.currentUninterruptedCharacters=0;
 }else if(String(e.inputType||"").startsWith("delete")){
  item.typingAfterDeletion=true;item.currentUninterruptedCharacters=0;
 }
 if(add>0){
  item.typedCharacters+=add;
  if(item.typingAfterDeletion){item.correctionCycles++;item.typingAfterDeletion=false;}
  item.currentUninterruptedCharacters+=add;
  item.longestUninterruptedCharacters=Math.max(item.longestUninterruptedCharacters,item.currentUninterruptedCharacters);
  item._deletionRunChars=0;item._deletionRunCounted=false;item._deletionLineCounted=false;
 }
 changed(false);
},true);
if(PARENT){
 document.addEventListener("visibilitychange",()=>{
  if(!enabled||finished)return;
  const t=time();
  if(document.hidden){
   if(!state.hiddenSince){state.hiddenSince=t;state.visibilityHiddenCount++;mark("exam_tab_hidden");}
  }else if(state.hiddenSince){
   state.hiddenMilliseconds+=Math.max(0,t-state.hiddenSince);
   state.hiddenSince=null;mark("exam_tab_visible");
  }
 });
 window.addEventListener("blur",()=>{
  if(!enabled||finished||document.hidden)return;
  // Focusing an embedded Excel/SQL/Python editor also blurs the parent window.
  if(document.activeElement?.tagName==="IFRAME")return;
  if(!state.blurSince){state.blurSince=time();state.focusLossCount++;mark("exam_window_unfocused");}
 });
 window.addEventListener("focus",()=>{
  if(!enabled||finished||!state.blurSince)return;
  state.focusLossMilliseconds+=Math.max(0,time()-state.blurSince);
  state.blurSince=null;mark("exam_window_refocused");
 });
}
function snapshot(){
 const t=time(),out=JSON.parse(JSON.stringify(state));
 if(out.hiddenSince)out.hiddenMilliseconds+=Math.max(0,t-out.hiddenSince);
 if(out.blurSince)out.focusLossMilliseconds+=Math.max(0,t-out.blurSince);
 for(const f of Object.values(out.fields)){
  const samples=f.medianGapSamplesMs||[];
  if(samples.length){const arr=[...samples].sort((a,b)=>a-b);f.medianInterInputMs=arr[Math.floor(arr.length/2)];}
  else f.medianInterInputMs=null;
  f.activeCharactersPerSecond=f.activeTypingMs>=1000?Number((f.typedCharacters/(f.activeTypingMs/1000)).toFixed(2)):null;
  f.sustainedCharactersPerSecond=f.writingSpanMs>=30000?Number((f.typedCharacters/(f.writingSpanMs/1000)).toFixed(2)):null;
  f.deletionRatio=f.typedCharacters?Number((f.deletedCharacters/f.typedCharacters).toFixed(3)):null;
  delete f._lastInputAt;delete f.typingAfterDeletion;delete f.currentUninterruptedCharacters;delete f.medianGapSamplesMs;
  delete f._deletionRunChars;delete f._deletionRunCounted;delete f._deletionLineCounted;delete f._lastDeletionAt;
 }
 return out;
}
function restore(x){
 if(!PARENT||!x||x.schema!=="MVM_MONITOR_1"||x.source!=="evaluation")return;
 state=JSON.parse(JSON.stringify(x));state.sessionId=sessionId;
 for(const f of Object.values(state.fields||{})){
  f._lastInputAt=null;f.typingAfterDeletion=false;f.currentUninterruptedCharacters=0;
  f._deletionRunChars=0;f._deletionRunCounted=false;f._deletionLineCounted=false;f._lastDeletionAt=null;
  f.medianGapSamplesMs=[];
 }
 if(state.hiddenSince)state.hiddenSince=null;
 if(state.blurSince)state.blurSince=null;
}
function start(){enabled=true;finished=false;if(!state.firstAt)state.firstAt=new Date().toISOString();}
function stop(){
 if(!enabled||finished)return;
 if(PARENT){
  if(state.hiddenSince){state.hiddenMilliseconds+=Math.max(0,time()-state.hiddenSince);state.hiddenSince=null;}
  if(state.blurSince){state.focusLossMilliseconds+=Math.max(0,time()-state.blurSince);state.blurSince=null;}
 }
 changed(true);finished=true;
}
window.MVMInteractionMonitor={start,stop,restore,snapshot,source:SOURCE,sessionId,onChange:null,sendToParent};
// Flush child statistics before moving to the next embedded module, reloading, or closing.
if(!PARENT&&EMBEDDED){
 document.addEventListener("click",e=>{
  if(e.target?.closest?.("#finish,#finishPivot,#finishSQL,#finishPython"))sendToParent();
 },true);
 window.addEventListener("pagehide",()=>sendToParent());
 document.addEventListener("visibilitychange",()=>{if(document.hidden)sendToParent();});
 if(parentConsent())start();
}
})();
