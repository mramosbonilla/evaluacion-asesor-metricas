/* MVM V36 · adaptador de pruebas aislado. NO conectar a doPost de producción.
 * Permite únicamente T36 tras configurar explícitamente un hash de invitación de ensayo.
 * Depende del núcleo V36 y las funciones del receptor V35. No usa P00–P15.
 */
const MVM36_BANK_REF="a1dbca0bf960a123ec18bc0c6d8b8ccfab6120fc";
const MVM36_BANK_PATH="bancos/MVM-ASESOR-2026-V36.json";
const MVM36_SANDBOX_PATH="v36-sandbox/T36.json";
function mvm36BankFromPrivate_(cfg){
 const url="https://api.github.com/repos/"+cfg.repo+"/contents/"+MVM36_BANK_PATH.split("/").map(encodeURIComponent).join("/")+"?ref="+encodeURIComponent(MVM36_BANK_REF);
 const r=mvmFetch_(url,{method:"get",headers:mvmApiHeaders_(cfg.token)});
 if(r.status!==200)throw Error("PRIVATE_BANK_UNAVAILABLE");
 const raw=Utilities.newBlob(Utilities.base64Decode(String(r.data.content||"").replace(/\s/g,""))).getDataAsString("UTF-8");
 const bank=JSON.parse(raw);mvm36CheckBank_(bank);return bank;
}
function mvm36SandboxAuth_(params,prop){
 if(prop.getProperty("MVM36_SANDBOX_ENABLED")!=="YES")throw Error("SANDBOX_DISABLED");
 const code=String(params.invitationCode||"");
 const token=String(params.invitationToken||"");
 const expected=prop.getProperty("MVM36_TEST_HASH")||"";
 if(code!=="T36"||!/^[a-f0-9]{64}$/.test(token)||!/^[a-f0-9]{64}$/.test(expected)||mvmHash_(token)!==expected)throw Error("INVALID_INVITATION");
 return mvmSessionIdentity_(params);
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
   const previous=mvmReadJson_(cfg,MVM36_SANDBOX_PATH);
   const prior=previous?.value?.schema==="MVM36_SANDBOX_1"?previous.value:null;
   if(previous&&!prior&&previous.value?.schema!=="MVM_SLOT_PENDING")throw Error("INVALID_SANDBOX_RECORD");
   const result=mvm36SandboxStep_(prior,bank,identity,req,Date.now(),"T36-"+Utilities.getUuid());
   // Receipt only after durable server storage.
   if(JSON.stringify(prior)!==JSON.stringify(result.record))mvmWriteJson_(cfg,MVM36_SANDBOX_PATH,result.record,previous);
   return mvmReceipt_({...base,ok:true,...result.reply});
  }finally{lock.releaseLock();}
 }catch(e){
  const allowed=["SANDBOX_DISABLED","INVALID_INVITATION","PRIVATE_BANK_UNAVAILABLE","OTHER_BROWSER","CONCURRENT_TAB","ATTEMPT_MISMATCH","CLAIM_REQUIRED","SESSION_BANK_MISMATCH","STALE_OR_UNAUTHORIZED_STAGE","NOT_AT_FINAL_STAGE","PAYLOAD_SIZE","SESSION_CLOSED","IDENTIFICATION_REQUIRED"];
  const status=allowed.includes(String(e.message))?String(e.message):"REJECTED";
  return mvmReceipt_({...base,status});
 }
}
