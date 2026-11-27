/* V36 migration receiver: keep existing V35 routes, properties and deployment URL.
 * Migration defaults OFF. mvm36EstadoMigracion returns only four safe status values.
 * No tokens or invitation links are embedded. Do not run mvmProvisionInvitations.
 */
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
 if(response.status!==200)throw Error("GITHUB_READ_HTTP_"+response.status);
 const raw=Utilities.newBlob(Utilities.base64Decode(String(response.data.content||"").replace(/\s/g,""))).getDataAsString("UTF-8");
 return {sha:response.data.sha,raw,value:JSON.parse(raw)};
}
function mvmWriteJson_(cfg,path,value,previous){
 const raw=JSON.stringify(value);
 const bytes=Utilities.newBlob(raw).getBytes();
 if(bytes.length>MVM_MAX_BYTES)throw Error("Tamaño de registro excedido");
 const content=Utilities.base64Encode(bytes);
 let lastStatus=0;
 for(let i=0;i<3;i++){
  const body={message:"MVM registro privado "+path,content};
  if(previous)body.sha=previous.sha;
  const result=mvmFile_(cfg.token,cfg.repo,"PUT",path,body);
  lastStatus=result.status;
  if(result.status===(previous?200:201))return {sha:result.data.content?.sha||null,raw,value};
  // A write may have completed even though its response was lost.
  if(![409,422,429,500,502,503,504].includes(lastStatus))throw Error("GITHUB_WRITE_HTTP_"+lastStatus);
  if(i<2)Utilities.sleep(400*(i+1));
  previous=mvmReadJson_(cfg,path);
  if(previous&&previous.raw===raw)return previous;
 }
 throw Error("GITHUB_WRITE_HTTP_"+lastStatus);
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
   // When migration is enabled, existing legacy sessions may finish; new pilot sessions cannot start through V35.
   if(!session&&action==="claim"&&/^P0[2-5]$/.test(code)&&prop.getProperty("MVM36_PILOTS_ENABLED")==="YES"){reply.status="MIGRATED_V36";return mvmReceipt_(reply);}
   const save=()=>prop.setProperty(key,JSON.stringify(session));
   let cfg=null;const getCfg=()=>cfg||(cfg=mvmPrivateConfig_(prop));
   const auditWrite=()=>{
    const path="auditoria/"+session.year+"/"+code+".json";
    try{const conf=getCfg();mvmWriteJson_(conf,path,mvmPublicAudit_(session),mvmReadJson_(conf,path));}catch(e){console.warn("MVM AUDIT "+code+" "+mvmSafeDiagnostic_(e));}
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
 }catch(e){reply.ok=false;reply.diagnostic=mvmSafeDiagnostic_(e);console.warn("MVM SESSION "+action+" "+reply.diagnostic);}
 return mvmReceipt_(reply);
}

