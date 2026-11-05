export const THREAT_MODEL_ZH = `    <h1>聊天应用威胁模型</h1>
    <p class="meta">最后更新：2026-11-05</p>
    <p class="lead">SecureInChat 聊天应用旨在保护什么、防范谁，以及它无法隐藏什么。这些应用仍在开发中，尚未经过独立审计，因此本文描述的是设计，而非经过验证的行为。</p>
    <h2>它旨在保护什么</h2>
    <ul>
      <li>消息和文件的内容。密钥保留在设备上，中继只转发它无法解密的加密负载。</li>
      <li>群组名称。在设计上，群组的显示名称只存在于每台设备上，从不发送给中继。</li>
      <li>群组管理员发布的公告。公告带有来自创建者密钥的签名，每个客户端都会拒绝无法验证的公告。</li>
    </ul>
    <h2>群组密钥如何到达成员手中</h2>
    <p>成员之间不进行公钥交换。创建群组时，应用会生成一个随机的群组密钥，并将其放入邀请码（链接或二维码）中。任何持有有效邀请码的人都能加入并读取该群组的消息。请把邀请当作房门钥匙：只在当面或通过你信任的渠道分享。</p>
    <h2>它旨在防范谁</h2>
    <ul>
      <li>入侵中继的人，或强迫其运营者交出数据的人。中继不持有消息内容，其设计不持久存储消息内容。</li>
      <li>监视设备与中继之间网络的人。连接使用 TLS，其中承载的负载又在端到端层面再次加密。</li>
    </ul>
    <h2>中继仍然能看到什么</h2>
    <p>负责路由消息的中继无法避免某些元数据。在当前设计中，它能看到：</p>
    <ul>
      <li>每台设备连接时使用的网络地址。中继仅用它来限制重复的连接尝试，并且只保留加盐哈希而非地址本身；托管服务商以及中继前方的任何网络或隧道（目前为 Cloudflare）仍然可以看到该地址。</li>
      <li>设备何时连接，以及消息何时到达。</li>
      <li>每个负载的大小，这可能暗示其类型。</li>
      <li>路由消息所需的标识符，例如某台设备加入了哪个群组。</li>
    </ul>
    <p>不保留连接历史是一项设计目标。对于一台路由消息的服务器来说，完全消除这些元数据并不现实。</p>
    <h2>它不能防范什么</h2>
    <ul>
      <li>被攻破的手机。恶意软件，或拿着你已解锁设备的人，能读取你所能读取的一切。</li>
      <li>群组内的人。任何收到消息的人都可以复制、截图或转发它。</li>
      <li>泄露的邀请码。任何拿到它的人都能读取该群组，直到管理员更换密钥，并只向应当留下的人发送新邀请。</li>
      <li>日后泄露的密钥。每个群组密钥在更换之前用于每一条消息，因此在此期间没有前向保密：如果密钥泄露，该时间段内录下的消息就可以被解密。</li>
      <li>被移除的成员保留旧消息。移除操作会把群组切换到新密钥，因此之后的消息对他们不可读，但已经送达的消息仍留在他们的设备上。</li>
      <li>丢失管理员密钥。管理员权限属于持有创建者签名密钥的人，因此丢失它需要经过恢复步骤。</li>
    </ul>
    <h2>对比</h2>
    <p>移除成员时更换群组密钥，弱于 Signal 协议或 MLS 所提供的持续密钥棘轮机制。我们不声称具有同等的安全性。</p>
    <h2>构建模块</h2>
    <ul>
      <li>AES-256-GCM，用于对每条消息进行认证加密。</li>
      <li>HKDF-SHA-256，用于从邀请中的群组密钥派生每个密钥周期的加密密钥。</li>
      <li>ECDSA P-256 签名，用于设备登录中继以及管理员公告。</li>
    </ul>
    <p>以上仅列出设计中所用的基础算法。它们不是一种认证。更多细节：<a href="/blog/what-a-blind-relay-can-and-cannot-know/" hreflang="en">盲中继能知道什么、不能知道什么</a>。你可以在浏览器中<a href="/messaging/" hreflang="en">检查实时中继连接</a>。</p>`;

