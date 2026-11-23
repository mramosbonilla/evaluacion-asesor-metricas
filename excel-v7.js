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
 if(!/^[A-K](?:[1-9]|1\d|2[0-5])$/.test(k))return "#REF!";
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
 if(name==="ROUND"||name==="REDONDEAR"){const n=num(args[0]),d=Math.min(12,Math.max(0,num(args[1]??0)));return Number(n.toFixed(d));}
 if(name==="IF"||name==="SI")return Boolean(args[0])?args[1]:args[2]??"";
 if(name==="IFERROR"||name==="SI.ERROR")return isErr(args[0])?args[1]:args[0];
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
const oldGrade=grade;
grade=function(){
 const keys=["J3","J4","J5","J7"],expected=[12,3,.25,"directo"];
 const labels=["Total de pedidos creados","Total de pedidos cancelados","Tasa global de cancelación","Canal con más pedidos completados"];
 const tests=keys.map((k,i)=>{
  const input=String(cells[k]??""),v=val(k),isFormula=input.trimStart().startsWith("=");
  const okResult=i===3?String(v).trim().toLowerCase()===expected[i]:i===2?typeof v==="number"&&Math.abs(v-expected[i])<1e-9:v===expected[i];
  return{cell:k,label:labels[i],ok:isFormula&&okResult,hasFormula:isFormula,got:fmt(v),expected:["12","3","25 % (0.25)","Directo"][i],input};
 });
 const score=tests.reduce((a,t)=>a+(t.ok?25:0),0);
 return{score,tests,formulas:tests.every(t=>t.hasFormula),answers:Object.fromEntries(keys.map(k=>[k,{input:cells[k]||"",evaluated:fmt(val(k))}])),events:[...events],elapsed_seconds:Math.round((Date.now()-started)/1000),prototype:true};
};
function clearForWork(){if(typeof showFormulas!=="undefined"){showFormulas=false;renderSheet();}}
function onFinish(){
 if(finished)return;
 const missing=["J3","J4","J5","J7"].filter(k=>!String(cells[k]??"").trimStart().startsWith("="));
 if(missing.length){alert("Debes completar las cuatro respuestas finales utilizando fórmulas, no números o textos escritos directamente. Revisa: "+missing.join(", ")+". Puedes utilizar las celdas libres H y K para cálculos auxiliares.");select(missing[0]);return;}
 if(!confirm("¿Confirmas que has terminado la práctica de Excel? Podrás continuar con las demás secciones de la evaluación."))return;
 finished=true;clearInterval(interval);result=grade();
 if(window.parent!==window&&new URLSearchParams(location.search).get("embed")==="1"){
  window.parent.postMessage({type:"MVM_EXCEL_COMPLETE",version:7,score:result.score,answers:result.answers},location.origin);
  byId("status").textContent="Práctica de Excel terminada. Regresando a la evaluación…";
  return;
 }
 const list=result.tests.map(t=>'<p><strong>'+(t.ok?"✓":"✗")+" "+t.label+'</strong> — Respuesta: '+escapeHTML(t.got)+' · Esperado: '+t.expected+' · '+(t.hasFormula?"Se usó fórmula":"Sin fórmula")+'</p>').join("");
 byId("results").innerHTML='<div class="result"><h2>Práctica de Excel completada</h2><p>Resultado diagnóstico: '+result.score+'/100 (solo piloto).</p><p>Esta pantalla no termina la evaluación general. Regresa a la prueba principal para continuar con tablas dinámicas, SQL y Python.</p><a class="btn" href="./vista-previa.html?etapa=3&amp;v=12">Volver a la etapa de Excel</a> <a class="btn" href="./vista-previa.html?etapa=4&amp;v=12">Continuar a tablas dinámicas</a></div>'+list;
 show("done");
}
finish=onFinish;
byId("finish").onclick=()=>onFinish();
byId("finish").textContent="Terminar práctica de Excel";
const hint=byId("instructions").querySelector(".task");
if(hint){
 const extra=document.createElement("p");
 extra.className="hint";
 extra.innerHTML="<strong>Obligatorio:</strong> las respuestas finales J3, J4, J5 y J7 deben contener fórmulas (comenzar con =), no valores escritos manualmente. Puedes usar las celdas libres de las columnas H y K para operaciones auxiliares; sus resultados pueden alimentar las fórmulas finales. Se admiten SUM, COUNTIF, SUMIF, COUNTIFS, SUMIFS, IF, MAX, INDEX, MATCH, XLOOKUP y referencias entre celdas.";
 hint.appendChild(extra);
}
const reminder=document.createElement("div");reminder.className="task";reminder.id="formulaRules";reminder.innerHTML="<strong>Importante:</strong> completa J3, J4, J5 y J7 con fórmulas que empiecen por <code>=</code>. Puedes realizar cálculos auxiliares en H y K; el resultado final debe venir de una fórmula. Para identificar el canal líder puedes utilizar <code>COUNTIFS</code>, <code>INDEX</code>, <code>MATCH</code> o <code>XLOOKUP</code> combinados con celdas auxiliares.";
byId("excel").querySelector(".ribbon").before(reminder);
const badge=byId("excel").querySelector(".badge");if(badge)badge.textContent="Simulador Excel · v14";
if(new URLSearchParams(location.search).get("embed")==="1"){
 // Mantener la evaluación principal abierta mientras el candidato trabaja.
 byId("candidate").value="Participante de prueba";
 byId("email").value="";
 byId("goExcel").click();
 byId("excel").querySelector(".footer .hint").textContent="Fórmulas obligatorias en J3, J4, J5 y J7 · Ayudas en H y K · Terminar esta práctica no finaliza la evaluación.";
}
})();
