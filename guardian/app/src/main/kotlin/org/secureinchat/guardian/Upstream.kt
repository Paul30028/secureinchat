// SPDX-License-Identifier: GPL-3.0-or-later
package org.secureinchat.guardian

import android.content.Context
import android.net.ConnectivityManager
import android.net.LinkProperties
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetAddress
import java.util.concurrent.ConcurrentHashMap

class Upstream(
    context: Context,
    private val protect: (DatagramSocket) -> Boolean
) {
    private val cm = context.applicationContext
        .getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager

    private val networkServers = ConcurrentHashMap<Network, List<InetAddress>>()
    @Volatile private var started = false

    private val callback = object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) { refresh(network) }
        override fun onLinkPropertiesChanged(network: Network, lp: LinkProperties) { refresh(network) }
        override fun onLost(network: Network) { networkServers.remove(network) }
    }

    fun start() {
        if (started) return
        started = true
        try {
            val req = NetworkRequest.Builder()
                .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                .addCapability(NetworkCapabilities.NET_CAPABILITY_NOT_VPN)
                .build()
            cm.registerNetworkCallback(req, callback)
        } catch (_: Throwable) {
            started = false
        }
    }

    fun stop() {
        if (!started) return
        started = false
        try { cm.unregisterNetworkCallback(callback) } catch (_: Throwable) {}
        networkServers.clear()
    }

    fun dnsServers(): List<InetAddress> {
        val out = LinkedHashSet<InetAddress>()
        for (servers in networkServers.values) out.addAll(servers)
        return out.toList()
    }

    fun sendQuery(payload: ByteArray): ByteArray? {
        if (networkServers.isEmpty()) return null
        for (server in dnsServers()) {
            val r = queryOne(server, payload) ?: continue
            return r
        }
        return null
    }

    private fun refresh(network: Network) {
        try {
            val lp: LinkProperties = cm.getLinkProperties(network) ?: return
            val list = lp.dnsServers ?: emptyList()
            if (list.isEmpty()) networkServers.remove(network)
            else networkServers[network] = ArrayList(list)
        } catch (_: Throwable) {}
    }

    private fun queryOne(server: InetAddress, payload: ByteArray): ByteArray? {
        var sock: DatagramSocket? = null
        try {
            sock = DatagramSocket()
            if (!protect(sock)) return null
            sock.soTimeout = 4000
            sock.send(DatagramPacket(payload, payload.size, server, 53))
            val buf = ByteArray(4096)
            val recv = DatagramPacket(buf, buf.size)
            sock.receive(recv)
            return buf.copyOf(recv.length)
        } catch (_: Throwable) {
            return null
        } finally {
            try { sock?.close() } catch (_: Throwable) {}
        }
    }
}
