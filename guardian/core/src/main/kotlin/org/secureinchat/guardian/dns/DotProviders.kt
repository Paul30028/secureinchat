// SPDX-License-Identifier: GPL-3.0-or-later
package org.secureinchat.guardian.dns

/**
 * Encrypted DNS resolvers the user can choose (G18). Off by default: Guardian keeps using the network's
 * own resolver until the user picks one of these.
 *
 * This is the only file allowed to name public resolver addresses (tests/policy_check.py), and only as
 * DNS-over-TLS endpoints: a provider is reached on port 853 with its certificate checked against
 * [tlsName]. Guardian never sends clear-text DNS to a public resolver, and never falls back to one.
 *
 * Sources, checked 2026-11-01:
 *  - Quad9: https://www.quad9.net/service/service-addresses-and-features (dns.quad9.net, malware blocking + DNSSEC)
 *  - Cloudflare: https://developers.cloudflare.com/1.1.1.1/encryption/dns-over-tls/ (one.one.one.one)
 * Mullvad's public DNS was left out: its page announces the service ends on 2026-11-02.
 */
data class DotProvider(
    val id: String,
    val label: String,
    val tlsName: String,
    val addresses: List<String>,
    val about: String,
    val aboutZh: String
)

object DotProviders {
    val ALL: List<DotProvider> = listOf(
        DotProvider(
            id = "quad9",
            label = "Quad9",
            tlsName = "dns.quad9.net",
            addresses = listOf("9.9.9.9", "149.112.112.112", "2620:fe::fe", "2620:fe::9"),
            about = "Swiss non-profit; also blocks known malware domains",
            aboutZh = "瑞士非营利机构;同时拦截已知恶意域名"
        ),
        DotProvider(
            id = "cloudflare",
            label = "Cloudflare",
            tlsName = "one.one.one.one",
            addresses = listOf("1.1.1.1", "1.0.0.1", "2606:4700:4700::1111", "2606:4700:4700::1001"),
            about = "Large commercial resolver; no filtering",
            aboutZh = "大型商业解析服务;不过滤"
        )
    )

    fun byId(id: String?): DotProvider? = ALL.firstOrNull { it.id == id }
}