function mvm35DoPost_(e){
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

/* Diagnóstico administrativo: registra exclusivamente estados y códigos HTTP.
   No muestra tokens, claves, hashes, correos ni respuestas. */
function mvmSafeDiagnostic_(e){
 const s=String(e&&e.message||"");
 if(/^GITHUB_(READ|WRITE)_HTTP_[0-9]{3}$/.test(s))return s;
 if(s==="Avance inválido")return "CHECKPOINT_VALIDATION";
 if(s==="Tamaño de avance no permitido"||s==="Tamaño de registro excedido")return "PAYLOAD_SIZE";
 if(s==="Destino privado sin configurar"||s==="El destino no es un repositorio privado autorizado.")return "PRIVATE_REPO_CONFIG";
 if(s==="Invitación inválida"||s==="Identidad de sesión inválida"||s==="Intento inválido")return "SESSION_AUTH";
 if(/lock|bloqueo/i.test(s))return "LOCK_ERROR";
 return "OTHER_SERVER_ERROR";
}
function mvmDiagnosticoP01(){
 const result={session:"NO",checkpoint:"NO",audit:"NO",read:"NO",write:"NO"};
 const prop=PropertiesService.getScriptProperties();
 const lock=LockService.getScriptLock();lock.waitLock(25000);
 try{
  const raw=prop.getProperty("MVM_SESSION_P01");
  const session=raw?JSON.parse(raw):null;
  result.session=session?"SI":"NO";
  const cfg=mvmPrivateConfig_(prop);result.read="SI";
  const year=session?session.year:String(new Date().getUTCFullYear());
  const checkpoint=mvmReadJson_(cfg,"avances/"+year+"/P01.json");
  result.checkpoint=checkpoint?.value?.schema==="MVM_PROGRESS_1"?"SI":checkpoint?"CONTENEDOR_VACIO":"NO";
  if(checkpoint?.value?.schema==="MVM_PROGRESS_1"){result.savedAt=checkpoint.value.savedAt;result.stage=checkpoint.value.state?.stage;result.answers=checkpoint.value.report?.progress?.objectiveAnswered;}
  const path="diagnostico/"+year+"/conexion-P01.json";
  const prev=mvmReadJson_(cfg,path);
  mvmWriteJson_(cfg,path,{test:"MVM_CONNECTION_CHECK",at:new Date().toISOString()},prev);
  result.write="SI";
  if(session){
   const auditPath="auditoria/"+year+"/P01.json";
   mvmWriteJson_(cfg,auditPath,mvmPublicAudit_(session),mvmReadJson_(cfg,auditPath));
   result.audit="SI";
  }
 }catch(e){result.error=mvmSafeDiagnostic_(e);}
 finally{lock.releaseLock();}
 Logger.log(JSON.stringify(result));
}

/* MVM V36 · núcleo de evaluación privada, borrador.
 * Funciones puras para servidor; no contienen preguntas, respuestas ni credenciales.
 * El adaptador debe autenticar invitación, sesión y exclusividad bajo LockService ANTES de invocarlas.
 */
const MVM36_STAGES = ["identification","objective","excel","pivot","sql","python","open","final"];
function mvm36Fail_(code){throw new Error(code);}
function mvm36Copy_(v){return JSON.parse(JSON.stringify(v));}
function mvm36Text_(v,max){if(typeof v!=="string"||v.length>max)mvm36Fail_("INVALID_TEXT");return v;}
function mvm36Obj_(v){if(!v||typeof v!=="object"||Array.isArray(v))mvm36Fail_("INVALID_OBJECT");return v;}
function mvm36Array_(v,n){if(!Array.isArray(v)||v.length!==n)mvm36Fail_("INVALID_ARRAY");return v;}
function mvm36CheckBank_(bank){
 if(bank?.schema!=="MVM_EXAM_BANK_1"||typeof bank.examId!=="string"||bank.durationSeconds!==4500||bank.objective?.length!==15||bank.open?.length!==3||bank.sharedForm!==true)mvm36Fail_("INVALID_BANK");
 for(const q of bank.objective){if(q.options?.length!==4||!Number.isInteger(q.correct)||q.correct<0||q.correct>3)mvm36Fail_("INVALID_BANK");}
 if(new Set(bank.objective.map(q=>q.id)).size!==15||new Set(bank.open.map(q=>q.id)).size!==3)mvm36Fail_("INVALID_BANK");
}
function mvm36Create_(bank,attemptId,now){
 mvm36CheckBank_(bank);if(!Number.isFinite(now)||typeof attemptId!=="string"||!attemptId)mvm36Fail_("INVALID_START");
 return {schema:"MVM36_SERVER_STATE_1",examId:bank.examId,attemptId,startedAt:now,deadline:now+bank.durationSeconds*1000,stage:0,caseIndex:0,revision:0,closed:{},draft:null,finished:false};
}
function mvm36Guard_(state,bank,now){
 if(!state||state.schema!=="MVM36_SERVER_STATE_1"||state.examId!==bank.examId)mvm36Fail_("SESSION_BANK_MISMATCH");
 if(state.finished||now>=state.deadline)mvm36Fail_("SESSION_CLOSED");
}
function mvm36StageView_(state,bank,now){
 mvm36Guard_(state,bank,now);
 const s=MVM36_STAGES[state.stage],v={examId:state.examId,stage:s,caseIndex:state.caseIndex,revision:state.revision,deadline:state.deadline,serverNow:now,draft:mvm36Copy_(state.draft)};
 const p=bank.practical;
 switch(s){
  case "identification":v.content={fields:["name","email"]};break;
  case "objective":v.content=bank.objective.map(q=>({id:q.id,prompt:q.prompt,options:[...q.options]}));break;
  case "excel":v.content={rows:p.excel.rows,tasks:p.excel.tasks};break;
  case "pivot":v.content={rows:p.pivot.rows,tasks:p.pivot.tasks.map(q=>({id:q.id,prompt:q.prompt}))};break;
  case "sql":v.content={products:p.sql.products,sales:p.sql.sales,prompt:p.sql.prompt};break;
  case "python":v.content={rows:p.python.rows,prompt:p.python.prompt};break;
  case "open":{const c=bank.open[state.caseIndex];v.content={id:c.id,title:c.title,prompt:c.prompt};break;}
  case "final":v.content={readyToSubmit:true};break;
  default:mvm36Fail_("INVALID_STAGE");
 }
 return mvm36Copy_(v);
}
function mvm36ExecutionEvidence_(stage,p){
 const code=mvm36Text_(p.code||"",30000),out={code,executions:Math.max(0,Math.min(100000,Math.trunc(Number(p.executions)||0))),lastExecution:null};
 if(stage==="python")out.engineReady=p.engineReady===true;
 const x=p.lastExecution;if(!x||typeof x!=="object"||String(stage==="sql"?x.query:x.code)!==code)return out;
 const safe=(v,n)=>String(v??"").slice(0,n),e={success:x.success===true,executionCount:Math.max(0,Math.min(100000,Math.trunc(Number(x.executionCount)||0))),error:safe(x.error,3000)};
 if(stage==="sql"){
  e.query=code;e.rowsReturned=Math.max(0,Math.min(1000000,Math.trunc(Number(x.rowsReturned)||0)));
  e.results=Array.isArray(x.results)?x.results.slice(0,3).map(t=>({columns:Array.isArray(t?.columns)?t.columns.slice(0,30).map(v=>safe(v,100)):[],values:Array.isArray(t?.values)?t.values.slice(0,100).map(row=>Array.isArray(row)?row.slice(0,30).map(v=>v===null||typeof v==="number"&&Number.isFinite(v)?v:safe(v,200)):[]):[]})):[];
  // Keep an upper bound on the total size, irrespective of the result table shape.
  if(JSON.stringify(e.results).length>40000)e.results=[];
 }else{e.code=code;e.output=safe(x.output,30000);e.executedAt=safe(x.executedAt,60);}
 out.lastExecution=e;return out;
}
function mvm36PivotRecord_(x){
 mvm36Obj_(x);if(![1,2,3].includes(x.id))mvm36Fail_("INVALID_PIVOT");
 const a=mvm36Obj_(x.answers||{}),answers={};if(Object.keys(a).length>10)mvm36Fail_("INVALID_PIVOT");
 for(const k of Object.keys(a)){if(!/^[a-z_0-9]{1,50}$/.test(k))mvm36Fail_("INVALID_PIVOT");answers[k]=mvm36Text_(a[k],300);}
 const fields={};for(const k of ["rowField","colField","valueField","aggregate","filterField","sortOrder"])fields[k]=mvm36Text_(x[k]||"",60);
 const filters=x.filterValues||[];if(!Array.isArray(filters)||filters.length>80)mvm36Fail_("INVALID_PIVOT");
 return {id:x.id,skipped:x.skipped===true,...fields,filterValues:filters.map(v=>mvm36Text_(v,100)),answers};
}
function mvm36ValidateAnswer_(stage,caseIndex,bank,input,partial){
 const p=mvm36Obj_(input);
 switch(stage){
 case "identification":{const name=mvm36Text_(p.name||"",160).trim(),email=mvm36Text_(p.email||"",180).trim();if(!partial&&(!name||!email))mvm36Fail_("IDENTIFICATION_REQUIRED");return {name,email};}
 case "objective":return {answers:mvm36Array_(p.answers,15).map((v,i)=>{if(v!==null&&(!Number.isInteger(v)||v<0||v>3))mvm36Fail_("INVALID_OPTION");return {id:bank.objective[i].id,selected:v};})};
 case "excel":{const f=mvm36Obj_(p.formulas||{}),formulas={};const keys=Object.keys(f);if(keys.length>1500)mvm36Fail_("EXCEL_LIMIT");for(const k of keys){if(!/^[A-Z]{1,3}[1-9][0-9]{0,3}$/.test(k))mvm36Fail_("INVALID_CELL");formulas[k]=mvm36Text_(f[k],1000);}const ids=bank.practical.excel.rows.map(r=>String(r.id)),order=p.rowOrder===undefined?ids:p.rowOrder;
 if(!Array.isArray(order)||order.length!==ids.length||new Set(order.map(String)).size!==ids.length||order.some(id=>!ids.includes(String(id))))mvm36Fail_("INVALID_ROW_ORDER");const layout={};if(partial&&p.layout&&typeof p.layout==="object"){const raw=p.layout;layout.selected=/^[A-K][1-9][0-9]{0,3}$/.test(raw.selected||"")?raw.selected:"A1";layout.filterChannel=typeof raw.filterChannel==="string"?raw.filterChannel.slice(0,60):"Todos";layout.cellFormats={};for(const [k,v] of Object.entries(raw.cellFormats||{}).slice(0,1500)){if(!/^[A-K][1-9][0-9]{0,3}$/.test(k))continue;if(typeof v==="string")layout.cellFormats[k]=v.slice(0,30);else if(v&&typeof v==="object")layout.cellFormats[k]=Object.fromEntries(Object.entries(v).filter(([key,value])=>["percent","bold","border","number","format"].includes(key)&&["string","boolean"].includes(typeof value)).map(([key,value])=>[key,typeof value==="string"?value.slice(0,30):value]));}}return {formulas,rowOrder:order.map(String),layout};}
 case "pivot":{const items=p.exercises;if(!Array.isArray(items)||items.length>3)mvm36Fail_("INVALID_PIVOT");const result=items.map(mvm36PivotRecord_);if(new Set(result.map(x=>x.id)).size!==result.length)mvm36Fail_("INVALID_PIVOT");const working=partial&&p.working?mvm36PivotRecord_(p.working):null;return {exercises:result,working};}
 case "sql":case "python":return mvm36ExecutionEvidence_(stage,p);
 case "open":return {id:bank.open[caseIndex].id,response:mvm36Text_(p.response||"",16000)};
 case "final":return {};
 default:mvm36Fail_("INVALID_STAGE");
 }
}
function mvm36Apply_(state,bank,request,now){
 mvm36Guard_(state,bank,now);mvm36Obj_(request);
 const stage=MVM36_STAGES[state.stage];
 if(request.stage!==stage||request.caseIndex!==state.caseIndex||request.revision!==state.revision)mvm36Fail_("STALE_OR_UNAUTHORIZED_STAGE");
 if(!["save","advance"].includes(request.action))mvm36Fail_("INVALID_ACTION");
 if(stage==="final")mvm36Fail_("USE_FINALIZE");
 const answer=mvm36ValidateAnswer_(stage,state.caseIndex,bank,request.answer,request.action==="save");
 const next=mvm36Copy_(state);next.revision++;next.updatedAt=now;
 if(request.action==="save"){next.draft=answer;return next;}
 const key=stage==="open"?"open_"+(state.caseIndex+1):stage;
 if(Object.prototype.hasOwnProperty.call(next.closed,key))mvm36Fail_("ALREADY_CLOSED");
 next.closed[key]={answer,closedAt:now,revision:next.revision};next.draft=null;
 if(stage==="open"&&state.caseIndex<2)next.caseIndex++;else{next.stage++;next.caseIndex=0;}
 return next;
}
function mvm36Finalize_(state,bank,now){
 if(state.finished)return mvm36Copy_(state);
 if(state.examId!==bank.examId)mvm36Fail_("SESSION_BANK_MISMATCH");
 if(now<state.deadline&&MVM36_STAGES[state.stage]!=="final")mvm36Fail_("NOT_AT_FINAL_STAGE");
 const next=mvm36Copy_(state);next.finished=true;next.finishedAt=Math.min(now,state.deadline);next.receivedAt=now;next.reason=now>=state.deadline?"time_expired":"manual";
 if(next.draft){const k=MVM36_STAGES[next.stage]==="open"?"open_"+(next.caseIndex+1):MVM36_STAGES[next.stage];if(!next.closed[k])next.closed[k]={answer:next.draft,closedAt:next.finishedAt,revision:next.revision,partial:true};}
 next.draft=null;next.revision++;return next;
}
function mvm36ObjectiveScore_(state,bank){
 const a=state.closed.objective?.answer?.answers||[];const index=new Map(a.map(v=>[v.id,v.selected]));
 const correct=bank.objective.filter(q=>index.get(q.id)===q.correct).length;
 return {correct,total:bank.objective.length,points:correct*bank.weights.objective/bank.objective.length};
}

const MVM36_BANK_REF="a1dbca0bf960a123ec18bc0c6d8b8ccfab6120fc";
const MVM36_BANK_PATH="bancos/MVM-ASESOR-2026-V36.json";
const MVM36_SANDBOX_PATH="v36-sandbox/";
function mvm36BankFromPrivate_(cfg){
 const url="https://api.github.com/repos/"+cfg.repo+"/contents/"+MVM36_BANK_PATH.split("/").map(encodeURIComponent).join("/")+"?ref="+encodeURIComponent(MVM36_BANK_REF);
 const r=mvmFetch_(url,{method:"get",headers:mvmApiHeaders_(cfg.token)});
 if(r.status!==200)throw Error("PRIVATE_BANK_UNAVAILABLE");
 const raw=Utilities.newBlob(Utilities.base64Decode(String(r.data.content||"").replace(/\s/g,""))).getDataAsString("UTF-8");
 const bank=JSON.parse(raw);mvm36CheckBank_(bank);return bank;
}
function mvm36SandboxAuth_(params,prop){
 if(prop.getProperty("MVM36_PILOTS_ENABLED")!=="YES")throw Error("SANDBOX_DISABLED");
 const code=String(params.invitationCode||"");
 const token=String(params.invitationToken||"");
 const expected=/^P0[02345]$/.test(code)?(JSON.parse(prop.getProperty("MVM_INVITE_HASHES")||"{}")[code]||""):"";
 if(!/^P0[02345]$/.test(code)||!/^[a-f0-9]{64}$/.test(token)||!/^[a-f0-9]{64}$/.test(expected)||mvmHash_(token)!==expected)throw Error("INVALID_INVITATION");
 return {...mvmSessionIdentity_(params),code};
}
// Client telemetry is advisory. Only bounded numeric aggregates are retained.
function mvm36Telemetry_(input){
 if(!input||typeof input!=="object")return null;
 const countKeys=["copyAttempts","pasteAttempts","dropAttempts","visibilityHiddenCount","hiddenMilliseconds","focusLossCount","focusLossMilliseconds"];
 const fieldKeys=["typedCharacters","deletedCharacters","inputEvents","activeTypingMs","writingSpanMs","pausesOver5Seconds","pausesOver10Seconds","substantialRevisionCount","backspacePresses","deletePresses","longestUninterruptedCharacters","longestInterInputPauseMs","correctionCycles","multilineRevisionCount","minorDeletionEvents","maxDeletionSequenceChars"];
 const norm=v=>Number.isFinite(v)&&v>=0?Math.min(Math.round(v),100000000):0;
 const out={sources:{}};
 for(const [source,s] of Object.entries(input).slice(0,6)){
  if(!["evaluation","excel","pivot","sql","python"].includes(source)||!s||typeof s!=="object")continue;
  const v={source,schema:"MVM_MONITOR_1",pasteAllowed:true};for(const k of countKeys)v[k]=norm(s[k]);v.fields={};
  for(const [key,f] of Object.entries(s.fields||{}).slice(0,100)){
   if(!/^[a-zA-Z0-9_]{1,80}$/.test(key)||!f||typeof f!=="object")continue;
   v.fields[key]=Object.fromEntries(fieldKeys.map(k=>[k,norm(f[k])]));
  }
  out.sources[source]=v;
 }
 return out;
}
function mvm36Feedback_(answer){
 const f=answer?.feedback||{},out={};
 for(const k of ["device","clarity","navigation","technicalIssues","suggestions","integrityTests"]){const v=f[k];out[k]=typeof v==="string"?v.slice(0,4000):"";}
 for(const k of ["clarity","navigation"])if(!/^[1-5]$/.test(out[k]))out[k]="";
 return out;
}
function mvm36FeedbackView_(r,now){return {examId:r.state.examId,stage:"final",caseIndex:0,revision:r.state.revision,deadline:r.state.deadline,serverNow:now,frozenAt:r.state.finishedAt,draft:{feedback:r.feedback||{}},content:{readyToSubmit:true},expired:true};}
function mvm36MonitoringSummary_(data){
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
 const reopens=data.reopens||{count:0,events:[]};
 if(reopens.count)alerts.push({code:"ASSESSMENT_REOPENED",level:"informativo",count:reopens.count,evidence:{events:reopens.events||[]},message:"Se reabrió o recargó la evaluación en el mismo perfil de navegador. Puede deberse a una salida accidental, actualización o fallo técnico; no demuestra un reinicio intencional."});
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
  // Exploratory calibration from P00; requires several simultaneous indicators.
  const pausesPerMinute=f.writingSpanMs>0?f.pausesOver5Seconds/(f.writingSpanMs/60000):null;
  const steadyLowRevision=f.field.startsWith("caso_")&&f.typedCharacters>=250&&f.inputEvents>=150&&f.writingSpanMs>=60000&&
   f.activeCharactersPerSecond>=2.5&&f.sustainedCharactersPerSecond>=1.8&&pausesPerMinute!==null&&pausesPerMinute<=1&&f.pausesOver10Seconds===0&&
   f.deletionRatio!==null&&f.deletionRatio<=0.05&&f.substantialRevisionCount===0&&f.multilineRevisionCount===0;
  if(continuousRapid||steadyLowRevision){
   alerts.push({
    code:continuousRapid?"FAST_CONTINUOUS_LOW_REVISION":"POSSIBLE_TRANSCRIPTION",level:"revisar",source:f.source,field:f.field,
    evidence:{typedCharacters:f.typedCharacters,writingSeconds:Math.round(f.writingSpanMs/1000),
     sustainedCharactersPerSecond:f.sustainedCharactersPerSecond,activeCharactersPerSecond:f.activeCharactersPerSecond,inputEvents:f.inputEvents,pausesOver5Seconds:f.pausesOver5Seconds,pausesOver10Seconds:f.pausesOver10Seconds,pausesPerMinute:pausesPerMinute===null?null:Number(pausesPerMinute.toFixed(2)),
     deletedCharacters:f.deletedCharacters,deletionRatio:f.deletionRatio,
     substantialRevisionCount:f.substantialRevisionCount,multilineRevisionCount:f.multilineRevisionCount,
     longestUninterruptedCharacters:f.longestUninterruptedCharacters},
    message:"Se observó escritura sostenida, con muy pocas pausas y sin revisiones extensas detectables en "+f.field+". El patrón podría ser compatible con transcripción, pero también con otras formas legítimas de redacción; requiere revisión contextual, no demuestra consulta de otro equipo."
   });
  }
 }
 return{enabled:!!data.consentAt,consentAt:data.consentAt||null,
  policy:"Los umbrales de escritura son orientativos y no validados como detector de fraude. Las métricas no afectan la calificación ni constituyen prueba de irregularidad; requieren revisión contextual y posibilidad de aclaración.",
  tabHiddenCount:tabs,hiddenSeconds:Math.round(Number(parent.hiddenMilliseconds||0)/1000),
  windowFocusLossCount:blur,windowUnfocusedSeconds:Math.round(Number(parent.focusLossMilliseconds||0)/1000),
  copyEvents,pasteEvents,pasteAttempts:pasteEvents,dropEvents,blockedPasteAttempts:legacyBlockedPaste,blockedDropAttempts:0,reopenCount:reopens.count||0,fields,alerts,detail:{parent,tools:data.tools||{},reopens}};
}
function mvm36PivotEvidence_(item,bank){
 const p=bank.practical.pivot.rows.map((r,i)=>({...r,Fecha:"2026-"+String(Math.floor(i/24)+1).padStart(2,"0")+"-"+String(i%24+1).padStart(2,"0"),PrecioUnitario:r.Precio}));
 const fields=["Fecha","Mes","Sucursal","Categoría","Título","Unidades","PrecioUnitario","Importe"],measures=["Unidades","PrecioUnitario","Importe"];
 if(!measures.includes(item.valueField)||!["sum","avg","count"].includes(item.aggregate))return {...item,total:null,rowTotals:{},colTotals:{}};
 const rows=fields.includes(item.filterField)?p.filter(r=>item.filterValues.includes(String(r[item.filterField]))):p;
 const ag=items=>{const s=items.reduce((n,r)=>n+Number(r[item.valueField]||0),0);return item.aggregate==="count"?items.length:item.aggregate==="avg"?(items.length?s/items.length:0):s;};
 const totals=k=>fields.includes(k)?Object.fromEntries([...new Set(rows.map(r=>String(r[k])))].map(v=>[v,ag(rows.filter(r=>String(r[k])===v))])):{};
 return {...item,visibleRows:rows.length,total:ag(rows),rowTotals:totals(item.rowField),colTotals:totals(item.colField)};
}
function mvm36AuditEvent_(r,event,now,detail={}){
 r.counts=r.counts||{};r.counts[event]=(r.counts[event]||0)+1;
 r.audit=r.audit||[];r.audit.push({event,at:now,...detail});if(r.audit.length>150)r.audit=r.audit.slice(-150);
}
function mvm36Report_(r,bank){
 const s=r.state,c=s.closed,code=r.invitationCode,person=c.identification?.answer||{},obj=new Map((c.objective?.answer?.answers||[]).map(x=>[x.id,x.selected]));
 const pivot=Object.fromEntries((c.pivot?.answer?.exercises||[]).map(x=>[x.id,mvm36PivotEvidence_(x,bank)]));
 const sources={};
 for(const tel of Object.values(r.telemetry||{}))for(const [name,v] of Object.entries(tel.sources||{}))sources[name]=v;
 const counts={};for(const e of r.audit||[])counts[e.event]=(counts[e.event]||0)+1;Object.assign(counts,r.counts||{});
 const stamp=t=>new Date(t).toISOString(),tools=Object.fromEntries(Object.entries(sources).filter(([n])=>n!=="evaluation").map(([n,v])=>[n,{cumulative:v}]));
 const monitoring=mvm36MonitoringSummary_({consentAt:stamp(s.startedAt),parent:sources.evaluation||{},tools,reopens:{count:(counts.RESUMED||0)+(counts.TAB_CHANGED||0),events:(r.audit||[]).filter(e=>["RESUMED","TAB_CHANGED"].includes(e.event)).map(e=>({type:e.event,at:stamp(e.at)}))}});
 if(!Object.keys(sources).length)monitoring.alerts.push({code:"MONITORING_MISSING",level:"revisar",count:1,message:"No se recibieron métricas; revisar incidencia técnica."});
 for(const [key,msg] of [["OTHER_BROWSER_BLOCKED","Otro navegador intentó acceder a esta sesión."],["CONCURRENT_TAB_BLOCKED","Otra pestaña intentó acceder simultáneamente."]])if(counts[key])monitoring.alerts.push({code:key,level:"revisar",count:counts[key],message:msg+" El evento no demuestra fraude."});
 monitoring.source="CLIENT_ADVISORY";monitoring.byStage=r.telemetry||{};
 const f=c.excel?.answer?.formulas||{},excel=c.excel?{formulas:f,rowOrder:c.excel.answer.rowOrder,score:null,answers:Object.fromEntries(["J3","J4","J5","J7"].map(k=>[k,{input:f[k]||"",evaluated:null}])),helperFormulas:Object.entries(f).filter(([k,v])=>!["J3","J4","J5","J7"].includes(k)&&v.startsWith("=")).map(([cell,input])=>({cell,input,evaluated:null})),formulaChecks:[],completedAt:stamp(c.excel.closedAt)}:null;
 const exec=k=>c[k]?{...c[k].answer,completedAt:stamp(c[k].closedAt)}:null;
 return {schema:"MVM_PILOT_16",assessment:"Asesor de Métricas · MVM V36",examId:bank.examId,bankRef:r.bankRef,attemptId:s.attemptId,candidate:{name:person.name||"Sin nombre",email:person.email||""},createdAt:stamp(s.startedAt),startedAt:stamp(s.startedAt),finishedAt:stamp(s.finishedAt),finishReason:s.reason,timeLimitSeconds:bank.durationSeconds,elapsedSeconds:Math.round((s.finishedAt-s.startedAt)/1000),overtime:false,pilot:{invitationCode:code,mode:"PRUEBA_DE_USABILIDAD",integrityAcknowledgedAt:stamp(s.startedAt),feedback:r.feedback||{}},progress:{stage:s.stage,objectiveAnswered:[...obj.values()].filter(Number.isInteger).length,casesAnswered:[1,2,3].filter(n=>c["open_"+n]?.answer?.response?.trim()).length},knowledge:bank.objective.map((q,i)=>{const v=obj.get(q.id);return {id:q.id,number:i+1,question:q.prompt,selected:Number.isInteger(v)?"ABCD"[v]:null,selectedText:Number.isInteger(v)?q.options[v]:null};}),openCases:bank.open.map((q,i)=>({id:q.id,number:i+1,title:q.title,prompt:q.prompt,response:c["open_"+(i+1)]?.answer?.response||""})),practical:{excel,pivot:c.pivot?{snapshots:pivot,completedAt:stamp(c.pivot.closedAt),completed:!c.pivot.partial}:null,sql:exec("sql"),python:exec("python")},practicalDrafts:Object.fromEntries(["excel","pivot","sql","python"].filter(k=>c[k]?.partial).map(k=>[k,c[k].answer])),monitoring,serverSession:{version:36,startedAt:stamp(s.startedAt),receivedAt:stamp(r.submittedAt),lastCheckpointAt:s.updatedAt?stamp(s.updatedAt):null,counts,events:(r.audit||[]).map(e=>({...e,at:stamp(e.at)})),deadlineAt:stamp(s.deadline)},review:{status:"PENDIENTE_DE_REVISION",objective:r.score?.objective||mvm36ObjectiveScore_(s,bank),note:"Evidencias de ejecución de cliente orientativas; fórmulas, tablas y código deben verificarse de forma independiente con banco privado fijado."}};
}
function mvm36SandboxStep_(record,bank,identity,req,now,newAttempt){
 const action=req.action;
 if(!["claim","save","advance","finalize"].includes(action))throw Error("INVALID_ACTION");
 const r=record?mvm36Copy_(record):null;
 if(!r&&action!=="claim")throw Error("CLAIM_REQUIRED");
 if(!r){
  const state=mvm36Create_(bank,newAttempt,now);
  const fresh={schema:"MVM36_SANDBOX_1",bankRef:MVM36_BANK_REF,browserHash:identity.browserHash,tabHash:identity.tabHash,leaseUntil:now+120000,state,audit:[{event:"FIRST_START",at:now}],counts:{FIRST_START:1}};
  return {record:fresh,reply:{status:"CLAIMED",attemptId:state.attemptId,view:mvm36StageView_(state,bank,now)}};
 }
 if(r.bankRef!==MVM36_BANK_REF)throw Error("SESSION_BANK_MISMATCH");
 if(r.browserHash!==identity.browserHash){mvm36AuditEvent_(r,"OTHER_BROWSER_BLOCKED",now);return {record:r,reply:{ok:false,status:"OTHER_BROWSER"}};}
 if(r.tabHash!==identity.tabHash&&r.leaseUntil>now){mvm36AuditEvent_(r,"CONCURRENT_TAB_BLOCKED",now);return {record:r,reply:{ok:false,status:"CONCURRENT_TAB"}};}
 if(action!=="claim"&&req.attemptId!==r.state.attemptId)throw Error("ATTEMPT_MISMATCH");
 if(r.submitted)return {record:r,reply:{status:"ALREADY_SUBMITTED",attemptId:r.state.attemptId,receivedAt:r.submittedAt}};
 if(r.state.finished){
  if(action==="finalize"){r.feedback=mvm36Feedback_(req.answer);r.submitted=true;r.submittedAt=now;mvm36AuditEvent_(r,"FINAL_DELIVERY",now);return {record:r,reply:{status:"RECEIVED",attemptId:r.state.attemptId,receivedAt:now}};}
  if(action!=="claim")throw Error("SESSION_CLOSED");
  return {record:r,reply:{status:"FEEDBACK_REQUIRED",attemptId:r.state.attemptId,view:mvm36FeedbackView_(r,now)}};
 }
 if(action==="claim"){
  const event=r.tabHash===identity.tabHash?"RESUMED":"TAB_CHANGED";
  r.tabHash=identity.tabHash;mvm36AuditEvent_(r,event,now);
 }else if(action!=="finalize"&&now<r.state.deadline){
  r.state=mvm36Apply_(r.state,bank,req,now);
  if(req.monitor){const telemetry=mvm36Telemetry_(req.monitor);if(telemetry){r.telemetry=r.telemetry||{};const k=req.stage==="open"?"open_"+(req.caseIndex+1):req.stage;r.telemetry[k]=telemetry;}}
  mvm36AuditEvent_(r,action==="advance"?"STAGE_CLOSED":"CHECKPOINT",now,{stage:req.stage,caseIndex:req.caseIndex,revision:r.state.revision});
 }
 if(now>=r.state.deadline||action==="finalize"||MVM36_STAGES[r.state.stage]==="final"){
  r.state=mvm36Finalize_(r.state,bank,now);
  r.score={objective:mvm36ObjectiveScore_(r.state,bank),practical:"PENDING_INDEPENDENT_REVIEW",open:"PENDING_INDEPENDENT_REVIEW"};
  if(action!=="finalize"||req.answer?.feedback===undefined){mvm36AuditEvent_(r,"TIME_CLOSED",now);return {record:r,reply:{status:"FEEDBACK_REQUIRED",attemptId:r.state.attemptId,view:mvm36FeedbackView_(r,now)}};}
  r.feedback=mvm36Feedback_(req.answer);r.submitted=true;r.submittedAt=now;mvm36AuditEvent_(r,"FINAL_DELIVERY",now);
  return {record:r,reply:{status:"RECEIVED",attemptId:r.state.attemptId,receivedAt:now}};
 }
 r.leaseUntil=now+120000;
 if(r.audit.length>150)r.audit=r.audit.slice(-150);
 return {record:r,reply:{status:action==="claim"?"CLAIMED":action==="save"?"SAVED":"ADVANCED",attemptId:r.state.attemptId,view:mvm36StageView_(r.state,bank,now)}};
}
function mvm36SandboxAction_(params){
 const nonce=String(params.nonce||"").slice(0,100);
 const base={type:"MVM36_SESSION_RECEIPT",version:36,nonce,ok:false};
 const lock=LockService.getScriptLock();
 try{
  const prop=PropertiesService.getScriptProperties();
  const identity=mvm36SandboxAuth_(params,prop);
  const raw=String(params.payload||"{}");
  if(Utilities.newBlob(raw).getBytes().length>350000)throw Error("PAYLOAD_SIZE");
  const req=JSON.parse(raw);req.action=String(params.action||"").replace(/^v36_/,"");
  lock.waitLock(25000);
  try{
   const cfg=mvmPrivateConfig_(prop),bank=mvm36BankFromPrivate_(cfg);
   const isControl=identity.code==="P00";
   const path=isControl?"control/2026/P00/sesion.json":MVM36_SANDBOX_PATH+identity.code+".json";
   const previous=mvmReadJson_(cfg,path);
   const prior=previous?.value?.schema==="MVM36_SANDBOX_1"?previous.value:null;
   if(previous&&!prior&&previous.value?.schema!=="MVM_SLOT_PENDING")throw Error("INVALID_SANDBOX_RECORD");
   if(!isControl&&!prior&&prop.getProperty("MVM_SESSION_"+identity.code))throw Error("LEGACY_SESSION_EXISTS");
   if(!isControl&&!prior&&mvmReadJson_(cfg,"entregas/2026/"+identity.code+".json"))throw Error("LEGACY_SESSION_EXISTS");
   const result=mvm36SandboxStep_(prior,bank,identity,req,Date.now(),identity.code+"-V36-"+Utilities.getUuid());
   result.record.invitationCode=identity.code;
   // Receipt only after durable server storage.
   if(JSON.stringify(prior)!==JSON.stringify(result.record))mvmWriteJson_(cfg,path,result.record,previous);
   if(result.record.submitted){
    const finalPath=isControl?"control/2026/P00/entregas/"+result.record.state.attemptId+".json":"entregas/2026/"+identity.code+".json",existing=mvmReadJson_(cfg,finalPath),report=mvm36Report_(result.record,bank);
    if(isControl){report.pilot.mode="CONTROL_INTERNO";report.pilot.excludeFromRanking=true;}
    if(existing){if(existing.value?.attemptId!==report.attemptId||existing.value?.bankRef!==report.bankRef)throw Error("LEGACY_SESSION_EXISTS");}
    else mvmWriteJson_(cfg,finalPath,report,null);
   }
   return mvmReceipt_({...base,ok:true,...result.reply});
  }finally{lock.releaseLock();}
 }catch(e){
  const allowed=["SANDBOX_DISABLED","INVALID_INVITATION","PRIVATE_BANK_UNAVAILABLE","OTHER_BROWSER","CONCURRENT_TAB","ATTEMPT_MISMATCH","CLAIM_REQUIRED","SESSION_BANK_MISMATCH","STALE_OR_UNAUTHORIZED_STAGE","NOT_AT_FINAL_STAGE","PAYLOAD_SIZE","SESSION_CLOSED","IDENTIFICATION_REQUIRED","LEGACY_SESSION_EXISTS"];
  const status=allowed.includes(String(e.message))?String(e.message):"REJECTED";
  return mvmReceipt_({...base,status});
 }
}


