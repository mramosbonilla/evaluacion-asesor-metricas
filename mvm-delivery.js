/* Entrega MVM. Sin URL configurada no simula envíos ni marca una entrega como recibida.
   Requiere receptor Apps Script verificado, almacenamiento privado y acuse explícito. */
(function(){
"use strict";
function endpoint(){
 const cfg=window.MVM_RECEIVER_CONFIG||{};
 const url=String(cfg.endpoint||"").trim();
 return /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec(?:\?.*)?$/.test(url)?url:"";
}
function available(){return !!endpoint();}
function send(data){
 return new Promise((resolve,reject)=>{
  if(!available()){reject(Error("Receptor de evaluaciones no configurado."));return;}
  if(!data||!data.attemptId||!data.candidate||!data.finishedAt){reject(Error("Evaluación incompleta."));return;}
  const nonce="MVM-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,12);
  const frame=document.createElement("iframe"),form=document.createElement("form");
  frame.name="mvm_delivery_"+Math.random().toString(36).slice(2);
  frame.title="Entrega privada de resultados";
  frame.style.display="none";
  form.style.display="none";
  form.method="POST";form.action=endpoint();form.target=frame.name;
  form.enctype="application/x-www-form-urlencoded";
  for(const [key,value] of Object.entries({payload:JSON.stringify(data),nonce,returnOrigin:location.origin})){
   const input=document.createElement("input");input.type="hidden";input.name=key;input.value=value;form.append(input);
  }
  let settled=false;
  function clean(){window.removeEventListener("message",ack);clearTimeout(timer);form.remove();frame.remove();}
  function finish(error,res){if(settled)return;settled=true;clean();error?reject(error):resolve(res);}
  function ack(event){
   if(event.source!==frame.contentWindow)return;
   const origin=String(event.origin||"");
   if(!/^https:\/\/(?:script\.google\.com|script\.googleusercontent\.com|[a-z0-9-]+-script\.googleusercontent\.com)$/.test(origin))return;
   const msg=event.data;
   if(!msg||msg.type!=="MVM_DELIVERY_RECEIPT"||msg.nonce!==nonce||msg.attemptId!==data.attemptId)return;
   if(msg.ok!==true){finish(Error("El receptor rechazó la entrega. Conserva una copia y contacta al coordinador."));return;}
   finish(null,{ok:true,attemptId:data.attemptId,receivedAt:msg.receivedAt||null});
  }
  window.addEventListener("message",ack);
  const timer=setTimeout(()=>finish(Error("No se recibió confirmación del servidor. Antes de reintentar, verifica con el coordinador.")),30000);
  document.body.append(frame,form);
  try{form.submit();}catch(e){finish(Error("No fue posible completar el envío desde este navegador."));}
 });
}
window.MVMDelivery={available,send};
})();
