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
 pasteAttempts:0,dropAttempts:0,visibilityHiddenCount:0,hiddenMilliseconds:0,
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
function newField(){return{typedCharacters:0,deletedCharacters:0,backspacePresses:0,deletePresses:0,inputEvents:0,activeTypingMs:0,activeGaps:0,longestUninterruptedCharacters:0,currentUninterruptedCharacters:0,correctionCycles:0,typingAfterDeletion:false,firstAt:null,lastAt:null,medianGapSamplesMs:[]};}
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
function pasteAttempt(type,field,event){
 const now=time();
 if(now-lastPaste>250){
  state[type==="drop"?"dropAttempts":"pasteAttempts"]++;
  mark(type==="drop"?"drop_blocked":"paste_blocked",{field});
  lastPaste=now;
 }
 if(event?.preventDefault)event.preventDefault();
 if(event?.stopPropagation)event.stopPropagation();
 if(SOURCE==="excel"){const status=document.getElementById("status");if(status)status.textContent="Pegado bloqueado: escribe la fórmula o respuesta directamente.";}
 if(SOURCE==="sql"||SOURCE==="python"){const status=document.getElementById("state");if(status)status.textContent="Pegado bloqueado en la respuesta. Puedes escribir y editar tu solución.";}
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
 previous.set(e.target,{key:field,value:next});
 const item=observe(field);
 item.inputEvents++;
 const now=time();
 if(item._lastInputAt&&now-item._lastInputAt<=2500){
  const gap=now-item._lastInputAt;
  item.activeTypingMs+=gap;item.activeGaps++;
  item.medianGapSamplesMs.push(gap);
  if(item.medianGapSamplesMs.length>150)item.medianGapSamplesMs.shift();
 }
 item._lastInputAt=now;
 const min=Math.min(old.length,next.length);let prefix=0;
 while(prefix<min&&old[prefix]===next[prefix])prefix++;
 let suffix=0;
 while(suffix<min-prefix&&old[old.length-1-suffix]===next[next.length-1-suffix])suffix++;
 const del=old.length-prefix-suffix,add=next.length-prefix-suffix;
 if(del>0||String(e.inputType||"").startsWith("delete")){
  item.deletedCharacters+=Math.max(0,del);
  item.typingAfterDeletion=true;item.currentUninterruptedCharacters=0;
 }
 if(add>0){
  item.typedCharacters+=add;
  if(item.typingAfterDeletion){item.correctionCycles++;item.typingAfterDeletion=false;}
  item.currentUninterruptedCharacters+=add;
  item.longestUninterruptedCharacters=Math.max(item.longestUninterruptedCharacters,item.currentUninterruptedCharacters);
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
  delete f._lastInputAt;delete f.typingAfterDeletion;delete f.currentUninterruptedCharacters;delete f.medianGapSamplesMs;
 }
 return out;
}
function restore(x){
 if(!PARENT||!x||x.schema!=="MVM_MONITOR_1"||x.source!=="evaluation")return;
 state=JSON.parse(JSON.stringify(x));state.sessionId=sessionId;
 for(const f of Object.values(state.fields||{})){
  f._lastInputAt=null;f.typingAfterDeletion=false;f.currentUninterruptedCharacters=0;
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
