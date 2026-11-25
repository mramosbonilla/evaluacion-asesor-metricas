/**
 * MVM · Receptor de evaluaciones protegido, V31. Conserva las propiedades y las invitaciones existentes.
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

/* V31: session registry + checkpoints. Never store invitation tokens or browser identifiers in reports. */
const MVM_SESSION_VERSION=31;
const MVM_DURATION_MS=75*60*1000;
const MVM_LEASE_MS=120000;
const MVM_FINAL_GRACE_MS=180000;
function mvmPrivateConfig_(prop){
 const repo=String(prop.getProperty("MVM_TARGET_REPO")||"").trim(),token=String(prop.getProperty("MVM_GITHUB_TOKEN")||"").trim();
 if(!token||repo.toLowerCase()!=="mramosbonilla/mvm-resultados-privados")throw Error("Destino privado sin configurar");
 mvmGetRepo_(token,repo);return {repo,token};
}
function mvmAuth_(params,prop){
 const code=String(params.invitationCode||"").trim().toUpperCase(),secret=String(params.invitationToken||"").trim().toLowerCase();
 if(!/^P(?:0[0-9]|1[0-5])$/.test(code)||!/^[a-f0-9]{64}$/.test(secret))throw Error("Invitación inválida");
 const allow=JSON.parse(prop.getProperty("MVM_INVITE_HASHES")||"{}");
 if(!allow[code]||mvmHash_(secret)!==allow[code])throw Error("Invitación inválida");
 return code;
}
function mvmSessionIdentity_(params){
 const browser=String(params.browser||""),tab=String(params.tab||"");
 if(!/^[a-f0-9]{48}$/.test(browser)||!/^[a-f0-9]{48}$/.test(tab))throw Error("Identidad de sesión inválida");
 return {browserHash:mvmHash_(browser),tabHash:mvmHash_(tab)};
}
function mvmReadJson_(cfg,path){
 const response=mvmFile_(cfg.token,cfg.repo,"GET",path);
 if(response.status===404)return null;
 if(response.status!==200)throw Error("No se pudo leer almacenamiento privado");
 const raw=Utilities.newBlob(Utilities.base64Decode(String(response.data.content||"").replace(/\s/g,""))).getDataAsString("UTF-8");
 return {sha:response.data.sha,raw,value:JSON.parse(raw)};
}
function mvmWriteJson_(cfg,path,value,previous){
 const raw=JSON.stringify(value);
 if(Utilities.newBlob(raw).getBytes().length>MVM_MAX_BYTES)throw Error("Tamaño de registro excedido");
 const body={message:"MVM registro privado "+path,content:Utilities.base64Encode(Utilities.newBlob(raw).getBytes())};
 if(previous)body.sha=previous.sha;
 const result=mvmFile_(cfg.token,cfg.repo,"PUT",path,body);
 if(result.status!==(previous?200:201))throw Error("No se confirmó escritura privada");
 return {sha:result.data.content.sha,raw,value};
}
function mvmAudit_(session,kind,t){
 session.audit=Array.isArray(session.audit)?session.audit:[];
 session.audit.push({event:kind,at:new Date(t).toISOString()});
 if(session.audit.length>24)session.audit.shift();
 session.counts=session.counts||{};
 session.counts[kind]=(session.counts[kind]||0)+1;
}
function mvmPublicAudit_(session){
 return {version:MVM_SESSION_VERSION,startedAt:new Date(session.started).toISOString(),deadlineAt:new Date(session.deadline).toISOString(),lastCheckpointAt:session.checkpointAt?new Date(session.checkpointAt).toISOString():null,counts:session.counts||{},events:session.audit||[]};
}
function mvmSessionAction_(params){
 const nonce=String(params.nonce||"").slice(0,100),action=String(params.action||"");
 let reply={type:"MVM_SESSION_RECEIPT",version:31,nonce,ok:false,status:"REJECTED",serverNow:Date.now()};
 const lock=LockService.getScriptLock();
 try{
  const prop=PropertiesService.getScriptProperties(),code=mvmAuth_(params,prop),id=mvmSessionIdentity_(params);
  if(!["claim","checkpoint","release"].includes(action))throw Error("Acción no permitida");
  const attemptId=String(params.attemptId||"");
  if(!/^MVM-[0-9]{8}-[A-Z0-9-]{5,30}$/.test(attemptId))throw Error("Intento inválido");
  lock.waitLock(25000);
  try{
   const t=Date.now(),key="MVM_SESSION_"+code,raw=prop.getProperty(key);
   let session=raw?JSON.parse(raw):null;
   const save=()=>prop.setProperty(key,JSON.stringify(session));
   let cfg=null;const getCfg=()=>cfg||(cfg=mvmPrivateConfig_(prop));
   const auditWrite=()=>{
    const path="auditoria/"+session.year+"/"+code+".json";
    try{const conf=getCfg();mvmWriteJson_(conf,path,mvmPublicAudit_(session),mvmReadJson_(conf,path));}catch(e){/* counts remain in private script properties */}
   };
   if(!session){
    if(action!=="claim"){reply.status="CLAIM_REQUIRED";return mvmReceipt_(reply);}
    const year=String(new Date(t).getUTCFullYear());
    const old=mvmReadJson_(getCfg(),"entregas/"+year+"/"+code+".json");
    if(old){reply.status="ALREADY_SUBMITTED";return mvmReceipt_(reply);}
    session={attemptId,browserHash:id.browserHash,tabHash:id.tabHash,started:t,deadline:t+MVM_DURATION_MS,year,leaseUntil:t+MVM_LEASE_MS,checkpointAt:null,stage:0,finished:false,counts:{},audit:[]};
    mvmAudit_(session,"FIRST_START",t);save();auditWrite();
   }else{
    if(session.finished){reply.status="ALREADY_SUBMITTED";return mvmReceipt_(reply);}
    if(session.browserHash!==id.browserHash){
     mvmAudit_(session,"OTHER_BROWSER_BLOCKED",t);save();auditWrite();
     reply.status="OTHER_BROWSER";return mvmReceipt_(reply);
    }
    if(session.tabHash!==id.tabHash&&session.leaseUntil>t){
     mvmAudit_(session,"CONCURRENT_TAB_BLOCKED",t);save();auditWrite();
     reply.status="CONCURRENT_TAB";reply.retryAfterSeconds=Math.ceil((session.leaseUntil-t)/1000);return mvmReceipt_(reply);
    }
    if(action!=="claim"&&session.attemptId!==attemptId){reply.status="ATTEMPT_MISMATCH";return mvmReceipt_(reply);}
    if(action==="claim"){
     if(session.tabHash!==id.tabHash)mvmAudit_(session,"TAB_CHANGED",t);
     else mvmAudit_(session,"RESUMED",t);
     session.tabHash=id.tabHash;
    }
   }
   reply.attemptId=session.attemptId;reply.startedAt=new Date(session.started).toISOString();reply.deadlineAt=new Date(session.deadline).toISOString();reply.serverNow=t;
   reply.serverStage=session.stage;reply.expired=t>=session.deadline;
   if(action==="release"){
    session.leaseUntil=0;save();reply.ok=true;reply.status="RELEASED";return mvmReceipt_(reply);
   }
   session.leaseUntil=t+MVM_LEASE_MS;
   const progressPath="avances/"+session.year+"/"+code+".json";
   if(action==="claim"){
    const previous=session.checkpointAt?mvmReadJson_(getCfg(),progressPath):null;
    if(previous&&previous.value.attemptId===session.attemptId)reply.checkpoint=previous.value;
    save();reply.ok=true;reply.status=reply.expired?"EXPIRED":"CLAIMED";return mvmReceipt_(reply);
   }
   if(t>=session.deadline){save();reply.ok=false;reply.status="EXPIRED";return mvmReceipt_(reply);}
   const rawProgress=String(params.payload||"");
   if(!rawProgress||Utilities.newBlob(rawProgress).getBytes().length>MVM_MAX_BYTES)throw Error("Tamaño de avance no permitido");
   const snapshot=JSON.parse(rawProgress),st=snapshot.state,report=snapshot.report;
   if(!st||!report||st.attemptId!==session.attemptId||report.attemptId!==session.attemptId||report.pilot?.invitationCode!==code||st.schema!==MVM_SCHEMA||report.schema!==MVM_SCHEMA||st.startedAt!==reply.startedAt||!st.monitoring?.consentAt||!Number.isInteger(st.stage)||st.stage<session.stage||st.stage>8)throw Error("Avance inválido");
   const conf=getCfg(),previous=mvmReadJson_(conf,progressPath);
   const record={schema:"MVM_PROGRESS_1",attemptId:session.attemptId,savedAt:new Date(t).toISOString(),state:st,report};
   mvmWriteJson_(conf,progressPath,record,previous);session.checkpointAt=t;session.stage=st.stage;save();
   reply.ok=true;reply.status="SAVED";reply.savedAt=record.savedAt;return mvmReceipt_(reply);
  }finally{lock.releaseLock();}
 }catch(e){reply.ok=false;}
 return mvmReceipt_(reply);
}

