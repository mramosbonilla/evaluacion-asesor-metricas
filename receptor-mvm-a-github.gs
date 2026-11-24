/**
 * MVM · Receptor de evaluaciones protegido, V25.
 * Se despliega en GOOGLE APPS SCRIPT, NO en GitHub Pages.
 * Datos y credenciales solo en GitHub PRIVADO y propiedades del script.
 *
 * Propiedades privadas requeridas:
 *   MVM_GITHUB_TOKEN: token de alcance limitado, Contents read/write SOLO repo privado
 *   MVM_TARGET_REPO: owner/nombre-repo-privado
 *   MVM_INVITE_HASHES: generado automáticamente con mvmProvisionInvitations()
 *
 * ATENCIÓN: el contenido del navegador sigue siendo editable por el candidato.
 * No sustituye vigilancia supervisada ni impide manipular código/respuestas.
 */
const MVM_ORIGIN="https://mramosbonilla.github.io";
const MVM_SCHEMA="MVM_PILOT_16";
const MVM_MAX_BYTES=750000;
const MVM_INVITE_COUNT=15;

function mvmHash_(secret){
  const bytes=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(secret),Utilities.Charset.UTF_8);
  return bytes.map(b=>("0"+(b&255).toString(16)).slice(-2)).join("");
}
function mvmInvitationCodes_(){
  return ["P00",...Array.from({length:MVM_INVITE_COUNT},(_,i)=>"P"+String(i+1).padStart(2,"0"))];
}
/**
 * PROVISIÓN PRIVADA: ejecuta esta función UNA VEZ en el editor Apps Script.
 * Muestra en el registro P00 de ensayo y quince enlaces para candidatos.
 * Las claves originales NO se guardan: solo el hash SHA-256 de cada una.
 */