function mvm36EstadoMigracion(){const prop=PropertiesService.getScriptProperties();const result={};for(const code of ["P02","P03","P04","P05"])result[code]=prop.getProperty("MVM_SESSION_"+code)?"SESION_V35_EXISTENTE":"SIN_SESION_V35";console.log(JSON.stringify(result));return result;}

function doPost(e){const p=e&&e.parameter||{};if(/^v36_(claim|save|advance|finalize)$/.test(String(p.action||"")))return mvm36SandboxAction_(p);return mvm35DoPost_(e);}
function mvm36ActivarPilotos(){const prop=PropertiesService.getScriptProperties(),lock=LockService.getScriptLock();lock.waitLock(25000);try{const cfg=mvmPrivateConfig_(prop);mvm36BankFromPrivate_(cfg);const results={};for(const code of ["P02","P03","P04","P05"]){if(prop.getProperty("MVM_SESSION_"+code)||mvmReadJson_(cfg,"entregas/2026/"+code+".json"))throw Error("LEGACY_SESSION_EXISTS_"+code);results[code]="LISTO";}prop.setProperty("MVM36_PILOTS_ENABLED","YES");console.log(JSON.stringify(results));return results;}finally{lock.releaseLock();}}
function mvm36DesactivarPilotos(){PropertiesService.getScriptProperties().deleteProperty("MVM36_PILOTS_ENABLED");return "DESACTIVADO";}

