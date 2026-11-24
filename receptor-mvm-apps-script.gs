/** MVM · Receptor privado de pruebas (Google Apps Script vinculado a una Hoja de cálculo).
 * NO PUBLICAR DATOS REALES HASTA CONFIGURAR, AUTORIZAR Y PROBAR EL DEPLOYMENT.
 * Desplegar como Aplicación web: ejecutar como propietario; acceso: cualquier persona.
 * El URL de deployment se pega en mvm-config.js; jamás escribir contraseñas en GitHub.
 * Datos completos en Drive privado; índice en Google Sheets privado.
 *
 * IMPORTANTE: un endpoint anónimo es susceptible a envíos falsos, spam o abuso.
 * Válido únicamente para un piloto controlado hasta implementar autenticación
 * y protección contra alteraciones; el cliente público no es a prueba de fraude.
 */
const ALLOWED_ORIGIN='https://mramosbonilla.github.io';
const INDEX_TAB='Recepciones';
function doPost(e){
  const params=e&&e.parameter||{};
  const nonce=String(params.nonce||'').slice(0,100);
  const requestedOrigin=String(params.returnOrigin||'');
  const target=requestedOrigin===ALLOWED_ORIGIN?ALLOWED_ORIGIN:ALLOWED_ORIGIN;
  let id='',ok=false,receivedAt=new Date().toISOString();
  try{
    const raw=String(params.payload||'');
    if(raw.length>1500000)throw Error('La entrega supera el tamaño permitido');
    const data=JSON.parse(raw);
    if(data.schema!=='MVM_PILOT_16')throw Error('Formato no reconocido');
    id=String(data.attemptId||'');
    if(!/^MVM-[A-Za-z0-9-]{12,60}$/.test(id))throw Error('Identificador inválido');
    if(!data.candidate||!data.candidate.name||!data.startedAt||!data.finishedAt)throw Error('Prueba incompleta');
    const doc=SpreadsheetApp.getActiveSpreadsheet();
    if(!doc)throw Error('Vincula este script a la hoja privada de recepción');
    const lock=LockService.getScriptLock();
    lock.waitLock(25000);
    try{
      let sheet=doc.getSheetByName(INDEX_TAB);
      if(!sheet){sheet=doc.insertSheet(INDEX_TAB);
        sheet.appendRow(['Recibido (UTC)','ID de intento','Candidato','Código de invitación','Nombre del archivo Drive','ID del archivo Drive','Correo candidato']);}
      const ids=sheet.getLastRow()>1?sheet.getRange(2,2,sheet.getLastRow()-1,1).getValues().flat():[];
      if(ids.includes(id)){ok=true;receivedAt=new Date().toISOString();}
      else{
        const name=String(data.candidate.name||'Sin nombre').slice(0,120);
        const safeName=name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z0-9 -]/g,'').trim().replace(/\s+/g,'-').slice(0,45);
        const filename='MVM-'+id+'-'+safeName+'.json';
        const file=DriveApp.createFile(Utilities.newBlob(raw,'application/json',filename));
        const email=String(data.candidate.email||'').slice(0,180);
        sheet.appendRow([receivedAt,id,name,String(data.pilot&&data.pilot.invitationCode||''),filename,file.getId(),email]);
        ok=true;
        try{
          const owner=Session.getEffectiveUser().getEmail();
          if(owner)MailApp.sendEmail(owner,'MVM: nueva evaluación '+id,
            'Nueva entrega de '+name+' ('+id+'). La respuesta completa se guardó en tu Google Drive privado. Revisa el índice privado de Recepciones.');
        }catch(notifyErr){/* La notificación no condiciona la recepción. */}
      }
    }finally{lock.releaseLock();}
  }catch(err){ok=false;}
  const receipt={type:'MVM_DELIVERY_RECEIPT',ok,attemptId:id,nonce,receivedAt};
  const script='window.parent.postMessage('+JSON.stringify(receipt).replace(/</g,'\\u003c')+','+JSON.stringify(target)+');';
  return HtmlService.createHtmlOutput('<!doctype html><html><body><script>'+script+'</scr'+'ipt></body></html>')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