function mvmProvisionInvitations(){
  const props=PropertiesService.getScriptProperties();
  if(props.getProperty("MVM_INVITE_HASHES"))throw Error("Las invitaciones ya existen; no se reemplazan automáticamente.");
  const hashes={},links=[];
  mvmInvitationCodes_().forEach(code=>{
    const token=(Utilities.getUuid()+Utilities.getUuid()).replace(/-/g,"").toLowerCase();
    if(!/^[a-f0-9]{64}$/.test(token))throw Error("Error al generar invitación");
    hashes[code]=mvmHash_(token);
    links.push("https://mramosbonilla.github.io/evaluacion-asesor-metricas/vista-previa.html?tester="+code+"&token="+token+"&v=26");
  });
  props.setProperty("MVM_INVITE_HASHES",JSON.stringify(hashes));
  Logger.log("COPIAR ESTOS ENLACES PRIVADAMENTE; NO PUBLICAR NI PEGAR EN GITHUB:\n"+links.join("\n"));
  return {created:links.length,message:"Se generaron 15 invitaciones para candidatos más una invitación P00 exclusiva de ensayo. Consulta el registro de ejecución para copiarlas una sola vez."};
}
function mvmReceipt_(data){
  // Data is a fixed set of primitives originating only from controlled validation.
  const payload=JSON.stringify(data).replace(/</g,"\\u003c");
  const target=JSON.stringify(MVM_ORIGIN);
  const html='<!doctype html><html><head><meta charset="utf-8"></head><body>'+
    '<script>window.top.postMessage('+payload+','+target+');</scr'+'ipt></body></html>';
  return HtmlService.createHtmlOutput(html)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
function mvmFetch_(url,options){
  const res=UrlFetchApp.fetch(url,Object.assign({muteHttpExceptions:true},options||{}));
  let data={};
  try{data=JSON.parse(res.getContentText());}catch(e){}
  return {status:res.getResponseCode(),data};
}
function mvmApiHeaders_(token){
  return {"Authorization":"Bearer "+token,
    "Accept":"application/vnd.github+json",
    "X-GitHub-Api-Version":"2022-11-28",
    "User-Agent":"MVM-Private-Assessment-Receiver"};
}
function mvmGetRepo_(token,repo){
  const answer=mvmFetch_("https://api.github.com/repos/"+repo,{
    method:"get",headers:mvmApiHeaders_(token)});
  if(answer.status!==200 || answer.data.private!==true){
    throw Error("El destino no es un repositorio privado autorizado.");
  }
}
function mvmFile_(token,repo,method,path,body){
  const url="https://api.github.com/repos/"+repo+"/contents/"+
    path.split("/").map(encodeURIComponent).join("/");
  const options={method:method.toLowerCase(),headers:mvmApiHeaders_(token)};
  if(body!==undefined){options.contentType="application/json";options.payload=JSON.stringify(body);}
  return mvmFetch_(url,options);
}
function mvmCheckPayload_(obj,code){
  if(!obj||typeof obj!=="object"||Array.isArray(obj)||obj.schema!==MVM_SCHEMA)
    throw Error("Formato de resultados inválido");
  if(!/^MVM-[0-9]{8}-[A-Z0-9-]{5,30}$/.test(String(obj.attemptId||"")))
    throw Error("Identificador de evaluación inválido");
  if(!obj.pilot||obj.pilot.invitationCode!==code)
    throw Error("La entrega no corresponde a la invitación");
  if(!obj.candidate||typeof obj.candidate.name!=="string"||
     !obj.candidate.name.trim()||obj.candidate.name.length>160||
     String(obj.candidate.email||"").length>180)
    throw Error("Identificación inválida");
  if(!Array.isArray(obj.knowledge)||obj.knowledge.length!==15||
     !Array.isArray(obj.openCases)||obj.openCases.length!==3||
     !obj.practical||typeof obj.practical!=="object"||
     !obj.monitoring||typeof obj.monitoring!=="object"||
     !obj.monitoring.enabled||!obj.monitoring.consentAt)
    throw Error("Faltan secciones obligatorias");
  const started=Date.parse(obj.startedAt||""),finished=Date.parse(obj.finishedAt||"");
  if(!Number.isFinite(started)||!Number.isFinite(finished)||finished<started)
    throw Error("Fechas inválidas");
  if(finished-started>86400000)throw Error("Duración incompatible con la evaluación");
  return String(obj.attemptId);
}
function doPost(e){
  const params=e&&e.parameter||{};
  const nonce=String(params.nonce||"").slice(0,100);
  let attemptId="",code="",accepted=false,alreadyReceived=false;
  try{
    const raw=String(params.payload||"");
    if(Utilities.newBlob(raw).getBytes().length>MVM_MAX_BYTES||!raw.length)
      throw Error("Tamaño de evaluación no permitido");
    code=String(params.invitationCode||"").trim().toUpperCase();
    const secret=String(params.invitationToken||"").trim().toLowerCase();
    if(!/^P(?:0[0-9]|1[0-5])$/.test(code)||!/^[a-f0-9]{64}$/.test(secret))
      throw Error("Invitación inválida");
    const prop=PropertiesService.getScriptProperties();
    const allow=JSON.parse(prop.getProperty("MVM_INVITE_HASHES")||"{}");
    // SECURITY: refuse by default. Do not allow anonymous write without issued token.
    if(!allow[code]||mvmHash_(secret)!==allow[code])
      throw Error("La clave privada de invitación no coincide");
    const obj=JSON.parse(raw);
    attemptId=mvmCheckPayload_(obj,code);
    const repo=String(prop.getProperty("MVM_TARGET_REPO")||"").trim();
    const token=String(prop.getProperty("MVM_GITHUB_TOKEN")||"").trim();
    if(!token||!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)||
       repo.toLowerCase()==="mramosbonilla/evaluacion-asesor-metricas")
      throw Error("Destino privado sin configurar");

    const lock=LockService.getScriptLock();
    lock.waitLock(25000);
    try{
      // SECURITY: the token cannot cause a fallback to writing to the public app repo.
      mvmGetRepo_(token,repo);
      const year=String(new Date(Date.parse(obj.finishedAt)).getUTCFullYear());
      const path="entregas/"+year+"/"+code+".json";
      const existing=mvmFile_(token,repo,"GET",path);
      if(existing.status===200){
        const base64=String(existing.data.content||"").replace(/\s/g,"");
        const saved=Utilities.newBlob(Utilities.base64Decode(base64)).getDataAsString("UTF-8");
        // Same invite can confirm an identical retry, but NEVER overwrite a response.
        if(saved!==raw)throw Error("La invitación ya fue entregada con otros resultados");
        alreadyReceived=true;accepted=true;
      }else if(existing.status===404){
        const encoded=Utilities.base64Encode(Utilities.newBlob(raw).getBytes());
        const created=mvmFile_(token,repo,"PUT",path,{
          message:"MVM recepción "+code+" ("+attemptId+")",content:encoded});
        if(created.status!==201)throw Error("GitHub no confirmó escritura");
        accepted=true;
      }else throw Error("Error comprobando entregas existentes");
    }finally{lock.releaseLock();}
  }catch(ex){
    // Never expose secrets, GitHub response, server paths or candidate information.
    accepted=false;
  }
  return mvmReceipt_({type:"MVM_DELIVERY_RECEIPT",version:25,
    ok:accepted,duplicate:alreadyReceived,attemptId,nonce,
    receivedAt:accepted?new Date().toISOString():null});
}
