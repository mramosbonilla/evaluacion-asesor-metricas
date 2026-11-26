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
