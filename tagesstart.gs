// Tagesstart um ca. 07:00 und Fristen-Erinnerungen per Mail (Gmail-Benachrichtigung aufs Handy).
var STAEDTE=[["Darmstadt",49.8728,8.6512],["Frankfurt",50.1109,8.6821]];

function setup(){ // einmal ausführen (auch nach jedem Update dieses Skripts)
  ScriptApp.getProjectTriggers().forEach(function(t){ScriptApp.deleteTrigger(t);});
  ScriptApp.newTrigger("tagesstart").timeBased().everyDays(1).atHour(7).nearMinute(0).inTimezone("Europe/Berlin").create();
  ScriptApp.newTrigger("fristen").timeBased().everyMinutes(15).create();
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

function tagesstart(){
  var ev=CalendarApp.getDefaultCalendar().getEventsForDay(new Date()).map(function(e){
    return (e.isAllDayEvent()?"ganztägig":Utilities.formatDate(e.getStartTime(),"Europe/Berlin","HH:mm"))+" "+e.getTitle();
  });
  var s=snapshot(),dringend=s.urgent||[],probs=s.problems||[];
  var zeilen=[wetter(),"","Dringende Todos:"].concat(dringend.length?dringend:["keine"],["","Termine heute:"],ev.length?ev:["keine"]);
  if(probs.length)zeilen=zeilen.concat(["","Offene Probleme:"],probs);
  MailApp.sendEmail(Session.getEffectiveUser().getEmail(),"Tagesstart",zeilen.join("\n"));
}

// Läuft alle 15 Minuten: Mail 24 Stunden und 1 Stunde vor Fristablauf, solange das Todo offen ist.
function fristen(){
  var s=snapshot(),P=PropertiesService.getScriptProperties(),jetzt=Date.now(),me=Session.getEffectiveUser().getEmail();
  function senden(d,wann){
    MailApp.sendEmail(me,"Fällig "+wann+": "+d.t,d.t+"\nFällig: "+Utilities.formatDate(new Date(d.due),"Europe/Berlin","dd.MM.yyyy HH:mm")+"\n\nDiese Erinnerung kommt nur, solange das Todo beim letzten Sync noch offen war.");
  }
  (s.due||[]).forEach(function(d){
    var rest=new Date(d.due).getTime()-jetzt;if(!(rest>0))return;
    var k=d.id+"|"+d.due;
    if(rest<=36e5){ if(!P.getProperty(k+"|1h")){senden(d,"in 1 Stunde");P.setProperty(k+"|1h","1");P.setProperty(k+"|24h","1");} }
    else if(rest<=864e5){ if(!P.getProperty(k+"|24h")){senden(d,"in 24 Stunden");P.setProperty(k+"|24h","1");} }
  });
}