function doPost(e){
  const params=e&&e.parameter||{};
  if(params.action&&params.action!=="deliver")return mvmSessionAction_(params);
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
      const sessionKey="MVM_SESSION_"+code;
      const sessionRaw=prop.getProperty(sessionKey);
      const session=sessionRaw?JSON.parse(sessionRaw):null;
      const year=session?session.year:String(new Date().getUTCFullYear());
      const path="entregas/"+year+"/"+code+".json";
      const existing=mvmFile_(token,repo,"GET",path);
      if(existing.status===200){
        const base64=String(existing.data.content||"").replace(/\s/g,"");
        const saved=Utilities.newBlob(Utilities.base64Decode(base64)).getDataAsString("UTF-8");
        // Same invite can confirm an identical retry, but NEVER overwrite a response.
        const savedObject=JSON.parse(saved);
        if(saved!==raw&&savedObject.serverSession?.payloadHash!==mvmHash_(raw))throw Error("La invitación ya fue entregada con otros resultados");
        alreadyReceived=true;accepted=true;
        if(session&&!session.finished){session.finished=true;prop.setProperty(sessionKey,JSON.stringify(session));}
      }else if(existing.status===404){
        if(!session||session.finished||session.attemptId!==attemptId||obj.startedAt!==new Date(session.started).toISOString())throw Error("Inicio de servidor requerido");
        const identity=mvmSessionIdentity_(params);
        if(session.browserHash!==identity.browserHash||session.tabHash!==identity.tabHash)throw Error("Sesión distinta");
        const t=Date.now();
        if(Date.parse(obj.finishedAt)>session.deadline+5000)throw Error("Fecha de cierre fuera de plazo");
        let finalObject=obj;
        if(t>session.deadline+MVM_FINAL_GRACE_MS){
          const progress=mvmReadJson_({repo,token},"avances/"+year+"/"+code+".json");
          if(!progress||progress.value.attemptId!==attemptId)throw Error("Sin avance previo al vencimiento");
          finalObject=progress.value.report;
          finalObject.finishedAt=new Date(session.deadline).toISOString();
          finalObject.finishReason="tiempo_agotado_ultimo_avance_servidor";
          finalObject.elapsedSeconds=4500;finalObject.overtime=false;
          if(/^P0[0-5]$/.test(code))finalObject.pilot.feedback=obj.pilot.feedback||{};
          if(!finalObject.candidate.name.trim())finalObject.candidate.name="Sin nombre";
          mvmCheckPayload_(finalObject,code);
        }
        mvmAudit_(session,"FINAL_DELIVERY",t);
        finalObject.serverSession={...mvmPublicAudit_(session),payloadHash:mvmHash_(raw),receivedAt:new Date(t).toISOString()};
        const finalBytes=Utilities.newBlob(JSON.stringify(finalObject)).getBytes();
        if(finalBytes.length>MVM_MAX_BYTES)throw Error("Entrega demasiado grande");
        const encoded=Utilities.base64Encode(finalBytes);
        const created=mvmFile_(token,repo,"PUT",path,{
          message:"MVM recepción "+code+" ("+attemptId+")",content:encoded});
        if(created.status!==201)throw Error("GitHub no confirmó escritura");
        session.finished=true;prop.setProperty(sessionKey,JSON.stringify(session));
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
