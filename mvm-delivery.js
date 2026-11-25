/* Entrega MVM. Sin URL configurada no simula envíos ni marca una entrega como recibida.
   Requiere receptor Apps Script verificado, almacenamiento privado y acuse explícito. */
(function(){
"use strict";
function endpoint(){
 const cfg=window.MVM_RECEIVER_CONFIG||{};
 const url=String(cfg.endpoint||"").trim();
 return /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec(?:\?.*)?$/.test(url)?url:"";
}
function invitation(){
 const qs=new URLSearchParams(location.search),code=String(qs.get("tester")||"").toUpperCase();
 const token=String(qs.get("token")||"").toLowerCase();
 return /^P(?:0[0-9]|1[0-5])$/.test(code)&&/^[a-f0-9]{64}$/.test(token)?{code,token}:null;
}
function secureNonce(){
 if(!window.crypto?.getRandomValues)throw Error("El navegador no permite una conexión de entrega segura.");
 const bytes=new Uint8Array(24);window.crypto.getRandomValues(bytes);
 return Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("");
}
function available(){return !!endpoint()&&!!invitation()&&!!window.crypto?.getRandomValues;}
function sessionRequired(){return window.MVM_RECEIVER_CONFIG?.sessionRequired===true;}
function identity(){
 const invite=invitation();if(!invite)throw Error("Invitación inválida");
 const key="mvm-session-browser-v31-"+invite.code,tabKey="mvm-session-tab-v31-"+invite.code;
 let browser=localStorage.getItem(key),tab=sessionStorage.getItem(tabKey);
 if(!/^[a-f0-9]{48}$/.test(browser||"")){browser=secureNonce();localStorage.setItem(key,browser);}
 if(!/^[a-f0-9]{48}$/.test(tab||"")){tab=secureNonce();sessionStorage.setItem(tabKey,tab);}
 return {browser,tab};
}
let pageLockPromise=null;
function lockPage(){
 if(!navigator.locks?.request)return Promise.resolve(true);
 if(!pageLockPromise)pageLockPromise=new Promise(resolve=>{
  const invite=invitation();if(!invite){resolve(false);return;}
  navigator.locks.request("mvm-session-v31-"+invite.code,{ifAvailable:true},lock=>{
   if(!lock){pageLockPromise=null;resolve(false);return;}
   resolve(true);return new Promise(()=>{});
  }).catch(()=>{pageLockPromise=null;resolve(false);});
 });
 return pageLockPromise;
}
function requestSession(action,attemptId,payload){
 return new Promise((resolve,reject)=>{
  if(!available()){reject(Error("La recepción segura no está disponible."));return;}
  const invite=invitation();let nonce,ids;
  try{nonce=secureNonce();ids=identity();}catch(e){reject(Error("No se pudo guardar la identidad de sesión en este navegador."));return;}
  const frame=document.createElement("iframe"),form=document.createElement("form");
  frame.name="mvm_session_"+secureNonce().slice(0,24);frame.title="Sesión privada de evaluación";frame.style.display="none";form.style.display="none";
  form.method="POST";form.action=endpoint();form.target=frame.name;form.enctype="application/x-www-form-urlencoded";
  const fields={action,attemptId,nonce,invitationCode:invite.code,invitationToken:invite.token,...ids};
  if(payload!==undefined)fields.payload=JSON.stringify(payload);
  for(const [key,value] of Object.entries(fields)){const input=document.createElement("input");input.type="hidden";input.name=key;input.value=value;form.append(input);}
  let settled=false;
  function clean(){window.removeEventListener("message",ack);clearTimeout(timer);form.remove();frame.remove();}
  function done(error,result){if(settled)return;settled=true;clean();error?reject(error):resolve(result);}
  function ack(event){
   if(!/^https:\/\/(?:script\.google\.com|script\.googleusercontent\.com|[a-z0-9-]+-script\.googleusercontent\.com)$/.test(String(event.origin||"")))return;
   const msg=event.data;
   if(!msg||msg.nonce!==nonce)return;
   if(msg.type==="MVM_DELIVERY_RECEIPT"){done(Error("El receptor todavía necesita actualizarse a la versión de sesión segura."));return;}
   if(msg.type!=="MVM_SESSION_RECEIPT"||msg.version!==31)return;
   done(null,msg);
  }
  window.addEventListener("message",ack);const timer=setTimeout(()=>done(Error("El servidor no confirmó la sesión. Reintenta sin cerrar la página.")),45000);
  document.body.append(frame,form);try{form.submit();}catch(e){done(Error("No se pudo conectar con el servidor."));}
 });
}
function secureRequired(){return window.MVM_RECEIVER_CONFIG?.requireSecureDelivery===true;}
function send(data){
 return new Promise((resolve,reject)=>{
  if(!available()){reject(Error("El enlace de evaluación no tiene una recepción segura activa."));return;}
  const invite=invitation();
  if(!data||!data.attemptId||!data.candidate||!data.finishedAt||data.pilot?.invitationCode!==invite?.code){
   reject(Error("Evaluación o invitación incompleta."));return;
  }
  let nonce;try{nonce=secureNonce();}catch(e){reject(e);return;}
  const frame=document.createElement("iframe"),form=document.createElement("form");
  frame.name="mvm_delivery_"+secureNonce().slice(0,24);
  frame.title="Entrega privada de resultados";
  frame.style.display="none";
  form.style.display="none";
  form.method="POST";form.action=endpoint();form.target=frame.name;
  form.enctype="application/x-www-form-urlencoded";
  let ids={};try{if(sessionRequired())ids=identity();}catch(e){reject(e);return;}
  for(const [key,value] of Object.entries({payload:JSON.stringify(data),nonce,invitationCode:invite.code,invitationToken:invite.token,...ids})){
   const input=document.createElement("input");input.type="hidden";input.name=key;input.value=value;form.append(input);
  }
  let settled=false;
  function clean(){window.removeEventListener("message",ack);clearTimeout(timer);form.remove();frame.remove();}
  function finish(error,res){if(settled)return;settled=true;clean();error?reject(error):resolve(res);}
  function ack(event){
   // Apps Script HtmlService may render inside a nested Google-hosted iframe,
   // so event.source may differ from frame.contentWindow. Verify Google origin
   // plus a fresh unpredictable nonce and the exact attempt ID instead.
   const origin=String(event.origin||"");
   if(!/^https:\/\/(?:script\.google\.com|script\.googleusercontent\.com|[a-z0-9-]+-script\.googleusercontent\.com)$/.test(origin))return;
   const msg=event.data;
   if(!msg||msg.type!=="MVM_DELIVERY_RECEIPT"||msg.version!==25||msg.nonce!==nonce||msg.attemptId!==data.attemptId)return;
   if(msg.ok!==true){finish(Error("El receptor rechazó la entrega. Conserva una copia y contacta al coordinador."));return;}
   finish(null,{ok:true,attemptId:data.attemptId,receivedAt:msg.receivedAt||null});
  }
  window.addEventListener("message",ack);
  const timer=setTimeout(()=>finish(Error("No se recibió confirmación del servidor. Antes de reintentar, verifica con el coordinador.")),30000);
  document.body.append(frame,form);
  try{form.submit();}catch(e){finish(Error("No fue posible completar el envío desde este navegador."));}
 });
}
window.MVMDelivery={available,send,secureRequired,sessionRequired,lockPage,requestSession};
})();