export const THREAT_MODEL_ES = `    <h1>Modelo de amenazas de la app de mensajería</h1>
    <p class="meta">Última actualización: 2026-11-05</p>
    <p class="lead">Qué está diseñada para proteger la app de mensajería de SecureInChat, de quién, y qué no puede ocultar. Las apps están en desarrollo y no han sido auditadas de forma independiente, por lo que esto describe el diseño, no un comportamiento verificado.</p>
    <h2>Qué está diseñada para proteger</h2>
    <ul>
      <li>El contenido de los mensajes y archivos. Las claves permanecen en los dispositivos, y el relay solo reenvía cargas cifradas que no puede descifrar.</li>
      <li>Los nombres de los grupos. En el diseño, el nombre visible de un grupo existe solo en cada dispositivo y nunca se envía al relay.</li>
      <li>Los anuncios del administrador del grupo. Llevan una firma de la clave del creador, y cada cliente rechaza los anuncios que no puede verificar.</li>
    </ul>
    <h2>Cómo llega una clave de grupo a los miembros</h2>
    <p>No hay intercambio de claves públicas entre los miembros. Cuando se crea un grupo, la app genera una clave de grupo aleatoria y la coloca dentro del código de invitación (el enlace o el código QR). Quien tenga un código de invitación válido puede unirse y leer los mensajes del grupo. Trata una invitación como la llave de una casa: compártela solo en persona o por un canal en el que confíes.</p>
    <h2>A quién está diseñada para resistir</h2>
    <ul>
      <li>A alguien que comprometa el relay u obligue a su operador a entregar datos. El relay no tiene el contenido de los mensajes y está diseñado sin almacenamiento persistente del contenido de los mensajes.</li>
      <li>A alguien que vigile la red entre un dispositivo y el relay. Las conexiones usan TLS, y la carga que va dentro se cifra de nuevo de extremo a extremo.</li>
    </ul>
    <h2>Qué puede ver todavía el relay</h2>
    <p>Un relay que enruta mensajes no puede evitar ciertos metadatos. En el diseño actual ve:</p>
    <ul>
      <li>La dirección de red desde la que se conecta cada dispositivo. El relay la usa solo para limitar los intentos de conexión repetidos y guarda un hash con sal en lugar de la dirección misma; el proveedor de alojamiento y cualquier red o túnel delante del relay (actualmente Cloudflare) todavía pueden verla.</li>
      <li>Cuándo se conectan los dispositivos y cuándo llegan los mensajes.</li>
      <li>El tamaño de cada carga, lo que puede dar indicios de su tipo.</li>
      <li>Los identificadores necesarios para enrutar los mensajes, como a qué grupo se une un dispositivo.</li>
    </ul>
    <p>No guardar el historial de conexiones es un objetivo de diseño. Eliminar por completo estos metadatos no es realista para un servidor que enruta mensajes.</p>
    <h2>Contra qué no protege</h2>
    <ul>
      <li>Un teléfono comprometido. El malware, o alguien que tenga tu dispositivo desbloqueado, puede leer lo que tú puedes leer.</li>
      <li>Las personas dentro del grupo. Cualquiera que reciba un mensaje puede copiarlo, tomarle una captura de pantalla o reenviarlo.</li>
      <li>Un código de invitación filtrado. Quien lo obtenga puede leer el grupo hasta que el administrador cambie la clave y envíe una nueva invitación solo a las personas que deben quedarse.</li>
      <li>Una clave que se filtra más adelante. Cada clave de grupo se usa para todos los mensajes hasta que se cambia, así que no hay secreto hacia adelante dentro de ese periodo: si la clave se filtra, los mensajes grabados de ese periodo se pueden descifrar.</li>
      <li>Que los miembros eliminados conserven mensajes antiguos. La eliminación pasa el grupo a nuevas claves, así que los mensajes posteriores no son legibles para ellos, pero los mensajes ya entregados permanecen en su dispositivo.</li>
      <li>Perder la clave de administrador. Los derechos de administrador pertenecen a quien tiene la clave de firma del creador, así que perderla requiere un paso de recuperación.</li>
    </ul>
    <h2>Cómo se compara</h2>
    <p>El cambio de la clave de grupo al eliminar a alguien es más débil que el trinquete continuo de claves que ofrecen el protocolo Signal o MLS. No afirmamos una seguridad equivalente.</p>
    <h2>Piezas de base</h2>
    <ul>
      <li>AES-256-GCM para el cifrado autenticado de cada mensaje.</li>
      <li>HKDF-SHA-256 para derivar de la clave de grupo de la invitación la clave de cifrado de cada periodo de clave.</li>
      <li>Firmas ECDSA P-256 para el inicio de sesión de los dispositivos en el relay y para los anuncios del administrador.</li>
    </ul>
    <p>Estos son los primitivos que se nombran en el diseño. No son una certificación. Más detalles: <a href="/blog/what-a-blind-relay-can-and-cannot-know/" hreflang="en">qué puede y qué no puede saber un relay ciego</a>. Puedes <a href="/messaging/" hreflang="en">comprobar la conexión con el relay en vivo</a> desde tu navegador.</p>`;
