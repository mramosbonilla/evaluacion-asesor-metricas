/* V36 isolated test portal. Production stays on V35. */
var caseIndex=0;
(()=>{
"use strict";
const $=id=>document.getElementById(id),cfg=window.MVM36_CONFIG||{},qs=new URLSearchParams(location.search);
const invitation={code:qs.get("tester")||"",token:qs.get("token")||""};
const allowed=cfg.enabled===true&&/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(cfg.endpoint||"")&&(invitation.code==="T36"||/^P0[2-5]$/.test(invitation.code))&&/^[a-f0-9]{64}$/.test(invitation.token);
const stages=["identification","objective","excel","pivot","sql","python","open","final"];
const labels=["Identificación","Preguntas de opción múltiple","Excel · fórmulas","Excel · tablas dinámicas","SQL","Python","Preguntas abiertas","Finalización"];
const tools=["excel","pivot","sql","python"];
let view=null,attemptId=null,offset=0,busy=false,complete=false,frame=null,answer=null,lease=null,exclusive=false,mon={},lastSave=0,dirty=false;
function nonce(){return Array.from(crypto.getRandomValues(new Uint8Array(24)),b=>b.toString(16).padStart(2,"0")).join("");}
function identity(){let b=localStorage.getItem("mvm36-browser-"+invitation.code);if(!/^[a-f0-9]{48}$/.test(b||"")){b=nonce();localStorage.setItem("mvm36-browser-"+invitation.code,b);}const store=exclusive?localStorage:sessionStorage,key="mvm36-tab-"+invitation.code;let t=store.getItem(key);if(!/^[a-f0-9]{48}$/.test(t||"")){t=nonce();store.setItem(key,t);}return {browser:b,tab:t};}
function lock(){if(!navigator.locks?.request)return Promise.resolve(true);if(!lease)lease=new Promise(resolve=>{navigator.locks.request("mvm36-"+invitation.code,{ifAvailable:true},l=>{if(!l){lease=null;resolve(false);return;}exclusive=true;resolve(true);return new Promise(()=>{});}).catch(()=>{lease=null;resolve(false);});});return lease;}
function request(action,payload={}){
 return new Promise((resolve,reject)=>{
  if(!allowed){reject(Error("Entorno de ensayo no habilitado."));return;}
  let ids,n;try{ids=identity();n=nonce();}catch(e){reject(Error("No se pudo conservar identidad de sesión."));return;}
  const iframe=document.createElement("iframe"),form=document.createElement("form");iframe.name="mvm36_"+n.slice(0,24);iframe.hidden=true;form.hidden=true;form.method="POST";form.action=cfg.endpoint;form.target=iframe.name;
  const fields={action:"v36_"+action,invitationCode:invitation.code,invitationToken:invitation.token,nonce:n,payload:JSON.stringify(payload),...ids};
  for(const [k,v] of Object.entries(fields)){const x=document.createElement("input");x.type="hidden";x.name=k;x.value=v;form.append(x);}
  let done=false;function end(err,res){if(done)return;done=true;clearTimeout(timer);window.removeEventListener("message",receipt);form.remove();iframe.remove();err?reject(err):resolve(res);}
  function receipt(e){const d=e.data;if(!/^https:\/\/(?:script\.google\.com|script\.googleusercontent\.com|[a-z0-9-]+-script\.googleusercontent\.com)$/.test(e.origin)||d?.type!=="MVM36_SESSION_RECEIPT"||d?.version!==36||d.nonce!==n)return;d.ok?end(null,d):end(Error(d.status||"REJECTED"));}
  window.addEventListener("message",receipt);const timer=setTimeout(()=>end(Error("Sin confirmación del servidor. Reintenta.")),45000);document.body.append(iframe,form);try{form.submit();}catch(e){end(e);}
 });
}
function el(tag,text,cls){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;}
function button(label,fn){const b=el("button",label,"btn");b.type="button";b.onclick=fn;return b;}
function status(s){$("status").textContent=s;}
function nav(){const current=view?stages.indexOf(view.stage):-1;$("nav").replaceChildren(el("div","Bienvenida","step"+(current<0&&!complete?" active":"")));labels.forEach((label,i)=>{$("nav").append(el("div",(i<current?"✓ ":"")+label,"step"+(i===current?" active":"")+(i>=2&&i<=5?" nav-tools":"")));});}
function draftKey(){return attemptId&&view?"mvm36-draft-"+attemptId+"-"+view.stage+"-"+view.caseIndex:null;}
function localGet(){const k=draftKey();try{return k?JSON.parse(localStorage.getItem(k)||"null"):null}catch(e){return null}}
function localPut(v){const k=draftKey();if(k)try{localStorage.setItem(k,JSON.stringify(v));}catch(e){status("No se pudo guardar la copia local.");}}
function localClear(){const k=draftKey();if(k)try{localStorage.removeItem(k)}catch(e){}}
function clone(x){return JSON.parse(JSON.stringify(x));}
window.MVM36Stage={get(kind){return view?.stage===kind?clone(view.content):null}};
function serverSimDraft(kind){
 const d=view?.draft;if(!d)return null;
 if(kind==="excel"){
  const cells={};const base=[["ID","Canal","Título del libro","Zona","Órdenes","Estado","Mes"],...view.content.rows.map(r=>[r.id,r.canal,r.titulo,r.region,r.pedidos,r.estado,r.mes])];base.forEach((r,i)=>r.forEach((v,j)=>cells[String.fromCharCode(65+j)+(i+1)]=String(v)));Object.assign(cells,{"I2":"Indicador","J2":"Resultado","I3":"Órdenes creadas","I4":"Órdenes canceladas","I5":"Tasa cancelación","I7":"Brecha entre canales"},d.formulas||{});return {cells,selected:"A1"};
 }
 if(kind==="pivot"){const snapshots=Object.fromEntries((d.exercises||[]).map(x=>[x.id,x]));return {snapshots,activeExercise:Math.min(3,Object.keys(snapshots).length+1),builder:{},answers:{},filterValues:[]};}
 return {code:d.code||"",text:d.code||"",value:d.code||""};
}
window.MVMDraft={get(kind){if(view?.stage!==kind)return null;return localGet()?.sim||serverSimDraft(kind)},put(kind,data){if(view?.stage!==kind||complete)return;const old=localGet()?.sim;if(JSON.stringify(old)===JSON.stringify(data))return;localPut({sim:data});dirty=true;}};
function draftAnswer(){if(!view)return {};if(!tools.includes(view.stage))return answer||{};
 const d=localGet()?.sim||serverSimDraft(view.stage)||{};
 if(view.stage==="excel")return {formulas:Object.fromEntries(Object.entries(d.cells||{}).filter(([k])=>/^[H-K][1-9][0-9]*$/.test(k)&&!["I2","J2","I3","I4","I5","I7"].includes(k)).map(([k,v])=>[k,String(v)]))};
 if(view.stage==="pivot")return {exercises:Object.values(d.snapshots||{})};
 return {code:String(d.code??d.text??d.value??"")};
}
function telemetry(){const p=window.MVMInteractionMonitor?.snapshot?.();return {...mon,...(p?{evaluation:p}:{})}}
function fromView(r,rerender=true){if(!r.view){complete=true;view=null;frame=null;render();status("Entrega confirmada por el servidor.");return;}attemptId=r.attemptId;view=r.view;caseIndex=view.caseIndex;offset=view.serverNow-Date.now();if(rerender)render();lastSave=Date.now();}
function welcome(){const body=$("body");body.replaceChildren(el("h2","Evaluación técnica · Asesor de Métricas"),el("p","Tienes 75 minutos. Responde las preguntas de opción múltiple, completa los simuladores y las preguntas abiertas. Al cerrar una etapa no podrás regresar. El tiempo continúa si cierras la página."),el("p","No utilices IA ni ayuda externa. Registramos indicadores de interacción dentro de la evaluación; las alertas son orientativas y no prueban por sí solas una falta."));const lab=el("label"),check=el("input");check.type="checkbox";lab.append(check,document.createTextNode(" Acepto las reglas de integridad"));body.append(lab,button("Comenzar o reanudar",async()=>{if(!check.checked){status("Debes aceptar las reglas.");return;}await claim();}));if(!allowed){body.append(el("p","Entorno de ensayo deshabilitado. No uses invitaciones de producción.","notice"));}nav();}
function render(){
 const body=$("body");frame=null;body.replaceChildren();nav();document.body.classList.toggle("tool-wide",!!view&&tools.includes(view.stage));
 if(complete){body.append(el("h2","Entrega confirmada"),el("p","El servidor confirmó la recepción. Puedes cerrar la ventana."));return;}
 if(!view){welcome();return;}
 const s=view.stage,d=localGet()?.answer||view.draft||{};
 body.append(el("h2",labels[stages.indexOf(s)]));
 const saveLocal=()=>{localPut({answer});dirty=true;};
 if(s==="identification"){
  answer={name:d.name||"",email:d.email||""};for(const k of ["name","email"]){const l=el("label",k==="name"?"Nombre":"Correo"),input=el("input");input.type=k==="email"?"email":"text";input.value=answer[k];input.oninput=()=>{answer[k]=input.value;saveLocal()};l.append(input);body.append(l);}
 }else if(s==="objective"){
  const arr=(d.answers||[]).map(x=>x&&typeof x==="object"?x.selected:x);answer={answers:Array.from({length:15},(_,i)=>arr[i]??null)};
  let qIndex=0;const question=el("div"),controls=el("div",undefined,"actions");body.append(question,controls);
  const show=()=>{const q=view.content[qIndex];question.replaceChildren(el("h3","Pregunta "+(qIndex+1)+" de "+view.content.length),el("p",q.prompt));q.options.forEach((opt,i)=>{const l=el("label"),x=el("input");x.type="radio";x.name="option";x.checked=answer.answers[qIndex]===i;x.onchange=()=>{answer.answers[qIndex]=i;saveLocal()};l.append(x,document.createTextNode(" "+opt));question.append(l)});controls.replaceChildren(button("Anterior",()=>{if(qIndex>0){qIndex--;show()}}),button("Siguiente",()=>{if(qIndex<view.content.length-1){qIndex++;show()}}),el("span",answer.answers.filter(x=>x!==null).length+" de "+view.content.length+" respondidas"))};show();
 }else if(s==="open"){
  answer={response:d.response||""};body.append(el("p","Caso "+(view.caseIndex+1)+" de 3"),el("h3",view.content.title),el("p",view.content.prompt));const t=el("textarea");t.id="caseResponse";t.value=answer.response;t.rows=12;t.oninput=()=>{answer.response=t.value;saveLocal()};body.append(t);
 }else if(tools.includes(s)){
  answer=null;frame=el("iframe");frame.className="v36-frame";frame.title=labels[stages.indexOf(s)];frame.src="./"+s+".html?embed=1&v=36";body.append(frame);
 }else if(s==="final"){body.append(el("p","Confirma la entrega final de tu evaluación."),button("Entregar evaluación",()=>transact("finalize",{})));return;}
 const controls=el("div",undefined,"actions");controls.append(button("Guardar avance",()=>transact("save",draftAnswer())));
 if(!tools.includes(s))controls.append(button("Confirmar y continuar",()=>{if(confirm("¿Cerrar esta etapa? No podrás regresar."))transact("advance",draftAnswer());}));
 controls.append(button("Salir",()=>{if(confirm("El reloj seguirá corriendo. ¿Guardar y salir?"))transact("save",draftAnswer(),true);}));
 body.append(controls);
}
async function claim(){if(busy||complete)return;busy=true;status("Verificando sesión…");try{if(!await lock())throw Error("Otra pestaña tiene abierta la evaluación.");const r=await request("claim");window.__MVMMonitoringConsentGranted=true;window.MVMInteractionMonitor?.start?.();fromView(r);status(complete?"Entrega confirmada":"Sesión activa");}catch(e){status(String(e.message||e));}finally{busy=false;}}
async function transact(action,a,exit=false){
 if(busy||!view||complete)return;
 busy=true;const current=view;const key=draftKey();status("Guardando en el servidor…");
 try{const r=await request(action,{attemptId,stage:current.stage,caseIndex:current.caseIndex,revision:current.revision,answer:a,monitor:telemetry()});if(action!=="save"||!r.view){if(key)try{localStorage.removeItem(key)}catch(e){};mon={};}fromView(r,action!=="save"||!r.view);dirty=false;status(complete?"Entrega confirmada":"Guardado en servidor");if(exit&&!complete){view=null;render();status("Avance guardado. Puedes cerrar esta ventana.");}}
 catch(e){status(String(e.message||e)+" · El avance local se conserva; reanuda para reconciliar la sesión.");}finally{busy=false;}
}
window.addEventListener("message",e=>{
 if(!frame||e.origin!==location.origin||e.source!==frame.contentWindow||!view||complete)return;
 const d=e.data;if(!d)return;if(d.type==="MVM_MONITOR_UPDATE"&&d.snapshot){mon[view.stage]=d.snapshot;return;}
 if(d.type==="MVM36_SIM_COMPLETE"&&d.stage===view.stage)transact("advance",d.answer);
 if((d.type==="MVM_SQL_COMPLETE"&&view.stage==="sql")||(d.type==="MVM_PYTHON_COMPLETE"&&view.stage==="python"))transact("advance",{code:String(d.code||"")});
});
setInterval(()=>{if(!view||complete)return;const seconds=Math.max(0,Math.ceil((view.deadline-Date.now()-offset)/1000));$("timer").textContent=String(Math.floor(seconds/60)).padStart(2,"0")+":"+String(seconds%60).padStart(2,"0");if(seconds===0&&!busy)transact("finalize",{});else if(!busy&&view.stage!=="final"&&Date.now()-lastSave>=85000){transact("save",draftAnswer());}},1000);
window.addEventListener("beforeunload",e=>{if(view&&!complete){e.preventDefault();e.returnValue="";}});
render();
})();
