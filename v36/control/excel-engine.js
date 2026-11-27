/* MVM Excel v7: parser de fórmulas y continuidad del examen piloto.
   Este motor local solo calcula hojas de práctica; no constituye una solución segura de calificación. */
(function(){
"use strict";
const byId=id=>document.getElementById(id);
const num=v=>{if(typeof v==='boolean')return v?1:0;if(v===''||v==null)return 0;const x=Number(v);return Number.isFinite(x)?x:NaN;};
const flat=a=>a.flat(Infinity);
const isErr=v=>typeof v==='string'&&v.startsWith('#');
const coreVal=val;
function calcCell(address,trail){
 const k=String(address).toUpperCase().replace(/\$/g,"");
 const seen=trail||new Set();
 if(seen.has(k))return "#CIRC";
 if(!/^[A-K][1-9]\d*$/.test(k)||Number(k.slice(1))>R)return "#REF!";
 const raw=String(cells[k]??"");
 if(!raw.startsWith("="))return /^-?\d+(?:\.\d+)?$/.test(raw)?Number(raw):raw;
 const next=new Set(seen);next.add(k);
 try{return calculate(raw.slice(1),next);}
 catch(e){return "#ERROR";}
}
function valuesOfRange(a,b,trail){
 let p=String(a).toUpperCase().replace(/\$/g,""),q=String(b).toUpperCase().replace(/\$/g,"");
 const colOnly=/^[A-K]$/;
 if(colOnly.test(p)&&colOnly.test(q)){p+="1";q+=String(R);}
 if(!/^[A-K]\d+$/.test(p)||!/^[A-K]\d+$/.test(q))return "#REF!";
 const pa=addressParts(p),pb=addressParts(q),arr=[];
 for(let r=Math.min(pa.r,pb.r);r<=Math.max(pa.r,pb.r);r++)
  for(let c=Math.min(pa.c,pb.c);c<=Math.max(pa.c,pb.c);c++){
   const item=calcCell(col(c)+r,trail);
   if(isErr(item))return item;arr.push(item);
  }
 return arr;
}
function applyFunction(fn,args){
 const name=fn.toUpperCase();
 if(name==="IFERROR"||name==="SI.ERROR")return isErr(args[0])?args[1]:args[0];
 if(name==="IF"||name==="SI")return isErr(args[0])?args[0]:(Boolean(args[0])?args[1]:args[2]??"");
 const hasError=args.find(isErr);if(hasError)return hasError;
 const series=a=>Array.isArray(a)?flat(a):[a];
 const nums=a=>series(a).filter(v=>v!==""&&v!=null&&Number.isFinite(num(v))).map(num);
 const text=x=>String(x==null?"":x);
 const criterion=(value,crit)=>{
  const m=text(crit).match(/^(>=|<=|<>|>|<|=)(.*)$/);
  const op=m?m[1]:"=",target=m?m[2]:text(crit);
  const n1=Number(value),n2=Number(target);
  let cmp;
  if(value!==""&&target!==""&&Number.isFinite(n1)&&Number.isFinite(n2))cmp=n1-n2;
  else cmp=text(value).localeCompare(target,"es",{sensitivity:"base"});
  if(op==="=")return cmp===0;
  if(op==="<>")return cmp!==0;
  if(op===">")return cmp>0;
  if(op==="<")return cmp<0;
  if(op===">=")return cmp>=0;
  return cmp<=0;
 };
 const matched=(range,crit,index)=>criterion(series(range)[index],crit);
 if(name==="SUM"||name==="SUMA")return nums(args).reduce((a,b)=>a+b,0);
 if(name==="COUNT"||name==="CONTAR")return flat(args).filter(x=>x!==""&&x!=null&&typeof x==="number"&&Number.isFinite(x)).length;
 if(name==="COUNTA"||name==="CONTARA")return flat(args).filter(x=>x!==""&&x!=null).length;
 if(name==="AVERAGE"||name==="PROMEDIO"){const a=nums(args);return a.length?a.reduce((x,y)=>x+y,0)/a.length:"#DIV/0!";}
 if(name==="MIN"||name==="MAX"){const a=nums(args);return a.length?(name==="MAX"?Math.max(...a):Math.min(...a)):0;}
 if(name==="LARGE"||name==="K.ESIMO.MAYOR"){const a=nums(args[0]);const k=Math.trunc(num(args[1]));a.sort((x,y)=>y-x);return k>=1&&k<=a.length?a[k-1]:"#NUM!";}
 if(name==="SMALL"||name==="K.ESIMO.MENOR"){const a=nums(args[0]);const k=Math.trunc(num(args[1]));a.sort((x,y)=>x-y);return k>=1&&k<=a.length?a[k-1]:"#NUM!";}
 if(name==="COUNTBLANK"||name==="CONTAR.BLANCO")return flat(args).filter(x=>x===""||x==null).length;
 if(name==="ROUND"||name==="REDONDEAR"){const n=num(args[0]),d=Math.trunc(num(args[1]??0));if(!Number.isFinite(n)||!Number.isFinite(d)||Math.abs(d)>100)return "#NUM!";const f=Math.pow(10,d),v=Math.abs(n)*f;if(!Number.isFinite(v))return "#NUM!";return Math.sign(n)*Math.round(v+Number.EPSILON*Math.max(1,v))/f;}
 
 if(name==="AND"||name==="Y")return args.every(Boolean);
 if(name==="OR"||name==="O")return args.some(Boolean);
 if(name==="COUNTIF"||name==="CONTAR.SI"){const a=series(args[0]||[]);return a.filter(v=>criterion(v,args[1])).length;}
 if(name==="SUMIF"||name==="SUMAR.SI"){const a=series(args[0]||[]),s=series(args[2]??args[0]??[]);return a.reduce((z,v,i)=>z+(criterion(v,args[1])?(num(s[i])||0):0),0);}
 if(name==="COUNTIFS"||name==="CONTAR.SI.CONJUNTO"){
  if(args.length%2||args.length<2)return "#ERROR";
  const a=series(args[0]);return a.reduce((z,v,i)=>z+(args.every((x,j)=>j%2===0?true:matched(args[j-1],x,i))?1:0),0);
 }
 if(name==="SUMIFS"||name==="SUMAR.SI.CONJUNTO"){
  if(args.length<3||args.length%2!==1)return "#ERROR";
  const s=series(args[0]);return s.reduce((z,v,i)=>z+(args.slice(1).every((x,j)=>j%2===0?true:matched(args[j],x,i))?(num(v)||0):0),0);
 }
 if(name==="INDEX"||name==="INDICE"){
  const a=series(args[0]||[]),n=Math.trunc(num(args[1]??1));
  return n>=1&&n<=a.length?a[n-1]:"#REF!";
 }
 if(name==="MATCH"||name==="COINCIDIR"){
  const a=series(args[1]||[]),look=args[0],typ=num(args[2]??0);
  if(typ!==0)return "#ERROR";
  const i=a.findIndex(v=>String(v).toLowerCase()===String(look).toLowerCase());
  return i<0?"#N/A":i+1;
 }
 if(name==="XLOOKUP"||name==="BUSCARX"){
  const look=args[0],a=series(args[1]||[]),returns=series(args[2]||[]);
  const i=a.findIndex(v=>String(v).toLowerCase()===String(look).toLowerCase());
  return i<0?(args[3]??"#N/A"):(returns[i]??"#N/A");
 }
 return "#NAME?";
}
function calculate(expr,trail){
 const re=/\s*("(?:[^"]|"")*"|\$?[A-K]\$?\d+|\d+(?:\.\d+)?|[A-Za-z_ÁÉÍÓÚÑáéíóúñ][A-Za-z_ÁÉÍÓÚÑáéíóúñ.\d_]*|>=|<=|<>|[(),;:+\-*/^%=<>])/giy;
 const ts=[];let at=0;
 while(at<expr.length){
  re.lastIndex=at;const m=re.exec(expr);
  if(!m){if(!expr.slice(at).trim())break;throw Error("token");}
  ts.push(m[1]);at=re.lastIndex;
 }
 let p=0;
 const look=()=>ts[p],take=()=>ts[p++],expect=x=>{if(take()!==x)throw Error("expected");};
 const scalar=x=>Array.isArray(x)?(x.length?x[0]:0):x;
 function atom(){
  let t=take();if(t===undefined)throw Error("missing");
  if(t==="+")return atom();
  if(t==="-")return -num(atom());
  if(t==="("){const v=compare();expect(")");return v;}
  if(t[0]==='"')return t.slice(1,-1).replace(/""/g,'"');
  if(/^\d/.test(t))return Number(t);
  if(/^\$?[A-K]\$?\d+$/i.test(t)){
   const cell=t.toUpperCase().replace(/\$/g,"");
   if(look()===":"){take();const end=take();return valuesOfRange(cell,end,trail);}
   return calcCell(cell,trail);
  }
  if(/^[A-Za-z_ÁÉÍÓÚÑáéíóúñ]/.test(t)){
   if(look()===":"){take();return valuesOfRange(t,take(),trail);}
   if(look()==="("){
    take();const args=[];if(look()!==")"){while(true){args.push(compare());if(look()===","||look()===";"){take();continue;}break;}}
    expect(")");return applyFunction(t,args);
   }
   if(t.toUpperCase()==="TRUE"||t.toUpperCase()==="VERDADERO")return true;
   if(t.toUpperCase()==="FALSE"||t.toUpperCase()==="FALSO")return false;
   return "#NAME?";
  }
  throw Error("unexpected");
 }
 function power(){let x=atom();while(look()==="^"){take();x=Math.pow(num(x),num(atom()));}return x;}
 function mul(){let x=power();while(["*","/"].includes(look())){const op=take(),y=power();if(isErr(x)||isErr(y))return isErr(x)?x:y;const b=num(y);x=op==="*"?num(x)*b:b===0?"#DIV/0!":num(x)/b;}return x;}
 function add(){let x=mul();while(["+","-"].includes(look())){const op=take(),y=mul();if(isErr(x)||isErr(y))return isErr(x)?x:y;x=op==="+"?num(x)+num(y):num(x)-num(y);}return x;}
 function compare(){let x=add();while(["=",">","<",">=","<=","<>"].includes(look())){const op=take(),y=add();if(isErr(x)||isErr(y))return isErr(x)?x:y;const n1=num(x),n2=num(y);const a=Number.isFinite(n1)&&Number.isFinite(n2)?n1:String(x).toLowerCase(),b=Number.isFinite(n1)&&Number.isFinite(n2)?n2:String(y).toLowerCase();
 x=op==="="?a===b:op==="<>"?a!==b:op===">"?a>b:op==="<"?a<b:op===">="?a>=b:a<=b;}return x;}
 const answer=compare();if(p!==ts.length)throw Error("trailing");
 return answer;
}
val=function(address,trail){return calcCell(address,trail);};
const existingCommit=commit;
commit=function(){existingCommit();if(typeof window.excelShowResults==="function"){window.excelShowResults();document.getElementById("status").textContent="Fórmula guardada. Mostrando su resultado calculado; usa «Mostrar fórmulas» para ver la expresión.";}}
byId("apply").onclick=()=>commit();
// A formula may reference the original A:G records directly, or use helper cells
// containing formulas that ultimately depend on those records. Exact formula text
// is never compared; different valid strategies receive the same score.
function usesSourceData(address,visiting=new Set()){
 const key=String(address).replace(/\$/g,"").toUpperCase();
 if(visiting.has(key))return false;
 visiting.add(key);
 const input=String(cells[key]??"").trim();
 if(!input.startsWith("="))return false;
 let refs=[];
 for(const match of input.matchAll(/\$?([A-K])\$?([1-9]\d*)/gi)){
  const column=match[1].toUpperCase(),row=Number(match[2]);
  if(column<="G"&&row>=2&&row<=DATA.length)return true;
  if(row<=R)refs.push(column+row);
 }
 // Full-column references, for example E:E and F:F.
 for(const match of input.matchAll(/(?:^|[^A-Z\d])([A-K])\s*:\s*\1(?=[^A-Z\d]|$)/gi)){
  if(match[1].toUpperCase()<="G")return true;
 }
 // Ranges in helper columns: K2:K4 -> check all K2, K3 and K4.
 for(const match of input.matchAll(/\$?([A-K])\$?([1-9]\d*)\s*:\s*\$?([A-K])\$?([1-9]\d*)/gi)){
  const c1=match[1].toUpperCase().charCodeAt(0)-65,c2=match[3].toUpperCase().charCodeAt(0)-65;
  const r1=Number(match[2]),r2=Number(match[4]);
  for(let y=Math.min(r1,r2);y<=Math.min(R,Math.max(r1,r2));y++)
   for(let x=Math.min(c1,c2);x<=Math.max(c1,c2);x++)
    refs.push(col(x)+y);
 }
 return refs.some(ref=>usesSourceData(ref,new Set(visiting)));
}
grade=function(){return {score:null,tests:[],answers:{},helperFormulas:[]};};
function clearForWork(){if(typeof showFormulas!=="undefined"){showFormulas=false;renderSheet();}}
function onFinish(){
 if(finished)return;
 const required=["J3","J4","J5","J7"];
 const missing=required.filter(k=>!String(cells[k]??"").trim().startsWith("="));
 const unrelated=required.filter(k=>!missing.includes(k)&&!usesSourceData(k));
 const incomplete=[...missing,...unrelated];
 if(incomplete.length){
  const notices=[];
  if(missing.length)notices.push("Respuestas pendientes o sin fórmula: "+missing.join(", ")+".");
  if(unrelated.length)notices.push("Fórmulas que no utilizan los datos de la hoja: "+unrelated.join(", ")+".");
  if(!confirm("Práctica incompleta: "+incomplete.length+" de "+required.length+" respuestas sin fórmula válida.\n\n"+notices.join("\n")+"\n\nEstas respuestas no recibirán puntuación. Si continúas, no podrás regresar a esta sección. ¿Seguro que deseas finalizar?")){select(incomplete[0]);return;}
 }else if(!confirm("¿Confirmas que has terminado la práctica de Excel? No podrás regresar a esta sección."))return;
 if(window.parent===window||!window.parent.MVM36Stage?.get("excel"))return;
 const formulas=Object.fromEntries(Object.entries(cells).filter(([k,v])=>/^[H-K][1-9]\d*$/.test(k)&&!["I2","J2","I3","I4","I5","I7"].includes(k)).map(([k,v])=>[k,String(v)]));
 window.parent.postMessage({type:"MVM36_SIM_COMPLETE",stage:"excel",answer:{formulas,rowOrder:Array.from({length:DATA.length-1},(_,i)=>String(cells["A"+(i+2)]))}},location.origin);
 byId("status").textContent="Enviando práctica al servidor…";
}
byId("finish").onclick=()=>onFinish();
byId("finish").textContent="Terminar práctica de Excel";
const hint=byId("instructions").querySelector(".task");
if(hint){
 const extra=document.createElement("p");
 extra.className="hint";
 extra.innerHTML="<strong>Reglas:</strong> las respuestas finales de J3, J4, J5 y J7 deben ser fórmulas que calculen los valores usando la base de pedidos, sin escribir resultados manuales. Son válidos distintos métodos y tantas celdas auxiliares de H y K como necesites. En J7 debes calcular una diferencia numérica entre los totales de pedidos <em>completados</em> del canal con más y el de menos. No se exige una función determinada.";
 hint.appendChild(extra);
}
const reminder=document.createElement("div");reminder.className="task";reminder.id="formulaRules";reminder.innerHTML="<strong>IMPORTANTE · Prueba individual de conocimientos:</strong> está prohibido utilizar IA u otras fuentes externas para recibir, copiar y pegar, o transcribir respuestas. Incumplir esta regla constituye una falta a la integridad de la evaluación. <strong>Reglas de Excel:</strong> base de pedidos asignada. Las cuatro respuestas finales (<code>J3</code>, <code>J4</code>, <code>J5</code>, <code>J7</code>) deben contener fórmulas que dependan de los datos originales. No se admiten cifras tecleadas ni expresiones de solo constantes. Puedes combinar funciones, usar las columnas H y K como auxiliares y elegir cualquier procedimiento compatible que produzca el resultado correcto. <strong>J7:</strong> diferencia numérica de pedidos completados entre el canal con más y el canal con menos.";
byId("excel").querySelector(".ribbon").before(reminder);
const badge=byId("excel").querySelector(".badge");if(badge)badge.textContent="Excel · Hoja de evaluación";
if(new URLSearchParams(location.search).get("embed")==="1"){
 // Mantener la evaluación principal abierta mientras el candidato trabaja.
 byId("candidate").value="Participante de prueba";
 byId("email").value="";
 byId("goExcel").click();
 let draftApi;try{draftApi=window.parent.MVMDraft;}catch(e){}
 if(draftApi){
  const d=draftApi.get("excel");
  if(d&&d.cells&&typeof d.cells==="object"){
   cells=d.cells;cellFormats=d.cellFormats||{};filterChannel=d.filterChannel||"Todos";selected=d.selected||"A1";rangeStart=selected;rangeEnd=null;renderSheet();select(selected);
  }
  function persistDraft(){
   const copy={...cells};
   const edit=document.querySelector(".inline-edit");
   if(edit){const k=edit.closest("td[data-cell]")?.dataset?.cell||selected;copy[k]=edit.value;}
   else if(document.activeElement===byId("fx"))copy[selected]=byId("fx").value;
   draftApi.put("excel",{cells:copy,cellFormats,filterChannel,selected});
  }
  document.addEventListener("input",persistDraft);
  document.addEventListener("click",()=>setTimeout(persistDraft,0));
  window.addEventListener("pagehide",persistDraft);setInterval(persistDraft,1000);
 }
 // Embedded assessments use the single 75-minute clock in the parent evaluation.
 if(interval){clearInterval(interval);interval=null;}
 byId("clock").style.display="none";
 byId("excel").querySelector(".footer .hint").textContent="Fórmulas obligatorias en J3, J4, J5 y J7 · Ayudas en H y K · Terminar esta práctica no finaliza la evaluación.";
}
})();
