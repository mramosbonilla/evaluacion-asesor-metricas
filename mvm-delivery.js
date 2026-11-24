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
  for(const [key,value] of Object.entries({payload:JSON.stringify(data),nonce,invitationCode:invite.code,invitationToken:invite.token})){
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
window.MVMDelivery={available,send,secureRequired};
})();
