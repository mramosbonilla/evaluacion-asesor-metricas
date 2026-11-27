/* V36 isolated test portal. Production stays on V35. */
var caseIndex=0;
(()=>{
"use strict";
const $=id=>document.getElementById(id),cfg=window.MVM36_CONFIG||{},qs=new URLSearchParams(location.search);
const invitation={code:qs.get("tester")||"",token:qs.get("token")||""};
const allowed=cfg.enabled===true&&/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(cfg.endpoint||"")&&(/^P0[02345]$/.test(invitation.code))&&/^[a-f0-9]{64}$/.test(invitation.token);
const stages=["identification","objective","excel","pivot","sql","python","open","final"];
const labels=["Identificación","Preguntas de opción múltiple","Excel · fórmulas","Excel · tablas dinámicas","SQL","Python","Preguntas abiertas","Finalización"];
const tools=["excel","pivot","sql","python"];
let view=null,attemptId=null,offset=0,busy=false,complete=false,frame=null,answer=null,lease=null,exclusive=false,mon={},lastSave=0,dirty=false,questionIndex=0;
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
function button(label,fn){const b=el("button",label,"btn");b.type="button";b.onclick=()=>{if(!busy&&!b.disabled&&b.isConnected!==false)fn();};return b;}
function status(s){$("status").textContent=s;}
function resumeKey(){return "mvm36-resume-"+invitation.code;}
function rememberSession(){try{localStorage.setItem(resumeKey(),"active");}catch(e){}}
function hasSession(){try{return localStorage.getItem(resumeKey())==="active";}catch(e){return false;}}
function forgetSession(){try{localStorage.removeItem(resumeKey());}catch(e){}}
function transitionButtons(lock){for(const b of $("body").querySelectorAll("button")){if(lock){b.dataset.mvmWasDisabled=b.disabled?"1":"0";b.disabled=true;}else if(b.dataset.mvmWasDisabled!==undefined){b.disabled=b.dataset.mvmWasDisabled==="1";delete b.dataset.mvmWasDisabled;}}}
function nav(){const current=complete?stages.length:view?stages.indexOf(view.stage):-1;const progress=$("progress");if(progress){const percent=complete?100:Math.round((current+1)/stages.length*100);progress.style.width=percent+"%";progress.parentElement?.setAttribute("aria-valuenow",String(percent));}$("nav").replaceChildren(el("div","Bienvenida","step"+(current<0&&!complete?" active":"")));labels.forEach((label,i)=>{$("nav").append(el("div",(i<current?"✓ ":"")+label,"step"+(i===current?" active":"")+(i>=2&&i<=5?" nav-tools":"")));});}
function draftKey(){return attemptId&&view?"mvm36-draft-"+attemptId+"-"+view.stage+"-"+view.caseIndex:null;}
function localGet(){const k=draftKey();try{return k?JSON.parse(localStorage.getItem(k)||"null"):null}catch(e){return null}}
function localPut(v){const k=draftKey();if(k)try{localStorage.setItem(k,JSON.stringify(v));}catch(e){status("No se pudo guardar la copia local.");}}
function localClear(){const k=draftKey();if(k)try{localStorage.removeItem(k)}catch(e){}}
function clone(x){return JSON.parse(JSON.stringify(x));}
window.MVM36Stage={get(kind){return view?.stage===kind?clone(view.content):null}};
function serverSimDraft(kind){
 const d=view?.draft;if(!d)return null;
 if(kind==="excel"){
  const cells={};const base=[["ID","Canal","Título del libro","Zona","Órdenes","Estado","Mes"],...(d.rowOrder?d.rowOrder.map(id=>view.content.rows.find(r=>String(r.id)===String(id))):view.content.rows).map(r=>[r.id,r.canal,r.titulo,r.region,r.pedidos,r.estado,r.mes])];base.forEach((r,i)=>r.forEach((v,j)=>cells[String.fromCharCode(65+j)+(i+1)]=String(v)));Object.assign(cells,{"I2":"Indicador","J2":"Resultado","I3":"Órdenes creadas","I4":"Órdenes canceladas","I5":"Tasa cancelación","I7":"Brecha entre canales"},d.formulas||{});return {cells,selected:d.layout?.selected||"A1",filterChannel:d.layout?.filterChannel||"Todos",cellFormats:d.layout?.cellFormats||{}};
 }
 if(kind==="pivot"){const snapshots=Object.fromEntries((d.exercises||[]).map(x=>[x.id,x])),w=d.working;return {snapshots,activeExercise:w?.id||Math.min(3,Object.keys(snapshots).length+1),builder:w?Object.fromEntries(["rowField","colField","valueField","aggregate","filterField","sortOrder"].map(k=>[k,w[k]])):{},answers:w?.answers||{},filterValues:w?.filterValues||[]};}
 return {code:d.code||"",lastExecution:d.lastExecution||null,runCount:d.executions||0,engineReady:d.engineReady===true};
}
window.MVMDraft={get(kind){if(view?.stage!==kind)return null;return localGet()?.sim||serverSimDraft(kind)},put(kind,data){if(view?.stage!==kind||complete)return;const old=localGet()?.sim;if(JSON.stringify(old)===JSON.stringify(data))return;localPut({sim:data});dirty=true;}};
function draftAnswer(){if(!view)return {};if(!tools.includes(view.stage))return answer||{};
 const d=localGet()?.sim||serverSimDraft(view.stage)||{};
 if(view.stage==="excel")return {layout:{selected:d.selected,cellFormats:d.cellFormats,filterChannel:d.filterChannel},rowOrder:Array.from({length:view.content.rows.length},(_,i)=>String(d.cells?.["A"+(i+2)]??view.content.rows[i].id)),formulas:Object.fromEntries(Object.entries(d.cells||{}).filter(([k])=>/^[H-K][1-9][0-9]*$/.test(k)&&!["I2","J2","I3","I4","I5","I7"].includes(k)).map(([k,v])=>[k,String(v)]))};
 if(view.stage==="pivot")return {exercises:Object.values(d.snapshots||{}),working:d.activeExercise?{id:d.activeExercise,...(d.builder||{}),answers:d.answers||{},filterValues:d.filterValues||[]}:null};
 return {code:String(d.code??d.text??d.value??""),lastExecution:d.lastExecution||null,executions:Number(d.runCount)||0,engineReady:d.engineReady===true};
}
function monitorKey(){return attemptId?"mvm36-monitor-"+attemptId:null;}
function monitorLoad(){try{return JSON.parse(localStorage.getItem(monitorKey())||"{}");}catch(e){return {};}}
function monitorSave(name,snapshot){if(!attemptId||!snapshot||snapshot.source!==name)return;try{const data=monitorLoad();data[name]=snapshot;localStorage.setItem(monitorKey(),JSON.stringify(data));}catch(e){}}
window.MVM36Monitoring={get(name){return view?.stage===name?monitorLoad()[name]||null:null;}};
function telemetry(){const p=window.MVMInteractionMonitor?.snapshot?.();if(p)monitorSave("evaluation",p);return {...monitorLoad(),...mon,...(p?{evaluation:p}:{})}}
function fromView(r,rerender=true){if(!r.view){complete=true;view=null;frame=null;forgetSession();render();status("Entrega confirmada por el servidor.");return;}const changedAttempt=attemptId!==r.attemptId;attemptId=r.attemptId;view=r.view;rememberSession();caseIndex=view.caseIndex;if(changedAttempt){mon={};const old=monitorLoad().evaluation;const m=window.MVMInteractionMonitor;if(old)m?.restore?.(old);m?.start?.();if(m)m.onChange=x=>monitorSave("evaluation",x);}offset=view.serverNow-Date.now();if(rerender)render();lastSave=Date.now();}
function welcome(){const body=$("body");body.innerHTML="<h2>Evaluación técnica · Asesor de Métricas</h2><p>Lee las instrucciones y acepta las reglas de integridad. Después pulsa <strong>Comenzar evaluación</strong> al final de esta página. El reloj de 75 minutos empezará en ese momento y pasarás automáticamente a Identificación.</p><div class=\"question\"><h3>Instrucciones generales</h3><p>La evaluación dispone de <strong>75 minutos</strong>. Resuelve las preguntas y las actividades de manera individual. Puedes guardar los avances dentro de cada herramienta y continuar con las siguientes secciones.</p><p>Al terminar, pulsa Guardar y enviar evaluación para entregar tus respuestas.</p></div><div class=\"question\" style=\"border:2px solid #c87923;background:#fff8eb\"><h3>IMPORTANTE · Prueba individual de conocimientos</h3><p><strong>Esta evaluación comprueba tus conocimientos y razonamiento, no tu habilidad para obtener respuestas de herramientas de inteligencia artificial.</strong> No se permite consultar ChatGPT, Copilot, Gemini, otras IA, sitios web, personas o dispositivos externos para recibir, copiar y pegar, o transcribir respuestas. Debes resolver cada actividad por tus propios medios, utilizando únicamente los datos y herramientas incorporados en esta evaluación. <strong>Incumplir estas reglas constituye una falta a la integridad de la prueba.</strong></p><label style=\"display:flex;gap:10px;align-items:flex-start\"><input id=\"integrityAgreement\" type=\"checkbox\" style=\"margin-top:4px\"> He leído las reglas, me comprometo a resolver la evaluación sin ayuda externa y acepto el registro de mis respuestas e interacciones dentro de la prueba con fines de integridad.</label></div><p id=\"beginPilotHint\" role=\"status\" aria-live=\"polite\" style=\"font-size:14px;font-weight:600;margin:12px 0 4px\"></p><button class=\"btn\" id=\"beginPilot\" type=\"button\" disabled style=\"display:block;width:100%;padding:15px 20px;font-size:18px;font-weight:700;margin-top:16px\">Comenzar evaluación · 75 minutos</button>";const check=$("integrityAgreement"),start=$("beginPilot"),hint=$("beginPilotHint");function refresh(){start.disabled=!allowed||!check.checked;start.style.opacity=start.disabled?"0.55":"1";start.style.cursor=start.disabled?"not-allowed":"pointer";hint.textContent=!allowed?"Esta evaluación todavía no está disponible. Contacta al responsable del proceso.":check.checked?"Todo listo. Pulsa el botón para iniciar el cronómetro y continuar.":"Marca la casilla de aceptación de las reglas para habilitar el botón.";}if(hasSession()){start.textContent="Retomar evaluación";hint.insertAdjacentHTML("beforebegin",'<div class="question" role="status"><strong>Evaluación iniciada.</strong> Si tienes una sesión pendiente, puedes retomar desde el último avance. El cronómetro no se detiene al salir.</div>');}check.addEventListener("change",refresh);start.onclick=async()=>{if(!allowed||!check.checked||busy)return;start.disabled=true;await claim();if(!view&&!complete)refresh();};refresh();status(allowed?"Evaluación disponible":"Evaluación no disponible");nav();}
let caseClickAfter=0;
function render(){
 const body=$("body");frame=null;body.replaceChildren();nav();document.body.classList.toggle("tool-wide",!!view&&tools.includes(view.stage));
 if(complete){body.append(el("h2","Entrega confirmada"),el("p","El servidor confirmó la recepción. Puedes cerrar la ventana."));return;}
 if(!view){welcome();return;}
 const s=view.stage,d=localGet()?.answer||view.draft||{};
 body.append(el("h2",labels[stages.indexOf(s)]));
 const saveLocal=()=>{localPut({answer,questionIndex});dirty=true;};
 if(s==="identification"){
  answer={name:d.name||"",email:d.email||""};for(const k of ["name","email"]){const l=el("label",k==="name"?"Nombre":"Correo"),input=el("input");input.type=k==="email"?"email":"text";input.value=answer[k];input.oninput=()=>{answer[k]=input.value;saveLocal()};l.append(input);body.append(l);}
 }else if(s==="objective"){
  const arr=(d.answers||[]).map(x=>x&&typeof x==="object"?x.selected:x);answer={answers:Array.from({length:15},(_,i)=>arr[i]??null)};
  questionIndex=Math.max(0,Math.min(view.content.length-1,Number(localGet()?.questionIndex)||0));let qIndex=questionIndex;const question=el("div",undefined,"question"),controls=el("div",undefined,"actions"),counter=el("p",undefined,"muted");counter.setAttribute("aria-live","polite");body.append(counter,question,controls);const updateCount=()=>{counter.textContent=answer.answers.filter(x=>x!==null).length+" de "+view.content.length+" respondidas. Selecciona una opción y navega con los botones inferiores.";};
  const show=()=>{questionIndex=qIndex;saveLocal();const q=view.content[qIndex];question.replaceChildren(el("h3","Pregunta "+(qIndex+1)+" de "+view.content.length),el("p",q.prompt));q.options.forEach((opt,i)=>{const l=el("label"),x=el("input");x.type="radio";x.name="option";x.value=String(i);x.checked=answer.answers[qIndex]===i;x.onchange=()=>{answer.answers[qIndex]=i;saveLocal();updateCount()};l.append(x,document.createTextNode(String.fromCharCode(65+i)+". "+opt));question.append(l)});const prev=button("← Pregunta anterior",()=>{if(qIndex>0){qIndex--;show()}}),next=button(qIndex===view.content.length-1?"Continuar a Excel →":"Siguiente pregunta →",()=>{if(qIndex<view.content.length-1){qIndex++;show()}else if(confirm("¿Cerrar las preguntas de opción múltiple y continuar a Excel? No podrás regresar."))transact("advance",draftAnswer());});prev.disabled=qIndex===0;controls.replaceChildren(prev,next,button("Ir a pregunta 14 · SQL",()=>{qIndex=13;show()}),button("Ir a pregunta 15 · Python",()=>{qIndex=14;show()}));updateCount();};show();
 }else if(s==="open"){
  answer={response:d.response||""};body.append(el("p","Caso "+(view.caseIndex+1)+" de 3"),el("h3",view.content.title),el("p",view.content.prompt));const t=el("textarea");t.id="caseResponse";t.value=answer.response;t.rows=12;t.oninput=()=>{answer.response=t.value;saveLocal()};body.append(t);
 }else if(tools.includes(s)){
  answer=null;frame=el("iframe");frame.className="v36-frame";frame.title=labels[stages.indexOf(s)];frame.src="./"+s+".html?embed=1&v="+(s==="pivot"?"36.5":"36.4");body.append(frame);
 }else if(s==="final"){
  const f=localGet()?.answer?.feedback||d.feedback||{};
  answer={feedback:{...f}};body.append(el("p","La evaluación está cerrada. Los comentarios no modifican tus respuestas ni la calificación."));
  if(/^P0[02345]$/.test(invitation.code)){
   body.append(el("h3","Comentarios sobre la prueba"),el("p","Indica las pruebas que realizaste, incluyendo copia y pegado, uso de IA, salida y reingreso, y cualquier dificultad."));
   for(const [k,label] of [["device","Dispositivo utilizado"],["clarity","Claridad de instrucciones (1–5)"],["navigation","Facilidad de navegación (1–5)"],["integrityTests","Pruebas de integridad realizadas"],["technicalIssues","Problemas técnicos"],["suggestions","Sugerencias"]]){
    const l=el("label",label),x=el(k==="device"||k==="clarity"||k==="navigation"?"input":"textarea");x.value=f[k]||"";x.maxLength=4000;if(k==="clarity"||k==="navigation"){x.type="number";x.min="1";x.max="5";}x.oninput=()=>{answer.feedback[k]=x.value;saveLocal()};l.append(x);body.append(l);
   }
  }
  body.append(button("Entregar evaluación",()=>transact("finalize",answer)));return;
 }
 const controls=el("div",undefined,"actions");controls.append(button("Guardar avance",()=>transact("save",draftAnswer())));
 if(s==="open"){
 const ix=view.caseIndex,attempt=attemptId;
 const valid=()=>!busy&&view?.stage==="open"&&view.caseIndex===ix&&attemptId===attempt&&Date.now()>=caseClickAfter;
 const next=button("Guardar y pasar a la siguiente pregunta →",()=>{if(!valid()||!answer.response.trim())return;if(confirm("¿Guardar definitivamente la respuesta del caso "+(ix+1)+"? No podrás regresar a este caso."))transact("advance",draftAnswer());});
 if(ix===2)next.textContent="Guardar y finalizar preguntas abiertas →";
 const skip=button("Omitir este caso sin responder",()=>{if(!valid()||answer.response.trim())return;if(confirm("El caso "+(ix+1)+" quedará SIN RESPUESTA. ¿Confirmas que deseas omitirlo definitivamente?"))transact("advance",draftAnswer());});
 function updateCaseButtons(){const answered=!!answer.response.trim();next.disabled=busy||!answered;skip.disabled=busy||answered;skip.hidden=answered;}
 controls.append(next,skip);$("caseResponse").addEventListener("input",updateCaseButtons);updateCaseButtons();caseClickAfter=Date.now()+1000;
 }else if(!tools.includes(s)&&s!=="objective")controls.append(button("Continuar a preguntas de opción múltiple →",()=>{if(confirm("¿Cerrar esta etapa? No podrás regresar."))transact("advance",draftAnswer());}));
 controls.append(button("Salir",()=>{if(confirm("El reloj seguirá corriendo. ¿Guardar y salir?"))transact("save",draftAnswer(),true);}));
 body.append(controls);
}
async function claim(){if(busy||complete)return;busy=true;status("Verificando sesión…");try{if(!await lock())throw Error("Otra pestaña tiene abierta la evaluación.");const r=await request("claim");window.__MVMMonitoringConsentGranted=true;window.MVMInteractionMonitor?.start?.();const resumed=r.status==="RESUMED"||r.status==="FEEDBACK_REQUIRED"||!!r.view&&(r.view.revision>0||r.view.deadline-r.view.serverNow<4490000);fromView(r);status(complete?"Entrega confirmada":resumed?"Evaluación retomada · avance recuperado":"Sesión activa");if(resumed&&!complete){const notice=el("div","Has retomado tu evaluación. Se recuperó el último avance y el tiempo restante.","notice");notice.setAttribute("role","status");$("body").prepend(notice);}}catch(e){status(String(e.message||e));}finally{busy=false;}}
async function transact(action,a,exit=false){
 if(!view||complete)return;if(busy){status("Guardado anterior en curso. Reintenta al recibir confirmación.");return;}
 busy=true;transitionButtons(true);const current=view;const key=draftKey();status("Guardando en el servidor…");
 try{const r=await request(action,{attemptId,stage:current.stage,caseIndex:current.caseIndex,revision:current.revision,answer:a,monitor:telemetry()});if(action!=="save"||!r.view){if(key&&(!r.view?.expired||current.stage!=="final"))try{localStorage.removeItem(key)}catch(e){};mon={};}fromView(r,action!=="save"||!r.view||r.view.stage!==current.stage||r.view.caseIndex!==current.caseIndex);dirty=false;status(complete?"Entrega confirmada":"Guardado en servidor");if(exit&&!complete&&view?.stage!=="final"){view=null;render();status("Avance guardado. Puedes cerrar esta ventana.");}}
 catch(e){status(String(e.message||e)+" · El avance local se conserva; reanuda para reconciliar la sesión.");}finally{busy=false;transitionButtons(false);}
}
window.addEventListener("message",e=>{
 if(!frame||e.origin!==location.origin||e.source!==frame.contentWindow||!view||complete)return;
 const d=e.data;if(!d)return;if(d.type==="MVM_MONITOR_UPDATE"&&d.snapshot&&d.source===view.stage&&d.snapshot.source===view.stage){mon[view.stage]=d.snapshot;monitorSave(view.stage,d.snapshot);return;}
 const submit=(ans)=>{const stage=view.stage,caseNo=view.caseIndex,attempt=attemptId;const wait=()=>{if(!view||complete||view.stage!==stage||view.caseIndex!==caseNo||attemptId!==attempt)return;if(busy){status("Guardando avance previo; continuando al recibir confirmación…");setTimeout(wait,300);return;}transact("advance",ans);};wait();};
 if(d.type==="MVM36_SIM_COMPLETE"&&d.stage===view.stage)submit(d.answer);
 if((d.type==="MVM_SQL_COMPLETE"&&view.stage==="sql")||(d.type==="MVM_PYTHON_COMPLETE"&&view.stage==="python"))submit({code:String(d.code||""),lastExecution:d.lastExecution||null,executions:Number(d.executions)||0,engineReady:d.engineReady===true});
});
setInterval(()=>{if(!view||complete)return;const seconds=Math.max(0,Math.ceil((view.deadline-(view.frozenAt??(Date.now()+offset)))/1000));$("timer").textContent=String(Math.floor(seconds/60)).padStart(2,"0")+":"+String(seconds%60).padStart(2,"0");if(seconds===0&&!busy&&!view.expired)transact("finalize",{});else if(!busy&&view.stage!=="final"&&Date.now()-lastSave>=85000){transact("save",draftAnswer());}},1000);
window.addEventListener("pagehide",()=>{const p=window.MVMInteractionMonitor?.snapshot?.();if(p)monitorSave("evaluation",p);});
window.addEventListener("beforeunload",e=>{if(view&&!complete){e.preventDefault();e.returnValue="";}});
render();
})();
