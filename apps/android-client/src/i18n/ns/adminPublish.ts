import type { Messages } from "../index";

// AdminPublishScreen 的三语文案。
// 键统一以 adminPublish. 开头，占位符用 {name}，三种语言保持一致。
// 中文逐字保留原界面文案（现有测试按中文断言）。
// 栏目名与标题占位文案的中文值来自 CATEGORY_META 原文。

export const zh: Messages = {
  "adminPublish.category.notice": "通知",
  "adminPublish.placeholder.notice": "聚会时间、地点变更等事务性通知",
  "adminPublish.back": "返回",
  "adminPublish.backArrow": "← 返回",
  "adminPublish.title": "发布今日内容",
  "adminPublish.subtitle": "发布后会立刻加密发送给群里所有人，覆盖该栏目当天的旧内容。",
  "adminPublish.titlePlaceholder": "公告标题输入框",
  "adminPublish.bodyPlaceholder": "内容",
  "adminPublish.bodyAriaLabel": "公告内容输入框",
  "adminPublish.audioAriaLabel": "选择圣诗音频",
  "adminPublish.audioSelected": "已选择：{name}",
  "adminPublish.audioAdd": "添加音频（可选）",
  "adminPublish.audioEncryptedNote": "音频会和消息一样加密后发送，中继看不到内容",
  "adminPublish.published": "{category} 已发布",
  "adminPublish.publishing": "发布中...",
  "adminPublish.publishTo": "发布到「{category}」",
  "adminPublish.rotateSectionTitle": "移出成员",
  "adminPublish.rotateExplanation":
    "有人离开、或者手机丢失时，更换群密钥并把新邀请码只发给留下的人。之后的消息拿旧密钥的人再也读不到——但他",
  "adminPublish.rotateExplanationStrong": "已经收到的消息还在他手机上",
  "adminPublish.rotateExplanationTail": "，换密钥追不回来。",
  "adminPublish.rotateSuccess": "已更换群密钥。把下面的新邀请码发给留下的成员，他们需要重新加入一次。",
  "adminPublish.rotateButton": "更换群密钥",
  "adminPublish.cancel": "取消",
  "adminPublish.confirmRotate": "确认更换",
  "adminPublish.rotating": "更换中...",
  "adminPublish.rotateFailed": "更换失败，请重试",
  "adminPublish.lockAdmin": "退出管理员模式",
  "adminPublish.lockAdminNote": "说明：管理员入口只是把发布功能隐藏起来，服务端目前不校验发布权限。",
  "adminPublish.category.scripture": "今日经文",
  "adminPublish.category.hymn": "赞美圣诗",
  "adminPublish.category.devotional": "灵修短语",
  "adminPublish.placeholder.scripture": "例如：诗篇 133:1",
  "adminPublish.placeholder.hymn": "诗歌名称，或一段歌词",
  "adminPublish.placeholder.devotional": "今天的一句话默想",
};

export const en: Messages = {
  "adminPublish.category.notice": "Notice",
  "adminPublish.placeholder.notice": "Changes to meeting times or places, and other practical notices",
  "adminPublish.back": "Back",
  "adminPublish.backArrow": "← Back",
  "adminPublish.title": "Publish today's content",
  "adminPublish.subtitle":
    "Once published, it is encrypted and sent to everyone in the group right away, replacing that section's content for the day.",
  "adminPublish.titlePlaceholder": "Announcement title",
  "adminPublish.bodyPlaceholder": "Content",
  "adminPublish.bodyAriaLabel": "Announcement content field",
  "adminPublish.audioAriaLabel": "Choose hymn audio",
  "adminPublish.audioSelected": "Selected: {name}",
  "adminPublish.audioAdd": "Add audio (optional)",
  "adminPublish.audioEncryptedNote": "Audio is encrypted and sent like any message; relays can't see its content",
  "adminPublish.published": "{category} published",
  "adminPublish.publishing": "Publishing…",
  "adminPublish.publishTo": "Publish to \"{category}\"",
  "adminPublish.rotateSectionTitle": "Remove members",
  "adminPublish.rotateExplanation":
    "When someone leaves or a phone is lost, rotate the group key and send the new invite code only to those who remain. Messages sent afterward can no longer be read by anyone with the old key—but messages they",
  "adminPublish.rotateExplanationStrong": "have already received are still on their phone",
  "adminPublish.rotateExplanationTail": " and can't be taken back by rotating keys.",
  "adminPublish.rotateSuccess":
    "Group key changed. Send the new invite code below to the remaining members; they'll need to rejoin once.",
  "adminPublish.rotateButton": "Rotate group key",
  "adminPublish.cancel": "Cancel",
  "adminPublish.confirmRotate": "Confirm change",
  "adminPublish.rotating": "Changing…",
  "adminPublish.rotateFailed": "Change failed. Please try again",
  "adminPublish.lockAdmin": "Exit admin mode",
  "adminPublish.lockAdminNote":
    "Note: the admin entry only hides the publish feature; the server does not currently verify who is allowed to publish.",
  "adminPublish.category.scripture": "Daily Scripture",
  "adminPublish.category.hymn": "Hymn",
  "adminPublish.category.devotional": "Devotional",
  "adminPublish.placeholder.scripture": "Enter scripture title",
  "adminPublish.placeholder.hymn": "Enter hymn title",
  "adminPublish.placeholder.devotional": "Enter devotional title",
};

