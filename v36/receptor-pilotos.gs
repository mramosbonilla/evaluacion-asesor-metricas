/* MVM V36 piloto. Candidato a despliegue: no activar sin validar. Solo P02-P05. Reutiliza propiedades del proyecto actual; no sustituir todavía la implementación V35. */
const MVM_ORIGIN="https://mramosbonilla.github.io";
const MVM_MAX_BYTES=750000;
function mvmHash_(secret){
  const bytes=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(secret),Utilities.Charset.UTF_8);
  return bytes.map(b=>("0"+(b&255).toString(16)).slice(-2)).join("");
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

function mvmPrivateConfig_(prop){
 const repo=String(prop.getProperty("MVM_TARGET_REPO")||"").trim(),token=String(prop.getProperty("MVM_GITHUB_TOKEN")||"").trim();
 if(!token||repo.toLowerCase()!=="mramosbonilla/mvm-resultados-privados")throw Error("Destino privado sin configurar");
 mvmGetRepo_(token,repo);return {repo,token};
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
function mvm36ValidateAnswer_(stage,caseIndex,bank,input,partial){
 const p=mvm36Obj_(input);
 switch(stage){
 case "identification":{const name=mvm36Text_(p.name||"",160).trim(),email=mvm36Text_(p.email||"",180).trim();if(!partial&&(!name||!email))mvm36Fail_("IDENTIFICATION_REQUIRED");return {name,email};}
 case "objective":return {answers:mvm36Array_(p.answers,15).map((v,i)=>{if(v!==null&&(!Number.isInteger(v)||v<0||v>3))mvm36Fail_("INVALID_OPTION");return {id:bank.objective[i].id,selected:v};})};
 case "excel":{const f=mvm36Obj_(p.formulas||{}),formulas={};const keys=Object.keys(f);if(keys.length>1500)mvm36Fail_("EXCEL_LIMIT");for(const k of keys){if(!/^[A-Z]{1,3}[1-9][0-9]{0,3}$/.test(k))mvm36Fail_("INVALID_CELL");formulas[k]=mvm36Text_(f[k],1000);}return {formulas};}
 case "pivot":{const items=p.exercises;if(!Array.isArray(items)||items.length>3)mvm36Fail_("INVALID_PIVOT");const result=[],seen=new Set();for(const x of items){mvm36Obj_(x);if(![1,2,3].includes(x.id)||seen.has(x.id))mvm36Fail_("INVALID_PIVOT");seen.add(x.id);const a=mvm36Obj_(x.answers||{}),answers={};if(Object.keys(a).length>10)mvm36Fail_("INVALID_PIVOT");for(const k of Object.keys(a)){if(!/^[a-z_0-9]{1,50}$/.test(k))mvm36Fail_("INVALID_PIVOT");answers[k]=mvm36Text_(a[k],300);}const fields={};for(const k of ["rowField","colField","valueField","aggregate","filterField","sortOrder"])fields[k]=mvm36Text_(x[k]||"",60);const filters=x.filterValues||[];if(!Array.isArray(filters)||filters.length>80)mvm36Fail_("INVALID_PIVOT");result.push({id:x.id,skipped:x.skipped===true,...fields,filterValues:filters.map(v=>mvm36Text_(v,100)),answers});}return {exercises:result};}
 case "sql":case "python":return {code:mvm36Text_(p.code||"",30000)};
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

/* MVM V36 · adaptador de pruebas aislado. NO conectar a doPost de producción.
 * Permite únicamente T36 tras configurar explícitamente un hash de invitación de ensayo.
 * Depende del núcleo V36 y las funciones del receptor V35. No usa P00–P15.
 */
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
 const expected=/^P0[2-5]$/.test(code)?(JSON.parse(prop.getProperty("MVM_INVITE_HASHES")||"{}")[code]||""):"";
 if(!/^P0[2-5]$/.test(code)||!/^[a-f0-9]{64}$/.test(token)||!/^[a-f0-9]{64}$/.test(expected)||mvmHash_(token)!==expected)throw Error("INVALID_INVITATION");
 return {...mvmSessionIdentity_(params),code};
}
// Client telemetry is advisory. Only bounded numeric aggregates are retained.
function mvm36Telemetry_(input){
 if(!input||typeof input!=="object")return null;
 const countKeys=["copyAttempts","pasteAttempts","dropAttempts","visibilityHiddenCount","hiddenMilliseconds","focusLossCount","focusLossMilliseconds"];
 const fieldKeys=["typedCharacters","deletedCharacters","inputEvents","activeTypingMs","writingSpanMs","pausesOver5Seconds","pausesOver10Seconds","substantialRevisionCount","backspacePresses","deletePresses","longestUninterruptedCharacters","longestInterInputPauseMs"];
 const norm=v=>Number.isFinite(v)&&v>=0?Math.min(Math.round(v),100000000):0;
 const out={sources:{}};
 for(const [source,s] of Object.entries(input).slice(0,6)){
  if(!["evaluation","excel","pivot","sql","python"].includes(source)||!s||typeof s!=="object")continue;
  const v={};for(const k of countKeys)v[k]=norm(s[k]);v.fields={};
  for(const [key,f] of Object.entries(s.fields||{}).slice(0,100)){
   if(!/^[a-zA-Z0-9_]{1,80}$/.test(key)||!f||typeof f!=="object")continue;
   v.fields[key]=Object.fromEntries(fieldKeys.map(k=>[k,norm(f[k])]));
  }
  out.sources[source]=v;
 }
 return out;
}
function mvm36SandboxStep_(record,bank,identity,req,now,newAttempt){
 const action=req.action;
 if(!["claim","save","advance","finalize"].includes(action))throw Error("INVALID_ACTION");
 const r=record?mvm36Copy_(record):null;
 if(!r&&action!=="claim")throw Error("CLAIM_REQUIRED");
 if(!r){
  const state=mvm36Create_(bank,newAttempt,now);
  const fresh={schema:"MVM36_SANDBOX_1",bankRef:MVM36_BANK_REF,browserHash:identity.browserHash,tabHash:identity.tabHash,leaseUntil:now+120000,state,audit:[{event:"FIRST_START",at:now}]};
  return {record:fresh,reply:{status:"CLAIMED",attemptId:state.attemptId,view:mvm36StageView_(state,bank,now)}};
 }
 if(r.bankRef!==MVM36_BANK_REF)throw Error("SESSION_BANK_MISMATCH");
 if(r.browserHash!==identity.browserHash)throw Error("OTHER_BROWSER");
 if(r.tabHash!==identity.tabHash&&r.leaseUntil>now)throw Error("CONCURRENT_TAB");
 if(action!=="claim"&&req.attemptId!==r.state.attemptId)throw Error("ATTEMPT_MISMATCH");
 if(r.state.finished)return {record:r,reply:{status:"ALREADY_SUBMITTED",attemptId:r.state.attemptId,receivedAt:r.state.receivedAt}};
 if(action==="claim"){
  const event=r.tabHash===identity.tabHash?"RESUMED":"TAB_CHANGED";
  r.tabHash=identity.tabHash;r.audit.push({event,at:now});
 }else if(action!=="finalize"&&now<r.state.deadline){
  r.state=mvm36Apply_(r.state,bank,req,now);
  if(req.monitor){const telemetry=mvm36Telemetry_(req.monitor);if(telemetry){r.telemetry=r.telemetry||{};const k=req.stage==="open"?"open_"+(req.caseIndex+1):req.stage;r.telemetry[k]=telemetry;}}
  r.audit.push({event:action==="advance"?"STAGE_CLOSED":"CHECKPOINT",stage:req.stage,caseIndex:req.caseIndex,revision:r.state.revision,at:now});
 }
 if(now>=r.state.deadline||action==="finalize"){
  r.state=mvm36Finalize_(r.state,bank,now);
  r.score={objective:mvm36ObjectiveScore_(r.state,bank),practical:"PENDING_INDEPENDENT_REVIEW",open:"PENDING_INDEPENDENT_REVIEW"};
  r.audit.push({event:"FINAL_DELIVERY",at:now});
  return {record:r,reply:{status:"RECEIVED",attemptId:r.state.attemptId,receivedAt:r.state.receivedAt}};
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
   const path=MVM36_SANDBOX_PATH+identity.code+".json";
   const previous=mvmReadJson_(cfg,path);
   const prior=previous?.value?.schema==="MVM36_SANDBOX_1"?previous.value:null;
   if(previous&&!prior&&previous.value?.schema!=="MVM_SLOT_PENDING")throw Error("INVALID_SANDBOX_RECORD");
   if(!prior&&prop.getProperty("MVM_SESSION_"+identity.code))throw Error("LEGACY_SESSION_EXISTS");
   if(!prior&&mvmReadJson_(cfg,"entregas/2026/"+identity.code+".json"))throw Error("LEGACY_SESSION_EXISTS");
   const result=mvm36SandboxStep_(prior,bank,identity,req,Date.now(),identity.code+"-V36-"+Utilities.getUuid());
   result.record.invitationCode=identity.code;
   // Receipt only after durable server storage.
   if(JSON.stringify(prior)!==JSON.stringify(result.record))mvmWriteJson_(cfg,path,result.record,previous);
   return mvmReceipt_({...base,ok:true,...result.reply});
  }finally{lock.releaseLock();}
 }catch(e){
  const allowed=["SANDBOX_DISABLED","INVALID_INVITATION","PRIVATE_BANK_UNAVAILABLE","OTHER_BROWSER","CONCURRENT_TAB","ATTEMPT_MISMATCH","CLAIM_REQUIRED","SESSION_BANK_MISMATCH","STALE_OR_UNAUTHORIZED_STAGE","NOT_AT_FINAL_STAGE","PAYLOAD_SIZE","SESSION_CLOSED","IDENTIFICATION_REQUIRED","LEGACY_SESSION_EXISTS"];
  const status=allowed.includes(String(e.message))?String(e.message):"REJECTED";
  return mvmReceipt_({...base,status});
 }
}

function doGet(){return ContentService.createTextOutput("MVM V36 piloto");}
function doPost(e){const p=e&&e.parameter||{};if(!/^v36_(claim|save|advance|finalize)$/.test(String(p.action||"")))return mvmReceipt_({type:"MVM36_SESSION_RECEIPT",version:36,ok:false,status:"REJECTED",nonce:String(p.nonce||"").slice(0,100)});return mvm36SandboxAction_(p);}

// Diagnóstico manual: no devuelve enlaces, hashes, tokens ni datos de participantes.
function mvm36EstadoMigracion(){const prop=PropertiesService.getScriptProperties();const result={};for(const code of ["P02","P03","P04","P05"])result[code]=prop.getProperty("MVM_SESSION_"+code)?"SESION_V35_EXISTENTE":"SIN_SESION_V35";console.log(JSON.stringify(result));return result;}