// Función administrativa: solo desde el editor Apps Script; NO expuesta en doPost.
function mvm36ReiniciarControlP00(){
 const lock=LockService.getScriptLock();lock.waitLock(25000);
 try{const cfg=mvmPrivateConfig_(PropertiesService.getScriptProperties()),path="control/2026/P00/sesion.json",old=mvmReadJson_(cfg,path);
 if(old?.value?.schema==="MVM_SLOT_PENDING")return "P00_DISPONIBLE";
 if(old){const prior=old.value,id=prior?.state?.attemptId;if(prior.schema!=="MVM36_SANDBOX_1"||prior.invitationCode!=="P00"||!/^P00-V36-[a-f0-9-]{36}$/.test(id||""))throw Error("INVALID_CONTROL_RECORD");
 const history="control/2026/P00/historial/"+id+".json",saved=mvmReadJson_(cfg,history);if(!saved)mvmWriteJson_(cfg,history,prior,null);else if(JSON.stringify(saved.value)!==JSON.stringify(prior))throw Error("CONTROL_ARCHIVE_CONFLICT");}
 mvmWriteJson_(cfg,path,{schema:"MVM_SLOT_PENDING",invitationCode:"P00",reason:"CONTROL_INTERNO",resetAt:new Date().toISOString()},old);return "P00_DISPONIBLE";
 }finally{lock.releaseLock();}
}
