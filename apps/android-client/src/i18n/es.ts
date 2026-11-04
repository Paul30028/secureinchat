import type { Messages } from "./index";

/**
 * 西班牙语（中性拉美）词条。必须与 zh.ts 键集合完全一致（测试保证）。
 * 语气：平实、准确，不夸大安全效果。
 */
export const messages: Messages = {
  "deviceSafety.back": "Atrás",
  "deviceSafety.backAria": "Atrás",

  "deviceSafety.home.title": "Seguridad del dispositivo",
  "deviceSafety.home.intro":
    "Cuando alguien te quita, revisa o retiene el teléfono, el cifrado no protege lo que ya está en él. Lo más seguro es que esa información no esté en el teléfono desde el principio.",
  "deviceSafety.home.travelTitle": "Cruzar la frontera sin nada",
  "deviceSafety.home.travelSubtitle":
    "Antes de un control fronterizo o de una posible revisión, borra por completo los grupos seleccionados de este teléfono",
  "deviceSafety.home.compromisedTitle": "Este teléfono estuvo fuera de mis manos",
  "deviceSafety.home.compromisedSubtitle":
    "Si lo retuvieron, se lo llevaron o te pidieron desbloquearlo: borra todos los datos y vuelve a unirte desde otro equipo",

  "deviceSafety.travel.title": "Cruzar la frontera sin nada",
  "deviceSafety.travel.intro":
    "Los grupos seleccionados se borrarán por completo de este teléfono: el historial de chat, las claves del grupo y la función de administrador se eliminan. No queda ningún registro de qué grupos se borraron.",
  "deviceSafety.travel.outro":
    "Para volver al grupo más adelante, pide a otra persona del grupo una invitación nueva. El historial anterior no se recupera. Si exportaste archivos de respaldo, esta app no puede gestionarlos: bórralos tú.",
  "deviceSafety.travel.noGroups": "En este teléfono no hay grupos.",
  "deviceSafety.travel.selectLegend": "Elige los grupos que quieres borrar",
  "deviceSafety.travel.adminTag": " (eres administrador)",
  "deviceSafety.travel.adminWarning":
    "Eres administrador de {groups}. Al borrarlos, también se elimina tu función de administrador en este teléfono. Asegúrate de tener el código de recuperación de administrador guardado en otro lugar (no en este teléfono); de lo contrario, no podrás publicar avisos en este grupo.",
  "deviceSafety.travel.purgeButton": "Borrar {count} grupos seleccionados",
  "deviceSafety.travel.purging": "Borrando…",
  "deviceSafety.travel.error": "No se pudo completar el borrado. Inténtalo de nuevo.",
  "deviceSafety.travel.doneTitle": "Se borraron {count} grupos",
  "deviceSafety.travel.doneHint": "Cuando vuelvas, pide a otra persona del grupo una invitación nueva.",
  "deviceSafety.travel.doneButton": "Listo",

  "deviceSafety.compromised.title": "Este teléfono estuvo fuera de mis manos",
  "deviceSafety.compromised.intro":
    "Si el teléfono fue retenido, se lo llevaron o te obligaron a desbloquearlo en persona, es posible que hayan copiado los datos o instalado software de vigilancia. Una vez instalado, ya no se puede confiar en nada de lo que se haga en este teléfono.",
  "deviceSafety.compromised.stepsIntro": "Se recomienda hacer lo siguiente:",
  "deviceSafety.compromised.step1":
    "Desde un equipo limpio, avisa al administrador del grupo de que este teléfono quedó comprometido. Pídele que lo quite del grupo y cambie las claves.",
  "deviceSafety.compromised.step2": "Borra todos los datos de este teléfono con el botón de abajo.",
  "deviceSafety.compromised.step3":
    "Evita usar este teléfono para conversaciones sensibles. Si hace falta, restablece el teléfono a la configuración de fábrica.",
  "deviceSafety.compromised.step4":
    "Desde un equipo limpio, pide al administrador que te envíe una invitación nueva para volver al grupo.",
  "deviceSafety.compromised.note":
    "Al borrar se eliminan todos los grupos, el historial de chat, las claves del grupo, la función de administrador y la clave maestra del dispositivo. No se puede deshacer. Administradores: asegúrense de tener el código de recuperación guardado en otro lugar.",
  "deviceSafety.compromised.confirmLabel": "Escribe «{word}» para confirmar",
  "deviceSafety.compromised.confirmWord": "BORRAR",
  "deviceSafety.compromised.wipeButton": "Borrar todos los datos de este teléfono",
  "deviceSafety.compromised.wiping": "Borrando…",
  "deviceSafety.compromised.error":
    "No se pudo completar el borrado. Inténtalo de nuevo; si sigue fallando, borra los datos de esta aplicación en los ajustes del sistema.",
};
