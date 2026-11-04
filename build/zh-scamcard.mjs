// M3 (Chinese): printable scam warning card for parents, mainland China reporting lines.
// Every line on the card comes from an official public-security or government page, checked 2026-11-04 (links below).
// General anti-fraud only: no VPN, no IP test, nothing about getting around network controls (CLAUDE.md rule 5).
export const ZH_SCAM_CARD = {
  path: '/zh/scam-warning-card/',
  title: '给爸妈的防骗卡（可打印）',
  desc: '一张可以打印、放在电话旁边的防骗卡：公安机关提倡的“三不一多”、冒充公检法的识别要点、转账前先挂断核实，以及中国大陆的 110、96110、12381。用浏览器打印，不上传、不保存任何内容。',
  date: '2026-11-04',
  body: `
    <h1>给爸妈的防骗卡（可打印）</h1>
    <p class="meta">Paul · 2026-11-04</p>
    <p class="lead">很多诈骗电话和短信的套路是一样的。这一页把公安机关公开发布的防骗要点做成一张卡，打印出来，手写上你的名字和电话，放在电话旁边或钱包里。卡上每一句都来自官方页面，链接在下面，2026 年 11 月 4 日逐页核对。我们和文中提到的机构没有任何关系。</p>
    <p><strong>怎么打印：</strong>用浏览器的“打印”（Ctrl+P，Mac 上是 ⌘P）。打印这一页时只会打印卡片。想要 PDF，就在打印机里选“另存为 PDF”。PDF 由你自己的浏览器生成，本页不上传、不保存、不发送任何内容；卡上的两条空行是打印后用笔填写的。</p>

    <h2>防骗卡</h2>
    <div class="print-card" aria-label="防骗卡">
      <h3>先挂断，再核实</h3>
      <p class="print-card-sub">牢记“三不一多”：</p>
      <ol>
        <li><strong>未知链接不点击</strong></li>
        <li><strong>陌生来电不轻信</strong></li>
        <li><strong>个人信息不透露</strong></li>
        <li><strong>转账汇款多核实</strong></li>
      </ol>
      <h3>记住</h3>
      <ul>
        <li>公安机关不会通过电话、微信、视频办案，更不会要求你转账汇款。</li>
        <li>公检法机关没有所谓的“安全账户”。</li>
        <li>对方要你打开“屏幕共享”，或者要你保密——不要照做，马上挂断。</li>
      </ul>
      <h3>转账之前</h3>
      <ul>
        <li>先挂断。用<strong>你自己知道</strong>的号码打回去：家人本人的手机、本地派出所。</li>
        <li>先告诉一个你信任的人，哪怕对方说要保密。</li>
      </ul>
      <p class="print-card-fill">先打给：______________________________</p>
      <p class="print-card-fill">电话：______________________________</p>
      <h3>求助与报警（中国大陆）</h3>
      <ul>
        <li>已经转账或被骗：保留聊天和转账记录，立即拨打 110，或到就近的派出所报警。</li>
        <li>96110 是官方反诈预警劝阻专线。接到它的来电请接听，听民警劝阻；拿不准时也可以打这个号码咨询。</li>
        <li>12381 发来的是官方涉诈预警短信。</li>
      </ul>
      <p class="print-card-foot">来源：各地公安机关和中国驻外使馆网站公开发布的防骗提示。secureinchat.com</p>
    </div>

    <h2>每一句的出处</h2>
    <ul>
      <li><strong>“三不一多”：</strong><a href="https://my.china-embassy.gov.cn/zt/fanzhafangpian/202205/t20220526_10692860.htm" rel="noopener">中国驻马来西亚大使馆：全民用起来！五大反诈利器</a>（2022-05-26）原文是“未知链接不点击、陌生来电不轻信、个人信息不透露、转账汇款多核实”。同一页还说明了 96110 专线和 12381 预警短信。</li>
      <li><strong>没有“安全账户”、被骗后拨打 110：</strong><a href="https://gat.fujian.gov.cn/ztzl/fjjffpzxrx/spjq/202309/t20230913_6255863.htm" rel="noopener">福建省公安厅：别再被“假警察”骗了！这些都是冒充公检法的套路！</a>（2023-09-13）写明公检法机关不存在所谓的“安全账户”，通过电话、QQ、微信、网络“办案”的都是诈骗；被骗后“保留证据及时拨打110或到就近的派出所报警”。</li>
      <li><strong>公安不通过电话、微信、视频办案，屏幕共享和保密要求：</strong><a href="https://gat.jiangsu.gov.cn/art/2024/9/27/art_89956_11371763.html" rel="noopener">江苏省公安厅：“公安”来电说你涉嫌洗钱？假的，别信！</a>（2024-09-27）：公安机关不会通过电话、微信、视频等途径办案；骗子让受害人开启屏幕共享以远程操作手机转走钱款；不要按对方要求“保密”；核实可以打本地派出所电话。</li>
      <li><strong>96110 和 12381：</strong><a href="https://gaj.wuhan.gov.cn/jmzx/jfts/202506/t20250626_2601161.html" rel="noopener">武汉市公安局：反诈利器再添新成员</a>（2025-06-26）:96110 是反电信网络诈骗专用号码，接到它的来电说明你或家人可能正遭遇诈骗，也可以打它咨询、举报；12381 是涉诈预警劝阻短信系统。<a href="https://www.sz.gov.cn/hdjl/ywzsk/gaj/xz/content/post_10671144.html" rel="noopener">深圳市公安局（深圳市人民政府网站）</a>（2023-06-10）说，接到预警劝阻电话时要耐心听取民警劝阻，立即停止转账。</li>
      <li><strong>“用你自己知道的号码打回去”“先告诉信任的人”：</strong>上面的江苏省公安厅页面建议打本地派出所核实；给家人回电的做法来自美国联邦贸易委员会（FTC）的<a href="https://consumer.ftc.gov/articles/scammers-use-fake-emergencies-steal-your-money" rel="noopener">冒充亲友紧急求助诈骗提示</a>（英文）：用你确认过的号码联系，即使对方要求保密，也要先联系家里其他人。</li>
    </ul>
    <p>这些官方页面还介绍了国家反诈中心 App 等需要安装的工具。这张卡只收录不用安装软件的电话和短信号码。</p>

    <h2>怎么交给爸妈</h2>
    <p>最好和他们一起把卡读一遍，而不是只把卡递过去。在空行上写你自己的名字和电话，让他们知道在转账之前先打给谁。如果他们会用手机看链接，也可以告诉他们我们的<a href="/zh/tools/link-checker/">链接检查器</a>：它只在页面里查看常见的钓鱼迹象，不打开链接。</p>

    <h2>不在中国大陆</h2>
    <p>“三不一多”和“先挂断、再核实”在哪里都适用；卡上的 110、96110、12381 只适用于中国大陆。其他国家或地区请向当地警方报案。我们只收录了能打开官方原文核对的号码。英文版卡片（美国的举报渠道）在<a href="/blog/scam-warning-card-for-parents/" hreflang="en">这里</a>（英文）。</p>

    <h2>没有测试过的</h2>
    <p>我们只在 Chromium 浏览器里测试过本页打印为一张 A4 或 Letter 纸；其他浏览器和打印机未测，可能分成两页。号码和说明按 2026 年 11 月 4 日的官方页面抄录，以后可能变化。</p>
`,
};