export const es: Messages = {
  "adminPublish.category.notice": "Aviso",
  "adminPublish.placeholder.notice": "Cambios de hora o lugar de reunión y otros avisos prácticos",
  "adminPublish.back": "Volver",
  "adminPublish.backArrow": "← Volver",
  "adminPublish.title": "Publicar el contenido de hoy",
  "adminPublish.subtitle":
    "Al publicar, se cifra y se envía de inmediato a todo el grupo, reemplazando el contenido de esa sección para el día.",
  "adminPublish.titlePlaceholder": "Título del anuncio",
  "adminPublish.bodyPlaceholder": "Contenido",
  "adminPublish.bodyAriaLabel": "Campo de contenido del anuncio",
  "adminPublish.audioAriaLabel": "Elegir audio del himno",
  "adminPublish.audioSelected": "Seleccionado: {name}",
  "adminPublish.audioAdd": "Agregar audio (opcional)",
  "adminPublish.audioEncryptedNote":
    "El audio se cifra y se envía como cualquier mensaje; los relés no pueden ver su contenido",
  "adminPublish.published": "{category} publicado",
  "adminPublish.publishing": "Publicando…",
  "adminPublish.publishTo": "Publicar en «{category}»",
  "adminPublish.rotateSectionTitle": "Quitar miembros",
  "adminPublish.rotateExplanation":
    "Cuando alguien se va o pierde el teléfono, cambia la clave del grupo y envía el nuevo código de invitación solo a quienes se quedan. Los mensajes posteriores ya no los puede leer quien tenga la clave anterior, pero los mensajes que",
  "adminPublish.rotateExplanationStrong": "ya recibió siguen en su teléfono",
  "adminPublish.rotateExplanationTail": " y cambiar la clave no los recupera.",
  "adminPublish.rotateSuccess":
    "Se cambió la clave del grupo. Envía el nuevo código de invitación de abajo a los miembros que se quedan; deberán unirse de nuevo una vez.",
  "adminPublish.rotateButton": "Cambiar clave del grupo",
  "adminPublish.cancel": "Cancelar",
  "adminPublish.confirmRotate": "Confirmar cambio",
  "adminPublish.rotating": "Cambiando…",
  "adminPublish.rotateFailed": "No se pudo cambiar. Inténtalo de nuevo",
  "adminPublish.lockAdmin": "Salir del modo administrador",
  "adminPublish.lockAdminNote":
    "Nota: la entrada de administrador solo oculta la función de publicar; el servidor actualmente no verifica quién puede publicar.",
  "adminPublish.category.scripture": "Escritura diaria",
  "adminPublish.category.hymn": "Himno",
  "adminPublish.category.devotional": "Devocional",
  "adminPublish.placeholder.scripture": "Escribe el título de la escritura",
  "adminPublish.placeholder.hymn": "Escribe el título del himno",
  "adminPublish.placeholder.devotional": "Escribe el título del devocional",
};
