/**
 * MVM · Recepción privada hacia GitHub.
 * Google Apps Script funciona únicamente como puente HTTPS; los datos finales
 * se guardan en un REPOSITORIO PRIVADO, distinto del código público.
 *
 * Propiedades de script requeridas:
 *   MVM_GITHUB_TOKEN : token GitHub fine-grained, solo Contents: Read and Write
 *                      para el repositorio privado de resultados.
 *   MVM_TARGET_REPO  : owner/nombre-repositorio-privado
 *
 * Apps Script → Implementar → Nueva implementación → Aplicación web
 *   Ejecutar como: yo
 *   Acceso: cualquier persona (solo para piloto supervisado).
 *
 * No coloques tokens en este archivo, en GitHub Pages, ni en mvm-config.js.
 * Es un ejemplo para piloto: los POST anónimos deben limitarse/autenticarse
 * antes de un proceso oficial de selección.
 */
const MVM_ALLOWED_ORIGIN = "https://mramosbonilla.github.io";
const MVM_RECEIPT_TYPE = "MVM_DELIVERY_RECEIPT";
const MVM_MAX_PAYLOAD_BYTES = 800000;

function mvmReceipt_(message) {
  const safe = JSON.stringify(message).replace(/</g, "\\u003c");
  const target = JSON.stringify(MVM_ALLOWED_ORIGIN);
  const body = '<!doctype html><html><head><meta charset="utf-8"></head><body>' +
    '<script>window.parent.postMessage(' + safe + ',' + target + ');' +
    '</scr' + 'ipt></body></html>';
  return HtmlService.createHtmlOutput(body)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function mvmApiRequest_(token,repo,method,path,body) {
  const url="https://api.github.com/repos/" + repo +
    "/contents/" + path.split("/").map(encodeURIComponent).join("/");
  const options={
    method:method.toLowerCase(),
    muteHttpExceptions:true,
    headers:{
      "Authorization":"Bearer "+token,
      "Accept":"application/vnd.github+json",
      "X-GitHub-Api-Version":"2022-11-28",
      "User-Agent":"MVM-Assessment-Receiver"
    }
  };
  if(body!==undefined){
    options.contentType="application/json";
    options.payload=JSON.stringify(body);
  }
  const response=UrlFetchApp.fetch(url,options);
  const status=response.getResponseCode();
  const txt=response.getContentText();
  let result={};
  try{result=JSON.parse(txt);}catch(error){}
  return {status,result};
}

function doPost(e) {
  const p=e&&e.parameter||{};
  const nonce=String(p.nonce||"").slice(0,100);
  let attemptId="",ok=false,receivedAt=new Date().toISOString();
  try {
    const raw=String(p.payload||"");
    const bytes=Utilities.newBlob(raw).getBytes().length;
    if(!bytes||bytes>MVM_MAX_PAYLOAD_BYTES)throw Error("Tamaño inválido");
    const obj=JSON.parse(raw);
    if(obj.schema!=="MVM_PILOT_16")throw Error("Formato inválido");
    attemptId=String(obj.attemptId||"");
    if(!/^MVM-[0-9]{8}-[A-Z0-9-]{5,30}$/.test(attemptId))throw Error("ID inválido");
    if(!obj.candidate||!String(obj.candidate.name||"").trim()||
        !obj.startedAt||!obj.finishedAt)throw Error("Intento incompleto");

    const properties=PropertiesService.getScriptProperties();
    const token=String(properties.getProperty("MVM_GITHUB_TOKEN")||"").trim();
    const repo=String(properties.getProperty("MVM_TARGET_REPO")||"").trim();
    if(!token||!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo))
      throw Error("Servidor sin configurar");

    const lock=LockService.getScriptLock();
    lock.waitLock(25000);
    try {
      const yyyy=attemptId.slice(4,8);
      const path="entregas/"+yyyy+"/"+attemptId+".json";
      const existing=mvmApiRequest_(token,repo,"GET",path);
      if(existing.status===200) {
        // Una entrega ya recibida no se sobrescribe desde el navegador.
        ok=true;
      } else if(existing.status===404) {
        const encoded=Utilities.base64Encode(Utilities.newBlob(raw).getBytes());
        const created=mvmApiRequest_(token,repo,"PUT",path,{
          message:"Nueva evaluación MVM "+attemptId,
          content:encoded
        });
        if(created.status!==201)throw Error("GitHub no confirmó escritura");
        ok=true;
      } else {
        throw Error("No se pudo comprobar el resultado existente");
      }
    } finally {
      lock.releaseLock();
    }
  }catch(err){
    // No devolver mensajes internos, credenciales o datos de GitHub al cliente.
    ok=false;
  }
  return mvmReceipt_({
    type:MVM_RECEIPT_TYPE,
    ok,attemptId,nonce,receivedAt
  });
}
