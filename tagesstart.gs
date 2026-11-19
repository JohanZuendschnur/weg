// Tagesstart um ca. 07:00, Fristen-Erinnerungen und Wochen-/Quartals-/Jahresberichte als Mail (fürs Handy gestaltet).
var STAEDTE=[["Darmstadt",49.8728,8.6512],["Frankfurt",50.1109,8.6821]];
var APP_URL="https://johanzuendschnur.github.io/weg/";
var TZ="Europe/Berlin";
var TAGE=["Sonntag","Montag","Dienstag","Mittwoch","Donnerstag","Freitag","Samstag"];
var TAGE_K=["So","Mo","Di","Mi","Do","Fr","Sa"];
var MONATE=["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];

function setup(){ // einmal ausführen (auch nach Updates dieses Skripts, falls Trigger fehlen)
  ScriptApp.getProjectTriggers().forEach(function(t){ScriptApp.deleteTrigger(t);});
  ScriptApp.newTrigger("tagesstart").timeBased().everyDays(1).atHour(7).nearMinute(0).inTimezone(TZ).create();
  ScriptApp.newTrigger("fristen").timeBased().everyMinutes(15).create();
  ScriptApp.newTrigger("berichte").timeBased().everyDays(1).atHour(6).nearMinute(30).inTimezone(TZ).create();
}

function snapshot(){
  var f=DriveApp.getFilesByName("weg-snapshot.json");
  return f.hasNext()?JSON.parse(f.next().getBlob().getDataAsString()):{};
}

function wetter(){
  try{
    var teile=STAEDTE.map(function(s){
      var u="https://api.open-meteo.com/v1/forecast?latitude="+s[1]+"&longitude="+s[2]+"&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Europe%2FBerlin&forecast_days=1";
      var d=JSON.parse(UrlFetchApp.fetch(u).getContentText()).daily;
      return s[0]+" "+Math.round(d.temperature_2m_min[0])+" bis "+Math.round(d.temperature_2m_max[0])+" °C bei "+d.precipitation_probability_max[0]+" % Regenrisiko";
    });
    return "Heute in "+teile.join(", in ")+".";
  }catch(e){return "Wetter nicht verfügbar.";}
}

// ---------- Darstellung (E-Mail-HTML: Tabellen und Inline-Styles, einspaltig fürs Handy) ----------
function esc(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
function fmt(d,p){return Utilities.formatDate(d,TZ,p);}
function langDatum(d){return TAGE[+fmt(d,"u")%7]+", "+(+fmt(d,"d"))+". "+MONATE[+fmt(d,"M")-1];}
function kurzDatum(d){return TAGE_K[+fmt(d,"u")%7]+" "+fmt(d,"dd.MM.")+", "+fmt(d,"HH:mm")+" Uhr";}

function huelle(farbe,kopf,inhalt,fuss){
  return '<div style="background:#eceae6;padding:10px 8px;font-family:Arial,Helvetica,sans-serif;color:#23272b">'
   +'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden">'
   +'<tr><td style="background:'+farbe+';padding:22px 18px;color:#ffffff">'+kopf+'</td></tr>'
   +'<tr><td style="padding:4px 18px 20px">'+inhalt
   +'<a href="'+APP_URL+'" style="display:block;text-align:center;background:#e0a46a;color:#2a1d0e;font-weight:bold;text-decoration:none;padding:15px;border-radius:10px;margin-top:22px;font-size:17px">App öffnen</a></td></tr></table>'
   +'<p style="text-align:center;font-size:13px;color:#7d8288;margin:12px 6px">'+fuss+'</p></div>';
}
function block(titel,farbe,innen){
  return '<div style="margin-top:20px"><div style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:'+farbe+';font-weight:bold;margin-bottom:8px">'+titel+'</div>'+innen+'</div>';
}
function karte(farbe,innen){
  return '<div style="border-left:5px solid '+farbe+';background:#f5f4f1;border-radius:6px;padding:10px 12px;margin-bottom:8px;font-size:17px;line-height:1.35">'+innen+'</div>';
}
function pfadHtml(pfad){
  var t=String(pfad).split(" › "),letzt=t.pop();
  return (t.length?'<div style="font-size:13px;color:#7a7f85;margin-bottom:3px">'+esc(t.join(" › "))+'</div>':'')+'<div style="font-weight:bold">'+esc(letzt)+'</div>';
}
function leer(t){return '<div style="color:#7a7f85;font-size:16px">'+t+'</div>';}

// Höchstens MAX_TODOS_MAIL Todos pro Tagesstart-Mail. Reihenfolge: Dringendes, Probleme, dazu immer mindestens ein
// Langzeit-Todo, das seit ALT_TAGE Tagen niemand angefasst hat (höchstens MAX_ALT davon, täglich wechselnd).
var MAX_TODOS_MAIL=5, ALT_TAGE=30, MAX_ALT=3;
function auswahl(s,jetzt){
  var d=(s.urgent||[]).slice(),seen={};
  d.forEach(function(x){seen[x]=1;});
  var p=(s.problems||[]).filter(function(x){if(seen[x])return false;seen[x]=1;return true;});
  var o=(s.lang||[]).filter(function(l){return l.a&&(jetzt-l.a)/864e5>=ALT_TAGE&&!seen[l.t];})
    .map(function(l){return {t:l.t,tage:Math.floor((jetzt-l.a)/864e5)};})
    .sort(function(a,b){return b.tage-a.tage;});
  var reserve=Math.min(1,o.length),nd=Math.min(d.length,MAX_TODOS_MAIL-reserve),np=Math.min(p.length,MAX_TODOS_MAIL-reserve-nd);
  var no=Math.min(o.length,MAX_ALT,MAX_TODOS_MAIL-nd-np),start=o.length>no?Math.floor(jetzt/864e5)%o.length:0;
  return {d:d.slice(0,nd),p:p.slice(0,np),o:o.slice(start).concat(o.slice(0,start)).slice(0,no),mehr:d.length>nd||p.length>np||o.length>no};
}

function tagesstart(){
  var jetzt=new Date(),s=snapshot(),a=auswahl(s,jetzt.getTime()),dringend=a.d,probs=a.p,w=wetter();
  var ev=CalendarApp.getDefaultCalendar().getEventsForDay(jetzt).map(function(e){
    return {z:e.isAllDayEvent()?"ganztägig":fmt(e.getStartTime(),"HH:mm"),t:e.getTitle()};
  });
  var kopf='<div style="font-size:15px;opacity:.85">'+esc(langDatum(jetzt))+'</div><div style="font-size:26px;font-weight:bold;margin-top:2px">Guten Morgen</div>';
  var inh='<div style="background:#eef2f6;border-radius:8px;padding:12px;margin-top:16px;font-size:16px;line-height:1.4">'+esc(w)+'</div>';
  inh+=block("Dringend","#c9453f",dringend.length?dringend.map(function(x){return karte("#c9453f",pfadHtml(x));}).join(""):leer("Nichts als dringend markiert."));
  inh+=block("Termine heute","#3f78b3",ev.length?ev.map(function(e){
    return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px"><tr><td style="width:74px;vertical-align:top;font-weight:bold;font-size:16px;color:#3f78b3">'+esc(e.z)+'</td><td style="font-size:17px;line-height:1.35">'+esc(e.t)+'</td></tr></table>';
  }).join(""):leer("Keine Termine."));
  if(probs.length)inh+=block("Offene Probleme","#9a7600",probs.map(function(x){return karte("#d9a900",pfadHtml(x));}).join(""));
  if(a.o.length)inh+=block("Schon lange offen","#6b5b95",a.o.map(function(x){return karte("#8e7cc3",pfadHtml(x.t)+'<div style="font-size:13px;color:#7a7f85;margin-top:3px">seit '+x.tage+' Tagen nicht angefasst</div>');}).join(""));
  if(a.mehr)inh+='<div style="color:#7a7f85;font-size:14px;margin-top:16px">Weitere Todos warten in der App.</div>';
  var stand=s.at?"Todo-Stand vom letzten Sync: "+fmt(new Date(s.at),"dd.MM. HH:mm")+" Uhr":"Noch kein Sync-Stand gefunden";
  var text=[w,"","Dringend:"].concat(dringend.length?dringend:["nichts"],["","Termine heute:"],ev.length?ev.map(function(e){return e.z+" "+e.t;}):["keine"]);
  if(probs.length)text=text.concat(["","Offene Probleme:"],probs);
  if(a.o.length)text=text.concat(["","Schon lange offen:"],a.o.map(function(x){return x.t+" (seit "+x.tage+" Tagen)";}));
  if(a.mehr)text.push("","Weitere Todos warten in der App.");
  MailApp.sendEmail({to:Session.getEffectiveUser().getEmail(),subject:"Tagesstart",body:text.join("\n"),htmlBody:huelle("#2f3338",kopf,inh,esc(stand)),name:"Weg"});
}

// ---------- Fristen: läuft alle 15 Minuten ----------
function fristMail(d,wann,farbe){
  var titel=d.n||d.t,due=new Date(d.due);
  var tag=fmt(due,"yyyyMMdd")===fmt(new Date(),"yyyyMMdd")?"heute":(fmt(due,"yyyyMMdd")===fmt(new Date(Date.now()+864e5),"yyyyMMdd")?"morgen":"");
  var kopf='<div style="font-size:14px;letter-spacing:.08em;text-transform:uppercase;opacity:.9">Fällig</div><div style="font-size:28px;font-weight:bold;margin-top:2px">'+esc(wann)+'</div>';
  var inh='<div style="margin-top:16px">'+karte(farbe,pfadHtml((d.p?d.p+" › ":"")+titel))+'</div>'
   +block("Frist",farbe,'<div style="font-size:19px;font-weight:bold">'+esc(kurzDatum(due))+'</div>'+(tag?'<div style="font-size:15px;color:#7a7f85;margin-top:2px">'+tag+'</div>':''));
  var text=(d.p?"Gehört zu: "+d.p+"\n":"")+"Todo: "+titel+"\nFällig: "+kurzDatum(due);
  MailApp.sendEmail({to:Session.getEffectiveUser().getEmail(),subject:"Fällig "+wann+": "+titel,body:text,htmlBody:huelle(farbe,kopf,inh,"Diese Erinnerung kommt nur, solange das Todo beim letzten Sync offen war."),name:"Weg"});
}

function fristen(){
  var s=snapshot(),P=PropertiesService.getScriptProperties(),jetzt=Date.now();
  (s.due||[]).forEach(function(d){
    var rest=new Date(d.due).getTime()-jetzt;if(!(rest>0))return;
    var k=d.id+"|"+d.due;
    if(rest<=36e5){ if(!P.getProperty(k+"|1h")){fristMail(d,"in 1 Stunde","#c9453f");P.setProperty(k+"|1h","1");P.setProperty(k+"|24h","1");} }
    else if(rest<=864e5){ if(!P.getProperty(k+"|24h")){fristMail(d,"in 24 Stunden","#d9822b");P.setProperty(k+"|24h","1");} }
  });
}

// ---------- Schnittstelle für die App (Web-App, ersetzt die Google-Anmeldung im Browser) ----------
// Trage hier einen langen Zufallstext ein (mindestens 30 Zeichen, nur Buchstaben und Zahlen).
// Er ist der einzige Schutz der Schnittstelle. Gib ihn genauso in der App ein ("Server").
// ---------- Berichte: Woche, Quartal, Jahr ----------
// Grundlage ist der zuletzt synchronisierte Stand (weg-state.json, nur im Server-Weg vorhanden).
// "berichte" läuft täglich gegen 06:30 und verschickt jeden Bericht genau einmal:
//   Wochenbericht montags, Quartalsbericht am 1. Tag des neuen Quartals, Jahresbericht am 1. Januar.
// Zum Ansehen ohne Warten: berichteTest ausführen (Zwischenstand der laufenden Woche, des Quartals, des Jahres).
var FARBHEX={"sandgrau":"#b9ae9c","butterlemongelb":"#f2e08a","matcha-grün":"#a8c18b","helllila":"#c9b8e3","orange":"#ee8a3a","weiß":"#f3f2ee","blaugrau":"#7f93a6","altrosa":"#d4a1a6","schwarz":"#222428","dunkelgrün":"#2f5a45","betongrau":"#8c8e90","hellrosa":"#f5d0d8","pink":"#e8579a","dunkelrot":"#7a1f26"};
var BERICHT_FARBE={w:"#2f3338",q:"#2f5d8a",j:"#a8571a"};
var KURZ_MON=["Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"];

function zustand(){var f=DriveApp.getFilesByName(STATE_NAME);return f.hasNext()?JSON.parse(f.next().getBlob().getDataAsString()):null;}
function p2(n){return ("0"+n).slice(-2);}
function tagKey(ms){return fmt(new Date(ms),"yyyy-MM-dd");}
function utcMs(k){var p=k.split("-");return Date.UTC(+p[0],+p[1]-1,+p[2]);}
function keyUtc(u){var d=new Date(u);return d.getUTCFullYear()+"-"+p2(d.getUTCMonth()+1)+"-"+p2(d.getUTCDate());}
function addTage(k,n){return keyUtc(utcMs(k)+n*864e5);}
function wtag(k){return (new Date(utcMs(k)).getUTCDay()+6)%7;}
function montagVon(k){return addTage(k,-wtag(k));}
function isoKw(k){var d=new Date(utcMs(k)),n=d.getUTCDay()||7;d.setUTCDate(d.getUTCDate()+4-n);return Math.ceil(((d-Date.UTC(d.getUTCFullYear(),0,1))/864e5+1)/7);}
function datKurz(k){var p=k.split("-");return p[2]+"."+p[1]+".";}
function datLang(k){var p=k.split("-");return (+p[2])+". "+MONATE[+p[1]-1];}
function zahl(n){return String(Math.round(n*10)/10).replace(".",",");}

function qStart(y,q){if(q>3){y++;q-=4;}if(q<0){y--;q+=4;}return y+"-"+p2(q*3+1)+"-01";}
function qEnde(y,q){return addTage(qStart(y,q+1),-1);}
function periode(art,heute,laufend){ // laufend=true: Zwischenstand der aktuellen Periode, sonst die zuletzt abgeschlossene
  var y=+heute.slice(0,4),m=+heute.slice(5,7),von,bis,vv,vb;
  if(art==="w"){var mo=montagVon(heute);von=laufend?mo:addTage(mo,-7);bis=addTage(von,6);vv=addTage(von,-7);vb=addTage(von,-1);}
  else if(art==="q"){var q=Math.floor((m-1)/3)-(laufend?0:1),yy=y;if(q<0){q+=4;yy--;}von=qStart(yy,q);bis=qEnde(yy,q);vv=qStart(yy,q-1);vb=qEnde(yy,q-1);}
  else{var j=laufend?y:y-1;von=j+"-01-01";bis=j+"-12-31";vv=(j-1)+"-01-01";vb=(j-1)+"-12-31";}
  return {art:art,von:von,bis:bis,vor:{von:vv,bis:vb},laufend:!!laufend};
}
function tageListe(von,bis){var o=[],k=von;while(k<=bis&&o.length<400){o.push(k);k=addTage(k,1);}return o;}

function ereignisse(st){
  var m={};
  (function lv(l){(l||[]).forEach(function(x){if(x.kids&&x.kids.length)lv(x.kids);else if(x.done&&x.doneAt&&!x.perm)m[x.id]={id:x.id,at:x.doneAt,v:0};});})(st.items);
  (st.log||[]).forEach(function(l){if(!l.at)return;m[l.id]=l.vases?{id:l.id,at:l.at,v:l.vases,m:l.m||"",c:l.c||""}:{id:l.id,at:l.at,v:0};});
  (st.prints||[]).forEach(function(p){if(p.done&&p.doneAt)m[p.id]={id:p.id,at:p.doneAt,v:p.q||1,m:p.m||"",c:p.c||""};});
  return Object.keys(m).map(function(k){var e=m[k];e.d=tagKey(e.at);return e;});
}
function offenZaehlen(st){var n=0;(function lv(l){(l||[]).forEach(function(x){if(x.kids&&x.kids.length)lv(x.kids);else if(!x.done&&!x.perm)n++;});})(st.items);return n;}

function auswerten(ev,dl,p,heute){
  var tage=tageListe(p.von,p.bis),pt={},pv={},mod={},farb={},todos=0,vasen=0;
  ev.forEach(function(e){
    if(e.d<p.von||e.d>p.bis)return;
    if(e.v){vasen+=e.v;pv[e.d]=(pv[e.d]||0)+e.v;if(e.m)mod[e.m]=(mod[e.m]||0)+e.v;if(e.c)farb[e.c]=(farb[e.c]||0)+e.v;}
    else{todos++;pt[e.d]=(pt[e.d]||0)+1;}
  });
  var best=null;tage.forEach(function(k){if(pt[k]&&(!best||pt[k]>best.n))best={k:k,n:pt[k]};});
  var aktiv=tage.filter(function(k){return pt[k];}).length;
  var dtage=(dl||[]).filter(function(l){return !l.off&&l.d>=p.von&&l.d<=p.bis;}).length;
  var bisHeute=tage.filter(function(k){return k<=heute;}).length;
  return {p:p,tage:tage,pt:pt,pv:pv,todos:todos,vasen:vasen,mod:mod,farb:farb,best:best,aktiv:aktiv,dtage:dtage,dmax:bisHeute};
}
function sortiert(o){return Object.keys(o).map(function(k){return [k,o[k]];}).sort(function(a,b){return b[1]-a[1]||(a[0]<b[0]?-1:1);});}
function summe(pr,von,bis){var s=0;for(var k in pr)if(k>=von&&k<=bis)s+=pr[k];return s;}

function delta(jetzt,vorher,vorName){
  var d=jetzt-vorher;
  if(!vorher&&!jetzt)return '<span style="color:#7d8288">wie '+vorName+'</span>';
  if(!vorher)return '<span style="color:#2e8b57">neu gegenüber '+vorName+'</span>';
  if(!d)return '<span style="color:#7d8288">wie '+vorName+'</span>';
  var pr=Math.round(100*Math.abs(d)/vorher);
  return d>0?'<span style="color:#2e8b57">▲ '+d+' ('+pr+' %) zu '+vorName+'</span>':'<span style="color:#c9453f">▼ '+(-d)+' ('+pr+' %) zu '+vorName+'</span>';
}
function kpi(zahlTxt,titel,unter,farbe){
  return '<td width="33%" valign="top" style="padding:0 4px"><div style="background:#f5f4f1;border-radius:10px;padding:12px 8px;text-align:center">'
   +'<div style="font-size:30px;font-weight:bold;color:'+farbe+';line-height:1.1">'+zahlTxt+'</div>'
   +'<div style="font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#5c6168;margin-top:4px">'+titel+'</div>'
   +'<div style="font-size:12px;margin-top:6px;line-height:1.3">'+unter+'</div></div></td>';
}
function balken(werte,labels,farbe){
  var mx=Math.max.apply(null,werte.concat([1])),n=werte.length,z1='',z2='';
  werte.forEach(function(w,i){
    var h=w?Math.max(4,Math.round(64*w/mx)):2;
    z1+='<td valign="bottom" align="center" style="height:84px;padding:0 '+(n>8?1:3)+'px"><div style="font-size:12px;color:#5c6168;margin-bottom:2px">'+(w||"")+'</div><div style="height:'+h+'px;background:'+(w?farbe:"#dedbd5")+';border-radius:3px 3px 0 0"></div></td>';
    z2+='<td align="center" style="font-size:'+(n>8?10:12)+'px;color:#7d8288;padding-top:4px">'+esc(labels[i])+'</td>';
  });
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="table-layout:fixed"><tr>'+z1+'</tr><tr>'+z2+'</tr></table>';
}
function zeilenBalken(liste,farbeFn,gesamt){
  return liste.map(function(x){
    var pr=Math.max(4,Math.round(100*x[1]/gesamt));
    return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:7px"><tr>'
     +'<td style="font-size:15px;padding-bottom:2px">'+farbeFn(x[0])+esc(x[0])+'</td><td align="right" style="font-size:15px;font-weight:bold;padding-bottom:2px">'+x[1]+'</td></tr>'
     +'<tr><td colspan="2"><div style="background:#ebe9e4;border-radius:4px"><div style="width:'+pr+'%;height:7px;background:#e0a46a;border-radius:4px"></div></div></td></tr></table>';
  }).join("");
}
function punkt(c){return '<span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:'+(FARBHEX[c]||"#888")+';border:1px solid #bdb9b1;margin-right:7px;vertical-align:-1px"></span>';}

function wochenListe(p){ // Montage, die den Zeitraum berühren
  var o=[],k=montagVon(p.von);while(k<=p.bis&&o.length<60){o.push(k);k=addTage(k,7);}return o;
}

function berichtBauen(st,p,heute){
  var ev=ereignisse(st),dl=st.dlog||[],a=auswerten(ev,dl,p,heute),v=auswerten(ev,dl,p.vor,heute);
  var vorName={w:"Vorwoche",q:"Vorquartal",j:"Vorjahr"}[p.art],vorIm={w:"in der Vorwoche",q:"im Vorquartal",j:"im Vorjahr"}[p.art],farbe=BERICHT_FARBE[p.art];
  var jahr=+p.von.slice(0,4),zwischen=p.laufend&&heute<p.bis,titel,sub,betreff;
  if(p.art==="w"){titel="Wochenbericht";sub="KW "+isoKw(p.von)+" · "+datLang(p.von)+" bis "+datLang(p.bis)+" "+p.bis.slice(0,4);betreff="Wochenbericht KW "+isoKw(p.von)+" · "+datKurz(p.von)+"–"+datKurz(p.bis)+p.bis.slice(0,4);}
  else if(p.art==="q"){var qn=Math.floor((+p.von.slice(5,7)-1)/3)+1;titel="Quartalsbericht";sub="Q"+qn+" "+jahr+" · "+datLang(p.von)+" bis "+datLang(p.bis);betreff="Quartalsbericht Q"+qn+" "+jahr;}
  else{titel="Jahresbericht";sub=String(jahr);betreff="Jahresbericht "+jahr;}
  if(zwischen){sub+=" · Zwischenstand bis "+datLang(heute);betreff="[Zwischenstand] "+betreff;}
  var kopf='<div style="font-size:15px;opacity:.85">'+esc(sub)+'</div><div style="font-size:26px;font-weight:bold;margin-top:2px">'+titel+'</div>';

  // Fazit
  var fazit;
  if(!a.todos&&!a.vasen)fazit="In diesem Zeitraum wurde nichts abgehakt.";
  else{
    fazit=a.todos+(a.todos===1?" Todo":" Todos")+" erledigt";
    if(a.vasen)fazit+=" und "+a.vasen+(a.vasen===1?" Vase":" Vasen")+" gedruckt";
    fazit+=". ";
    if(v.todos&&!zwischen){var pr=Math.round(100*(a.todos-v.todos)/v.todos);fazit+=pr>0?"Das sind "+pr+" % mehr als "+vorIm+".":(pr<0?"Das sind "+(-pr)+" % weniger als "+vorIm+".":"Genau so viel wie "+vorIm+".");}
    if(a.best&&a.todos>2)fazit+=" Stärkster Tag: "+TAGE[(wtag(a.best.k)+1)%7]+", "+datLang(a.best.k)+" mit "+a.best.n+".";
  }
  var inh='<div style="background:#eef2f6;border-radius:8px;padding:12px;margin-top:16px;font-size:16px;line-height:1.45">'+esc(fazit)+'</div>';

  // Kennzahlen
  var ds=st.dstreak||{},gestern=addTage(heute,-1),streak=(ds.last&&ds.last>=gestern)?(ds.n||0):0,bestS=Math.max(ds.best||0,ds.n||0);
  inh+='<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px"><tr>'
    +kpi(a.todos,"Erledigt",zwischen?'<span style="color:#7d8288">läuft noch</span>':delta(a.todos,v.todos,vorName),farbe)
    +kpi(a.vasen,"Gedruckt",zwischen?'<span style="color:#7d8288">Vasen &amp; Anhänger</span>':delta(a.vasen,v.vasen,vorName),farbe)
    +kpi(a.dtage+'<span style="font-size:16px;color:#7d8288">/'+a.dmax+'</span>',"Daily-Tage",'<span style="color:#5c6168">alle täglichen Todos</span>',farbe)
    +'</tr></table>';

  // Verlauf
  var werte=[],labels=[],verlaufTitel;
  if(p.art==="w"){verlaufTitel="Erledigte Todos pro Tag";a.tage.forEach(function(k){werte.push(a.pt[k]||0);labels.push(TAGE_K[(wtag(k)+1)%7]);});}
  else if(p.art==="q"){verlaufTitel="Erledigte Todos pro Kalenderwoche";wochenListe(p).forEach(function(mo){werte.push(summe(a.pt,mo<p.von?p.von:mo,addTage(mo,6)>p.bis?p.bis:addTage(mo,6)));labels.push(isoKw(mo));});}
  else{verlaufTitel="Erledigte Todos pro Monat";for(var mi=1;mi<=12;mi++){var pf=jahr+"-"+p2(mi);werte.push(summe(a.pt,pf+"-01",pf+"-31"));labels.push(KURZ_MON[mi-1]);}}
  inh+=block(verlaufTitel,farbe,balken(werte,labels,"#e0a46a"));
  if(a.todos)inh+='<div style="font-size:14px;color:#5c6168;margin-top:8px">An '+a.aktiv+' von '+a.dmax+' Tagen etwas erledigt · Ø '+zahl(a.todos/Math.max(1,a.aktiv))+' pro aktivem Tag</div>';

  // Quartals-/Jahresdetails
  if(p.art==="q"){
    var mt=[];for(var i=0;i<3;i++){var mk=+p.von.slice(5,7)+i,pf2=jahr+"-"+p2(mk);mt.push([MONATE[mk-1],summe(a.pt,pf2+"-01",pf2+"-31"),summe(a.pv,pf2+"-01",pf2+"-31")]);}
    inh+=block("Monate",farbe,'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:16px">'
      +'<tr style="color:#7d8288;font-size:12px;text-transform:uppercase"><td></td><td align="right">Todos</td><td align="right">Vasen</td></tr>'
      +mt.map(function(r){return '<tr><td style="padding:5px 0;border-top:1px solid #ebe9e4">'+r[0]+'</td><td align="right" style="border-top:1px solid #ebe9e4;font-weight:bold">'+r[1]+'</td><td align="right" style="border-top:1px solid #ebe9e4">'+r[2]+'</td></tr>';}).join("")+'</table>');
  }
  if(p.art==="j"){
    var qt=[];for(var q2=0;q2<4;q2++){var qa=qStart(jahr,q2),qb=qEnde(jahr,q2);qt.push(["Q"+(q2+1),summe(a.pt,qa,qb),summe(a.pv,qa,qb)]);}
    inh+=block("Quartale",farbe,'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:16px">'
      +'<tr style="color:#7d8288;font-size:12px;text-transform:uppercase"><td></td><td align="right">Todos</td><td align="right">Vasen</td></tr>'
      +qt.map(function(r){return '<tr><td style="padding:5px 0;border-top:1px solid #ebe9e4">'+r[0]+'</td><td align="right" style="border-top:1px solid #ebe9e4;font-weight:bold">'+r[1]+'</td><td align="right" style="border-top:1px solid #ebe9e4">'+r[2]+'</td></tr>';}).join("")+'</table>');
  }
  if(p.art!=="w"&&a.todos){
    var bw=null;wochenListe(p).forEach(function(mo){var n=summe(a.pt,mo<p.von?p.von:mo,addTage(mo,6)>p.bis?p.bis:addTage(mo,6));if(!bw||n>bw.n)bw={mo:mo,n:n};});
    if(bw&&bw.n)inh+='<div style="font-size:15px;margin-top:10px">Stärkste Woche: <b>KW '+isoKw(bw.mo)+'</b> ('+datKurz(bw.mo)+'–'+datKurz(addTage(bw.mo,6))+') mit '+bw.n+' Todos.</div>';
    if(a.best)inh+='<div style="font-size:15px;margin-top:4px">Stärkster Tag: <b>'+datLang(a.best.k)+'</b> mit '+a.best.n+' Todos.</div>';
  }

  // Vasen
  if(a.vasen){
    var mods=sortiert(a.mod),fb=sortiert(a.farb),teil='';
    if(mods.length)teil+=zeilenBalken(mods.slice(0,6),function(){return "";},mods[0][1]);
    if(fb.length)teil+='<div style="margin-top:10px;font-size:15px;line-height:1.9">'+fb.slice(0,6).map(function(f){return '<span style="white-space:nowrap;margin-right:12px">'+punkt(f[0])+esc(f[0])+' <b>'+f[1]+'</b></span>';}).join(" ")+'</div>';
    inh+=block("Aesterior-Druck",farbe,teil||leer("Keine Details zu Modellen gespeichert."));
  }

  // Daily
  inh+=block("Tägliche Todos",farbe,'<div style="font-size:16px;line-height:1.5">An <b>'+a.dtage+' von '+a.dmax+'</b> Tagen war alles Tägliche erledigt.<br>Streak aktuell: <b>'+streak+'</b> '+(streak===1?'Tag':'Tage')+' · Bestwert: <b>'+bestS+'</b></div>');

  // Ausblick nur im Wochenbericht
  var text=[titel+" – "+sub,"",fazit];
  if(p.art==="w"){
    var s=snapshot(),offen=offenZaehlen(st),dringend=(s.urgent||[]).length,probs=(s.problems||[]).length;
    var fr=(s.due||[]).filter(function(d){var k=tagKey(new Date(d.due).getTime());return k>=heute&&k<=addTage(heute,13);}).sort(function(x,y){return x.due<y.due?-1:1;}).slice(0,6);
    var ausb='<div style="font-size:16px;line-height:1.5">Offen: <b>'+offen+'</b> '+(offen===1?'Station':'Stationen')+' · davon <b style="color:#c9453f">'+dringend+'</b> in dringenden Wegen'+(probs?' · <b style="color:#9a7600">'+probs+'</b> Problem'+(probs===1?'':'e'):'')+'</div>';
    if(fr.length)ausb+='<div style="margin-top:10px">'+fr.map(function(d){return karte("#3f78b3",'<div style="font-size:13px;color:#7a7f85">'+esc(kurzDatum(new Date(d.due)))+'</div><div style="font-weight:bold">'+esc(d.n)+'</div>');}).join("")+'</div>';
    else ausb+='<div style="margin-top:8px;color:#7a7f85;font-size:15px">Keine Fristen in den nächsten 14 Tagen.</div>';
    inh+=block("Offen &amp; Fristen (Stand letzter Sync)",farbe,ausb);
    text.push("","Offen: "+offen+(offen===1?" Station, ":" Stationen, ")+dringend+" in dringenden Wegen.");
  }
  text.push("","Todos erledigt: "+a.todos,"Vasen gedruckt: "+a.vasen,"Daily-Tage: "+a.dtage+"/"+a.dmax);
  return {betreff:betreff,html:huelle(farbe,kopf,inh,'Auswertung nach dem zuletzt synchronisierten Stand der App.'),text:text.join("\n")};
}

function berichtSenden(st,p,heute){
  var b=berichtBauen(st,p,heute);
  MailApp.sendEmail({to:Session.getEffectiveUser().getEmail(),subject:b.betreff,body:b.text,htmlBody:b.html,name:"Weg"});
}

function berichte(){ // täglich: verschickt fällige Berichte genau einmal
  var st=zustand();if(!st)return;
  var heute=tagKey(Date.now()),P=PropertiesService.getScriptProperties();
  [["w",3],["q",7],["j",7]].forEach(function(a){
    var p=periode(a[0],heute,false),key="bericht-"+a[0]+"-"+p.von;
    if(P.getProperty(key)||heute>addTage(p.bis,a[1]))return;
    berichtSenden(st,p,heute);P.setProperty(key,"1");
  });
}

function berichteTest(){ // schickt drei Vorschau-Mails mit dem Zwischenstand der laufenden Woche, des Quartals und des Jahres
  var st=zustand();if(!st){Logger.log("Noch kein Stand gefunden – erst in der App Server-Sync nutzen.");return;}
  var heute=tagKey(Date.now());
  ["w","q","j"].forEach(function(art){berichtSenden(st,periode(art,heute,true),heute);});
}

var SCHLUESSEL="HIER-LANGEN-ZUFALLSTEXT-EINTRAGEN";
var STATE_NAME="weg-state.json";

function antwort(o){return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);}

function schreiben(name,text){
  var f=DriveApp.getFilesByName(name),gefunden=false;
  while(f.hasNext()){f.next().setContent(text);gefunden=true;}
  if(!gefunden)DriveApp.createFile(name,text,"application/json");
}

function termineHeute(){
  return CalendarApp.getDefaultCalendar().getEventsForDay(new Date()).map(function(e){
    return {z:e.isAllDayEvent()?"ganztägig":fmt(e.getStartTime(),"HH:mm"),t:e.getTitle()};
  });
}

function doGet(){return antwort({ok:true,msg:"Weg-Schnittstelle läuft."});}

function doPost(e){
  var lock=null;
  try{
    var q=JSON.parse(e.postData.contents);
    if(SCHLUESSEL.indexOf("HIER-")===0||SCHLUESSEL.length<16||q.key!==SCHLUESSEL)return antwort({ok:false,err:"Schlüssel falsch"});
    if(q.action==="get"){
      var f=DriveApp.getFilesByName(STATE_NAME);
      return antwort({ok:true,state:f.hasNext()?JSON.parse(f.next().getBlob().getDataAsString()):null,ev:termineHeute()});
    }
    if(q.action==="cal")return antwort({ok:true,ev:termineHeute()});
    if(q.action==="put"){
      if(!q.state||!Array.isArray(q.state.items))return antwort({ok:false,err:"Ungültige Daten"});
      try{lock=LockService.getScriptLock();lock.waitLock(10000);}catch(x){lock=null;}
      schreiben(STATE_NAME,JSON.stringify(q.state));
      if(q.snap)schreiben("weg-snapshot.json",JSON.stringify(q.snap));
      return antwort({ok:true});
    }
    return antwort({ok:false,err:"Unbekannte Aktion"});
  }catch(err){
    return antwort({ok:false,err:String(err&&err.message||err)});
  }finally{
    if(lock){try{lock.releaseLock();}catch(x){}}
  }
}

// Optional: schreibt einen Link ins Protokoll, der die Verbindung am Handy automatisch einrichtet.
// Prüfe, dass die Adresse im Link auf /exec endet (nicht auf /dev).
function einrichtungsLink(){
  Logger.log(APP_URL+"#u="+encodeURIComponent(ScriptApp.getService().getUrl())+"&k="+encodeURIComponent(SCHLUESSEL));
}
